from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import List, Optional
import pandas as pd
import os
import calendar
import unicodedata
from google.cloud import vision
import re
import xml.etree.ElementTree as ET
from pydantic import BaseModel
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.backends import default_backend
import shutil

import hashlib
from datetime import datetime

import pycountry
import gettext
from mrz.checker.td1 import TD1CodeChecker
from mrz.checker.td2 import TD2CodeChecker
from mrz.checker.td3 import TD3CodeChecker

import models, schemas, database, invoices, auth

import time
import threading
import uuid
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

models.Base.metadata.create_all(bind=database.engine)
os.makedirs("certs", exist_ok=True) 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "google-credentials.json"

# =====================================================================
# --- LÓGICA VERIFACTU (HACIENDA) ---
# =====================================================================

def generate_invoice_hash(invoice_data: dict, last_hash: str = "") -> str:
    """
    Genera la Huella Digital (Hash) de la factura según normativa VeriFactu.
    """
    raw_string = f"{invoice_data['nif']}|{invoice_data['number']}|{invoice_data['date']}|{invoice_data['total']:.2f}|{last_hash}"
    return hashlib.sha256(raw_string.encode('utf-8')).hexdigest()

def crear_factura_oficial(booking: models.Booking, db: Session, current_user: models.User):
    """
    FUNCIÓN NÚCLEO: Crea y guarda la factura encadenada en la base de datos.
    """
    existing_invoice = db.query(models.Invoice).filter(
        models.Invoice.booking_id == booking.id,
        models.Invoice.owner_id == current_user.id
    ).first()

    if existing_invoice:
        return existing_invoice

    if booking.group_id:
        group_bookings = db.query(models.Booking).filter(
            models.Booking.group_id == booking.group_id,
            models.Booking.date == booking.date,
            models.Booking.owner_id == current_user.id
        ).all()
        total_amount = sum(b.total_price for b in group_bookings if b.total_price)
    else:
        total_amount = booking.total_price or 0.0

    user_tax = getattr(current_user, 'tax_rate', 10.0)
    divisor = 1 + (user_tax / 100)
    base_amount = round(total_amount / divisor, 2)
    tax_amount = round(total_amount - base_amount, 2)

    now_local = datetime.now() # <-- FORZAMOS HORA LOCAL DE ESPAÑA (Arregla el desfase de 1 hora)

    try:
        last_invoice = db.query(models.Invoice).filter(
            models.Invoice.owner_id == current_user.id
        ).order_by(models.Invoice.id.desc()).first()
        last_hash = last_invoice.current_hash if last_invoice else ""
        
        year = now_local.strftime('%Y')
        count = db.query(models.Invoice).filter(models.Invoice.owner_id == current_user.id).count() + 1
        invoice_number = f"FAC-{year}-{count:04d}"
    except Exception:
        last_hash = ""
        invoice_number = f"FAC-{now_local.strftime('%Y')}-0001"

    invoice_date_str = now_local.strftime("%d-%m-%Y")
    user_nif = current_user.nif or "00000000T"

    invoice_data_for_hash = {
        "nif": user_nif,
        "number": invoice_number,
        "date": invoice_date_str,
        "total": total_amount
    }
    current_hash = generate_invoice_hash(invoice_data_for_hash, last_hash)

    qr_url = (
        f"https://www2.agenciatributaria.gob.es/wlpl/VERIFACTU/Consulta"
        f"?nif={user_nif}&num={invoice_number}&fecha={invoice_date_str}&importe={total_amount:.2f}"
    )

    new_invoice = models.Invoice(
        invoice_number=invoice_number,
        base_amount=base_amount,
        tax_rate=user_tax,
        tax_amount=tax_amount,
        total_amount=total_amount,
        current_hash=current_hash,
        previous_hash=last_hash,
        qr_url=qr_url,
        booking_id=booking.id,
        owner_id=current_user.id,
        created_at=now_local # <-- EVITA QUE SE GUARDE EN HORA UTC
    )
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    
    return new_invoice

@app.post("/api/generate-invoice/{booking_id}")
async def create_verifactu_invoice(
    booking_id: str, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id, 
        models.Booking.owner_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    invoice = crear_factura_oficial(booking, db, current_user)

    return {
        "status": "success",
        "invoice": {
            "number": invoice.invoice_number,
            "date": datetime.now().strftime("%d-%m-%Y"),
            "total": invoice.total_amount,
            "hash": invoice.current_hash,
            "previous_hash": invoice.previous_hash,
            "qr_code_url": invoice.qr_url
        }
    }


# --- UTILIDADES: MAPEO DE PAÍSES AUTOMÁTICO CON PYCOUNTRY ---
try:
    es_lang = gettext.translation('iso3166-1', pycountry.LOCALES_DIR, languages=['es'])
    translate_country = es_lang.gettext
except FileNotFoundError:
    translate_country = lambda x: x

ISO3_A_ES = {}
ES_A_ISO3 = {}

for country in pycountry.countries:
    try:
        nombre_es = translate_country(country.name).upper()
        ISO3_A_ES[country.alpha_3] = nombre_es
        ES_A_ISO3[nombre_es] = country.alpha_3
    except AttributeError:
        pass

ES_A_ISO3["ESTADOS UNIDOS"] = "USA"
ES_A_ISO3["REINO UNIDO"] = "GBR"

ICAO_TO_ISO = {
    "D": "DEU", "D<<": "DEU", 
    "GBD": "GBR", "GBN": "GBR", "GBO": "GBR", "GBP": "GBR", "GBS": "GBR"
}

def obtener_nombre_pais_desde_mrz(icao_code: str) -> str:
    if not icao_code: return "ESPAÑA"
    codigo = icao_code.replace('<', '').strip()
    iso_code = ICAO_TO_ISO.get(codigo, codigo)
    return ISO3_A_ES.get(iso_code, "ESPAÑA")

def obtener_codigo_pais_iso3(nombre_pais: str) -> str:
    if not nombre_pais: return "ESP"
    nombre = nombre_pais.upper().strip()
    if nombre in ES_A_ISO3: return ES_A_ISO3[nombre]
    texto = unicodedata.normalize('NFD', nombre).encode('ascii', 'ignore').decode('utf-8')
    return ES_A_ISO3.get(texto, "ESP")


# =====================================================================
# --- EL CEREBRO DE LA IA (EXTRAÍDO PARA SER USADO POR MÓVIL Y CARPETA) ---
# =====================================================================
def procesar_documento_ia(content: bytes) -> dict:
    try:
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=content)
        
        response = client.text_detection(image=image)
        texts = response.text_annotations
        
        if not texts:
            return {"error": "No se detectó ningún texto en la imagen"}
            
        texto_completo = texts[0].description
        
        datos = {
            "guestName": "",
            "surname": "",
            "dni": "",
            "dniType": "DNI",  
            "birthDate": "",
            "nationality": "ESPAÑA", 
            "sex": "" 
        }
        
        lineas_limpias = [linea.replace(" ", "").strip().upper() for linea in texto_completo.split('\n')]
        
        mrz_lines = [l for l in lineas_limpias if '<' in l and len(l) > 15]
        mrz_data = None
        
        if len(mrz_lines) >= 2:
            try:
                if len(mrz_lines) == 2 or len(mrz_lines[0]) > 36:
                    l1 = mrz_lines[0].ljust(44, '<')[:44]
                    l2 = mrz_lines[1].ljust(44, '<')[:44]
                    mrz_data = TD3CodeChecker(f"{l1}\n{l2}").fields()
                    
                elif len(mrz_lines) >= 3:
                    l1 = mrz_lines[0].ljust(30, '<')[:30]
                    l2 = mrz_lines[1].ljust(30, '<')[:30]
                    l3 = mrz_lines[2].ljust(30, '<')[:30]
                    mrz_data = TD1CodeChecker(f"{l1}\n{l2}\n{l3}").fields()
                    
            except Exception as e_mrz:
                pass

            if mrz_data:
                datos["surname"] = mrz_data.surname.replace('<', ' ').strip()
                datos["guestName"] = mrz_data.name.replace('<', ' ').strip()
                
                doc_num = mrz_data.document_number.replace('<', '').strip()
                country_code = getattr(mrz_data, 'country', '').upper().replace('<', '')
                
                if country_code == 'ESP' and hasattr(mrz_data, 'optional_data'):
                    dni_real = mrz_data.optional_data.replace('<', '').strip()
                    if len(dni_real) > 5 and any(c.isdigit() for c in dni_real):
                        dni_match_esp = re.search(r'([XYZ]?\d{7,8}[A-Z])', dni_real, re.IGNORECASE)
                        if dni_match_esp:
                            doc_num = dni_match_esp.group(1).upper()
                        else:
                            doc_num = dni_real 
                
                datos["dni"] = doc_num
                
                doc_type = getattr(mrz_data, 'document_type', '').upper().replace('<', '')
                if doc_type.startswith('P'):
                    datos["dniType"] = "Pasaporte"
                else:
                    if doc_num.startswith('X') or doc_num.startswith('Y') or doc_num.startswith('Z'):
                        datos["dniType"] = "NIE"
                    else:
                        datos["dniType"] = "DNI"
                
                sex_val = getattr(mrz_data, 'sex', '').upper().replace('<', '')
                if sex_val in ['F', 'M']:
                    datos["sex"] = sex_val
                else:
                    datos["sex"] = "O" 
                
                nat_code = getattr(mrz_data, 'nationality', '').upper().replace('<', '')
                icao_to_es = {
                    'D': 'ALEMANIA', 'DEU': 'ALEMANIA', 'ESP': 'ESPAÑA', 'FRA': 'FRANCIA', 
                    'ITA': 'ITALIA', 'PRT': 'PORTUGAL', 'GBR': 'REINO UNIDO', 'NLD': 'PAÍSES BAJOS',
                    'BEL': 'BÉLGICA', 'CHE': 'SUIZA', 'AUT': 'AUSTRIA', 'SWE': 'SUECIA',
                    'IRL': 'IRLANDA', 'POL': 'POLONIA', 'USA': 'ESTADOS UNIDOS', 'CAN': 'CANADÁ',
                    'MEX': 'MÉXICO', 'ARG': 'ARGENTINA', 'COL': 'COLOMBIA', 'ROU': 'RUMANÍA'
                }
                
                if nat_code in icao_to_es:
                    datos["nationality"] = icao_to_es[nat_code]
                else:
                    try:
                        datos["nationality"] = obtener_nombre_pais_desde_mrz(nat_code)
                    except:
                        datos["nationality"] = "ESPAÑA"
                
                dob = mrz_data.birth_date
                if len(dob) == 6 and dob.isdigit():
                    yy, mm, dd = dob[0:2], dob[2:4], dob[4:6]
                    year_prefix = "19" if int(yy) > 26 else "20"
                    datos["birthDate"] = f"{year_prefix}{yy}-{mm}-{dd}"

        if not datos["dni"]:
            dni_match = re.search(r'\b([XYZ]?\d{7,8}[A-Z])\b', texto_completo, re.IGNORECASE)
            if dni_match:
                limpio = dni_match.group(0).replace(" ", "").replace("-", "").upper()
                datos["dni"] = limpio
                if limpio.startswith('X') or limpio.startswith('Y') or limpio.startswith('Z'):
                    datos["dniType"] = "NIE"
                else:
                    datos["dniType"] = "DNI"
                
        if not datos["birthDate"]:
            fecha_match = re.search(r'\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b', texto_completo)
            if fecha_match:
                datos["birthDate"] = f"{fecha_match.group(3)}-{fecha_match.group(2)}-{fecha_match.group(1)}"

        if not datos["sex"]:
            sex_match = re.search(r'\b(?:SEX|SEXO|GENDER|S)[/ :]*([MFO])\b', texto_completo, re.IGNORECASE)
            if sex_match:
                datos["sex"] = sex_match.group(1).upper()
            else:
                datos["sex"] = "M" 

        if not datos["guestName"]:
            lineas_raw = [linea.strip() for linea in texto_completo.split('\n')]
            for i, linea in enumerate(lineas_raw):
                if "NOMBRE" in linea.upper() and i + 1 < len(lineas_raw):
                    datos["guestName"] = lineas_raw[i+1].strip().upper()
                if "APELLIDOS" in linea.upper() and i + 1 < len(lineas_raw):
                    datos["surname"] = lineas_raw[i+1].strip().upper()
        
        for key in ["guestName", "surname", "dni", "nationality"]:
            if datos[key]:
                datos[key] = str(datos[key]).upper()

        return {
            "status": "success", 
            "data": datos
        }
        
    except Exception as e:
        return {"error": f"Error de Google Vision: {str(e)}"}

# --- SISTEMA DE COLA Y CARPETA CALIENTE (HOT FOLDER) ---
HOT_FOLDER = "scans_hotfolder"
os.makedirs(HOT_FOLDER, exist_ok=True)
PENDING_SCANS_QUEUE = []
PROCESSING_SCANS_COUNT = 0  

class ScannerHandler(FileSystemEventHandler):
    def on_created(self, event):
        global PROCESSING_SCANS_COUNT
        if event.is_directory:
            return
        filepath = event.src_path
        if filepath.lower().endswith(('.png', '.jpg', '.jpeg', '.pdf')):
            PROCESSING_SCANS_COUNT += 1 
            threading.Thread(target=self.process_scan, args=(filepath,)).start()

    def process_scan(self, filepath):
        global PROCESSING_SCANS_COUNT
        time.sleep(3) 
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            
            result = procesar_documento_ia(content)
            
            if "error" not in result:
                PENDING_SCANS_QUEUE.append({
                    "id": str(uuid.uuid4()),
                    "timestamp": int(time.time() * 1000),
                    "data": result["data"]
                })
            os.remove(filepath)
        except Exception as e:
            pass
        finally:
            PROCESSING_SCANS_COUNT = max(0, PROCESSING_SCANS_COUNT - 1)

observer = Observer()
observer.schedule(ScannerHandler(), path=HOT_FOLDER, recursive=False)
observer.start()

@app.get("/api/scans/queue")
def get_scan_queue():
    return PENDING_SCANS_QUEUE

@app.delete("/api/scans/queue/{scan_id}")
def delete_from_queue(scan_id: str):
    global PENDING_SCANS_QUEUE
    PENDING_SCANS_QUEUE = [s for s in PENDING_SCANS_QUEUE if s["id"] != scan_id]
    return {"status": "deleted"}

@app.get("/api/scans/status")
def get_scan_status():
    return {"processing_count": PROCESSING_SCANS_COUNT}

@app.post("/api/scan-document")
async def scan_document(file: UploadFile = File(...)):
    content = await file.read()
    return procesar_documento_ia(content)

# --- AUTENTICACIÓN ---
@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    hashed_pwd = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_pwd, hostel_name=user.hostel_name)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- GESTIÓN DE PERFIL ---
@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me", response_model=schemas.UserResponse)
def update_user_me(
    profile_data: schemas.UserProfileUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if profile_data.hostel_name is not None: current_user.hostel_name = profile_data.hostel_name
    if profile_data.address is not None: current_user.address = profile_data.address
    if profile_data.phone is not None: current_user.phone = profile_data.phone
    if profile_data.email is not None: current_user.email = profile_data.email
    if profile_data.razon_social is not None: current_user.razon_social = profile_data.razon_social
    if profile_data.nif is not None: current_user.nif = profile_data.nif
    if profile_data.domicilio_fiscal is not None: current_user.domicilio_fiscal = profile_data.domicilio_fiscal
    if profile_data.tax_rate is not None: current_user.tax_rate = profile_data.tax_rate
    
    db.commit()
    db.refresh(current_user)
    return current_user

# --- GESTIÓN DE HABITACIONES ---
@app.get("/rooms", response_model=List[schemas.Room])
def get_rooms(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    rooms = db.query(models.Room).filter(
        models.Room.owner_id == current_user.id,
        models.Room.is_active == True
    ).all()
    
    for room in rooms:
        room.beds = [bed for bed in room.beds if bed.is_active]
        
    return rooms

@app.post("/rooms", response_model=schemas.Room)
def create_room(
    room: schemas.RoomCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_room = models.Room(
        name=room.name, 
        price_default=room.price_default, 
        owner_id=current_user.id,
        is_active=True
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    new_beds = []
    for i in range(1, room.beds_count + 1):
        bed_id = f"r{db_room.id}-b{i}"
        bed_label = f"Cama {i}"
        db_bed = models.Bed(id=bed_id, label=bed_label, room_id=db_room.id, is_active=True)
        db.add(db_bed)
        new_beds.append(db_bed)
    
    db.commit()
    db.refresh(db_room)
    return db_room

@app.put("/rooms/{room_id}", response_model=schemas.Room)
def update_room(
    room_id: int,
    room_data: schemas.RoomCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_room = db.query(models.Room).filter(
        models.Room.id == room_id,
        models.Room.owner_id == current_user.id,
        models.Room.is_active == True
    ).first()
    
    if not db_room:
        raise HTTPException(status_code=404, detail="Habitación no encontrada")
        
    db_room.name = room_data.name
    db_room.price_default = room_data.price_default
    db_room.is_maintenance = room_data.is_maintenance
    
    active_beds = [b for b in db_room.beds if b.is_active]
    current_beds_count = len(active_beds)
    new_beds_count = room_data.beds_count
    
    if new_beds_count > current_beds_count:
        highest_bed_index = 0
        for b in db_room.beds:
            try:
                idx = int(b.id.split('-b')[-1])
                if idx > highest_bed_index:
                    highest_bed_index = idx
            except: pass
            
        beds_to_add = new_beds_count - current_beds_count
        for i in range(1, beds_to_add + 1):
            new_idx = highest_bed_index + i
            bed_id = f"r{db_room.id}-b{new_idx}"
            db_bed = models.Bed(id=bed_id, label=f"Cama {new_idx}", room_id=db_room.id, is_active=True)
            db.add(db_bed)
            
    elif new_beds_count < current_beds_count:
        beds_to_remove = current_beds_count - new_beds_count
        active_beds.sort(key=lambda x: int(x.id.split('-b')[-1]) if '-b' in x.id else 0, reverse=True)
        
        for i in range(beds_to_remove):
            bed_to_delete = active_beds[i]
            bed_to_delete.is_active = False

    db.commit()
    db.refresh(db_room)
    
    db_room.beds = [b for b in db_room.beds if b.is_active]
    return db_room

@app.delete("/rooms/{room_id}")
def delete_room(
    room_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    room = db.query(models.Room).filter(
        models.Room.id == room_id,
        models.Room.owner_id == current_user.id
    ).first()
    
    if not room:
        raise HTTPException(status_code=404, detail="Habitación no encontrada")
        
    room.is_active = False
    
    for bed in room.beds:
        bed.is_active = False
        
    db.commit()
    return {"status": "soft_deleted"}
    
# --- GESTIÓN DE CAMAS INDIVIDUALES ---
@app.put("/beds/{bed_id}", response_model=schemas.Bed)
def update_bed(
    bed_id: str,
    bed_data: schemas.BedUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    bed = db.query(models.Bed).join(models.Room).filter(
        models.Bed.id == bed_id,
        models.Room.owner_id == current_user.id
    ).first()
    
    if not bed:
        raise HTTPException(status_code=404, detail="Cama no encontrada")
        
    bed.label = bed_data.label
    bed.is_maintenance = bed_data.is_maintenance 
    
    db.commit()
    db.refresh(bed)
    return bed

# --- BUSCADOR GLOBAL ---
def remove_accents(input_str: str) -> str:
    if not input_str: return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return u"".join([c for c in nfkd_form if not unicodedata.combining(c)])

@app.get("/bookings/search")
def search_bookings(
    q: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not q or len(q) < 2:
        return []
        
    search_term = remove_accents(q.lower()) 
    
    # Ignoramos las canceladas en la búsqueda
    all_bookings = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id,
        models.Booking.bed_id != "CANCELADA"
    ).order_by(models.Booking.date.desc()).all()
    
    results = []
    for b in all_bookings:
        db_name = remove_accents((b.guest_name or "").lower())
        db_dni = (b.dni or "").lower()
        
        if search_term in db_name or search_term in db_dni:
            results.append({
                "id": b.id,
                "guestName": b.guest_name, 
                "date": b.date,
                "dni": b.dni
            })
            
            if len(results) >= 10:
                break
                
    return results

# =====================================================================
# --- RESERVAS Y CANCELACIONES (FACTURAS RECTIFICATIVAS) ---
# =====================================================================
@app.post("/bookings", response_model=schemas.Booking)
def create_booking(
    booking: schemas.BookingCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    existing_booking = db.query(models.Booking).filter(
        models.Booking.id == booking.id,
        models.Booking.owner_id == current_user.id
    ).first()
    
    if existing_booking:
        existing_booking.bed_id = booking.bedId
        existing_booking.guest_name = booking.guestName
        existing_booking.surname = booking.surname
        existing_booking.phone = booking.phone
        existing_booking.dni = booking.dni
        existing_booking.dni_type = booking.dniType
        existing_booking.nationality = booking.nationality
        existing_booking.sex = booking.sex
        existing_booking.birth_date = booking.birthDate
        existing_booking.date = booking.date
        existing_booking.checked_in = booking.checkedIn
        existing_booking.total_price = booking.totalPrice
        existing_booking.paid = booking.paid
        existing_booking.payment_method = booking.paymentMethod
        existing_booking.group_id = booking.groupId
        db_booking = existing_booking
    else:
        db_booking = models.Booking(
            id=booking.id,
            bed_id=booking.bedId,
            guest_name=booking.guestName,
            surname=booking.surname,
            phone=booking.phone,
            dni=booking.dni,
            dni_type=booking.dniType,
            nationality=booking.nationality,
            sex=booking.sex,
            birth_date=booking.birthDate,
            date=booking.date,
            checked_in=booking.checkedIn,
            total_price=booking.totalPrice,
            paid=booking.paid,
            payment_method=booking.paymentMethod,
            group_id=booking.groupId,
            owner_id=current_user.id
        )
        db.add(db_booking)
        
    db.commit()
    db.refresh(db_booking)

    if db_booking.paid:
        crear_factura_oficial(db_booking, db, current_user)

    return convert_to_schema(db_booking)

@app.get("/bookings", response_model=List[schemas.Booking])
def get_bookings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # AHORA SÍ ENVIAMOS TODO (INCLUSO LAS CANCELADAS) PARA EL HISTORIAL
    bookings = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id
    ).all()
    return [convert_to_schema(b) for b in bookings]

@app.delete("/bookings/{booking_id}")
def delete_booking(
    booking_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.owner_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # --- 1. LÓGICA DE FACTURA RECTIFICATIVA (DEVOLUCIONES) ---
    if booking.paid:
        # Buscamos si existe una factura original positiva
        inv = db.query(models.Invoice).filter(
            models.Invoice.booking_id == booking.id,
            models.Invoice.owner_id == current_user.id,
            models.Invoice.total_amount > 0
        ).first()
        
        if inv:
            # Calculamos valores negativos
            neg_total = -abs(inv.total_amount)
            neg_base = -abs(inv.base_amount)
            neg_tax = -abs(inv.tax_amount)
            
            # Buscamos el último hash para continuar la cadena inalterable
            last_invoice = db.query(models.Invoice).filter(
                models.Invoice.owner_id == current_user.id
            ).order_by(models.Invoice.id.desc()).first()
            last_hash = last_invoice.current_hash if last_invoice else ""
            
            now_local = datetime.now() # <-- FORZAMOS HORA LOCAL DE ESPAÑA
            year = now_local.strftime('%Y')
            
            # Generamos número de rectificativa (ej: REC-2026-0001)
            count_rec = db.query(models.Invoice).filter(
                models.Invoice.owner_id == current_user.id,
                models.Invoice.invoice_number.like(f"REC-{year}-%")
            ).count() + 1
            rec_number = f"REC-{year}-{count_rec:04d}"
            
            invoice_date_str = now_local.strftime("%d-%m-%Y")
            user_nif = current_user.nif or "00000000T"
            
            invoice_data_for_hash = {
                "nif": user_nif,
                "number": rec_number,
                "date": invoice_date_str,
                "total": neg_total
            }
            current_hash = generate_invoice_hash(invoice_data_for_hash, last_hash)
            qr_url = f"https://www2.agenciatributaria.gob.es/wlpl/VERIFACTU/Consulta?nif={user_nif}&num={rec_number}&fecha={invoice_date_str}&importe={neg_total:.2f}"
            
            new_rec = models.Invoice(
                invoice_number=rec_number,
                base_amount=neg_base,
                tax_rate=inv.tax_rate,
                tax_amount=neg_tax,
                total_amount=neg_total,
                current_hash=current_hash,
                previous_hash=last_hash,
                qr_url=qr_url,
                booking_id=booking.id,
                owner_id=current_user.id,
                created_at=now_local # <-- EVITA QUE SE GUARDE EN HORA UTC
            )
            db.add(new_rec)
    
    # --- 2. SOFT DELETE (Borrado fantasma) ---
    # En lugar de destruir el registro, liberamos la cama. 
    # El frontend dejará de mostrarlo y el nombre no se pierde para la AEAT.
    booking.bed_id = "CANCELADA"
    booking.checked_in = False
    booking.paid = False
    
    db.commit()
    return {"status": "cancelled"}


# --- ESTADISTICAS ---
@app.get("/stats/summary")
def get_stats_summary(
    year: int, 
    month: Optional[int] = None, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    total_beds = db.query(models.Bed).join(models.Room).filter(models.Room.owner_id == current_user.id).count()
    if total_beds == 0: total_beds = 1

    # Excluimos las canceladas
    query = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id,
        models.Booking.bed_id != "CANCELADA"
    )
    query = query.filter(models.Booking.date.like(f"{year}-%"))
    
    days_in_period = 366 if calendar.isleap(year) else 365
    
    if month:
        month_str = f"-{month:02d}-"
        query = query.filter(models.Booking.date.contains(month_str))
        days_in_period = calendar.monthrange(year, month)[1]
    
    bookings = query.all()
    
    total_peregrinos = len(bookings)
    ingresos_totales = sum(b.total_price for b in bookings if b.total_price)
    ocupacion = (total_peregrinos / (total_beds * days_in_period)) * 100
    
    nac_dict, pagos_dict, gen_dict = {}, {}, {"M": 0, "F": 0, "O": 0}
    for b in bookings:
        nac_dict[b.nationality or "Desconocida"] = nac_dict.get(b.nationality or "Desconocida", 0) + 1
        pagos_dict[b.payment_method or "No esp."] = pagos_dict.get(b.payment_method or "No esp.", 0) + 1
        gen_dict[b.sex if b.sex in ["M", "F", "O"] else "O"] += 1

    top_nacionalidades = sorted(nac_dict.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "peregrinos": total_peregrinos,
        "ingresos": round(ingresos_totales, 2),
        "ocupacion": round(ocupacion, 1),
        "paises": len(nac_dict),
        "nacionalidades": [{"name": n[0], "value": n[1]} for n in top_nacionalidades],
        "metodos_pago": [{"name": k, "value": v} for k, v in pagos_dict.items()],
        "generos": [
            {"name": "Hombres", "value": gen_dict["M"]},
            {"name": "Mujeres", "value": gen_dict["F"]},
            {"name": "Otros", "value": gen_dict["O"]}
        ]
    }

@app.get("/stats/compare")
def compare_stats(
    year1: int, year2: int, 
    month1: Optional[int] = None, month2: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    total_beds = db.query(models.Bed).join(models.Room).filter(models.Room.owner_id == current_user.id).count()
    if total_beds == 0: total_beds = 1

    def get_period_data(y, m):
        q = db.query(models.Booking).filter(
            models.Booking.owner_id == current_user.id, 
            models.Booking.date.like(f"{y}-%"),
            models.Booking.bed_id != "CANCELADA"
        )
        d_in_p = 366 if calendar.isleap(y) else 365
        if m:
            q = q.filter(models.Booking.date.contains(f"-{m:02d}-"))
            d_in_p = calendar.monthrange(y, m)[1]
        
        bks = q.all()
        pax = len(bks)
        ing = sum(b.total_price for b in bks if b.total_price)
        ocu = (pax / (total_beds * d_in_p)) * 100
        return {"peregrinos": pax, "ingresos": round(ing, 2), "ocupacion": round(ocu, 1)}

    return {
        "periodo1": get_period_data(year1, month1),
        "periodo2": get_period_data(year2, month2)
    }


# --- REPORTES DE POLICÍA Y CONTABILIDAD ---
@app.get("/reports/police/xml")
def generate_police_report_xml(
    start: str, end: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    bookings = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id,
        models.Booking.date >= start,
        models.Booking.date <= end,
        models.Booking.checked_in == True,
        models.Booking.bed_id != "CANCELADA"
    ).all()
    
    root = ET.Element("RegistroHospedajes")
    viajeros_elem = ET.SubElement(root, "Viajeros")
    
    for b in bookings:
        nombre_completo = (b.guest_name or "").strip()
        partes = nombre_completo.split(" ")
        
        if len(partes) == 1:
            nombre = partes[0]
            apellido1 = ""
            apellido2 = ""
        elif len(partes) == 2:
            nombre = partes[0]
            apellido1 = partes[1]
            apellido2 = ""
        else:
            apellido2 = partes[-1]
            apellido1 = partes[-2]
            nombre = " ".join(partes[:-2])
            
        tipo_doc_map = {"DNI": "D", "Pasaporte": "P", "NIE": "N"}
        tipo_doc = tipo_doc_map.get(b.dni_type, "I")
        
        fecha_nac = b.birth_date.replace("-", "") if b.birth_date else ""
        fecha_ent = b.date.replace("-", "") if b.date else ""
        sexo_oficial = "M" if b.sex == "M" else "F"
        nacionalidad_limpia = b.nationality if b.nationality else 'España'
        codigo_nacionalidad = obtener_codigo_pais_iso3(nacionalidad_limpia)
        
        viajero_elem = ET.SubElement(viajeros_elem, "Viajero")
        ET.SubElement(viajero_elem, "Nombre").text = nombre
        ET.SubElement(viajero_elem, "PrimerApellido").text = apellido1
        ET.SubElement(viajero_elem, "SegundoApellido").text = apellido2
        ET.SubElement(viajero_elem, "TipoDocumento").text = tipo_doc
        ET.SubElement(viajero_elem, "NumeroDocumento").text = b.dni or ""
        ET.SubElement(viajero_elem, "FechaNacimiento").text = fecha_nac
        ET.SubElement(viajero_elem, "Sexo").text = sexo_oficial
        ET.SubElement(viajero_elem, "Nacionalidad").text = codigo_nacionalidad
        ET.SubElement(viajero_elem, "FechaEntrada").text = fecha_ent

    tree = ET.ElementTree(root)
    filename = f"ses_hospedajes_{start}_{end}.xml"
    tree.write(filename, encoding="utf-8", xml_declaration=True)
    return FileResponse(path=filename, filename=filename, media_type='application/xml')

@app.get("/reports/accounting")
def generate_accounting_report(
    start: str, 
    end: str,
    tax_rate: float = 10.0, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    bookings = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id, 
        models.Booking.date >= start, 
        models.Booking.date <= end,
        models.Booking.bed_id != "CANCELADA"
    ).all()
    
    datos = []
    divisor_impuestos = 1 + (tax_rate / 100)
    
    for b in bookings:
        total = b.total_price or 0.0
        base = round(total / divisor_impuestos, 2)
        iva = round(total - base, 2)
        
        datos.append({
            "Ref": b.id, 
            "Fecha": b.date, 
            "Cliente": f"{b.guest_name} {b.surname or ''}".strip(),
            "DNI": b.dni, 
            "Total": total, 
            "Pagado": "SI" if b.paid else "NO",
            "Metodo": b.payment_method, 
            "Base": base, 
            "Impuestos ({tax_rate}%)": iva 
        })
        
    df = pd.DataFrame(datos)
    filename = f"contabilidad_{start}_{end}.csv"
    df.to_csv(filename, index=False, sep=";", encoding="utf-8-sig", decimal=",")
    return FileResponse(path=filename, filename=filename, media_type='text/csv')

def convert_to_schema(db_obj: models.Booking) -> schemas.Booking:
    return schemas.Booking(
        id=db_obj.id, bedId=db_obj.bed_id, guestName=db_obj.guest_name,
        surname=db_obj.surname, phone=db_obj.phone, dni=db_obj.dni,
        dniType=db_obj.dni_type, nationality=db_obj.nationality, sex=db_obj.sex,
        birthDate=db_obj.birth_date, date=db_obj.date, checkedIn=db_obj.checked_in,
        totalPrice=db_obj.total_price, paid=db_obj.paid, paymentMethod=db_obj.payment_method,
        groupId=db_obj.group_id
    )

# --- GESTIÓN DE CERTIFICADOS DIGITALES ---
@app.post("/api/upload-cert")
async def upload_certificate(
    file: UploadFile = File(...),
    password: str = Form(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    p12_data = await file.read()
    try:
        pkcs12.load_key_and_certificates(
            p12_data, 
            password.encode('utf-8'), 
            backend=default_backend()
        )
    except Exception as e:
        print(f"Error verificando certificado: {e}")
        raise HTTPException(
            status_code=400, 
            detail="Contraseña incorrecta o archivo .p12 corrupto."
        )

    file_extension = file.filename.split(".")[-1]
    save_path = f"certs/user_{current_user.id}_cert.{file_extension}"
    
    try:
        await file.seek(0)
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando el archivo: {e}")

    current_user.cert_path = save_path
    current_user.cert_password = password 
    
    db.commit()
    db.refresh(current_user)
    
    return {"status": "success", "message": "Certificado instalado y verificado correctamente"}

# ==============================================================================
# --- REGISTRO DE AUDITORÍA AEAT (ANTIFRAUDE) BLINDADO PARA EXCEL ---
# ==============================================================================
@app.get("/reports/aeat")
def generate_aeat_report(
    start: str, 
    end: str, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    import csv # Importamos esto para forzar las comillas en Excel

    # Buscamos todas las facturas en el rango de fechas
    invoices_list = db.query(models.Invoice).filter(
        models.Invoice.owner_id == current_user.id,
        models.Invoice.created_at >= datetime.strptime(start, "%Y-%m-%d"),
        models.Invoice.created_at <= datetime.strptime(end, "%Y-%m-%d")
    ).order_by(models.Invoice.id.asc()).all()

    datos = []
    for inv in invoices_list:
        # Buscamos el nombre del cliente
        booking = db.query(models.Booking).filter(models.Booking.id == inv.booking_id).first()
        cliente = f"{booking.guest_name} {booking.surname or ''}".strip() if booking else "Desconocido"
        
        datos.append({
            "Fecha Registro": inv.created_at.strftime("%d/%m/%Y %H:%M"),
            "Número Factura": inv.invoice_number,
            "Cliente": cliente,
            "NIF Albergue": current_user.nif,
            # SOLUCIÓN: Forzamos la coma española como texto puro
            "Base Imponible": f"{inv.base_amount:.2f}".replace(".", ","),
            "IVA (%)": f"{inv.tax_rate:.2f}".replace(".", ","),
            "Cuota IVA": f"{inv.tax_amount:.2f}".replace(".", ","),
            "Total Factura": f"{inv.total_amount:.2f}".replace(".", ","),
            "Huella (Hash)": inv.current_hash,
            "Hash Anterior": inv.previous_hash or "(Primera de la serie)",
            "Enviado AEAT": "SÍ" if inv.aeat_sent else "NO"
        })

    if not datos:
        raise HTTPException(status_code=404, detail="No hay facturas registradas en este periodo")

    df = pd.DataFrame(datos)
    filename = f"registro_aeat_{start}_al_{end}.csv"
    
    # quoting=csv.QUOTE_ALL es la magia: obliga a Excel a respetar los bloques con coma
    df.to_csv(filename, index=False, sep=";", encoding="utf-8-sig", quoting=csv.QUOTE_ALL)
    
    return FileResponse(path=filename, filename=filename, media_type='text/csv')

# ==============================================================================
# --- DESCARGA DE FACTURA (SOLO PARA RESERVAS PAGADAS Y ANTI-CACHÉ) ---
# ==============================================================================
@app.get("/invoices/{booking_id}")
def get_invoice(
    booking_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    print(f"--- SOLICITUD DE DOCUMENTO: {booking_id} ---")
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id,
        models.Booking.owner_id == current_user.id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    bookings_to_invoice = []
    if booking.group_id:
        bookings_to_invoice = db.query(models.Booking).filter(
            models.Booking.group_id == booking.group_id,
            models.Booking.date == booking.date,
            models.Booking.owner_id == current_user.id
        ).all()
    else:
        bookings_to_invoice = [booking]

    # Buscar factura en DB
    booking_ids = [b.id for b in bookings_to_invoice]
    existing_invoice = db.query(models.Invoice).filter(
        models.Invoice.booking_id.in_(booking_ids),
        models.Invoice.owner_id == current_user.id,
        models.Invoice.total_amount > 0 
    ).first()

    invoice_data = None
    if existing_invoice:
        print(f"-> Factura real encontrada: {existing_invoice.invoice_number}")
        invoice_data = {
            "number": existing_invoice.invoice_number,
            "hash": existing_invoice.current_hash,
            "qr_code_url": existing_invoice.qr_url
        }
    elif booking.paid:  # <--- REGLA ESTRICTA: Solo si está pagado
        print("-> Reserva pagada. Generando factura oficial...")
        invoice_obj = crear_factura_oficial(booking, db, current_user)
        invoice_data = {
            "number": invoice_obj.invoice_number,
            "hash": invoice_obj.current_hash,
            "qr_code_url": invoice_obj.qr_url
        }
    else:
        print("-> Rechazo: Intento de factura sin pago.")
        raise HTTPException(status_code=400, detail="No se puede generar una factura legal de una reserva no pagada.")

    # Generamos el PDF físicamente
    status_suffix = "OFICIAL" if invoice_data else "BORRADOR"
    filename = f"factura_{booking_id}_{status_suffix}.pdf"
    
    invoices.generate_invoice_pdf(bookings_to_invoice, filename, current_user, invoice_data)
    
    # MAGIA ANTI-CACHÉ
    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    
    return FileResponse(path=filename, filename=filename, media_type='application/pdf', headers=headers)

def main():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, access_log=False)

if __name__ == "__main__":
    main()
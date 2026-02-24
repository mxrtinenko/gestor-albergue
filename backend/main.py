from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import List, Optional
import pandas as pd
import os
import calendar
import country_converter as coco
import unicodedata

# Importamos módulos locales
import models, schemas, database, invoices, auth

# Crea tablas
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- UTILIDADES ---

def obtener_codigo_pais_iso3(nombre_pais: str) -> str:
    if not nombre_pais:
        return "ESP"
    
    # 1. Normalizamos el texto (Quitar tildes, espacios y a Mayúsculas)
    texto = unicodedata.normalize('NFD', nombre_pais).encode('ascii', 'ignore').decode('utf-8').upper().strip()
    
    # 2. Diccionario de refuerzo para nombres de la librería del frontend en español
    # Esto asegura que los países más comunes no fallen NUNCA
    traductor_manual = {
        "ESPANA": "ESP", "ESPANOLA": "ESP", "ESPANOL": "ESP",
        "ALEMANIA": "DEU", "FRANCIA": "FRA", "ITALIA": "ITA", 
        "PORTUGAL": "PRT", "REINO UNIDO": "GBR", "ESTADOS UNIDOS": "USA",
        "SUIZA": "CHE", "AUSTRIA": "AUT", "BELGICA": "BEL", 
        "PAISES BAJOS": "NLD", "HOLANDA": "NLD", "SUECIA": "SWE", 
        "DINAMARCA": "DNK", "NORUEGA": "NOR", "FINLANDIA": "FIN",
        "POLONIA": "POL", "MEXICO": "MEX", "ARGENTINA": "ARG",
        "COLOMBIA": "COL", "CHILE": "CHL", "BRASIL": "BRA", "CANADA": "CAN",
        "JAPON": "JPN", "CHINA": "CHN", "COREA DEL SUR": "KOR", "AUSTRALIA": "AUS",
        "IRLANDA": "IRL", "UCRANIA": "UKR", "RUMANIA": "ROU", "CHECO": "CZE"
    }
    
    if texto in traductor_manual:
        return traductor_manual[texto]
    
    # 3. Si no está en el diccionario, dejamos que coco intente adivinarlo
    try:
        res = coco.convert(names=nombre_pais, to='ISO3', not_found='ESP')
        return res if isinstance(res, str) else "ESP"
    except:
        return "ESP"

# --- AUTENTICACIÓN ---

@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # 1. Verificar si existe
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")
    
    # 2. Crear usuario con contraseña hasheada
    hashed_pwd = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_pwd, hostel_name=user.hostel_name)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # 1. Buscar usuario
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 2. Generar Token
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- GESTIÓN DE PERFIL (NUEVO) ---

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me", response_model=schemas.UserResponse)
def update_user_me(
    profile_data: schemas.UserProfileUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Actualizamos campos si vienen en la petición
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
    # DEVOLVER SOLO HABITACIONES ACTIVAS
    rooms = db.query(models.Room).filter(
        models.Room.owner_id == current_user.id,
        models.Room.is_active == True
    ).all()
    
    # Filtramos para que también devuelva solo las camas activas dentro de esa habitación
    for room in rooms:
        room.beds = [bed for bed in room.beds if bed.is_active]
        
    return rooms

@app.post("/rooms", response_model=schemas.Room)
def create_room(
    room: schemas.RoomCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Crear la Habitación
    db_room = models.Room(
        name=room.name, 
        price_default=room.price_default, 
        owner_id=current_user.id,
        is_active=True
    )
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    
    # 2. Crear las camas automáticamente
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

# NUEVO ENDPOINT: EDITAR HABITACIÓN
@app.put("/rooms/{room_id}", response_model=schemas.Room)
def update_room(
    room_id: int,
    room_data: schemas.RoomCreate, # Reutilizamos el schema de creación porque trae name, price y beds_count
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 1. Buscar la habitación
    db_room = db.query(models.Room).filter(
        models.Room.id == room_id,
        models.Room.owner_id == current_user.id,
        models.Room.is_active == True
    ).first()
    
    if not db_room:
        raise HTTPException(status_code=404, detail="Habitación no encontrada")
        
    # 2. Actualizar datos básicos
    db_room.name = room_data.name
    db_room.price_default = room_data.price_default
    
    # 3. Lógica compleja: Ajustar número de camas
    active_beds = [b for b in db_room.beds if b.is_active]
    current_beds_count = len(active_beds)
    new_beds_count = room_data.beds_count
    
    if new_beds_count > current_beds_count:
        # AÑADIR NUEVAS CAMAS
        # Buscamos el índice más alto actual para no repetir IDs si hubo borrados lógicos
        highest_bed_index = 0
        for b in db_room.beds: # Miramos TODAS, incluso las borradas, para sacar el ID
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
        # ELIMINAR CAMAS (BORRADO LÓGICO)
        # Eliminamos las últimas de la lista (las de índice más alto)
        beds_to_remove = current_beds_count - new_beds_count
        # Ordenamos las camas activas por su ID de mayor a menor para "apagar" las últimas
        active_beds.sort(key=lambda x: int(x.id.split('-b')[-1]) if '-b' in x.id else 0, reverse=True)
        
        for i in range(beds_to_remove):
            bed_to_delete = active_beds[i]
            # Podríamos comprobar aquí si tiene reservas futuras y lanzar error, 
            # pero el soft delete es seguro. Simplemente la ocultamos.
            bed_to_delete.is_active = False

    db.commit()
    db.refresh(db_room)
    
    # Filtramos antes de devolver para que el frontend reciba lo correcto al instante
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
        
    # BORRADO LÓGICO: Apagamos la habitación
    room.is_active = False
    
    # Y apagamos todas sus camas asociadas para que no salgan en el planning
    for bed in room.beds:
        bed.is_active = False
        
    db.commit()
    return {"status": "soft_deleted"}

# --- ENDPOINT: BUSCADOR GLOBAL ---
@app.get("/bookings/search")
def search_bookings(
    q: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if not q or len(q) < 2:
        return []
        
    search_term = q.lower() # Pasamos la búsqueda a minúsculas
    
    # Buscamos coincidencias forzando todo a minúsculas para que no falle
    bookings = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id,
        (func.lower(models.Booking.guest_name).contains(search_term)) |
        (func.lower(models.Booking.dni).contains(search_term))
    ).order_by(models.Booking.date.desc()).limit(10).all()
    
    return [
        {
            "id": b.id,
            "guestName": b.guest_name,
            "date": b.date,
            "dni": b.dni
        } for b in bookings
    ]

# --- RESERVAS (PROTEGIDAS) ---

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
        db.delete(existing_booking)
        db.commit()

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
    return convert_to_schema(db_booking)

@app.get("/bookings", response_model=List[schemas.Booking])
def get_bookings(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    bookings = db.query(models.Booking).filter(models.Booking.owner_id == current_user.id).all()
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
    
    db.delete(booking)
    db.commit()
    return {"status": "deleted"}


# --- 1. ENDPOINT: RESUMEN ACTUAL (LIMPIO) ---
@app.get("/stats/summary")
def get_stats_summary(
    year: int, 
    month: Optional[int] = None, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Calcular total de camas
    total_beds = db.query(models.Bed).join(models.Room).filter(models.Room.owner_id == current_user.id).count()
    if total_beds == 0: total_beds = 1

    query = db.query(models.Booking).filter(models.Booking.owner_id == current_user.id)
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

# --- 2. ENDPOINT: COMPARATIVA DE DOS PERIODOS ---
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
        q = db.query(models.Booking).filter(models.Booking.owner_id == current_user.id, models.Booking.date.like(f"{y}-%"))
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

# --- PDF Y REPORTES ---

@app.get("/invoices/{booking_id}")
def get_invoice(
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
    
    bookings_to_invoice = []
    
    if booking.group_id:
        group_bookings = db.query(models.Booking).filter(
            models.Booking.group_id == booking.group_id,
            models.Booking.date == booking.date,
            models.Booking.owner_id == current_user.id
        ).all()
        bookings_to_invoice = group_bookings
    else:
        bookings_to_invoice = [booking]

    filename = f"factura_{booking_id}.pdf"
    invoices.generate_invoice_pdf(bookings_to_invoice, filename, current_user)
    
    return FileResponse(path=filename, filename=filename, media_type='application/pdf')

@app.get("/reports/police")
def generate_police_report(
    start: str, end: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    bookings = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id,
        models.Booking.date >= start,
        models.Booking.date <= end,
        models.Booking.checked_in == True
    ).all()
    
    datos_oficiales = []
    
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
        # Usamos el traductor de países
        codigo_nacionalidad = obtener_codigo_pais_iso3(nacionalidad_limpia)
        
        datos_oficiales.append({
            "Nombre": nombre,
            "Primer_Apellido": apellido1,
            "Segundo_Apellido": apellido2,
            "Tipo_Documento": tipo_doc,
            "Numero_Documento": b.dni,
            "Fecha_Nacimiento": fecha_nac,
            "Sexo": sexo_oficial,
            "Nacionalidad": codigo_nacionalidad,
            "Fecha_Entrada": fecha_ent
        })
    
    df = pd.DataFrame(datos_oficiales)
    filename = f"parte_viajeros_{start}_{end}.csv"
    
    df.to_csv(filename, index=False, sep=";", encoding="utf-8-sig")
    
    return FileResponse(path=filename, filename=filename, media_type='text/csv')

@app.get("/reports/accounting")
def generate_accounting_report(
    start: str, 
    end: str,
    tax_rate: float = 10.0, # NUEVO: Recibe el IVA por URL, por defecto 10
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    bookings = db.query(models.Booking).filter(
        models.Booking.owner_id == current_user.id, 
        models.Booking.date >= start, 
        models.Booking.date <= end
    ).all()
    
    datos = []
    
    # Calcular el divisor (ej. si el IVA es 10%, el divisor es 1.10)
    divisor_impuestos = 1 + (tax_rate / 100)
    
    for b in bookings:
        total = b.total_price or 0.0
        
        # Matemáticas puras usando el porcentaje dinámico
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
            f"Impuestos ({tax_rate}%)": iva # El nombre de la columna se adapta
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
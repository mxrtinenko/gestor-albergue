from sqlalchemy import Column, String, Boolean, Float, ForeignKey, Integer, DateTime, UniqueConstraint
from database import Base
from sqlalchemy.orm import relationship
from datetime import datetime

# 1. USUARIOS
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True) 
    hashed_password = Column(String) 
    
    # Datos de Perfil y Fiscales
    hostel_name = Column(String)
    address = Column(String, nullable=True) 
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True) 
    razon_social = Column(String, nullable=True) 
    nif = Column(String, nullable=True) 
    domicilio_fiscal = Column(String, nullable=True) 
    
    tax_rate = Column(Float, default=10.0) # Para el IVA
    
    bookings = relationship("Booking", back_populates="owner")
    rooms = relationship("Room", back_populates="owner")
    
    # RELACIÓN NUEVA: FACTURAS
    invoices = relationship("Invoice", back_populates="owner")

    cert_path = Column(String, nullable=True)      # Ruta donde guardamos el .p12
    cert_password = Column(String, nullable=True)  # Contraseña del certificado

# 2. HABITACIONES
class Room(Base):
    __tablename__ = "rooms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    price_default = Column(Float, default=20.0)
    owner_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    
    # CAMPO DE MANTENIMIENTO (NUEVO)
    is_maintenance = Column(Boolean, default=False)

    owner = relationship("User", back_populates="rooms")
    beds = relationship("Bed", back_populates="room", cascade="all, delete-orphan")

# 3. CAMAS
class Bed(Base):
    __tablename__ = "beds"
    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    is_active = Column(Boolean, default=True)
    
    # CAMPO NUEVO PARA MANTENIMIENTO
    is_maintenance = Column(Boolean, default=False)

    room = relationship("Room", back_populates="beds")

# 4. RESERVAS
class Booking(Base):
    __tablename__ = "bookings"
    id = Column(String, primary_key=True, index=True)
    bed_id = Column(String, index=True) 
    guest_name = Column(String)
    surname = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    dni = Column(String, nullable=True)
    dni_type = Column(String, default="DNI")
    nationality = Column(String, default="Española")
    sex = Column(String, default="M")
    birth_date = Column(String, nullable=True)
    date = Column(String, index=True)
    checked_in = Column(Boolean, default=False)
    total_price = Column(Float, default=0.0)
    paid = Column(Boolean, default=False)
    payment_method = Column(String, default="EFECTIVO")
    group_id = Column(String, nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="bookings")

# 5. FACTURAS (VERIFACTU - LEY ANTIFRAUDE)
class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    # ¡OJO! Quitamos el unique=True de aquí
    invoice_number = Column(String, index=True) 
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Datos económicos
    base_amount = Column(Float)
    tax_rate = Column(Float) 
    tax_amount = Column(Float)
    total_amount = Column(Float)
    
    # Huella digital y encadenamiento
    current_hash = Column(String, index=True)   
    previous_hash = Column(String)              
    qr_url = Column(String)                     
    
    # Estado AEAT
    aeat_sent = Column(Boolean, default=False)
    
    # Relaciones
    booking_id = Column(String, ForeignKey("bookings.id"))
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="invoices")

    # NUEVO: RESTRICCIÓN COMPUESTA
    # Obliga a que la combinación (Albergue + Número de factura) sea única
    __table_args__ = (
        UniqueConstraint('owner_id', 'invoice_number', name='uix_owner_invoice'),
    )
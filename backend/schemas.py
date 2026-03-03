from pydantic import BaseModel
from typing import List, Optional

# --- ESQUEMAS DE RESERVAS ---
class BookingBase(BaseModel):
    bedId: str
    guestName: str
    date: str
    checkedIn: bool
    surname: Optional[str] = ""
    phone: Optional[str] = ""
    dni: Optional[str] = ""
    dniType: Optional[str] = "DNI"
    nationality: Optional[str] = "Española"
    sex: Optional[str] = "M"
    birthDate: Optional[str] = ""
    
    # Campos económicos
    totalPrice: Optional[float] = 0.0
    paid: Optional[bool] = False
    paymentMethod: Optional[str] = "EFECTIVO"
    
    # Campo de grupo
    groupId: Optional[str] = None

    class Config:
        from_attributes = True

class BookingCreate(BookingBase):
    id: str

class Booking(BookingBase):
    id: str

# --- ESQUEMAS DE USUARIO ---
class UserCreate(BaseModel):
    username: str
    password: str
    hostel_name: str

class UserResponse(BaseModel):
    id: int
    username: str
    hostel_name: str
    # Campos opcionales de perfil
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    razon_social: Optional[str] = None
    nif: Optional[str] = None
    domicilio_fiscal: Optional[str] = None
    tax_rate: float
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfileUpdate(BaseModel):
    hostel_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    razon_social: Optional[str] = None
    nif: Optional[str] = None
    domicilio_fiscal: Optional[str] = None
    tax_rate: Optional[float] = None

# --- ESQUEMAS DE HABITACIONES Y CAMAS ---

class BedBase(BaseModel):
    id: str
    label: str
    # Campo para lectura y creación
    is_maintenance: bool = False 

class BedCreate(BedBase):
    pass

# Esquema específico para actualizar una cama (PUT)
class BedUpdate(BaseModel):
    label: str
    is_maintenance: bool = False

class Bed(BedBase):
    room_id: int
    is_active: bool
    
    class Config:
        from_attributes = True

class RoomBase(BaseModel):
    name: str
    price_default: float
    # Campo nuevo para mantenimiento de habitación completa
    is_maintenance: bool = False

class RoomCreate(RoomBase):
    beds_count: int

class Room(RoomBase):
    id: int
    owner_id: int
    beds: List[Bed] = []
    
    class Config:
        from_attributes = True
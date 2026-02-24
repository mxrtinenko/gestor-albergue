from pydantic import BaseModel
from typing import List, Optional

# Base común (campos compartidos al leer y escribir)
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
    
    # Campo de grupo (El que daba error)
    groupId: Optional[str] = None

    class Config:
        from_attributes = True # Permite leer desde el modelo ORM

# Para crear (input)
class BookingCreate(BookingBase):
    id: str

# Para leer (output)
class Booking(BookingBase):
    id: str

    # --- NUEVOS ESQUEMAS DE USUARIO ---
class UserCreate(BaseModel):
    username: str
    password: str
    hostel_name: str

class UserResponse(BaseModel):
    id: int
    username: str
    hostel_name: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    # --- ESQUEMAS DE HABITACIONES ---

class BedBase(BaseModel):
    id: str
    label: str

class BedCreate(BedBase):
    pass

class Bed(BedBase):
    room_id: int
    class Config:
        from_attributes = True

class RoomBase(BaseModel):
    name: str
    price_default: float

class RoomCreate(RoomBase):
    beds_count: int # El usuario dirá "Crea una hab. con 6 camas"

class Room(RoomBase):
    id: int
    owner_id: int
    beds: List[Bed] = []
    
    class Config:
        from_attributes = True

# --- ESQUEMA PARA ACTUALIZAR PERFIL ---
class UserProfileUpdate(BaseModel):
    hostel_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    razon_social: Optional[str] = None
    nif: Optional[str] = None
    domicilio_fiscal: Optional[str] = None
    tax_rate: Optional[float] = None

# Actualiza UserResponse para que devuelva estos campos
class UserResponse(BaseModel):
    id: int
    username: str
    hostel_name: str
    # Campos opcionales nuevos
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    razon_social: Optional[str] = None
    nif: Optional[str] = None
    domicilio_fiscal: Optional[str] = None
    tax_rate: float
    
    class Config:
        from_attributes = True
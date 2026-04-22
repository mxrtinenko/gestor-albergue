const API_URL = "https://gestor-albergue-production.up.railway.app";

export interface UserProfile {
    username?: string;
    hostel_name: string;
    address?: string;
    phone?: string;
    email?: string;
    razon_social?: string;
    nif?: string;
    domicilio_fiscal?: string;
    tax_rate?: number;
    logo_url?: string | null;
}

export interface Bed {
  id: string;
  label: string;
  room_id: number;
  is_maintenance?: boolean
}

export interface Room {
  id: number;
  name: string;
  price_default: number;
  beds: Bed[];
  beds_count?: number;
  is_maintenance?: boolean;
}

export interface BookingData {
  id: string;
  bedId: string;
  roomId?: string; 
  guestName: string;
  surname?: string;
  phone?: string;
  email?: string;
  dni?: string;
  dniType?: string;
  nationality?: string;
  sex?: string;
  birthDate?: string;
  date: string;
  checkedIn: boolean;
  totalPrice?: number;
  paid?: boolean;
  paymentMethod?: string;
  groupId?: string;
}

export interface UserData {
    username: string;
    password?: string;
    hostel_name?: string;
}

const getAuthHeaders = () => {
    const token = localStorage.getItem("hostly_token");
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const apiService = {
  // --- AUTENTICACIÓN ---
  async login(username: string, password: string) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${API_URL}/token`, {
        method: 'POST',
        body: formData, 
    });

    if (!response.ok) throw new Error("Credenciales incorrectas");
    return response.json(); 
  },

  async register(data: UserData) {
      const response = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Error al registrar. El usuario quizás ya existe.");
      return response.json();
  },

  // --- RESERVAS ---
  async saveBooking(bookingData: BookingData) {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(bookingData),
    });
    
    if (!response.ok) throw new Error("Error en el servidor al guardar");
    return response.json();
  },

  async getBookings(): Promise<BookingData[]> {
    const response = await fetch(`${API_URL}/bookings`, {
        headers: getAuthHeaders() 
    });
    if (!response.ok) throw new Error("Error al obtener datos (¿Sesión caducada?)");
    return response.json();
  },

  async deleteBooking(id: string) {
    const response = await fetch(`${API_URL}/bookings/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error al eliminar la reserva");
    return response.json();
  },

  // --- INFORMES Y FACTURAS ---
  async downloadInvoice(bookingId: string) {
    const response = await fetch(`${API_URL}/invoices/${bookingId}`, {
        method: 'GET',
        headers: {
            ...(localStorage.getItem("hostly_token") ? { 'Authorization': `Bearer ${localStorage.getItem("hostly_token")}` } : {})
        }
    });
    
    if (!response.ok) throw new Error("Error generando factura");
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recibo_${bookingId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  async downloadReport(startDate: string, endDate: string) {
    const response = await fetch(`${API_URL}/reports/police?start=${startDate}&end=${endDate}`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error generando informe policial");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parte_viajeros_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  
  async downloadPoliceReportXML(start: string, end: string) {
    const response = await fetch(`${API_URL}/reports/police/xml?start=${start}&end=${end}`, {
        headers: getAuthHeaders()
    });
    
    if (!response.ok) throw new Error("Error al descargar el XML policial");
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ses_hospedajes_${start}_al_${end}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url); // Buena práctica para liberar memoria
  },

  async downloadAccountingReport(start: string, end: string, taxRate: number = 10) {
    const response = await fetch(`${API_URL}/reports/accounting?start=${start}&end=${end}&tax_rate=${taxRate}`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error generando informe contable");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contabilidad_${start}_${end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  
  // --- NUEVO: Exportación Registro AEAT (Ley Antifraude) ---
  async downloadAEATReport(start: string, end: string) {
    const response = await fetch(`${API_URL}/reports/aeat?start=${start}&end=${end}`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        if(response.status === 404) throw new Error("No hay facturas en esas fechas");
        throw new Error("Error generando el registro de la AEAT");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registro_VeriFactu_${start}_al_${end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // --- GESTIÓN DE HABITACIONES ---
  async getRooms(): Promise<Room[]> {
    const response = await fetch(`${API_URL}/rooms`, {
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error cargando habitaciones");
    return response.json();
  },

  async createRoom(name: string, bedsCount: number, price: number) {
    const response = await fetch(`${API_URL}/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        price_default: price,
        beds_count: bedsCount
      }),
    });
    if (!response.ok) throw new Error("Error creando habitación");
    return response.json();
  },

  // Actualizar habitación
  async updateRoom(roomId: string, name: string, bedsCount: number, priceDefault: number, isMaintenance: boolean = false) {
    const response = await fetch(`${API_URL}/rooms/${roomId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
          name, 
          beds_count: bedsCount, 
          price_default: priceDefault,
          is_maintenance: isMaintenance // <--- ENVIAR AL BACKEND
      }),
    });
    if (!response.ok) throw new Error("Error actualizando habitación");
    return response.json();
  },

  // NUEVO: Actualizar nombre de una cama individual
  async updateBedLabel(bedId: string, label: string, isMaintenance: boolean) {
    const response = await fetch(`${API_URL}/beds/${bedId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ label, is_maintenance: isMaintenance }),
    });
    if (!response.ok) throw new Error("Error actualizando cama");
    return response.json();
  },

  async deleteRoom(roomId: number) {
    const response = await fetch(`${API_URL}/rooms/${roomId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error eliminando habitación");
    return response.json();
  },

  // --- GESTIÓN DE PERFIL ---

  async getProfile(): Promise<UserProfile> {
    const response = await fetch(`${API_URL}/users/me`, {
        headers: getAuthHeaders()
    });
    
    // Si el error es 401, el token ha caducado de verdad
    if (response.status === 401) throw new Error("TOKEN_EXPIRED");
    // Si es otro error, el servidor está dormido o no hay internet
    if (!response.ok) throw new Error("SERVER_ERROR");
    
    return response.json();
  },
  async updateProfile(data: UserProfile) {
    const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error("Error actualizando perfil");
    return response.json();
  },

  // --- ESTADISTICAS Y COMPARACION---
  async getStats(year: number, month?: number) {
    const url = month 
      ? `${API_URL}/stats/summary?year=${year}&month=${month}`
      : `${API_URL}/stats/summary?year=${year}`;
    
    const response = await fetch(url, {
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error cargando estadísticas");
    return response.json();
  },

  async getComparison(year1: number, year2: number, month1?: number, month2?: number) {
    let url = `${API_URL}/stats/compare?year1=${year1}&year2=${year2}`;
    if (month1) url += `&month1=${month1}`;
    if (month2) url += `&month2=${month2}`;
    
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error("Error cargando comparativa");
    return response.json();
  },

  // --- BUSCADOR GLOBAL ---
  async searchBookings(query: string) {
    const response = await fetch(`${API_URL}/bookings/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error en la búsqueda");
    return response.json();
  },
  
  // --- ESCÁNER DE DOCUMENTOS ---
  async scanDocument(file: File, saveToQueue: boolean = false) {
    const formData = new FormData();
    formData.append("file", file);

    // Le pasamos el interruptor en la URL
    const response = await fetch(`${API_URL}/api/scan-document?save_to_queue=${saveToQueue}`, {
        method: 'POST',
        headers: {
            ...(localStorage.getItem("hostly_token") ? { 'Authorization': `Bearer ${localStorage.getItem("hostly_token")}` } : {})
        },
        body: formData
    });
    
    if (!response.ok) throw new Error("Error escaneando documento");
    return response.json();
  },
  
  // --- NUEVO: POLLING COLA DE ESCÁNER ---
  async getPendingScans() {
    const response = await fetch(`${API_URL}/api/scans/queue`, {
        method: 'GET',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error obteniendo la cola de escaneo");
    return response.json();
  },
  async getScanStatus() {
    const response = await fetch(`${API_URL}/api/scans/status`, {
        method: 'GET',
        headers: getAuthHeaders()
    });
    if (!response.ok) return { processing_count: 0 };
    return response.json();
  },

  async deletePendingScan(id: string) {
    const response = await fetch(`${API_URL}/api/scans/queue/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error borrando el escaneo de la cola");
    return response.json();
  },

async uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/upload-logo`, {
        method: 'POST',
        headers: {
            // No ponemos Content-Type, el navegador lo pone solo al ser FormData
            'Authorization': `Bearer ${localStorage.getItem('hostly_token')}`
        },
        body: formData
    });
    if (!response.ok) throw new Error('Fallo al subir logo');
    return response.json();
},
};

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Bed {
  id: string;
  label: string;
}

export interface Room {
  id: string;
  name: string;
  beds: Bed[];
  priceDefault: number; // <--- NUEVO: Precio por defecto de la habitación
}

export interface Guest {
  id: string;
  name: string;
  surname: string;
  dni: string;
  dniType: "DNI" | "Pasaporte" | "NIE";
  dniExpeditionDate?: string;
  birthDate: string;
  sex: "M" | "F" | "O";
  nationality: string;
  phone?: string;
  email?: string;
  checkedIn: boolean;
}

export interface Booking {
  id: string;
  bedId: string;
  roomId: string;
  date: string;
  guest: Guest;
  groupId?: string;
  // NUEVOS CAMPOS ECONÓMICOS
  totalPrice: number;
  paid: boolean;
  paymentMethod: "EFECTIVO" | "TARJETA" | "BIZUM" | "OTRO";
  
}

export interface HostelData {
  name: string;
  address: string;
  phone: string;
  email: string;
  razonSocial: string;
  nif: string;
  domicilioFiscal: string;
  taxRate: number;
}

interface HostelStore {
  hostel: HostelData;
  rooms: Room[];
  bookings: Booking[];
  setHostel: (data: Partial<HostelData>) => void;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  addBooking: (booking: Booking) => void;
  addBookings: (bookings: Booking[]) => void;
  updateBooking: (bookingId: string, data: Partial<Booking>) => void;
  removeBooking: (bookingId: string) => void;
  getBookingsForDate: (date: string) => Booking[];
  getBookingForBed: (bedId: string, date: string) => Booking | undefined;
  setBookings: (bookings: Booking[]) => void;
}

export const useHostelStore = create<HostelStore>()(
  persist(
    (set, get) => ({
      hostel: {
        name: "",
        address: "",
        phone: "",
        email: "",
        razonSocial: "",
        nif: "",
        domicilioFiscal: "",
		taxRate: 10, // <--- Tasa de impuestos por defecto (10% por ejemplo)
      },
      rooms: [],
      bookings: [],
      setHostel: (data) =>
        set((s) => ({ hostel: { ...s.hostel, ...data } })),
      setRooms: (rooms) => set({ rooms }),
      addRoom: (room) => set((s) => ({ rooms: [...s.rooms, room] })),
      removeRoom: (roomId) =>
        set((s) => ({
          rooms: s.rooms.filter((r) => r.id !== roomId),
          bookings: s.bookings.filter((b) => b.roomId !== roomId),
        })),
      addBooking: (booking) =>
        set((s) => ({ bookings: [...s.bookings, booking] })),
      addBookings: (newBookings) => 
        set((s) => ({ bookings: [...s.bookings, ...newBookings] })),
      updateBooking: (bookingId, data) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === bookingId ? { ...b, ...data } : b
          ),
        })),
      removeBooking: (bookingId) =>
        set((s) => ({
          bookings: s.bookings.filter((b) => b.id !== bookingId),
        })),
      getBookingsForDate: (date) => get().bookings.filter((b) => b.date === date),
      getBookingForBed: (bedId, date) =>
        get().bookings.find((b) => b.bedId === bedId && b.date === date),
      setBookings: (bookings) => set({ bookings }),
    }),
    { name: "hostly-store" }
  )
);
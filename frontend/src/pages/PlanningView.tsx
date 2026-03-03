import React, { useState, useEffect, useRef } from "react";
import { useHostelStore, Booking, Guest, PendingScan } from "@/stores/hostelStore";
import { apiService, BookingData } from "../services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ChevronLeft, 
  ChevronRight, 
  BedDouble, 
  Plus,
  Euro,
  Phone,
  Copy,
  FileText,
  Trash2,
  X,
  Camera, 
  Loader2,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Split,
  FolderOpen,
  Hammer, // Nuevo import
  Ban     // Nuevo import
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  isWeekend,
  parseISO,
  addDays
} from "date-fns";
import { es } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription, 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// @ts-expect-error Librería sin tipos
import countries from "i18n-iso-countries";
// @ts-expect-error Librería sin tipos
import esLocale from "i18n-iso-countries/langs/es.json";

countries.registerLocale(esLocale);
const ALL_COUNTRIES = Object.values(countries.getNames("es", {select: "official"})) as string[];

// --- 1. DEFINICIONES DE TIPOS PARA EVITAR ANY ---

interface RoomResponse {
    id: string | number;
    name: string;
    price_default: number;
    beds: Array<{ id: string | number; label: string; is_maintenance?: boolean }>;
}

// Tipo exacto para los métodos de pago (coincide con Booking['paymentMethod'])
type PaymentMethodType = "EFECTIVO" | "TARJETA" | "BIZUM" | "OTRO";

interface IndividualPaymentState {
    paid: boolean;
    method: PaymentMethodType;
}

// Interfaz para la cola de escaneo
interface PendingScanItem {
    id: string;
    timestamp: number;
    data: {
        name: string;
        surname: string;
        dni: string;
        dniType: string;
        nationality: string;
        birthDate: string;
        sex: string;
    }
}

const emptyGuest = (): Guest => ({
  id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: "", surname: "", dni: "", dniType: "DNI", birthDate: "",
  sex: "M", nationality: "ESPAÑA", phone: "", email: "", checkedIn: false,
});

const PlanningView = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // pendingScans viene del store
  const { rooms, bookings, setBookings, addBookings, updateBooking, removeBooking, setRooms, pendingScans } = useHostelStore();

  const [selectedCells, setSelectedCells] = useState<{ bedId: string; date: string; roomId: string; bookingId?: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guestForms, setGuestForms] = useState<Guest[]>([]);
  const [departureDate, setDepartureDate] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estado global de pago
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("EFECTIVO");
  const [currentPrice, setCurrentPrice] = useState(0);

  // --- ESTADO PARA PAGOS INDIVIDUALES (TIPADO FUERTE) ---
  const [isIndividualPaymentMode, setIsIndividualPaymentMode] = useState(false);
  const [individualPayments, setIndividualPayments] = useState<IndividualPaymentState[]>([]);
  
  // --- ESTADO PARA EL ESCÁNER ---
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);

  // --- ESTADO PARA LA COLA ---
  const [showQueueSelector, setShowQueueSelector] = useState(false);
  const [targetIndexForQueue, setTargetIndexForQueue] = useState<number | null>(null);

  // --- REFERENCIAS PARA EL SCROLL ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const roomsData = await apiService.getRooms();
        // Mapeo seguro convirtiendo IDs a string e incluyendo estado de mantenimiento
        const formattedRooms = roomsData.map((r: RoomResponse) => ({
            id: String(r.id), 
            name: r.name,
            priceDefault: r.price_default,
            beds: r.beds.map((b) => ({ 
                id: String(b.id), 
                label: b.label,
                is_maintenance: b.is_maintenance // <--- Nuevo campo capturado
            }))
        }));
        setRooms(formattedRooms);

        const data = await apiService.getBookings();
        const formattedBookings: Booking[] = data.map((b) => ({
          id: b.id,
          bedId: b.bedId,
          roomId: b.bedId.split("-")[0],
          date: b.date,
          totalPrice: b.totalPrice || 0,
          paid: b.paid || false,
          paymentMethod: (b.paymentMethod as PaymentMethodType) || "EFECTIVO",
          groupId: b.groupId,
          guest: {
            id: `g-${b.id}`,
            name: b.guestName.split(" ")[0] || "Huésped",
            surname: b.guestName.split(" ")[1] || "",
            phone: b.phone || "",
            dni: b.dni || "",
            dniType: (b.dniType as Guest["dniType"]) || "DNI",
            nationality: b.nationality || "ESPAÑA",
            sex: (b.sex as Guest["sex"]) || "M",
            birthDate: b.birthDate || "",
            checkedIn: b.checkedIn,
          },
        }));
        setBookings(formattedBookings);
      } catch (error) {
        console.error("Error cargando planning:", error);
      }
    };
    loadData();
  }, [setBookings, setRooms]);

  // Lógica de Scroll
  const checkScroll = () => {
      if (scrollContainerRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
          setCanScrollLeft(scrollLeft > 0);
          setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
      }
  };

  useEffect(() => {
      checkScroll();
      window.addEventListener('resize', checkScroll);
      return () => window.removeEventListener('resize', checkScroll);
  }, [currentMonth, rooms]);

  const handleScroll = (direction: 'left' | 'right') => {
      if (scrollContainerRef.current) {
          const amount = 300;
          scrollContainerRef.current.scrollBy({
              left: direction === 'left' ? -amount : amount,
              behavior: 'smooth'
          });
      }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBooking = (bedId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return bookings.find((b) => b.bedId === bedId && b.date === dateStr);
  };

  const getAvailableBedsList = (targetDateStr: string) => {
    const dayBookings = bookings.filter((b) => b.date === targetDateStr);
    const occupiedBedIds = dayBookings.map(b => b.bedId);
    
    const list: { id: string; label: string; roomId: string }[] = [];
    rooms.forEach(r => {
        r.beds.forEach((b: any) => { // Usamos any temporalmente para acceder a is_maintenance si el tipo Room del store no está actualizado aún
            const isOccupied = occupiedBedIds.includes(b.id);
            const isMaintenance = b.is_maintenance; // <--- Check de mantenimiento
            const isCurrentlySelected = selectedCells.some(sc => sc.bedId === b.id && sc.date === targetDateStr);
            
            // Solo añadimos si NO está ocupada Y NO está en mantenimiento
            if ((!isOccupied && !isMaintenance) || isCurrentlySelected) {
                list.push({ id: b.id, label: `${r.name} - ${b.label}`, roomId: String(r.id) });
            }
        });
    });
    return list;
  };

  const handleDialogChange = (isOpen: boolean) => {
      setDialogOpen(isOpen);
      if (!isOpen) {
          setSelectedCells([]);
          setIsEditing(false);
          setEditingId(null);
          setIsIndividualPaymentMode(false);
      }
  };

  const updateGuestField = (index: number, field: keyof Guest, value: string | boolean) => {
    setGuestForms((prev) => {
        let processedValue = value;
        if (typeof value === "string" && ["name", "surname", "dni", "nationality"].includes(field)) {
            processedValue = value.toUpperCase();
        }
        return prev.map((g, i) => (i === index ? { ...g, [field]: processedValue } : g));
    });
  };

  const updateIndividualPayment = (index: number, field: 'paid' | 'method', value: boolean | string) => {
      setIndividualPayments(prev => prev.map((p, i) => {
          if (i !== index) return p;
          
          if (field === 'paid') {
              return { ...p, paid: value as boolean };
          } else {
              return { ...p, method: value as PaymentMethodType };
          }
      }));
  };

  const handleScanFile = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setScanningIndex(index);
      toast.info("Analizando documento...");

      try {
          const result = await apiService.scanDocument(file);
          
          if (result.error) {
              toast.error(result.error);
          } else {
              const data = result.data;
              setGuestForms(prev => prev.map((guest, i) => {
                  if (i === index) {
                      return {
                          ...guest,
                          ...data,
                          name: data.guestName || guest.name,
                      };
                  }
                  return guest;
              }));
              toast.success("¡Datos extraídos correctamente!");
          }
      } catch (error) {
          toast.error("Fallo al conectar con el servidor de escaneo");
      } finally {
          setScanningIndex(null);
          e.target.value = ""; 
      }
  };

  const handleUseFromQueue = (scan: PendingScan | PendingScanItem) => {
      if (targetIndexForQueue === null) return;

      setGuestForms(prev => prev.map((g, i) => {
          if (i === targetIndexForQueue) {
              return {
                  ...g,
                  ...scan.data,
                  name: scan.data.name || g.name,
                  dniType: (scan.data.dniType as Guest['dniType']) || 'DNI',
                  sex: (scan.data.sex as Guest['sex']) || 'M',
              };
          }
          return g;
      }));

      setShowQueueSelector(false);
      setTargetIndexForQueue(null);
      toast.success("Datos cargados desde la cola");
  };

  const handleCellClick = (bedId: string, roomId: string, date: Date, isMaintenance: boolean) => {
    // Si la cama está en mantenimiento, bloqueamos el click
    if (isMaintenance) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const existing = getBooking(bedId, date);

    if (existing) {
      let groupBookings = [existing];
      if (existing.groupId) {
          const siblings = bookings.filter(b => b.groupId === existing.groupId && b.date === dateStr);
          if (siblings.length > 0) groupBookings = siblings;
      }

      const cellsToSelect = groupBookings.map(b => ({ 
          bedId: b.bedId, 
          roomId: String(b.roomId), 
          date: b.date, 
          bookingId: b.id 
      }));
      
      const uniqueBeds = Array.from(new Set(groupBookings.map(b => b.bedId)));
      const guestsToEdit = uniqueBeds.map(bId => {
          return groupBookings.find(b => b.bedId === bId)?.guest || emptyGuest();
      });

      const totalGroupPrice = groupBookings.reduce((acc, b) => acc + b.totalPrice, 0);

      setIsEditing(true);
      setEditingId(existing.id); 
      setGuestForms(guestsToEdit);
      
      setIsPaid(groupBookings[0].paid);
      setPaymentMethod(groupBookings[0].paymentMethod as PaymentMethodType);
      
      setIndividualPayments(groupBookings.map(b => ({
          paid: b.paid,
          method: b.paymentMethod as PaymentMethodType
      })));

      setCurrentPrice(totalGroupPrice);
      setSelectedCells(cellsToSelect);
      setDepartureDate(format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd'));

      setDialogOpen(true);
      return;
    }

    const isActuallyOccupied = bookings.some(b => b.bedId === bedId && b.date === dateStr);
    if (isActuallyOccupied) {
      toast.error("Esta cama ya no está disponible");
      return;
    }

    setIsEditing(false);
    setEditingId(null);
    const isSelected = selectedCells.some((c) => c.bedId === bedId && c.date === dateStr);
    if (isSelected) {
      setSelectedCells((prev) => prev.filter((c) => !(c.bedId === bedId && c.date === dateStr)));
    } else {
      setSelectedCells((prev) => [...prev, { bedId, roomId: String(roomId), date: dateStr }]);
    }
  };

  const openCreateDialog = () => {
    if (selectedCells.length === 0) return;
    setIsEditing(false);
    setEditingId(null);
    setIsIndividualPaymentMode(false);

    const uniqueBedIds = Array.from(new Set(selectedCells.map((c) => c.bedId)));
    const initialForms = uniqueBedIds.map(() => emptyGuest());
    setGuestForms(initialForms);
    setIndividualPayments(initialForms.map(() => ({ paid: false, method: 'EFECTIVO' })));

    let totalEstimated = 0;
    selectedCells.forEach((cell) => {
      const room = rooms.find((r) => String(r.id) === String(cell.roomId));
      // @ts-ignore (por si priceDefault viene como price_default en tipos viejos)
      totalEstimated += room?.priceDefault || room?.price_default || 15;
    });
    setCurrentPrice(totalEstimated);
    
    setIsPaid(false);
    setPaymentMethod("EFECTIVO");

    const sortedDates = selectedCells.map(c => c.date).sort();
    if(sortedDates.length > 0) {
        setDepartureDate(format(addDays(parseISO(sortedDates[sortedDates.length-1]), 1), 'yyyy-MM-dd'));
    }

    setDialogOpen(true);
  };

  const handleSave = async (asReservation: boolean) => {
    for (const g of guestForms) {
      if (!asReservation && (!g.name || !g.surname || !g.dni || !g.birthDate)) {
        toast.error("Faltan datos para el check-in");
        return;
      }
      if (asReservation && !g.name) {
        toast.error("El nombre es obligatorio");
        return;
      }
    }

    if (!isEditing) {
      const conflict = selectedCells.find(cell => 
        bookings.some(b => b.bedId === cell.bedId && b.date === cell.date)
      );
      if (conflict) {
        toast.error("Conflicto detectado: Alguna cama ya está ocupada");
        setSelectedCells([]);
        setDialogOpen(false);
        return;
      }
    }

    try {
      const uniqueBedIds = Array.from(new Set(selectedCells.map(c => c.bedId)));
      const apiPromises = [];
      const newBookings: Booking[] = [];
      const groupId = uniqueBedIds.length > 1 || selectedCells.length > 1 ? `group-${Date.now()}` : undefined;
      const pricePerCell = currentPrice / (selectedCells.length || 1);

      for (let i = 0; i < uniqueBedIds.length; i++) {
          const bedId = uniqueBedIds[i];
          const guest = guestForms[i];
          const cells = selectedCells.filter(c => c.bedId === bedId);
          
          let thisGuestPaid = isPaid;
          let thisGuestMethod: PaymentMethodType = paymentMethod;

          if (isIndividualPaymentMode && individualPayments[i]) {
              thisGuestPaid = individualPayments[i].paid;
              thisGuestMethod = individualPayments[i].method;
          }

          if (isEditing && editingId) {
             for (const cell of cells) {
                const original = bookings.find(b => b.id === cell.bookingId);
                if (original) {
                    const data: BookingData = {
                        id: original.id, bedId: cell.bedId, guestName: `${guest.name} ${guest.surname}`.trim(),
                        date: original.date, checkedIn: !asReservation, phone: guest.phone,
                        dni: guest.dni, dniType: guest.dniType, nationality: guest.nationality,
                        sex: guest.sex, birthDate: guest.birthDate, totalPrice: pricePerCell,
                        paid: thisGuestPaid, paymentMethod: thisGuestMethod, groupId: original.groupId 
                    };
                    apiPromises.push(apiService.saveBooking(data));
                    updateBooking(original.id, { 
                        bedId: cell.bedId, roomId: cell.roomId, guest: { ...guest, checkedIn: !asReservation },
                        totalPrice: pricePerCell, paid: thisGuestPaid, paymentMethod: thisGuestMethod
                    });
                }
             }
          } else {
             for (const cell of cells) {
                const bId = `bk-${Date.now()}-${cell.bedId}-${cell.date}`;
                const bData: BookingData = {
                  id: bId, bedId: cell.bedId, guestName: `${guest.name} ${guest.surname}`.trim(),
                  date: cell.date, checkedIn: !asReservation, phone: guest.phone,
                  dni: guest.dni, dniType: guest.dniType, nationality: guest.nationality,
                  sex: guest.sex, birthDate: guest.birthDate, totalPrice: pricePerCell,
                  paid: thisGuestPaid, paymentMethod: thisGuestMethod, groupId: groupId 
                };
                apiPromises.push(apiService.saveBooking(bData));
                newBookings.push({
                  id: bId, bedId: cell.bedId, roomId: cell.roomId, date: cell.date, groupId: groupId,
                  guest: { ...guest, checkedIn: !asReservation }, totalPrice: pricePerCell, paid: thisGuestPaid, paymentMethod: thisGuestMethod,
                });
             }
          }
      }

      await Promise.all(apiPromises);
      if (!isEditing) addBookings(newBookings);
      toast.success(asReservation ? "Reserva actualizada" : "Check-in realizado");
      setDialogOpen(false);
      setSelectedCells([]);
      setIsEditing(false);
      setEditingId(null);
    } catch (e) { 
        console.error(e);
        toast.error("Error al guardar"); 
    }
  };

  const handleDeleteCurrentEdit = async () => {
    if (!confirm("¿Estás seguro de eliminar?")) return;
    try {
        const promises = selectedCells.map(c => {
            if (c.bookingId) return apiService.deleteBooking(c.bookingId);
            return Promise.resolve();
        });
        await Promise.all(promises);
        selectedCells.forEach(c => { if (c.bookingId) removeBooking(c.bookingId); });
        toast.success("Eliminado correctamente");
        setDialogOpen(false);
        setSelectedCells([]);
        setIsEditing(false);
    } catch (e) { toast.error("Error al eliminar"); }
  };

  // --- CÁLCULO DE ESTADÍSTICAS (Nuevo) ---
  const totalBedsCount = rooms.reduce((acc, r) => acc + r.beds.length, 0);
  const maintenanceBedsCount = rooms.reduce((acc, r) => acc + r.beds.filter((b: any) => b.is_maintenance).length, 0);
  const occupied = bookings.filter((b) => b.date === format(new Date(), "yyyy-MM-dd") && b.guest.checkedIn).length;
  const reserved = bookings.filter((b) => b.date === format(new Date(), "yyyy-MM-dd") && !b.guest.checkedIn).length;
  // Restamos también las de mantenimiento
  const available = totalBedsCount - occupied - reserved - maintenanceBedsCount;

  return (
    <div className="w-full max-w-full animate-fade-in p-2 md:p-6 overflow-hidden relative">
      
      {/* Estilos para ocultar scrollbar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            Planning de Ocupación
        </h1>
        <div className="flex items-center justify-between gap-4 bg-card p-1 rounded-md border shadow-sm">
           <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
             <ChevronLeft className="h-5 w-5" />
           </Button>
           <h2 className="font-display text-lg font-bold capitalize w-32 text-center">
             {format(currentMonth, "MMMM yyyy", { locale: es })}
           </h2>
           <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
             <ChevronRight className="h-5 w-5" />
           </Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-3 mb-6'>
          <Badge variant='outline' className='border-primary/30 text-muted-foreground'>
              {available} libres
          </Badge>
          <Badge variant='outline' className='border-gold text-gold bg-gold/5'>
              {reserved} reservas
          </Badge>
          <Badge variant='outline' className='border-primary text-primary bg-primary/5'>
              {occupied} en albergue
          </Badge>
          {maintenanceBedsCount > 0 && (
              <Badge variant='outline' className='border-red-200 text-red-400 bg-red-50/50'>
                  {maintenanceBedsCount} averiadas
              </Badge>
          )}
      </div>

      {selectedCells.length > 0 && !isEditing && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 flex items-center gap-2">
              <Button onClick={openCreateDialog} size="lg" className="shadow-xl bg-primary hover:bg-primary/90 text-white gap-2 px-6 h-14 rounded-full">
                  <Plus className="h-6 w-6" /> Reservar Selección ({selectedCells.length})
              </Button>
              <Button onClick={() => setSelectedCells([])} size="icon" variant="outline" className="h-14 w-14 rounded-full shadow-xl bg-red-500 hover:bg-red-600 text-white border-none">
                  <X className="h-6 w-6" />
              </Button>
          </div>
      )}

      {/* --- CARD DEL PLANNING --- */}
      <Card className="border shadow-md w-full relative z-0 group">
        
        {/* Botón Flotante Izquierda */}
        <div className={`absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white/90 to-transparent z-50 flex items-center justify-start pl-2 transition-opacity duration-300 pointer-events-none ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`}>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full shadow-md pointer-events-auto bg-white/90 hover:bg-white border border-gray-100" onClick={() => handleScroll('left')}>
                <ChevronLeft className="h-6 w-6 text-primary" />
            </Button>
        </div>

        {/* Botón Flotante Derecha */}
        <div className={`absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white/90 to-transparent z-50 flex items-center justify-end pr-2 transition-opacity duration-300 pointer-events-none ${canScrollRight ? 'opacity-100' : 'opacity-0'}`}>
            <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full shadow-md pointer-events-auto bg-white/90 hover:bg-white border border-gray-100" onClick={() => handleScroll('right')}>
                <ChevronRight className="h-6 w-6 text-primary" />
            </Button>
        </div>

        {/* Contenedor de Scroll */}
        <div 
            className="w-full overflow-auto max-h-[75vh] no-scrollbar" 
            ref={scrollContainerRef}
            onScroll={checkScroll}
        >
          <div className="w-fit min-w-full">
            
            {/* --- CABECERA DE DÍAS (Sticky Top) --- */}
            <div className="flex border-b bg-muted/30 sticky top-0 z-30 h-10 w-full shadow-sm"> 
              <div className="w-36 shrink-0 p-2 font-bold text-xs border-r bg-white sticky left-0 top-0 z-40 shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.1)] flex items-center justify-center text-muted-foreground border-b">
                Hab.
              </div>
              {days.map((day) => {
                const isWeekendDay = isWeekend(day);
                const isTodayDay = isToday(day);
                return (
                  <div key={day.toString()} className={`flex-1 min-w-[32px] text-center flex flex-col justify-center border-r last:border-r-0 bg-white ${isWeekendDay ? "bg-slate-50" : ""} ${isTodayDay ? "bg-primary/10 text-primary font-bold border-b-2 border-b-primary" : ""}`}>
                    <span className="text-[9px] uppercase leading-none opacity-70 mb-0.5">{format(day, "EEEEE", { locale: es })}</span>
                    <span className="text-xs leading-none">{format(day, "d")}</span>
                  </div>
                );
              })}
            </div>

            <div className="divide-y">
              {rooms.map((room) => (
                <React.Fragment key={room.id}>
                  {/* --- FILA NOMBRE HABITACIÓN (Sticky Left) --- */}
                  <div className="bg-slate-100/50 border-b flex h-8 w-full">
                    <div className="w-36 shrink-0 px-3 flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r bg-slate-100/90 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] truncate">
                      {room.name}
                    </div>
                    <div className="flex-1 bg-slate-100/50 h-full"></div> 
                  </div>

                  {/* --- FILAS DE CAMAS --- */}
                  {room.beds.map((bed: any) => (
                    <div key={bed.id} className="flex h-10 hover:bg-slate-50 transition-colors w-full">
                      {/* Columna Nombre Cama (Sticky Left) */}
                      <div className="w-36 shrink-0 flex items-center px-3 border-r bg-white text-xs font-medium sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <BedDouble className={`h-3 w-3 mr-2 shrink-0 ${bed.is_maintenance ? 'text-red-400' : 'text-muted-foreground'}`} />
                        <span className={`truncate ${bed.is_maintenance ? 'text-red-600 font-bold' : ''}`} title={bed.label}>{bed.label}</span>
                        {bed.is_maintenance && <Hammer className="h-3 w-3 ml-auto text-red-400" />}
                      </div>

                      {/* Celdas del Calendario */}
                      {days.map((day) => {
                        const booking = getBooking(bed.id, day);
                        const isWeekendDay = isWeekend(day);
                        const dateStr = format(day, "yyyy-MM-dd");
                        const isSelected = selectedCells.some(c => c.bedId === bed.id && c.date === dateStr);
                        
                        // LÓGICA DE MANTENIMIENTO AÑADIDA
                        const isBroken = bed.is_maintenance; 

                        let cellBg = isWeekendDay ? "bg-slate-50" : "bg-white hover:bg-slate-50";
                        let cursorClass = "cursor-pointer";

                        if (isBroken) {
                            // Estilo rayado y cursor bloqueado
                            cellBg = "bg-slate-100 opacity-60 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#e2e8f0_5px,#e2e8f0_10px)]";
                            cursorClass = "cursor-not-allowed";
                        } else if (isSelected) {
                            cellBg = "bg-blue-100/80 ring-1 ring-inset ring-blue-300";
                        }

                        let bookingColorClass = "bg-gold hover:bg-gold/90";
                        if (booking?.guest.checkedIn) bookingColorClass = "bg-emerald-600 hover:bg-emerald-700";
                        else if (booking?.paid) bookingColorClass = "bg-green-500 hover:bg-green-600";

                        return (
                          <div 
                            key={day.toString()} 
                            onClick={() => handleCellClick(bed.id, String(room.id), day, isBroken)} 
                            className={`flex-1 min-w-[32px] border-r last:border-r-0 relative group transition-colors ${cellBg} ${cursorClass}`}
                          >
                            {/* Icono de bloqueado si está averiada */}
                            {isBroken ? (
                                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                                    <Ban className="h-4 w-4 text-slate-400" />
                                </div>
                            ) : booking ? (
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <div className={`absolute inset-0.5 rounded-[2px] text-[8px] flex items-center justify-center font-bold text-white shadow-sm overflow-hidden select-none cursor-pointer ${bookingColorClass}`}>
                                        {booking.guest.name.charAt(0).toUpperCase()}
                                        {booking.guest.checkedIn && !booking.paid && (
                                            <div className="absolute top-0 right-0 p-[1px]">
                                                <AlertTriangle className="h-2.5 w-2.5 text-yellow-300 fill-yellow-600" />
                                            </div>
                                        )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-50 bg-popover text-popover-foreground shadow-xl">
                                    <div className="text-xs space-y-1">
                                        <p className="font-bold text-sm">{booking.guest.name} {booking.guest.surname}</p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="h-5 px-1">{booking.guest.nationality}</Badge>
                                            {booking.paid ? <span className="text-emerald-600 font-bold text-[10px]">PAGADO</span> : <span className="text-red-500 font-bold text-[10px]">PENDIENTE</span>}
                                        </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? `Editar` : `Nueva Reserva`}</DialogTitle>
            <DialogDescription className="hidden">Formulario</DialogDescription>
          </DialogHeader>

          {!isEditing && (
             <div className="flex items-center gap-4 p-4 bg-secondary/10 rounded-lg mb-4">
                 <div className="flex flex-col gap-1 flex-1">
                     <Label className="text-xs text-muted-foreground">Fecha Salida</Label>
                     <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} min={format(addDays(currentMonth, 1), 'yyyy-MM-dd')} className="bg-white" />
                 </div>
             </div>
          )}

          <div className="flex flex-col gap-2 mb-2">
              {guestForms.length > 1 && (
                  <>
                    <Button type='button' variant='outline' size='sm' className='w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 mb-2' onClick={() => {
                            const first = guestForms[0];
                            setGuestForms((prev) => prev.map((g, i) => i === 0 ? g : { ...g, name: first.name, surname: first.surname, nationality: first.nationality, phone: first.phone, email: first.email }));
                            toast.info('Datos copiados');
                        }}>
                        <Copy className='w-4 h-4 mr-2' /> Copiar datos del 1º huésped a todos
                    </Button>
                    <div className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${isIndividualPaymentMode ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-transparent'}`}>
                        <input type='checkbox' id='splitPayment' checked={isIndividualPaymentMode} onChange={(e) => setIsIndividualPaymentMode(e.target.checked)} className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer' />
                        <label htmlFor='splitPayment' className='text-sm font-medium cursor-pointer select-none text-foreground flex items-center gap-2'>
                            <Split className='h-4 w-4 text-primary' /> Gestionar pagos por separado
                        </label>
                    </div>
                  </>
              )}
          </div>

          <div className="space-y-6 py-2">
            {guestForms.map((guest, index) => {
              const associatedCell = selectedCells[index * (selectedCells.length / guestForms.length)];
              const targetDate = associatedCell ? associatedCell.date : format(new Date(), "yyyy-MM-dd");
              const availableBeds = getAvailableBedsList(targetDate);

              return (
                <div key={index} className="space-y-4 p-4 border rounded-xl relative mt-3 transition-all bg-secondary/10">
                  <div className="absolute -top-3 left-0 z-10 pl-2">
                      <Select value={selectedCells[index]?.bedId} onValueChange={(newBedId) => {
                              const bedInfo = availableBeds.find(b => b.id === newBedId);
                              if (bedInfo) {
                                  const newCells = [...selectedCells];
                                  newCells[index] = { ...newCells[index], bedId: newBedId, roomId: bedInfo.roomId };
                                  setSelectedCells(newCells);
                              }
                          }}
                      >
                          <SelectTrigger className="h-6 text-[11px] bg-primary text-primary-foreground border-none rounded-full px-3 font-semibold shadow-sm focus:ring-0 w-fit min-w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              {availableBeds.map(b => (<SelectItem key={b.id} value={b.id} className="text-xs font-medium">{b.label}</SelectItem>))}
                          </SelectContent>
                      </Select>
                  </div>
                  
                  <div className="pt-2 flex gap-2">
                        <div className="flex-1 flex gap-2">
                            <input type="file" accept="image/*" capture="environment" id={`dni-scanner-planning-${index}`} className="hidden" onChange={(e) => handleScanFile(index, e)} />
                            <Button type="button" variant="outline" className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" onClick={() => document.getElementById(`dni-scanner-planning-${index}`)?.click()} disabled={scanningIndex === index}>
                                {scanningIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                {scanningIndex === index ? "Procesando..." : "Escanear DNI"}
                            </Button>
                            {pendingScans.length > 0 && (
                                <Button type='button' variant='outline' className='bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200' onClick={() => { setTargetIndexForQueue(index); setShowQueueSelector(true); }} title="Usar escaneo guardado">
                                    <FolderOpen className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Cola ({pendingScans.length})</span>
                                    <span className="sm:hidden">({pendingScans.length})</span>
                                </Button>
                            )}
                        </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2"><Label>Nombre</Label><Input value={guest.name} onChange={(e) => updateGuestField(index, "name", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Apellidos</Label><Input value={guest.surname} onChange={(e) => updateGuestField(index, "surname", e.target.value)} /></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Tipo Doc.</Label><Select value={guest.dniType} onValueChange={(v) => updateGuestField(index, "dniType", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DNI">DNI</SelectItem><SelectItem value="Pasaporte">Pasaporte</SelectItem><SelectItem value="NIE">NIE</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2 md:col-span-2"><Label>Nº Documento</Label><Input value={guest.dni} onChange={(e) => updateGuestField(index, "dni", e.target.value)} /></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>Nacionalidad</Label><Input list={`countries-list-${index}`} value={guest.nationality} onChange={(e) => updateGuestField(index, "nationality", e.target.value)} /><datalist id={`countries-list-${index}`}>{ALL_COUNTRIES.map((c: string) => <option key={c} value={c.toUpperCase()} />)}</datalist></div>
                      <div className="space-y-2"><Label>Sexo</Label><Select value={guest.sex} onValueChange={(v) => updateGuestField(index, "sex", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="M">Hombre</SelectItem><SelectItem value="F">Mujer</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label>F. Nacimiento</Label><Input type="date" value={guest.birthDate} onChange={(e) => updateGuestField(index, "birthDate", e.target.value)} /></div>
                  </div>

                  {isIndividualPaymentMode && (
                        <div className='mt-2 p-3 bg-slate-50 border rounded-lg flex items-center justify-between gap-3 animate-fade-in'>
                            <div className='flex items-center space-x-3 cursor-pointer select-none' onClick={() => updateIndividualPayment(index, 'paid', !individualPayments[index]?.paid)}>
                                <input type='checkbox' checked={individualPayments[index]?.paid || false} readOnly className='h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer' />
                                <span className={`text-sm font-bold ${individualPayments[index]?.paid ? 'text-emerald-600' : 'text-muted-foreground'}`}>{individualPayments[index]?.paid ? "PAGADO" : "Marcar como Pagado"}</span>
                            </div>
                            {individualPayments[index]?.paid && (
                                <Select value={individualPayments[index]?.method || 'EFECTIVO'} onValueChange={(v) => updateIndividualPayment(index, 'method', v)}>
                                    <SelectTrigger className='h-9 w-[130px] bg-white'><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value='EFECTIVO'>Efectivo</SelectItem><SelectItem value='TARJETA'>Tarjeta</SelectItem><SelectItem value='BIZUM'>Bizum</SelectItem></SelectContent>
                                </Select>
                            )}
                        </div>
                    )}
                </div>
              );
            })}
          </div>

          {!isIndividualPaymentMode && (
              <div className='flex flex-col gap-2 border-t pt-4 border-gray-200 mt-4 bg-slate-50 p-4 rounded-lg animate-fade-in'>
                  <div className='flex items-center justify-between'><Label className='font-bold flex items-center gap-1 text-lg'><Euro className='h-5 w-5' /> Total a Cobrar:</Label><Input type='number' value={currentPrice} onChange={(e) => setCurrentPrice(Number(e.target.value))} className='w-32 text-right font-bold bg-white text-lg h-10' /></div>
                  <div className='flex items-center justify-between gap-3 mt-2'>
                      <div className='flex items-center space-x-2 bg-white px-3 py-2 rounded-md border flex-1 cursor-pointer hover:bg-slate-50 transition-colors' onClick={() => setIsPaid(!isPaid)}>
                          <input type='checkbox' id='paid' checked={isPaid} readOnly className='h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer' />
                          <label htmlFor='paid' className={`text-sm font-bold cursor-pointer flex-1 ${isPaid ? 'text-emerald-600' : 'text-muted-foreground'}`}>{isPaid ? "PAGADO (TODO EL GRUPO)" : "Marcar como Pagado"}</label>
                      </div>
                      {isPaid && (<div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /><Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethodType)}><SelectTrigger className='w-[140px] h-10 bg-white font-medium'><SelectValue /></SelectTrigger><SelectContent><SelectItem value='EFECTIVO'>Efectivo</SelectItem><SelectItem value='TARJETA'>Tarjeta</SelectItem><SelectItem value='BIZUM'>Bizum</SelectItem></SelectContent></Select></div>)}
                  </div>
              </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <div className="mr-auto flex gap-2">
                {isEditing && (<Button type="button" variant="destructive" onClick={handleDeleteCurrentEdit} title="Eliminar reserva"><Trash2 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Eliminar</span></Button>)}
                {isEditing && editingId && (<Button type="button" variant="secondary" onClick={() => { toast.info("Descargando recibo..."); apiService.downloadInvoice(editingId).catch(() => toast.error("Error al descargar")); }}><FileText className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Recibo</span></Button>)}
            </div>
            <Button variant="outline" className="border-gold text-gold" onClick={() => handleSave(true)}>{isEditing ? "Guardar Cambios" : "Reservar"}</Button>
            <Button onClick={() => handleSave(false)}>{isEditing ? "Confirmar + Check-in" : "Confirmar Check-in"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL PARA LA COLA --- */}
      <Dialog open={showQueueSelector} onOpenChange={setShowQueueSelector}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Seleccionar de la Cola</DialogTitle>
                  <DialogDescription>Elige un DNI escaneado previamente para rellenar los datos.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                  {pendingScans.map(scan => (
                      <div key={scan.id} onClick={() => handleUseFromQueue(scan)} className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer flex justify-between items-center group">
                          <div>
                              <p className="font-bold">{scan.data.name} {scan.data.surname}</p>
                              <p className="text-xs text-muted-foreground">{scan.data.dni} • {format(scan.timestamp, 'HH:mm')}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 text-green-600">
                              <CheckCircle2 className="h-5 w-5" />
                          </Button>
                      </div>
                  ))}
                  {pendingScans.length === 0 && <p className="text-center text-muted-foreground py-4">La cola está vacía.</p>}
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanningView;
import React, { useState, useEffect, useMemo } from "react";
import { useHostelStore, Booking, Guest } from "@/stores/hostelStore";
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
  StretchHorizontal,
  Plus,
  Euro,
  Phone,
  Copy,
  Users,
  FileText,
  Trash2,
  X,
  Camera, 
  Loader2
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
  parseISO
} from "date-fns";
import { es } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// @ts-ignore
import countries from "i18n-iso-countries";
// @ts-ignore
import esLocale from "i18n-iso-countries/langs/es.json";
countries.registerLocale(esLocale);
const ALL_COUNTRIES = Object.values(countries.getNames("es", {select: "official"})) as string[];

const emptyGuest = (): Guest => ({
  id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: "", surname: "", dni: "", dniType: "DNI", birthDate: "",
  sex: "M", nationality: "España", phone: "", email: "", checkedIn: false,
});

const PlanningView = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { rooms, bookings, setBookings, addBookings, updateBooking, removeBooking, setRooms } = useHostelStore();

  const [selectedCells, setSelectedCells] = useState<{ bedId: string; date: string; roomId: string; bookingId?: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guestForms, setGuestForms] = useState<Guest[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"EFECTIVO" | "TARJETA" | "BIZUM" | "OTRO">("EFECTIVO");
  const [currentPrice, setCurrentPrice] = useState(0);

  const [isGroupMode, setIsGroupMode] = useState(false);
  
  // --- ESTADO PARA EL ESCÁNER ---
  const [scanningIndex, setScanningIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const roomsData = await apiService.getRooms();
        const formattedRooms = roomsData.map((r: any) => ({
            id: r.id, 
            name: r.name,
            priceDefault: r.price_default,
            beds: r.beds.map((b: any) => ({ id: b.id, label: b.label }))
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
          paymentMethod: (b.paymentMethod as Booking["paymentMethod"]) || "EFECTIVO",
          groupId: b.groupId,
          guest: {
            id: `g-${b.id}`,
            name: b.guestName.split(" ")[0] || "Huésped",
            surname: b.guestName.split(" ")[1] || "",
            phone: b.phone || "",
            dni: b.dni || "",
            dniType: (b.dniType as Guest["dniType"]) || "DNI",
            nationality: b.nationality || "España",
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
        r.beds.forEach(b => {
            const isOccupied = occupiedBedIds.includes(b.id);
            const isCurrentlySelected = selectedCells.some(sc => sc.bedId === b.id && sc.date === targetDateStr);
            if (!isOccupied || isCurrentlySelected) {
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
      }
  };

  // --- FUNCIÓN ACTUALIZADA: FORZAR MAYÚSCULAS ---
  const updateGuestField = (index: number, field: keyof Guest, value: string | boolean) => {
    setGuestForms((prev) => {
        let processedValue = value;
        if (typeof value === "string" && ["name", "surname", "dni", "nationality"].includes(field)) {
            processedValue = value.toUpperCase();
        }

        const newForms = prev.map((g, i) => (i === index ? { ...g, [field]: processedValue } : g));
        
        if (isGroupMode && index === 0) {
            return newForms.map((g, i) => {
                if (i === 0) return g; 
                if (['name', 'surname', 'phone', 'email', 'nationality'].includes(field)) {
                    return { ...g, [field]: processedValue };
                }
                return g;
            });
        }
        return newForms;
    });
  };

  // --- NUEVA FUNCIÓN: MANEJAR EL ESCÁNER ---
  const handleScanFile = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setScanningIndex(index);
      toast.info("Analizando documento con Inteligencia Artificial...");

      try {
          const result = await apiService.scanDocument(file);
          
          if (result.error) {
              toast.error(result.error);
          } else {
              const data = result.data;
              console.log("Datos extraídos por el backend:", data);

              setGuestForms(prev => prev.map((guest, i) => {
                  if (i === index) {
                      return {
                          ...guest,
                          name: data.guestName || guest.name,
                          surname: data.surname || guest.surname,
                          dni: data.dni || guest.dni,
                          birthDate: data.birthDate || guest.birthDate,
                          nationality: data.nationality || guest.nationality,
                      };
                  }
                  if (isGroupMode && index === 0 && i !== 0) {
                      return {
                          ...guest,
                          name: data.guestName || guest.name,
                          surname: data.surname || guest.surname,
                          nationality: data.nationality || guest.nationality,
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

  const handleCellClick = (bedId: string, roomId: string, date: Date) => {
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
      setPaymentMethod(groupBookings[0].paymentMethod);
      setCurrentPrice(totalGroupPrice);
      setSelectedCells(cellsToSelect);
      setIsGroupMode(false); 
      
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
    setIsPaid(false);
    setPaymentMethod("EFECTIVO");
    
    setIsGroupMode(selectedCells.length > 1);

    const uniqueBedIds = Array.from(new Set(selectedCells.map((c) => c.bedId)));
    const initialForms = uniqueBedIds.map(() => emptyGuest());
    setGuestForms(initialForms);

    let totalEstimated = 0;
    selectedCells.forEach((cell) => {
      const room = rooms.find((r) => String(r.id) === String(cell.roomId));
      totalEstimated += room?.priceDefault || 15;
    });
    setCurrentPrice(totalEstimated);
    
    setDialogOpen(true);
  };

  const handleSave = async (asReservation: boolean) => {
    for (const g of guestForms) {
      if (!asReservation && (!g.name || !g.surname || !g.dni || !g.birthDate)) {
        toast.error("Faltan datos (DNI, Nacimiento...) para el check-in");
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
        toast.error("Conflicto detectado: Alguna cama ya ha sido reservada");
        setSelectedCells([]);
        setDialogOpen(false);
        return;
      }
    }

    try {
      const uniqueBedIds = Array.from(new Set(selectedCells.map(c => c.bedId)));

      if (isEditing && editingId) {
        const pricePerCell = currentPrice / (selectedCells.length || 1);
        const apiPromises = [];

        for (let i = 0; i < uniqueBedIds.length; i++) {
            const guest = guestForms[i];
            const cellsForThisGuest = selectedCells.filter((_, cellIndex) => Math.floor(cellIndex / (selectedCells.length / uniqueBedIds.length)) === i);
            
            for (const cell of cellsForThisGuest) {
                const original = bookings.find(b => b.id === cell.bookingId);
                if (original) {
                    const data: BookingData = {
                        id: original.id,
                        bedId: cell.bedId,
                        guestName: `${guest.name} ${guest.surname}`.trim(),
                        date: original.date,
                        checkedIn: !asReservation,
                        phone: guest.phone,
                        dni: guest.dni,
                        dniType: guest.dniType,
                        nationality: guest.nationality,
                        sex: guest.sex,
                        birthDate: guest.birthDate,
                        totalPrice: pricePerCell,
                        paid: isPaid,
                        paymentMethod: paymentMethod,
                        groupId: original.groupId 
                    };
                    apiPromises.push(apiService.saveBooking(data));
                    updateBooking(original.id, { 
                        bedId: cell.bedId,
                        roomId: cell.roomId,
                        guest: { ...guest, checkedIn: !asReservation },
                        totalPrice: pricePerCell, paid: isPaid, paymentMethod: paymentMethod
                    });
                }
            }
        }
        await Promise.all(apiPromises);
        toast.success("Reserva actualizada");
      } 
      else {
        const pricePerCell = currentPrice / (selectedCells.length || 1);
        const apiPromises = [];
        const newBookings: Booking[] = [];
        const groupId = uniqueBedIds.length > 1 || selectedCells.length > 1 ? `group-${Date.now()}` : undefined;

        for (let i = 0; i < uniqueBedIds.length; i++) {
          const bedId = uniqueBedIds[i];
          const guest = guestForms[i];
          const cells = selectedCells.filter(c => c.bedId === bedId);

          for (const cell of cells) {
            const bId = `bk-${Date.now()}-${cell.bedId}-${cell.date}`;
            const bData: BookingData = {
              id: bId, bedId: cell.bedId, guestName: `${guest.name} ${guest.surname}`.trim(),
              date: cell.date, checkedIn: !asReservation, phone: guest.phone,
              dni: guest.dni, dniType: guest.dniType, nationality: guest.nationality,
              sex: guest.sex, birthDate: guest.birthDate, totalPrice: pricePerCell,
              paid: isPaid, paymentMethod: paymentMethod,
              groupId: groupId 
            };
            apiPromises.push(apiService.saveBooking(bData));
            newBookings.push({
              id: bId, bedId: cell.bedId, roomId: cell.roomId, date: cell.date,
              groupId: groupId,
              guest: { ...guest, checkedIn: !asReservation }, totalPrice: pricePerCell,
              paid: isPaid, paymentMethod: paymentMethod,
            });
          }
        }
        await Promise.all(apiPromises);
        addBookings(newBookings);
        toast.success("Reservas creadas correctamente");
      }
      setDialogOpen(false);
      setSelectedCells([]);
    } catch (e) { toast.error("Error al guardar"); }
  };

  const handleDeleteCurrentEdit = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta reserva/check-in? La cama quedará libre al instante.")) return;
    try {
        const promises = selectedCells.map(c => {
            if (c.bookingId) return apiService.deleteBooking(c.bookingId);
            return Promise.resolve();
        });
        await Promise.all(promises);
        
        selectedCells.forEach(c => {
            if (c.bookingId) removeBooking(c.bookingId);
        });
        
        toast.success("Eliminado correctamente");
        setDialogOpen(false);
        setSelectedCells([]);
        setIsEditing(false);
    } catch (e) {
        toast.error("Error al eliminar");
    }
  };

  return (
    <div className="w-full max-w-full animate-fade-in p-2 md:p-6 overflow-hidden relative">
      
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
            <StretchHorizontal className="h-8 w-8 text-primary"/> Planning de Ocupación
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

      {/* --- BURBUJA DE SELECCIÓN CON BOTÓN X --- */}
      {selectedCells.length > 0 && !isEditing && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 flex items-center gap-2">
              <Button onClick={openCreateDialog} size="lg" className="shadow-xl bg-primary hover:bg-primary/90 text-white gap-2 px-6 h-14 rounded-full">
                  <Plus className="h-6 w-6" />
                  Reservar Selección ({selectedCells.length})
              </Button>
              <Button 
                onClick={() => setSelectedCells([])} 
                size="icon" 
                variant="outline" 
                title="Cancelar selección"
                className="h-14 w-14 rounded-full shadow-xl bg-white text-destructive border-destructive/20 hover:bg-destructive hover:text-white transition-colors"
              >
                  <X className="h-6 w-6" />
              </Button>
          </div>
      )}

      <Card className="overflow-hidden border shadow-md w-full relative z-0">
        <div className="w-full overflow-x-auto">
          <div className="w-fit min-w-full">
            
            <div className="flex border-b bg-muted/30 sticky top-0 z-[5] h-10 w-full"> 
              <div className="w-36 shrink-0 p-2 font-bold text-xs border-r bg-white sticky left-0 z-[10] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] flex items-center justify-center text-muted-foreground">
                Hab.
              </div>
              {days.map((day) => {
                const isWeekendDay = isWeekend(day);
                const isTodayDay = isToday(day);
                return (
                  <div key={day.toString()} className={`flex-1 min-w-[32px] text-center flex flex-col justify-center border-r last:border-r-0 ${isWeekendDay ? "bg-slate-50" : ""} ${isTodayDay ? "bg-primary/10 text-primary font-bold border-b-2 border-b-primary" : ""}`}>
                    <span className="text-[9px] uppercase leading-none opacity-70 mb-0.5">{format(day, "EEEEE", { locale: es })}</span>
                    <span className="text-xs leading-none">{format(day, "d")}</span>
                  </div>
                );
              })}
            </div>

            <div className="divide-y">
              {rooms.map((room) => (
                <React.Fragment key={room.id}>
                  <div className="bg-slate-100/50 border-b flex h-8 w-full">
                    <div className="w-36 shrink-0 px-3 flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-r bg-slate-100/50 sticky left-0 z-[2] truncate">
                      {room.name}
                    </div>
                    <div className="flex-1 bg-slate-100/50 h-full"></div> 
                  </div>

                  {room.beds.map((bed) => (
                    <div key={bed.id} className="flex h-10 hover:bg-slate-50 transition-colors w-full">
                      <div className="w-36 shrink-0 flex items-center px-3 border-r bg-white text-xs font-medium sticky left-0 z-[2] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        <BedDouble className="h-3 w-3 mr-2 text-muted-foreground shrink-0" />
                        <span className="truncate" title={bed.label}>{bed.label}</span>
                      </div>

                      {days.map((day) => {
                        const booking = getBooking(bed.id, day);
                        const isWeekendDay = isWeekend(day);
                        const dateStr = format(day, "yyyy-MM-dd");
                        const isSelected = selectedCells.some(c => c.bedId === bed.id && c.date === dateStr);
                        
                        return (
                          <div key={day.toString()} onClick={() => handleCellClick(bed.id, String(room.id), day)} className={`flex-1 min-w-[32px] border-r last:border-r-0 relative cursor-pointer group ${isWeekendDay ? "bg-slate-50/50" : ""} ${isSelected ? "bg-blue-500/20" : "hover:bg-blue-50/50"}`}>
                            {booking && (
                              <TooltipProvider>
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <div className={`absolute inset-0.5 rounded-[2px] text-[8px] flex items-center justify-center font-bold text-white shadow-sm overflow-hidden select-none cursor-pointer ${booking.paid ? "bg-green-500 hover:bg-green-600" : (booking.guest.checkedIn ? "bg-primary hover:bg-primary/90" : "bg-gold hover:bg-gold/90")}`}>
                                        {booking.guest.name.charAt(0).toUpperCase()}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="z-50 bg-popover text-popover-foreground shadow-xl">
                                    <div className="text-xs space-y-1">
                                        <p className="font-bold text-sm">{booking.guest.name} {booking.guest.surname}</p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="h-5 px-1">{booking.guest.nationality}</Badge>
                                            {booking.paid ? <span className="text-green-600 font-bold text-[10px]">PAGADO</span> : <span className="text-red-500 font-bold text-[10px]">PENDIENTE</span>}
                                        </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
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
            <DialogTitle>{isEditing ? `Editar Grupo (${guestForms.length} pax)` : `Nueva Reserva (${guestForms.length} pax)`}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col md:flex-row items-center gap-4 p-4 bg-secondary/20 rounded-lg mb-4">
              <div className="flex-1 flex items-center gap-2">
                <Euro className="h-5 w-5 text-muted-foreground" />
                <span className="font-bold text-sm">Total:</span>
                <Input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(Number(e.target.value))} className="w-24 font-bold bg-white h-8" />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-2">
                    <input type="checkbox" id="paid" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <label htmlFor="paid" className="text-sm font-medium">Pagado</label>
                </div>
                {isPaid && (
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                        <SelectTrigger className="w-[130px] h-8 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                            <SelectItem value="TARJETA">Tarjeta</SelectItem>
                            <SelectItem value="BIZUM">Bizum</SelectItem>
                        </SelectContent>
                    </Select>
                )}
             </div>
          </div>

          {guestForms.length > 1 && (
            <div className="flex flex-col gap-2 mb-4">
                {!isGroupMode && (
                    <div className="flex justify-end px-1">
                        <Button type="button" variant="ghost" size="sm" className="text-xs text-primary hover:bg-primary/10 h-8" onClick={() => {
                            const first = guestForms[0];
                            setGuestForms(prev => prev.map((g, i) => i === 0 ? g : { ...g, name: first.name, surname: first.surname, nationality: first.nationality, phone: first.phone, email: first.email }));
                            toast.info("Datos copiados");
                        }}>
                        <Copy className="w-3 h-3 mr-2" /> Copiar 1º
                        </Button>
                    </div>
                )}
                <div className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${isGroupMode ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-transparent'}`}>
                    <input type="checkbox" id="groupMode" checked={isGroupMode} onChange={(e) => setIsGroupMode(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                    <label htmlFor="groupMode" className="text-sm font-medium cursor-pointer select-none text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Reserva Rápida: Usar nombre y datos del titular</label>
                </div>
            </div>
           )}

          <div className="space-y-6 py-2">
            {guestForms.map((guest, index) => {
              const associatedCell = selectedCells[index * (selectedCells.length / guestForms.length)];
              const targetDate = associatedCell ? associatedCell.date : format(new Date(), "yyyy-MM-dd");
              const availableBeds = getAvailableBedsList(targetDate);

              return (
                <div key={index} className={`space-y-4 p-4 border rounded-xl relative mt-3 transition-all ${isGroupMode && index > 0 ? 'bg-primary/5 border-primary/20 opacity-80' : 'bg-secondary/10'}`}>
                  
                  <div className="absolute -top-3 left-0 z-10 pl-2">
                      <Select 
                          value={selectedCells[index]?.bedId} 
                          onValueChange={(newBedId) => {
                              const bedInfo = availableBeds.find(b => b.id === newBedId);
                              if (bedInfo) {
                                  const newCells = [...selectedCells];
                                  newCells[index] = { ...newCells[index], bedId: newBedId, roomId: bedInfo.roomId };
                                  setSelectedCells(newCells);
                              }
                          }}
                      >
                          <SelectTrigger className="h-6 text-[11px] bg-primary text-primary-foreground border-none rounded-full px-3 font-semibold shadow-sm focus:ring-0 w-fit min-w-[120px]">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                              {availableBeds.map(b => (
                                  <SelectItem key={b.id} value={b.id} className="text-xs font-medium">
                                      {b.label}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  
                  {/* --- BOTÓN DE ESCANEAR DNI --- */}
                  {!(isGroupMode && index > 0) && (
                    <div className="pt-2">
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            id={`dni-scanner-planning-${index}`}
                            className="hidden"
                            onChange={(e) => handleScanFile(index, e)}
                        />
                        <Button 
                            type="button" 
                            variant="outline" 
                            className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                            onClick={() => document.getElementById(`dni-scanner-planning-${index}`)?.click()}
                            disabled={scanningIndex === index}
                        >
                            {scanningIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                            {scanningIndex === index ? "Procesando imagen..." : "Escanear DNI / Pasaporte"}
                        </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className={index === 0 && isGroupMode ? "font-bold text-primary" : ""}>{index === 0 && isGroupMode ? "Nombre Titular" : "Nombre"}</Label>
                      <Input value={guest.name} onChange={(e) => updateGuestField(index, "name", e.target.value)} disabled={isGroupMode && index > 0} />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellidos</Label>
                      <Input value={guest.surname} onChange={(e) => updateGuestField(index, "surname", e.target.value)} disabled={isGroupMode && index > 0} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><div className="relative"><Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={guest.phone} onChange={(e) => updateGuestField(index, "phone", e.target.value)} className="pl-9" placeholder="Teléfono" disabled={isGroupMode && index > 0} /></div></div>
                    <div className="space-y-2"><Input value={guest.email} onChange={(e) => updateGuestField(index, "email", e.target.value)} placeholder="Email" disabled={isGroupMode && index > 0} /></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo Doc.</Label>
                      <Select value={guest.dniType} onValueChange={(v) => updateGuestField(index, "dniType", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="DNI">DNI</SelectItem>
                              <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                              <SelectItem value="NIE">NIE</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Nº Documento</Label>
                      <Input value={guest.dni} onChange={(e) => updateGuestField(index, "dni", e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>País de Origen</Label>
                        <Input
                          list={`countries-list-${index}`}
                          value={guest.nationality}
                          onChange={(e) => updateGuestField(index, "nationality", e.target.value)}
                          disabled={isGroupMode && index > 0}
                          placeholder="Ej: ESPAÑA"
                          autoComplete="off"
                        />
                        <datalist id={`countries-list-${index}`}>
                          {ALL_COUNTRIES.map((c: string) => <option key={c} value={c.toUpperCase()} />)}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                          <Label>Sexo</Label>
                          <Select value={guest.sex} onValueChange={(v) => updateGuestField(index, "sex", v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="M">Hombre</SelectItem>
                                  <SelectItem value="F">Mujer</SelectItem>
                                  <SelectItem value="O">Otro</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>F. Nacimiento</Label>
                          <Input type="date" value={guest.birthDate} onChange={(e) => updateGuestField(index, "birthDate", e.target.value)} />
                      </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <div className="mr-auto flex gap-2">
                {isEditing && (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDeleteCurrentEdit}
                        title="Eliminar reserva y dejar la cama libre"
                    >
                        <Trash2 className="h-4 w-4 sm:mr-2" /> 
                        <span className="hidden sm:inline">Eliminar</span>
                    </Button>
                )}

                {isEditing && editingId && (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            toast.info("Descargando recibo...");
                            apiService.downloadInvoice(editingId).catch(() => toast.error("Error al descargar"));
                        }}
                    >
                        <FileText className="h-4 w-4 sm:mr-2" /> 
                        <span className="hidden sm:inline">Recibo</span>
                    </Button>
                )}
            </div>

            <Button variant="outline" className="border-gold text-gold" onClick={() => handleSave(true)}>{isEditing ? "Guardar Cambios" : "Reservar"}</Button>
            <Button onClick={() => handleSave(false)}>{isEditing ? "Confirmar + Check-in" : "Confirmar Check-in"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanningView;
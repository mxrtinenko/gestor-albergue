import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useHostelStore, Booking, Guest } from "@/stores/hostelStore";
import { apiService } from "../services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BedDouble, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Hammer } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const CalendarView = () => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const { rooms, bookings, setBookings, setRooms } = useHostelStore();

  // Carga de datos
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. CARGAR HABITACIONES
        // IMPORTANTE: Mapeamos también el estado de mantenimiento
        const roomsData = await apiService.getRooms();
        const formattedRooms = roomsData.map((r: any) => ({
            id: r.id, 
            name: r.name,
            priceDefault: r.price_default,
            is_maintenance: r.is_maintenance, // <--- Nuevo
            beds: r.beds.map((b: any) => ({ 
                id: b.id, 
                label: b.label,
                is_maintenance: b.is_maintenance // <--- Nuevo
            }))
        }));
        setRooms(formattedRooms);

        // 2. CARGAR RESERVAS
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
            nationality: b.nationality || "Española",
            sex: (b.sex as Guest["sex"]) || "M",
            birthDate: b.birthDate || "",
            checkedIn: b.checkedIn,
          },
        }));
        setBookings(formattedBookings);
      } catch (error) {
        console.error("Error cargando calendario:", error);
      }
    };
    loadData();
  }, [setBookings, setRooms]);

  // --- CÁLCULOS DE CAPACIDAD ---

  // 1. Total camas físicas
  const totalPhysicalBeds = useMemo(() => 
    rooms.reduce((acc, r) => acc + r.beds.length, 0), 
  [rooms]);

  // 2. Camas bloqueadas (por avería individual O habitación cerrada)
  const blockedBedsCount = useMemo(() => {
    return rooms.reduce((acc, r: any) => {
        // Si la habitación está cerrada, TODAS sus camas cuentan como bloqueadas
        if (r.is_maintenance) {
            return acc + r.beds.length;
        }
        // Si la habitación está abierta, sumamos solo las camas averiadas
        return acc + r.beds.filter((b: any) => b.is_maintenance).length;
    }, 0);
  }, [rooms]);

  // 3. Capacidad real vendible
  const netCapacity = totalPhysicalBeds - blockedBedsCount;


  // Helpers de fecha
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Relleno para que el mes empiece en el día correcto de la semana
  const startDayOfWeek = (getDay(monthStart) + 6) % 7;
  const paddedDays: (Date | null)[] = [
    ...Array(startDayOfWeek).fill(null),
    ...days,
  ];

  const bookingsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    bookings.forEach((b) => {
      map[b.date] = (map[b.date] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const handleDayClick = (day: Date) => {
    navigate(`/registro?date=${format(day, "yyyy-MM-dd")}`);
  };

  return (
    <div className="w-full max-w-full animate-fade-in p-2 md:p-6 overflow-hidden relative">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
           Calendario Mensual
        </h1>
        
        {/* Navegación Meses */}
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

      <Card className="shadow-card p-4 md:p-6">
        {/* Leyenda */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground justify-end">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary/20" />
            Disponibles
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-destructive" />
            Completo
          </div>
          <div className="flex items-center gap-1.5">
             <Hammer className="h-3 w-3 text-muted-foreground" />
             <span className="font-bold">{blockedBedsCount}</span> Bloqueadas
          </div>
        </div>

        {/* Grid Calendario */}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}

          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />;

            const dateStr = format(day, "yyyy-MM-dd");
            const booked = bookingsByDate[dateStr] || 0;
            const checkedIn = bookings.filter(
              (b) => b.date === dateStr && b.guest.checkedIn
            ).length;
            
            // Cálculos del día
            const freeSpots = Math.max(0, netCapacity - booked);
            const isFull = freeSpots === 0 && netCapacity > 0;
            const isClosed = netCapacity === 0; // Si todo el albergue está en mantenimiento
            
            const today = isToday(day);

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                className={`
                  group relative flex flex-col items-center rounded-lg p-1.5 md:p-2 text-sm transition-all
                  hover:shadow-card-hover hover:scale-[1.02]
                  ${today ? "ring-2 ring-primary ring-offset-1" : ""}
                  ${!isSameMonth(day, currentMonth) ? "opacity-40" : ""}
                  ${isFull ? "bg-red-50 border-red-200" : "bg-card border"}
                  h-24 sm:h-32 justify-start
                `}
              >
                <div className="w-full flex justify-between items-start mb-1">
                    <span className={`font-medium ${today ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                    </span>
                    {/* Indicador de plazas libres destacado */}
                    {!isFull && !isClosed && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded-full border border-emerald-100">
                            {freeSpots} libres
                        </span>
                    )}
                </div>
                
                <div className="mt-1 flex flex-col gap-1 w-full text-[10px] leading-tight px-1">
                  
                  {isFull && (
                      <div className="w-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider rounded py-1 text-center shadow-sm">
                          COMPLETO
                      </div>
                  )}

                  {isClosed && (
                      <div className="w-full bg-slate-200 text-slate-500 text-[10px] font-bold uppercase rounded py-1 text-center flex items-center justify-center gap-1">
                          <Hammer className="h-3 w-3" /> Obras
                      </div>
                  )}

                  {!isFull && !isClosed && booked > 0 && (
                      <div className="flex gap-1 justify-center w-full">
                           {/* Barra de progreso visual simple */}
                           <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div style={{ width: `${(checkedIn / netCapacity) * 100}%` }} className="bg-primary h-full" />
                                <div style={{ width: `${((booked - checkedIn) / netCapacity) * 100}%` }} className="bg-gold h-full" />
                           </div>
                      </div>
                  )}

                  {!isFull && !isClosed && booked > 0 && (
                      <div className="flex justify-between text-[9px] text-muted-foreground font-medium w-full mt-0.5">
                          <span>{checkedIn} In</span>
                          <span>{booked - checkedIn} Res</span>
                      </div>
                  )}

                  {booked === 0 && !isClosed && (
                    <span className="text-muted-foreground/50 text-center w-full block mt-4 text-[10px]">Sin reservas</span>
                  )}
                  
                </div>
              </button>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground border-t pt-4">
          <div className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-primary" />
            <span>Capacidad total física: <strong className="text-foreground">{totalPhysicalBeds} camas</strong></span>
          </div>
          
          {blockedBedsCount > 0 && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                <Hammer className="h-4 w-4" />
                <span>Mantenimiento: <strong>{blockedBedsCount} camas</strong> (No vendibles)</span>
              </div>
          )}

          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Capacidad real diaria: <strong>{netCapacity} camas</strong></span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CalendarView;
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const roomsData = await apiService.getRooms();
        const formattedRooms = roomsData.map((r: any) => ({
            id: r.id, 
            name: r.name,
            priceDefault: r.price_default,
            is_maintenance: r.is_maintenance, 
            beds: r.beds.map((b: any) => ({ 
                id: b.id, 
                label: b.label,
                is_maintenance: b.is_maintenance 
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

  const totalPhysicalBeds = useMemo(() => 
    rooms.reduce((acc, r) => acc + r.beds.length, 0), 
  [rooms]);

  const blockedBedsCount = useMemo(() => {
    return rooms.reduce((acc, r: any) => {
        if (r.is_maintenance) {
            return acc + r.beds.length;
        }
        return acc + r.beds.filter((b: any) => b.is_maintenance).length;
    }, 0);
  }, [rooms]);

  const netCapacity = totalPhysicalBeds - blockedBedsCount;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

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
    <div className="w-full max-w-full animate-fade-in p-2 md:p-6 overflow-hidden relative text-foreground">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
           Calendario Mensual
        </h1>
        
        <div className="flex items-center justify-between gap-4 bg-card p-1 rounded-md border border-border shadow-sm">
           <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
             <ChevronLeft className="h-5 w-5" />
           </Button>
           <h2 className="font-display text-lg font-bold capitalize w-32 text-center text-foreground">
             {format(currentMonth, "MMMM yyyy", { locale: es })}
           </h2>
           <Button variant="ghost" size="icon" className="hover:bg-muted" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
             <ChevronRight className="h-5 w-5" />
           </Button>
        </div>
      </div>

      <Card className="shadow-sm border-border p-2 sm:p-4 md:p-6 bg-card">
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground justify-center md:justify-end">
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
             <span className="font-bold text-foreground">{blockedBedsCount}</span> Bloqueadas
          </div>
        </div>

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
            
            const freeSpots = Math.max(0, netCapacity - booked);
            const isFull = freeSpots === 0 && netCapacity > 0;
            const isClosed = netCapacity === 0; 
            
            const today = isToday(day);

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(day)}
                className={`
                  group relative flex flex-col items-center rounded-lg p-1 sm:p-1.5 md:p-2 transition-all
                  hover:shadow-card-hover hover:scale-[1.02] overflow-hidden
                  ${today ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
                  ${!isSameMonth(day, currentMonth) ? "opacity-40" : ""}
                  ${isFull ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900" : "bg-card hover:bg-muted/50 border border-border"}
                  h-20 sm:h-24 md:h-32 justify-start
                `}
              >
                {/* LÓGICA RESPONSIVE: Apilado en móvil, en línea en PC */}
                <div className="w-full flex flex-col xl:flex-row justify-between items-center xl:items-start mb-1 gap-1 xl:gap-0">
                    <span className={`font-medium text-xs sm:text-sm leading-none mt-0.5 xl:mt-0 ${today ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                    </span>
                    
                    {!isFull && !isClosed && (
                        <span className="whitespace-nowrap text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.5 rounded border border-emerald-100 dark:border-emerald-900 leading-none">
                            {freeSpots}<span className="hidden xl:inline ml-1">libres</span>
                        </span>
                    )}
                </div>
                
                <div className="mt-auto xl:mt-1 flex flex-col gap-1 w-full text-[9px] sm:text-[10px] leading-tight px-0.5 sm:px-1">
                  
                  {isFull && (
                      <div className="w-full bg-destructive text-destructive-foreground text-[8px] sm:text-[10px] font-bold uppercase tracking-wider rounded py-1 text-center shadow-sm">
                          <span className="hidden sm:inline">COMPLETO</span>
                          <span className="sm:hidden">LLENO</span>
                      </div>
                  )}

                  {isClosed && (
                      <div className="w-full bg-muted text-muted-foreground text-[8px] sm:text-[10px] font-bold uppercase rounded py-1 text-center flex items-center justify-center gap-1 border border-border">
                          <Hammer className="h-3 w-3" /> <span className="hidden sm:inline">Obras</span>
                      </div>
                  )}

                  {!isFull && !isClosed && booked > 0 && (
                      <div className="flex gap-1 justify-center w-full">
                           <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex border border-border/50">
                                <div style={{ width: `${(checkedIn / netCapacity) * 100}%` }} className="bg-primary h-full" />
                                <div style={{ width: `${((booked - checkedIn) / netCapacity) * 100}%` }} className="bg-gold h-full" />
                           </div>
                      </div>
                  )}

                  {!isFull && !isClosed && booked > 0 && (
                      <div className="flex justify-between text-[8px] sm:text-[9px] text-muted-foreground font-medium w-full mt-0.5">
                          <span>{checkedIn} In</span>
                          <span>{booked - checkedIn} Res</span>
                      </div>
                  )}

                  {booked === 0 && !isClosed && (
                    <span className="text-muted-foreground/50 text-center w-full block mt-2 sm:mt-4 text-[8px] sm:text-[10px]">
                      <span className="hidden sm:inline">Sin reservas</span>
                      <span className="sm:hidden">-</span>
                    </span>
                  )}
                  
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-muted-foreground border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-primary" />
            <span>Total física: <strong className="text-foreground">{totalPhysicalBeds}</strong></span>
          </div>
          
          {blockedBedsCount > 0 && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-3 py-1 rounded-full border border-red-100 dark:border-red-900">
                <Hammer className="h-4 w-4" />
                <span>Mantenimiento: <strong>{blockedBedsCount}</strong></span>
              </div>
          )}

          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Real diaria: <strong className="text-foreground">{netCapacity}</strong></span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CalendarView;
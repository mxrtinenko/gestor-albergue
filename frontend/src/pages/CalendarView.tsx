import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useHostelStore, Booking, Guest } from "@/stores/hostelStore";
import { apiService } from "../services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BedDouble, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
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
  // AÑADIDO: setRooms para actualizar la configuración
  const { rooms, bookings, setBookings, setRooms } = useHostelStore();

  // Carga de datos
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. CARGAR HABITACIONES (NUEVO)
        const roomsData = await apiService.getRooms();
        const formattedRooms = roomsData.map((r: any) => ({
            id: r.id, 
            name: r.name,
            priceDefault: r.price_default,
            beds: r.beds.map((b: any) => ({ id: b.id, label: b.label }))
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
  }, [setBookings, setRooms]); // AÑADIDO setRooms a dependencias

  // Helpers de fecha
  const totalBeds = rooms.reduce((acc, r) => acc + r.beds.length, 0);
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
            <div className="h-3 w-3 rounded-sm bg-accent" />
            Reservadas
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-primary" />
            Ocupadas
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
            const reserved = booked - checkedIn;
            const available = Math.max(0, totalBeds - booked);
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
                  bg-card border h-24 sm:h-32 justify-start
                `}
              >
                <span className={`font-medium mb-1 ${today ? "text-primary" : "text-foreground"}`}>
                  {format(day, "d")}
                </span>
                <div className="mt-1 flex flex-col gap-0.5 w-full text-[10px] leading-tight px-1">
                  {totalBeds > 0 && available > 0 && reserved === 0 && checkedIn === 0 && (
                    <span className="text-primary/50 text-center w-full block mt-2">Libre</span>
                  )}
                  {reserved > 0 && (
                      <div className="w-full bg-gold/20 text-gold text-[10px] rounded px-1 py-0.5 truncate font-medium border border-gold/30 text-center">
                        {reserved} Res.
                      </div>
                  )}
                  {checkedIn > 0 && (
                      <div className="w-full bg-primary/20 text-primary text-[10px] rounded px-1 py-0.5 truncate font-medium border border-primary/30 text-center">
                        {checkedIn} Ocup.
                      </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground border-t pt-4">
          <BedDouble className="h-4 w-4 text-primary" />
          <span>Capacidad total: <strong className="text-foreground">{totalBeds} camas</strong> en {rooms.length} habitaciones</span>
        </div>
      </Card>
    </div>
  );
};

export default CalendarView;
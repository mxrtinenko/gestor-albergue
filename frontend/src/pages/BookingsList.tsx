import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useHostelStore, Booking, Guest } from "@/stores/hostelStore";
import { apiService } from "../services/api";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Calendar as CalendarIcon, 
  MoreHorizontal,
  Trash2,
  BedDouble,
  FileText, // IMPORTADO: Icono para factura
  Download
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const BookingsList = () => {
  const navigate = useNavigate();
  const { bookings, setBookings, removeBooking, rooms } = useHostelStore(); 
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending" | "checkedIn">("all");

  useEffect(() => {
    const loadData = async () => {
      try {
        const roomsData = await apiService.getRooms(); // Cargamos las habitaciones para tener la info de camas (QUIZÁ QUITAR)
        const data = await apiService.getBookings();
        const formatted: Booking[] = data.map((b) => ({
          id: b.id,
          bedId: b.bedId,
          roomId: b.bedId.split("-")[0],
          date: b.date,
          totalPrice: b.totalPrice || 0,
          paid: b.paid || false,
          paymentMethod: (b.paymentMethod as Booking["paymentMethod"]) || "EFECTIVO",
          // Mapeamos el groupId si viene del backend
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
        setBookings(formatted);
      } catch (error) {
        console.error("Error cargando listado:", error);
      }
    };
    loadData();
  }, [setBookings]);

  const getBedInfo = (bedId: string) => {
    for (const room of rooms) {
      const bed = room.beds.find((b) => b.id === bedId);
      if (bed) return { roomName: room.name, bedLabel: bed.label };
    }
    return { roomName: "N/A", bedLabel: "Cama" };
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const nameMatch = b.guest.name.toLowerCase().includes(searchTerm.toLowerCase());
      const surnameMatch = b.guest.surname.toLowerCase().includes(searchTerm.toLowerCase());
      const dniMatch = b.guest.dni.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSearch = nameMatch || surnameMatch || dniMatch;

      const matchesStatus = 
        filterStatus === "all" ||
        (filterStatus === "paid" && b.paid) ||
        (filterStatus === "pending" && !b.paid) ||
        (filterStatus === "checkedIn" && b.guest.checkedIn);

      return matchesSearch && matchesStatus;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [bookings, searchTerm, filterStatus]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta reserva?")) return;
    try {
      await apiService.deleteBooking(id);
      removeBooking(id);
      toast.success("Reserva eliminada");
    } catch (e) {
      toast.error("Error al eliminar");
    }
  };

  // --- FUNCIÓN NUEVA PARA DESCARGAR FACTURA ---
  const handleDownloadInvoice = async (id: string) => {
    try {
        toast.info("Generando recibo PDF...");
        await apiService.downloadInvoice(id);
        toast.success("Recibo descargado");
    } catch (error) {
        toast.error("No se pudo descargar el recibo");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Listado de Reservas</h1>
          <p className="text-muted-foreground text-sm">Control detallado de ocupación y cobros</p>
        </div>
        <div className="flex gap-3 items-center">
            <Badge variant="outline" className="px-3 py-1 h-8">
            {filteredBookings.length} resultados
            </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o DNI..." 
            className="pl-10 bg-white shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 md:col-span-2">
          {(["all", "pending", "checkedIn"] as const).map((status) => (
            <Button 
              key={status}
              variant={filterStatus === status ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilterStatus(status)}
              className="flex-1 capitalize"
            >
              {status === "all" ? "Todos" : status === "pending" ? "Pendientes" : "Alojado"}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
              <tr>
                <th className="px-4 py-3">Huésped</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Estado / Pago</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {filteredBookings.map((b) => {
                const bedInfo = getBedInfo(b.bedId);
                return (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-foreground capitalize">{b.guest.name} {b.guest.surname}</p>
                        <p className="text-[10px] text-muted-foreground">{b.guest.dni}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BedDouble className="h-3.5 w-3.5 text-primary/60" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{bedInfo.roomName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{bedInfo.bedLabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground italic">
                      {format(parseISO(b.date), "dd/MM/yy", { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {b.guest.checkedIn ? (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-primary" /> ALOJADO
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gold flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-gold" /> RESERVA
                          </span>
                        )}
                        <span className={`text-[10px] ${b.paid ? "text-green-600 font-medium" : "text-red-400 font-bold"}`}>
                          {b.paid ? `PAGADO (${b.paymentMethod})` : "PAGO PENDIENTE"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {Number(b.totalPrice).toFixed(2)}€
                    </td>
                    <td className="px-4 py-3 text-right flex justify-end gap-1">
                      
                      {/* BOTÓN FACTURA AÑADIDO */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                        title="Descargar Factura"
                        onClick={() => handleDownloadInvoice(b.id)}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/registro?date=${b.date}`)}>
                            <CalendarIcon className="mr-2 h-4 w-4" /> Ir al Calendario
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(b.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default BookingsList;
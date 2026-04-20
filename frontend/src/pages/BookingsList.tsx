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
  FileText, 
  Ban,
  AlertTriangle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from "sonner";

const BookingsList = () => {
  const navigate = useNavigate();
  const { bookings, setBookings, removeBooking, rooms } = useHostelStore(); 
  const [searchTerm, setSearchTerm] = useState("");
  
  const [filterStatus, setFilterStatus] = useState<"all" | "checkedIn" | "pendingPayment" | "reservations" | "cancelled">("all");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        await apiService.getRooms(); 
        const data = await apiService.getBookings();
        const formatted: Booking[] = data.map((b) => ({
          id: b.id,
          bedId: b.bedId,
          roomId: b.bedId.split("-")[0] || "",
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
        setBookings(formatted);
      } catch (error) {
        console.error("Error cargando listado:", error);
      }
    };
    loadData();
  }, [setBookings]);

  const getBedInfo = (bedId: string) => {
    if (bedId === "CANCELADA") return { roomName: "Anulada", bedLabel: "-" };

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

      const isCancelled = b.bedId === "CANCELADA";
      
      let matchesStatus = false;
      if (filterStatus === "all") matchesStatus = true;
      if (filterStatus === "cancelled") matchesStatus = isCancelled;
      if (filterStatus === "checkedIn") matchesStatus = b.guest.checkedIn && !isCancelled;
      if (filterStatus === "pendingPayment") matchesStatus = b.guest.checkedIn && !b.paid && !isCancelled;
      if (filterStatus === "reservations") matchesStatus = !b.guest.checkedIn && !isCancelled;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [bookings, searchTerm, filterStatus]);

  const handleDownloadInvoice = async (id: string) => {
    try {
        toast.info("Generando recibo PDF...");
        await apiService.downloadInvoice(id);
        toast.success("Recibo descargado");
    } catch (error) {
        toast.error("No se pudo descargar el recibo");
    }
  };

  const openCancelDialog = (booking: Booking) => {
      setBookingToCancel(booking);
      setCancelDialogOpen(true);
  };

  const confirmCancellation = async () => {
      if (!bookingToCancel) return;
      try {
          await apiService.deleteBooking(bookingToCancel.id);
          removeBooking(bookingToCancel.id); 
          toast.success("Reserva cancelada. Cama liberada.");
          setCancelDialogOpen(false);
          setBookingToCancel(null);
      } catch (e) {
          toast.error("Error al cancelar");
      }
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in p-4 text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Listado de Reservas</h1>
          <p className="text-muted-foreground text-sm">Control detallado de ocupación, cobros e historial</p>
        </div>
        <div className="flex gap-3 items-center">
            <Badge variant="outline" className="px-3 py-1 h-8 bg-card border-border">
            {filteredBookings.length} resultados
            </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o DNI..." 
            className="pl-10 bg-card shadow-sm border-border text-foreground"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 lg:col-span-3 overflow-x-auto pb-2 sm:pb-0">
          {(["all", "checkedIn", "pendingPayment", "reservations", "cancelled"] as const).map((status) => (
            <Button 
              key={status}
              variant={filterStatus === status ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilterStatus(status)}
              className={`flex-1 min-w-fit capitalize border-border ${status === 'cancelled' && filterStatus === 'cancelled' ? 'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 border-red-500/50' : ''}`}
            >
              {status === "all" ? "Todos" : 
               status === "checkedIn" ? "Alojados" : 
               status === "pendingPayment" ? "Pendientes Pago" : 
               status === "reservations" ? "Reservas" : "Canceladas"}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border border-border shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-4 py-3">Huésped</th>
                <th className="px-4 py-3">Ubicación</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Estado / Pago</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBookings.map((b) => {
                const isCancelled = b.bedId === "CANCELADA";
                const bedInfo = getBedInfo(b.bedId);

                return (
                  <tr key={b.id} className={`transition-colors ${isCancelled ? 'bg-muted/30 opacity-60' : 'hover:bg-muted/50'}`}>
                    <td className="px-4 py-3">
                      <div className={isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}>
                        <p className="font-bold capitalize">{b.guest.name} {b.guest.surname}</p>
                        <p className="text-[10px] opacity-70">{b.guest.dni}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isCancelled ? <Ban className="h-3.5 w-3.5 text-red-400" /> : <BedDouble className="h-3.5 w-3.5 text-primary/60" />}
                        <div>
                          <p className={`text-xs font-medium ${isCancelled ? 'text-red-500 dark:text-red-400' : 'text-foreground'}`}>{bedInfo.roomName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{bedInfo.bedLabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground italic">
                      {format(parseISO(b.date), "dd/MM/yy", { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {isCancelled ? (
                            <span className="text-[10px] font-bold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded-full w-fit">
                                CANCELADA
                            </span>
                        ) : b.guest.checkedIn ? (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-primary" /> ALOJADO
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gold flex items-center gap-1">
                             <div className="w-1.5 h-1.5 rounded-full bg-gold" /> RESERVA
                          </span>
                        )}
                        
                        {!isCancelled && (
                            <span className={`text-[10px] ${b.paid ? "text-green-600 dark:text-green-500 font-medium" : "text-red-500 dark:text-red-400 font-bold"}`}>
                            {b.paid ? `PAGADO (${b.paymentMethod})` : "PAGO PENDIENTE"}
                            </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${isCancelled ? 'text-red-500 dark:text-red-400 line-through' : 'text-foreground'}`}>
                      {Number(b.totalPrice).toFixed(2)}€
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {!isCancelled && b.paid && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Descargar Factura Oficial"
                              onClick={() => handleDownloadInvoice(b.id)}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                        )}

                        {!isCancelled && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-border">
                                <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={() => navigate(`/?date=${b.date}`)}>
                                  <CalendarIcon className="mr-2 h-4 w-4" /> Ver en Calendario
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer" onClick={() => openCancelDialog(b)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Cancelar Reserva
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {filteredBookings.length === 0 && (
                  <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron reservas con estos filtros.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="max-w-md bg-card border-border text-foreground">
              <DialogHeader>
              <div className="flex items-center gap-3 text-destructive mb-2">
                  <AlertTriangle className="h-6 w-6" />
                  <DialogTitle>¿Cancelar reserva?</DialogTitle>
              </div>
              <DialogDescription className="text-base pt-2 text-muted-foreground">
                  Esta acción liberará la cama y marcará la reserva como anulada en el historial.
              </DialogDescription>
              </DialogHeader>

              {bookingToCancel?.paid && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 p-4 rounded-lg my-2 text-sm flex gap-3 shadow-sm animate-in zoom-in-95">
                      <FileText className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
                      <div>
                          <p className="font-bold">Factura Rectificativa Automática</p>
                          <p className="mt-1 opacity-90">Como esta reserva ya estaba cobrada, el sistema emitirá automáticamente de fondo una factura en negativo (-{bookingToCancel.totalPrice}€) para cuadrar tu contabilidad con Hacienda.</p>
                      </div>
                  </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 mt-6">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="w-full sm:w-auto bg-transparent border-border hover:bg-muted">
                  Atrás
              </Button>
              <Button variant="destructive" onClick={confirmCancellation} className="w-full sm:w-auto font-bold">
                  <Trash2 className="h-4 w-4 mr-2" /> 
                  Confirmar Cancelación
              </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingsList;
import React, { useMemo, useEffect, useState } from 'react';
import { useHostelStore } from '@/stores/hostelStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Bell, Euro, Clock, Hammer, CheckCircle2, Building, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { apiService } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

const DailyAlertsHeader = () => {
  const { bookings, rooms } = useHostelStore();
  const today = format(new Date(), 'yyyy-MM-dd');
  const navigate = useNavigate();
  const location = useLocation(); 

  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);

  useEffect(() => {
    const checkProfileData = async () => {
      try {
         const profile = await apiService.getProfile();
         if (!profile || !profile.nif || !profile.razon_social || !profile.domicilio_fiscal) {
             setIsProfileIncomplete(true);
         } else {
             setIsProfileIncomplete(false);
         }
      } catch (e) {
         setIsProfileIncomplete(true);
      }
    };
    checkProfileData();
  }, [location.pathname]); 

  const dayBookings = useMemo(() => {
    return bookings.filter((b) => b.date === today);
  }, [bookings, today]);

  const maintenanceBedsCount = useMemo(() => {
    return rooms.reduce((acc, r) => 
        acc + r.beds.filter((b: any) => b.is_maintenance || r.is_maintenance).length, 0
    );
  }, [rooms]);

  const pendingPayments = dayBookings.filter(b => b.guest.checkedIn && !b.paid);
  const pendingArrivals = dayBookings.filter(b => !b.guest.checkedIn);
  
  const notificationCount = (pendingPayments.length > 0 ? 1 : 0) + 
                            (pendingArrivals.length > 0 ? 1 : 0) + 
                            (maintenanceBedsCount > 0 ? 1 : 0) +
                            (isProfileIncomplete ? 1 : 0);

  const hasNotifications = notificationCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative mr-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
          {hasNotifications && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 shadow-sm items-center justify-center rounded-full bg-red-500"></span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[340px] rounded-xl shadow-xl border-border bg-popover text-popover-foreground">
        <DropdownMenuLabel className="font-bold text-foreground">Avisos de Hoy</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        
        {!hasNotifications && (
          <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
             <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-50" />
            <p>Todo al día. No hay avisos.</p>
          </div>
        )}

        {isProfileIncomplete && (
          <DropdownMenuItem 
            className="flex items-center gap-3 p-3 cursor-pointer focus:bg-muted transition-colors"
            onClick={() => navigate('/perfil')}
          >
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400 shrink-0"><Building className="h-4 w-4" /></div>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Ficha Incompleta</span>
              <span className="text-xs text-muted-foreground">Faltan datos fiscales para facturar.</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </DropdownMenuItem>
        )}

        {pendingPayments.length > 0 && (
          <DropdownMenuItem 
            className="flex items-center gap-3 p-3 cursor-pointer focus:bg-muted transition-colors"
            onClick={() => navigate('/listado')} 
          >
            <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600 dark:text-red-400 shrink-0"><Euro className="h-4 w-4" /></div>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-bold text-red-700 dark:text-red-400">Pagos Pendientes</span>
              <span className="text-xs text-muted-foreground">{pendingPayments.length} alojado(s) sin pagar.</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </DropdownMenuItem>
        )}

        {pendingArrivals.length > 0 && (
          <DropdownMenuItem 
            className="flex items-center gap-3 p-3 cursor-pointer focus:bg-muted transition-colors"
            onClick={() => navigate('/listado')}
          >
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400 shrink-0"><Clock className="h-4 w-4" /></div>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Por Llegar</span>
              <span className="text-xs text-muted-foreground">{pendingArrivals.length} check-in(s) pendiente(s).</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </DropdownMenuItem>
        )}

        {maintenanceBedsCount > 0 && (
          <DropdownMenuItem 
            className="flex items-center gap-3 p-3 cursor-pointer focus:bg-muted transition-colors"
            onClick={() => navigate('/perfil')}
          >
            <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400 shrink-0"><Hammer className="h-4 w-4" /></div>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-bold text-orange-700 dark:text-orange-400">Mantenimiento</span>
              <span className="text-xs text-muted-foreground">{maintenanceBedsCount} cama(s) bloqueada(s).</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </DropdownMenuItem>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DailyAlertsHeader;
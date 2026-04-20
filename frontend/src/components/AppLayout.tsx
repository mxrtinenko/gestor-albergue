import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppSidebar from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import GlobalSearch from "./GlobalSearch"; 
import DailyAlertsHeader from '@/components/DailyAlertsHeader';
import { FastCheckInHeader } from "@/components/FastCheckInHeader";

const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      {/* CAMBIO 1: bg-slate-50/50 -> bg-background 
        Esto hace que el fondo general sea el gris súper oscuro en modo noche y blanco roto en modo día.
      */}
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-300">
        
        <AppSidebar />
        
        <div className="flex flex-1 flex-col min-w-0 h-full relative transition-all duration-300 ease-in-out">
          
          {/* CAMBIO 2: bg-white/95 -> bg-card/95 y border-border
            Esto hace que la cabecera se funda perfectamente con el tema oscuro.
          */}
          <header className="shrink-0 flex h-14 items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-4 z-50 shadow-sm gap-2 transition-colors duration-300">
            
            {/* Izquierda */}
            <div className="flex items-center shrink-0">
              <SidebarTrigger className="text-foreground/80 hover:text-foreground" />
            </div>

            {/* Centro: Buscador */}
            <div className="flex-1 flex justify-center max-w-lg min-w-0 px-2">
               <GlobalSearch />
            </div>

            {/* Derecha: Notificaciones + Widget Fast Check-in */}
            <div className="flex items-center justify-end shrink-0 gap-1">
               <DailyAlertsHeader />
               <FastCheckInHeader />
            </div>
            
          </header>

          {/* Main con scroll independiente */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-6 pb-20 w-full">
            <div className="max-w-full">
                <Outlet />
            </div>
          </main>
          
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
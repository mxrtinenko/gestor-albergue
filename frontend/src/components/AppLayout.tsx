import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppSidebar from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import GlobalSearch from "./GlobalSearch"; 
import { FastCheckInHeader } from "@/components/FastCheckInHeader";

const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      {/* Contenedor Global: Ocupa toda la pantalla y no permite scroll en el body */}
      <div className="flex h-screen w-full overflow-hidden bg-slate-50/50">
        
        <AppSidebar />
        
        {/* COLUMNA DERECHA (Header + Main)
           CLAVE DEL ARREGLO: 'min-w-0'
           Esto evita que una tabla ancha (como el Planning) reviente el ancho 
           de la columna y empuje el header fuera de la pantalla.
        */}
        <div className="flex flex-1 flex-col min-w-0 h-full relative transition-all duration-300 ease-in-out">
          
          {/* Header fijo */}
          <header className="shrink-0 flex h-14 items-center justify-between border-b bg-white/95 backdrop-blur-sm px-4 z-50 shadow-sm gap-2">
            
            {/* Izquierda */}
            <div className="flex items-center shrink-0">
              <SidebarTrigger />
            </div>

            {/* Centro: Buscador */}
            <div className="flex-1 flex justify-center max-w-lg min-w-0 px-2">
               <GlobalSearch />
            </div>

            {/* Derecha: Widget Fast Check-in */}
            <div className="flex items-center justify-end shrink-0">
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
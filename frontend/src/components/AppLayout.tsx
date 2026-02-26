import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppSidebar from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import GlobalSearch from "./GlobalSearch"; 

const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      {/* CAMBIO CLAVE AQUÍ: Pasamos de min-h-screen a h-screen y limitamos que toda la app ocupe 100vh */}
      <div className="flex h-screen w-full overflow-hidden bg-slate-50/50">
        <AppSidebar />
        
        {/* El contenedor derecho también debe ocupar solo el alto de la pantalla */}
        <div className="flex flex-1 flex-col h-full relative">
          
          {/* Header fijo */}
          <header className="shrink-0 flex h-14 items-center justify-between border-b bg-white/95 backdrop-blur-sm px-4 gap-4 z-50">
            
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>

            <div className="flex-1 flex justify-center max-w-lg">
               <GlobalSearch />
            </div>

            <div className="w-8 md:w-12"></div>
            
          </header>

          {/* MAIN es el ÚNICO que hace scroll ahora */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
            <Outlet />
          </main>
          
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
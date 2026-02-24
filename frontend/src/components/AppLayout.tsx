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
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          
          <header className="flex h-14 items-center justify-between border-b bg-card px-4 gap-4">
            
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>

            {/* AQUÍ COLOCAMOS EL BUSCADOR GLOBAL (Centrado) */}
            <div className="flex-1 flex justify-center max-w-lg">
               <GlobalSearch />
            </div>

            {/* Un div vacío a la derecha para mantener el buscador centrado perfectamente */}
            <div className="w-8 md:w-12"></div>
            
          </header>

          <main className="flex-1 overflow-auto bg-slate-50/50 p-4 md:p-6">
            <Outlet />
          </main>
          
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Kanban, 
  CalendarDays, 
  Users, 
  FileSpreadsheet, 
  PieChart, 
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronsUpDown
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHostelStore } from "@/stores/hostelStore";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// IMPORTAMOS LA IMAGEN COMO SI FUERA CÓDIGO
import logoHostly from "@/assets/logo.png";

// Bloque 1: Uso diario
const mainItems = [
  { title: "Hoy", url: "/registro", icon: LayoutDashboard },
  { title: "Planning", url: "/planning", icon: Kanban },
  { title: "Calendario", url: "/calendario", icon: CalendarDays },
  { title: "Listado Reservas", url: "/reservas", icon: Users },
  { title: "Informes", url: "/informes", icon: FileSpreadsheet },
  { title: "Estadísticas", url: "/estadisticas", icon: PieChart },
];

const AppSidebar: React.FC = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  
  // Datos del usuario actual
  const { logout } = useAuth();
  const { hostel } = useHostelStore();
  const hostelName = hostel?.name || "Mi Albergue";
  const initial = hostelName.charAt(0).toUpperCase();

  // Lógica del Tema (Claro / Oscuro)
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      setIsDarkMode(false);
      localStorage.setItem('hostly_theme', 'light');
    } else {
      root.classList.add('dark');
      setIsDarkMode(true);
      localStorage.setItem('hostly_theme', 'dark');
    }
  };

  // Recuperar el tema al recargar la página
  useEffect(() => {
    const savedTheme = localStorage.getItem('hostly_theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  }, []);

  return (
    // LIMPIEZA 1: Quitamos bg-white dark:bg-slate-950 y usamos bg-sidebar 
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar shadow-sm flex flex-col transition-colors duration-300">
      
      {/* --- CABECERA CON LOGO --- */}
      <div className={`flex h-14 items-center border-b border-sidebar-border transition-all duration-300 overflow-hidden shrink-0 ${
          collapsed ? "justify-center px-0" : "px-5 gap-3"
      }`}>
        {/* USAMOS LA VARIABLE DEL IMPORT AQUÍ */}
        <img 
            src={logoHostly} 
            alt="Logo Hostly" 
            className={`object-contain transition-all duration-300 ${
                collapsed ? "h-8 w-8" : "h-7 w-auto"
            }`} 
        />
        
        {!collapsed && (
            <span className="font-display font-extrabold text-xl tracking-tight text-sidebar-foreground truncate animate-in fade-in duration-500">
                Hostly
            </span>
        )}
      </div>

      <SidebarContent className="flex flex-col flex-1 overflow-hidden bg-transparent">
        
        {/* --- MENÚ PRINCIPAL --- */}
        <SidebarGroup className="flex-1 overflow-y-auto pt-6 px-3">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] font-bold uppercase tracking-widest mb-3 px-2">
            {!collapsed && "Gestión Diaria"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {mainItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      // LIMPIEZA 2: Hover con variables de sidebar
                      className={`h-10 transition-all rounded-lg border border-transparent ${
                        isActive 
                          ? "bg-primary/10 text-primary font-semibold" 
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }`}
                    >
                      <NavLink to={item.url} end className="flex items-center gap-3 w-full px-2">
                        <item.icon className={`h-4 w-4 transition-colors ${isActive ? "text-primary" : "opacity-70"}`} />
                        <span className="text-[14px]">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* --- MINI PERFIL (FONDO) --- */}
        {/* LIMPIEZA 3: Quitamos los bg-slate-900 y usamos bg-sidebar/50 */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border p-3 bg-sidebar-accent/30">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton 
                    size="lg" 
                    className="h-12 w-full justify-start hover:bg-sidebar-accent transition-colors"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold shrink-0 overflow-hidden">
  {hostel?.logoUrl ? (
    <img src={hostel.logoUrl} alt="Logo" className="h-full w-full object-cover" />
  ) : (
    initial
  )}
</div>
                    {!collapsed && (
                      <>
                        <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                          <span className="truncate font-semibold text-sidebar-foreground">{hostelName}</span>
                          <span className="truncate text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Recepción</span>
                        </div>
                        <ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
                      </>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                
                {/* Menú Flotante adaptado al tema global */}
                <DropdownMenuContent className="w-56 bg-popover text-popover-foreground border-border" align="end" side="right" sideOffset={8}>
                  <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer gap-3 p-3 hover:bg-muted">
                    <Settings className="h-4 w-4 text-muted-foreground" /> 
                    <span className="font-medium">Ajustes del Albergue</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer gap-3 p-3 hover:bg-muted">
                    {isDarkMode ? (
                      <Sun className="h-4 w-4 text-amber-500" /> 
                    ) : (
                      <Moon className="h-4 w-4 text-indigo-500" />
                    )}
                    <span className="font-medium">
                      {isDarkMode ? "Modo Claro" : "Modo Oscuro"}
                    </span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-border" />
                  
                  <DropdownMenuItem 
                    onClick={logout} 
                    className="cursor-pointer gap-3 p-3 text-red-500 focus:text-red-500 focus:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" /> 
                    <span className="font-bold">Cerrar sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
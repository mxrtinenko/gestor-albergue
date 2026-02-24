import React from "react";
import { 
  LayoutDashboard, // Hoy
  Kanban,          // Planning
  CalendarDays,    // Calendario
  Users,           // Listado Reservas
  FileSpreadsheet, // Informes
  PieChart,        // Estadísticas
  Settings         // Mi Albergue (Ajustes)
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";

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

// --- 1. SEPARAMOS EL MENÚ EN DOS BLOQUES ---

// Bloque 1: Uso diario
const mainItems = [
  { title: "Hoy", url: "/registro", icon: LayoutDashboard },
  { title: "Planning", url: "/planning", icon: Kanban },
  { title: "Calendario", url: "/calendario", icon: CalendarDays },
  { title: "Listado Reservas", url: "/reservas", icon: Users },
  { title: "Informes", url: "/informes", icon: FileSpreadsheet },
  { title: "Estadísticas", url: "/estadisticas", icon: PieChart },
];

// Bloque 2: Configuración (Se irá al fondo)
const bottomItems = [
  { title: "Mi Albergue", url: "/perfil", icon: Settings },
];

const AppSidebar: React.FC = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0 shadow-sm">
      {/* --- CABECERA CON LOGO PNG --- */}
      {/* --- CABECERA CON LOGO DINÁMICO --- */}
      <div className={`flex h-16 items-center border-b border-sidebar-border transition-all duration-300 overflow-hidden shrink-0 ${
          collapsed ? "justify-center px-0" : "px-4 gap-3"
      }`}>
        <img 
            src="/logo.png" 
            alt="Logo Hostly" 
            className={`object-contain transition-all duration-300 ${
                collapsed ? "h-10 w-10" : "h-8 w-auto"
            }`} 
        />
        
        {!collapsed && (
            <span className="font-display font-extrabold text-xl tracking-tight text-sidebar-foreground truncate animate-in fade-in duration-500">
                Hostly
            </span>
        )}
      </div>
      {/* ----------------------------- */}

      <SidebarContent className="flex flex-col h-full overflow-hidden">
        
        {/* --- MENÚ PRINCIPAL --- */}
        <SidebarGroup className="flex-1 overflow-y-auto pt-4">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-semibold uppercase tracking-wider mb-2">
            {!collapsed && "Gestión Diaria"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {/* gap-2 separa más las opciones entre sí */}
            <SidebarMenu className="gap-2">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    className="h-11 transition-all hover:bg-sidebar-accent/50" // h-11 hace el botón más alto
                  >
                    <NavLink to={item.url} end activeClassName="bg-primary/10 text-primary font-bold shadow-sm">
                      <item.icon className="h-5 w-5 opacity-80" />
                      <span className="text-[15px]">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* --- MENÚ CONFIGURACIÓN (ANCLADO AL FONDO) --- */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border pt-4 pb-4 bg-sidebar-background/50">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-semibold uppercase tracking-wider mb-2">
            {!collapsed && "Ajustes"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                    className="h-11 transition-all hover:bg-sidebar-accent/50"
                  >
                    <NavLink to={item.url} end activeClassName="bg-primary/10 text-primary font-bold shadow-sm">
                      <item.icon className="h-5 w-5 opacity-80" />
                      <span className="text-[15px]">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
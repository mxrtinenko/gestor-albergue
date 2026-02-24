import React from "react";
import { 
  Building2, 
  CalendarDays, 
  BedDouble, 
  FileText, 
  ClipboardList, 
  StretchHorizontal,
  BarChart3 // <--- 1. IMPORTAMOS EL NUEVO ICONO
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

// --- 2. AÑADIMOS EL ITEM AL ARRAY ---
const items = [
  { title: "Hoy", url: "/registro", icon: BedDouble },
  { title: "Planning", url: "/planning", icon: StretchHorizontal },
  { title: "Calendario", url: "/calendario", icon: CalendarDays },
  { title: "Listado Reservas", url: "/reservas", icon: ClipboardList },
  { title: "Informes", url: "/informes", icon: FileText },
  { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
  { title: "Mi Albergue", url: "/perfil", icon: Building2 },
];

const AppSidebar: React.FC = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* --- CABECERA CON LOGO PNG --- */}
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border gap-3 overflow-hidden">
        <img 
            src="/logo.png" 
            alt="Logo Hostly" 
            className="h-8 w-auto object-contain transition-all" 
        />
        
        {!collapsed && (
            <span className="font-display font-extrabold text-xl tracking-tight text-sidebar-foreground truncate transition-all duration-300">
                Hostly
            </span>
        )}
      </div>
      {/* ----------------------------- */}

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            {!collapsed && "Menú"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
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
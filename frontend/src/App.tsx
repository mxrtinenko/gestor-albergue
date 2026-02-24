import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Añadido Navigate
import { AuthProvider, useAuth } from "@/contexts/AuthContext"; // Añadido useAuth

import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AppLayout from "./components/AppLayout";
import HostelProfile from "./pages/HostelProfile";
import CalendarView from "./pages/CalendarView";
import PlanningView from "./pages/PlanningView";
import DayView from "./pages/DayView";
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import BookingsList from "./pages/BookingsList";
import Statistics from "./pages/Statistics";

const queryClient = new QueryClient();

// --- COMPONENTE DE PROTECCIÓN (GUARD) ---
// Si no estás logueado, te manda al Login.
// Si está cargando, muestra un texto simple.
const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center">Cargando sesión...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* --- RUTAS PÚBLICAS --- */}
            {/* Index suele ser la Landing Page, si quieres que redirija al login directamente cámbialo */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* --- RUTAS PROTEGIDAS (DENTRO DEL LAYOUT) --- */}
            {/* Envolvemos AppLayout con RequireAuth para proteger todas las hijas a la vez */}
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/registro" element={<DayView />} />
              <Route path="/calendario" element={<CalendarView />} />
              <Route path="/planning" element={<PlanningView />} />
              <Route path="/reservas" element={<BookingsList />} />
              <Route path="/informes" element={<Reports />} />
              <Route path="/estadisticas" element={<Statistics />} />
              <Route path="/perfil" element={<HostelProfile />} />
            </Route>

            {/* --- CATCH ALL --- */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
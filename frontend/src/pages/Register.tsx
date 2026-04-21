import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiService } from "@/services/api"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Zap, Camera, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// IMPORTAMOS EL LOGO
import logoHostly from "@/assets/logo.png";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!email || !password || !confirmPassword) {
      toast.error("Completa todos los campos");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await apiService.register({
          username: email,
          password: password,
          hostel_name: "Mi Albergue" 
      });
      
      toast.success("¡Cuenta creada! Ahora inicia sesión.");
      navigate("/login"); 
    } catch (error) {
      toast.error("Error al registrarse. Puede que el email ya exista.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      
      {/* COLUMNA IZQUIERDA: FORMULARIO */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8 sm:p-12 xl:p-24 animate-in fade-in slide-in-from-left-8 duration-700">
        <div className="w-full max-w-[400px] space-y-8">
          
          {/* Cabecera Móvil */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            {/* CAMBIO 1 */}
            <img src={logoHostly} alt="Hostly Logo" className="h-10 w-auto object-contain" />
            <span className="font-display text-2xl font-bold text-primary">HOSTLY</span>
          </div>

          <div className="space-y-2 text-left">
            <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900">
              Crea tu cuenta
            </h1>
            <p className="text-sm text-slate-500">
              Introduce tu correo electrónico para empezar a gestionar tu hotel de forma inteligente.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">Confirmar Contraseña</Label>
              <div className="relative">
                <CheckCircle2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite la contraseña"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold shadow-md transition-transform hover:scale-[1.02] text-white" disabled={loading}>
              <UserPlus className="mr-2 h-5 w-5" />
              {loading ? "Creando cuenta..." : "Comenzar gratis"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500">
            ¿Ya tienes una cuenta?{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>

      {/* COLUMNA DERECHA: BRANDING Y CARACTERÍSTICAS */}
      <div className="hidden lg:flex w-1/2 bg-slate-50 flex-col items-center justify-center p-12 relative overflow-hidden border-l border-slate-200">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4"></div>

        <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-right-8 duration-700 delay-150 fill-mode-both">
          <div className="flex items-center justify-center gap-4 mb-12">
            {/* CAMBIO 2 */}
            <img src={logoHostly} alt="Hostly Logo" className="h-16 w-auto object-contain drop-shadow-sm" />
            <h2 className="text-5xl font-display font-black text-slate-900 tracking-tight">HOSTLY</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-1">
              <div className="bg-blue-100 p-3 rounded-xl shrink-0">
                <Camera className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Escáner de DNI con IA</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">Extrae los datos de tus huéspedes automáticamente usando la cámara del móvil. Fast Check-in en 5 segundos.</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-1 delay-75">
              <div className="bg-emerald-100 p-3 rounded-xl shrink-0">
                <FileText className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Facturación Legal Integrada</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">Facturas automáticas, rectificativas y exportación de informes para Hacienda y la Policía.</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-1 delay-150">
              <div className="bg-purple-100 p-3 rounded-xl shrink-0">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Gestión en Tiempo Real</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">Controla la ocupación de tus camas, pagos divididos y mantenimiento desde un planning visual.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// Importamos los iconos del ojo
import { LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import logoHostly from "@/assets/logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  // Nuevo estado para controlar la visibilidad de la contraseña
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Completa todos los campos");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      
      // AHORA GUARDAMOS Y BORRAMOS AMBAS COSAS
      if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
          localStorage.setItem("rememberedPassword", password);
      } else {
          localStorage.removeItem("rememberedEmail");
          localStorage.removeItem("rememberedPassword");
      }

      toast.success("¡Bienvenido de nuevo!");
      navigate("/"); 
    } catch {
      toast.error("Credenciales incorrectas. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
      const savedEmail = localStorage.getItem("rememberedEmail");
      const savedPassword = localStorage.getItem("rememberedPassword");
      
      if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
      }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 relative overflow-hidden p-4">
      
      {/* Decoración de fondo sutil */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500 z-10">
        
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <img 
              src={logoHostly} 
              alt="Logo Hostly" 
              className="w-14 h-14 object-contain drop-shadow-sm" 
            />
            <span className="font-display text-4xl font-black text-slate-900 tracking-tight">HOSTLY</span>
          </div>
          <p className="text-base text-slate-500 text-center px-4">
            La gestión de tu albergue, simplificada al máximo.
          </p>
        </div>

        <Card className="shadow-xl border-slate-200/60 bg-white/95 backdrop-blur-sm rounded-2xl">
          <CardHeader className="pb-4 pt-8 px-8">
            <h2 className="font-display text-2xl font-bold text-slate-900">Iniciar sesión</h2>
          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    // Cambiamos el type dinámicamente según el estado
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    // Añadimos pr-10 para que el texto no se monte encima del icono del ojo
                    className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  {/* Botón para alternar la visibilidad */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                    tabIndex={-1} // Evita que el tabulador se pare en este botón al rellenar el formulario
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <Label htmlFor="rememberMe" className="text-sm font-medium text-slate-600 cursor-pointer select-none">
                    Recordar datos
                  </Label>
                </div>
                <Link
                  to="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Función de recuperar contraseña en desarrollo.");
                  }}
                  className="text-sm font-semibold text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                  ¿Has olvidado tu contraseña?
                </Link>
              </div>

              <Button type="submit" className="w-full h-11 text-base font-bold shadow-md transition-all hover:scale-[1.02] mt-2" disabled={loading}>
                <LogIn className="mr-2 h-5 w-5" />
                {loading ? "Entrando..." : "Entrar a mi albergue"}
              </Button>
            </form>
            
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-center text-sm text-slate-500">
                ¿No tienes cuenta?{" "}
                <Link to="/register" className="font-bold text-primary hover:underline transition-colors">
                  Crea una cuenta gratis
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
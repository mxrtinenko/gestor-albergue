import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
// Cambiamos useAuth por apiService porque el registro es una llamada única a la API
import { apiService } from "@/services/api"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import HostlyLogo from "@/components/HostlyLogo";
import { UserPlus, Building2 } from "lucide-react";
import { toast } from "sonner";

const Register = () => {
  const [hostelName, setHostelName] = useState(""); // Cambiado de name a hostelName
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!hostelName || !email || !password) {
      toast.error("Completa todos los campos");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      // Llamamos a la API directamente
      await apiService.register({
          username: email,
          password: password,
          hostel_name: hostelName
      });
      
      toast.success("¡Cuenta creada! Ahora inicia sesión.");
      navigate("/login"); // Redirigimos al login, no al registro
    } catch (error) {
      toast.error("Error al registrarse. Puede que el email ya exista.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-2">
          <HostlyLogo size={56} />
          <p className="text-sm text-muted-foreground">
            Crea tu cuenta y empieza a gestionar tu albergue.
          </p>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <h2 className="font-display text-2xl font-bold text-foreground">Crear cuenta</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* CAMPO NUEVO: NOMBRE DEL ALBERGUE */}
              <div className="space-y-2">
                <Label htmlFor="hostelName">Nombre del Albergue</Label>
                <div className="relative">
                    <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                    id="hostelName"
                    placeholder="Ej: Albergue del Sol"
                    className="pl-9"
                    value={hostelName}
                    onChange={(e) => setHostelName(e.target.value)}
                    autoComplete="organization"
                    />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (Usuario)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                <UserPlus className="mr-2 h-4 w-4" />
                {loading ? "Creando..." : "Crear cuenta"}
              </Button>
            </form>
            
            <p className="mt-4 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Inicia sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
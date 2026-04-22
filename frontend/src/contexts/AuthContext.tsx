import React, { createContext, useContext, useState, useEffect } from "react";
import { apiService } from "../services/api";

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null; // <--- 1. AÑADIMOS EL USUARIO A LA INTERFAZ
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any | null>(null); // <--- 2. CREAMOS EL ESTADO DEL USUARIO
  const [isLoading, setIsLoading] = useState(true);

  // Al cargar la app, comprobamos si hay un token guardado
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("hostly_token");
      if (token) {
        setIsAuthenticated(true);
        try {
          // Si hay token, pedimos los datos del usuario al backend
          const profileData = await apiService.getProfile();
          setUser(profileData); // Guardamos el ID, nombre, etc.
        } catch (error) {
          // Si falla (ej. token caducado), cerramos sesión
          localStorage.removeItem("hostly_token");
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await apiService.login(email, password);
      localStorage.setItem("hostly_token", data.access_token);
      setIsAuthenticated(true);
      
      // Inmediatamente después de loguear, pedimos y guardamos sus datos
      const profileData = await apiService.getProfile();
      setUser(profileData);
      
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("hostly_token");
    setIsAuthenticated(false);
    setUser(null); // Limpiamos el usuario al salir
  };

  return (
    // <--- 3. EXPORTAMOS EL USER PARA QUE TODA LA APP LO PUEDA USAR
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};
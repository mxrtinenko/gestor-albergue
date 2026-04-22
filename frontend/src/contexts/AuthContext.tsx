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
        // Asumimos que estás logueado porque tienes la llave
        setIsAuthenticated(true); 
        try {
          // Intentamos pedir tus datos
          const profileData = await apiService.getProfile();
          setUser(profileData);
        } catch (error: any) {
          // solo si el servidor nos jura que el token ha caducado, te echamos
          if (error.message === "TOKEN_EXPIRED") {
            localStorage.removeItem("hostly_token");
            setIsAuthenticated(false);
            setUser(null);
          }
          // Si el servidor estaba dormido (SERVER_ERROR), no hacemos nada. 
          // Sigues logueado y el usuario simplemente no tendrá foto/nombre 
          // hasta que la app logre conectar más tarde.
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
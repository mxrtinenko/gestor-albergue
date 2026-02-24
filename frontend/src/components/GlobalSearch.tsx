import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiService } from "@/services/api";

const GlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Efecto "Debounce" para no saturar el servidor al teclear rápido
  useEffect(() => {
    const fetchResults = async () => {
      if (query.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      setIsSearching(true);
      try {
        const data = await apiService.searchBookings(query);
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        console.error("Error buscando", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 400); // Espera 400ms tras teclear
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Cerrar el buscador al hacer clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (date: string) => {
    setIsOpen(false);
    setQuery(""); // Limpiamos el buscador
    navigate(`/registro?date=${date}`); // ¡Magia! Vamos a la fecha
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar peregrino (Nombre, DNI)..."
          className="pl-10 bg-white/50 backdrop-blur-sm border-primary/20 focus-visible:ring-primary h-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        />
        {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-primary animate-spin" />}
      </div>

      {/* Resultados Flotantes */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg border shadow-xl overflow-hidden z-50">
          {results.length > 0 ? (
            <div className="p-2 flex flex-col max-h-80 overflow-y-auto">
              <div className="text-[10px] font-bold text-muted-foreground mb-2 px-2 uppercase tracking-wider">Resultados</div>
              {results.map((b) => (
                <div
                  key={b.id}
                  onClick={() => handleSelect(b.date)}
                  className="flex items-center justify-between p-2 hover:bg-primary/10 cursor-pointer rounded-md transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold flex items-center gap-1.5 text-foreground capitalize">
                      <User className="w-3.5 h-3.5 text-primary" /> {b.guestName}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-5">{b.dni || "Sin DNI"}</span>
                  </div>
                  <div className="text-xs font-medium bg-secondary px-2 py-1 rounded-md text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-muted-foreground" /> 
                    {/* Formatea la fecha "YYYY-MM-DD" a "DD/MM" */}
                    {b.date.split("-")[2]}/{b.date.split("-")[1]}
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 && !isSearching ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No se han encontrado peregrinos para "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
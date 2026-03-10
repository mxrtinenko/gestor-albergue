import React, { useState, useEffect } from 'react'; // <-- Añadido useEffect
import { useHostelStore, PendingScan } from '@/stores/hostelStore';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { 
  Camera, 
  Loader2, 
  Plus, 
  ScanLine,
  X,
  AlertTriangle 
} from 'lucide-react';
import { format } from 'date-fns';

export function FastCheckInHeader() {
  const { pendingScans, addPendingScan, removePendingScan } = useHostelStore();
  const [isScanning, setIsScanning] = useState(false);
  const [open, setOpen] = useState(false);
  
  // NUEVO: Estado para saber si la carpeta automática está procesando algo
  const [folderProcessing, setFolderProcessing] = useState(false);

  // NUEVO: El vigilante del Frontend. Pregunta cada segundo si hay actividad
  useEffect(() => {
    const interval = setInterval(async () => {
        try {
            const status = await apiService.getScanStatus();
            setFolderProcessing(status.processing_count > 0);
        } catch (e) {
            // Silencioso en caso de error de red temporal
        }
    }, 1000); 
    return () => clearInterval(interval);
  }, []);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const toastId = toast.loading('Analizando documento...');

    try {
      const result = await apiService.scanDocument(file);

      if (result.error) {
        toast.error(result.error, { id: toastId });
      } else {
        const newScan: PendingScan = {
          id: `scan-${Date.now()}`,
          timestamp: Date.now(),
          data: {
            name: result.data.guestName || result.data.name || '', 
            surname: result.data.surname || '',
            dni: result.data.dni || '',
            dniType: result.data.dniType || 'DNI',
            nationality: result.data.nationality || 'España',
            birthDate: result.data.birthDate || '',
            sex: result.data.sex || 'M',
          },
        };

        addPendingScan(newScan);
        toast.success('¡Añadido a la cola!', { id: toastId });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: toastId });
    } finally {
      setIsScanning(false);
      e.target.value = ''; 
    }
  };

  const handleRemoveScan = async (scanId: string) => {
    removePendingScan(scanId); 
    try {
      await apiService.deletePendingScan(scanId); 
    } catch (e) {
      console.error("No se pudo borrar del backend", e);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative mr-2 text-muted-foreground hover:text-foreground">
          
          {/* NUEVA LÓGICA DE ICONO: Si está procesando la carpeta O subiendo manual, rueda gira. Si no, cámara */}
          {folderProcessing || isScanning ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
              <Camera className={`h-5 w-5 ${pendingScans.length > 0 ? 'text-primary fill-primary/20' : ''}`} />
          )}
          
          {/* Badge rojo con el contador */}
          {pendingScans.length > 0 && !folderProcessing && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-in zoom-in">
              {pendingScans.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0 mr-4" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-slate-50/50">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            Cola de Escaneo
          </h4>
          <span className="text-xs text-muted-foreground">{pendingScans.length} pendientes</span>
        </div>

        <div className="p-4 border-b bg-white">
            <div className="relative">
                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="header-scanner"
                    className="hidden"
                    onChange={handleScan}
                    disabled={isScanning}
                />
                <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-md transition-all active:scale-95"
                    onClick={() => document.getElementById('header-scanner')?.click()}
                    disabled={isScanning || folderProcessing}
                >
                    {isScanning || folderProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <Plus className="mr-2 h-4 w-4" />
                            Escanear Nuevo DNI
                        </>
                    )}
                </Button>
            </div>
        </div>

        <ScrollArea className="h-[300px]">
          {pendingScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4 text-muted-foreground">
                <Camera className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">La cola está vacía.</p>
                {folderProcessing ? (
                    <p className="text-xs mt-2 text-primary animate-pulse flex items-center gap-1 justify-center">
                        <Loader2 className="h-3 w-3 animate-spin" /> Escáner detectado...
                    </p>
                ) : (
                    <p className="text-xs mt-1">Sube una foto aquí para usarla más tarde.</p>
                )}
            </div>
          ) : (
            <div className="divide-y">
              {pendingScans.map((scan) => {
                const rawData = scan.data as any; 
                
                const rawName = rawData.guestName || scan.data.name || "";
                const safeName = rawName || "Desconocido";
                const safeSurname = scan.data.surname || "";
                const safeDni = scan.data.dni || "Sin DNI";
                const safeBirthDate = scan.data.birthDate || "";
                
                const initial = safeName.charAt(0).toUpperCase();

                const isIncomplete = !rawName || !safeSurname || safeDni === "Sin DNI" || !safeBirthDate;

                return (
                  <div key={scan.id} className={`flex items-center justify-between p-3 transition-colors group border-l-4 ${isIncomplete ? 'border-yellow-400 bg-yellow-50/50 hover:bg-yellow-100/50' : 'border-transparent hover:bg-slate-50'}`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                          
                          {isIncomplete ? (
                              <div className="h-8 w-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0" title="Faltan datos por revisar">
                                  <AlertTriangle className="h-4 w-4" />
                              </div>
                          ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                                  {initial}
                              </div>
                          )}

                          <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                  {safeName} {safeSurname}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Badge variant="outline" className={`text-[9px] h-4 px-1 rounded-sm ${isIncomplete ? 'border-yellow-300' : 'border-slate-200'}`}>
                                      {safeDni}
                                  </Badge>
                                  • {format(scan.timestamp, 'HH:mm')}
                              </p>
                          </div>
                      </div>
                      <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground hover:text-red-500 opacity-50 group-hover:opacity-100 transition-all"
                          onClick={() => handleRemoveScan(scan.id)}
                          title="Descartar"
                      >
                          <X className="h-4 w-4" />
                      </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
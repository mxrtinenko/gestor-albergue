import React, { useState } from 'react';
import { useHostelStore, PendingScan } from '@/stores/hostelStore';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, Loader2, Trash2, Clock, CheckCircle2, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const FastCheckIn = () => {
  const { pendingScans, addPendingScan, removePendingScan } = useHostelStore();
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const toastId = toast.loading('Procesando documento...');

    try {
      // 1. Enviamos al backend
      const result = await apiService.scanDocument(file);

      if (result.error) {
        toast.error(result.error, { id: toastId });
      } else {
        // 2. Creamos el objeto de escaneo
        const newScan: PendingScan = {
          id: `scan-${Date.now()}`,
          timestamp: Date.now(),
          data: {
            name: result.data.guestName || '',
            surname: result.data.surname || '',
            dni: result.data.dni || '',
            dniType: result.data.dniType || 'DNI',
            nationality: result.data.nationality || 'España',
            birthDate: result.data.birthDate || '',
            sex: result.data.sex || 'M',
          },
        };

        // 3. Guardamos en la cola
        addPendingScan(newScan);
        toast.success('¡Guardado en la cola!', { id: toastId });
      }
    } catch (error) {
      toast.error('Error de conexión', { id: toastId });
    } finally {
      setIsScanning(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="mx-auto max-w-lg p-4 animate-fade-in pb-20">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Modo Ráfaga
        </h1>
        <p className="text-sm text-muted-foreground">
          Escanea ahora, asigna habitación luego.
        </p>
      </div>

      {/* --- BOTÓN GIGANTE DE CÁMARA --- */}
      <div className="mb-8 flex justify-center">
        <div className="relative group">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            id="fast-scanner"
            className="hidden"
            onChange={handleScan}
            disabled={isScanning}
          />
          <Button
            className="h-48 w-48 rounded-full shadow-2xl border-4 border-white ring-4 ring-primary/20 bg-gradient-to-br from-primary to-primary/80 hover:scale-105 transition-all flex flex-col gap-2"
            onClick={() => document.getElementById('fast-scanner')?.click()}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-white" />
                <span className="text-lg font-bold text-white">Procesando...</span>
              </>
            ) : (
              <>
                <Camera className="h-16 w-16 text-white" />
                <span className="text-xl font-bold text-white">ESCANEAR</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* --- LISTA DE PENDIENTES --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pendientes ({pendingScans.length})
          </h2>
        </div>

        {pendingScans.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p>Todo limpio. No hay documentos en cola.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingScans.map((scan) => (
              <Card key={scan.id} className="overflow-hidden border-l-4 border-l-amber-400 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {scan.data.name} {scan.data.surname}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-white">
                          {scan.data.dni}
                        </Badge>
                        <span>{format(scan.timestamp, 'HH:mm', { locale: es })}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => {
                        if(confirm('¿Borrar este escaneo?')) removePendingScan(scan.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FastCheckIn;
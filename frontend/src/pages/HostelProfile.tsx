import React, { useState, useEffect } from "react";
import { useHostelStore } from "@/stores/hostelStore";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, CreditCard, Plus, Trash2, BedDouble, Euro, Loader2, LogOut, Pencil, X, Percent } from "lucide-react"; 
import { Badge } from "@/components/ui/badge";

const HostelProfile = () => {
  const { hostel, setHostel, rooms, setRooms } = useHostelStore();
  const { logout } = useAuth(); 
  
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomBeds, setNewRoomBeds] = useState(4);
  const [newRoomPrice, setNewRoomPrice] = useState(15);
  const [loading, setLoading] = useState(false);

  // Estados para el modo edición general
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [originalHostel, setOriginalHostel] = useState(hostel); 

  // NUEVO: Estados para la edición de una habitación específica
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomBeds, setEditRoomBeds] = useState(0);
  const [editRoomPrice, setEditRoomPrice] = useState(0);

  const fetchAllData = async () => {
    setLoading(true);
    try {
        const roomsData = await apiService.getRooms();
        const formattedRooms = roomsData.map((r: any) => ({
            id: r.id, 
            name: r.name,
            priceDefault: r.price_default,
            beds: r.beds.map((b: any) => ({ id: b.id, label: b.label }))
        }));
        setRooms(formattedRooms);

        const profile = await apiService.getProfile();
        const loadedHostel = {
            name: profile.hostel_name,
            address: profile.address || "",
            phone: profile.phone || "",
            email: profile.email || "",
            razonSocial: profile.razon_social || "",
            nif: profile.nif || "",
            domicilioFiscal: profile.domicilio_fiscal || "",
			taxRate: profile.tax_rate || 10
        };
        setHostel(loadedHostel);
        setOriginalHostel(loadedHostel);

    } catch (error) {
        console.error("Error cargando datos:", error);
        toast.error("Error al cargar datos del servidor");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSaveHostel = async () => {
    try {
        setLoading(true);
        await apiService.updateProfile({
            hostel_name: hostel.name,
            address: hostel.address,
            phone: hostel.phone,
            email: hostel.email,
            razon_social: hostel.razonSocial,
            nif: hostel.nif,
            domicilio_fiscal: hostel.domicilioFiscal,
			// @ts-ignore
            tax_rate: hostel.taxRate
        });
        setOriginalHostel(hostel); 
        setIsEditingInfo(false);   
        toast.success("Datos del albergue guardados correctamente");
    } catch (error) {
        toast.error("Error al guardar perfil");
    } finally {
        setLoading(false);
    }
  };

  const handleCancelEdit = () => {
      setHostel(originalHostel); 
      setIsEditingInfo(false);
  };

  const handleAddRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Escribe un nombre para la habitación");
      return;
    }
    
    setLoading(true);
    try {
        await apiService.createRoom(newRoomName, newRoomBeds, newRoomPrice);
        toast.success("Habitación añadida");
        setNewRoomName("");
        setNewRoomBeds(4);
        setNewRoomPrice(15);
        fetchAllData(); 
    } catch (error) {
        toast.error("Error al crear habitación");
    } finally {
        setLoading(false);
    }
  };

  const handleRemoveRoom = async (roomId: string | number) => {
      if(!confirm("¿Seguro que quieres eliminar esta habitación? Los datos contables se mantendrán, pero la habitación desaparecerá del calendario.")) return;
      
      try {
          await apiService.deleteRoom(Number(roomId));
          toast.success("Habitación eliminada");
          fetchAllData();
      } catch (error) {
          toast.error("Error al eliminar");
      }
  };

  // NUEVO: Funciones para editar habitación
  const openEditRoomDialog = (room: any) => {
      setEditingRoom(room);
      setEditRoomName(room.name);
      setEditRoomBeds(room.beds.length);
      setEditRoomPrice(room.priceDefault || 0);
  };

  const handleSaveRoomEdit = async () => {
      if (!editingRoom) return;
      if (!editRoomName.trim()) {
          toast.error("El nombre no puede estar vacío");
          return;
      }

      setLoading(true);
      try {
          await apiService.updateRoom(editingRoom.id, editRoomName, editRoomBeds, editRoomPrice);
          toast.success("Habitación actualizada");
          setEditingRoom(null);
          fetchAllData(); // Refresca las camas y los datos visuales
      } catch (error) {
          toast.error("Error al actualizar la habitación");
      } finally {
          setLoading(false);
      }
  };

  const totalBeds = rooms.reduce((acc, r) => acc + r.beds.length, 0);

  const inputClassName = isEditingInfo 
    ? "bg-white" 
    : "bg-transparent border-transparent px-0 text-muted-foreground font-medium disabled:opacity-80 focus-visible:ring-0 shadow-none";

  return (
    <div className="mx-auto max-w-4xl animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Mi Albergue</h1>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      </div>

      <Tabs defaultValue="datos" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="datos" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Datos del Albergue
          </TabsTrigger>
          <TabsTrigger value="tarifas" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Suscripción Hostly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-6">
          
          <div className="flex justify-between items-end border-b pb-2 mb-4">
              <h2 className="text-xl font-bold text-muted-foreground">Ficha del Establecimiento</h2>
              {!isEditingInfo ? (
                  <Button variant="outline" onClick={() => setIsEditingInfo(true)} className="gap-2">
                      <Pencil className="h-4 w-4" /> Editar Datos
                  </Button>
              ) : (
                  <div className="flex gap-2">
                      <Button variant="ghost" onClick={handleCancelEdit} className="text-muted-foreground">
                          <X className="h-4 w-4 mr-2" /> Cancelar
                      </Button>
                      <Button onClick={handleSaveHostel} disabled={loading} className="gap-2">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
                      </Button>
                  </div>
              )}
          </div>

          <Card className={`shadow-card transition-all duration-300 ${!isEditingInfo ? "bg-slate-50/50 shadow-sm border-dashed" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-primary">Información Comercial</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nombre Comercial</Label>
                <Input value={hostel.name} onChange={(e) => setHostel({ ...hostel, name: e.target.value })} placeholder="Ej: Albergue del Camino" disabled={!isEditingInfo} className={inputClassName} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Dirección Física</Label>
                <Input value={hostel.address} onChange={(e) => setHostel({ ...hostel, address: e.target.value })} placeholder="Ej: Calle Mayor, 1" disabled={!isEditingInfo} className={inputClassName} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Teléfono de Contacto</Label>
                <Input value={hostel.phone} onChange={(e) => setHostel({ ...hostel, phone: e.target.value })} placeholder="+34 600 000 000" disabled={!isEditingInfo} className={inputClassName} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Correo Electrónico</Label>
                <Input value={hostel.email} onChange={(e) => setHostel({ ...hostel, email: e.target.value })} placeholder="info@albergue.com" disabled={!isEditingInfo} className={inputClassName} />
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-card transition-all duration-300 ${!isEditingInfo ? "bg-slate-50/50 shadow-sm border-dashed" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-primary">Datos de Facturación</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Razón Social</Label>
                <Input value={hostel.razonSocial} onChange={(e) => setHostel({ ...hostel, razonSocial: e.target.value })} placeholder="Albergue Camino S.L." disabled={!isEditingInfo} className={inputClassName} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">NIF / CIF</Label>
                <Input value={hostel.nif} onChange={(e) => setHostel({ ...hostel, nif: e.target.value })} placeholder="B12345678" disabled={!isEditingInfo} className={inputClassName} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Domicilio Fiscal</Label>
                <Input value={hostel.domicilioFiscal} onChange={(e) => setHostel({ ...hostel, domicilioFiscal: e.target.value })} placeholder="Calle Mayor, 1, 28001 Madrid" disabled={!isEditingInfo} className={inputClassName} />
              </div>
			  <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    IVA / Impuesto por defecto (%)
                </Label>
                <div className="relative">
                    <Input 
                        type="number" 
                        // @ts-ignore
                        value={hostel.taxRate} 
                        onChange={(e) => setHostel({ ...hostel, taxRate: Number(e.target.value) })} 
                        disabled={!isEditingInfo} 
                        className={inputClassName + " pr-8"} 
                    />
                    {isEditingInfo && <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="pt-4 border-t mt-8">
              <Card className="shadow-card border-l-4 border-l-primary">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-lg">Configuración de Habitaciones</CardTitle>
                  <Badge variant="outline" className="text-primary border-primary bg-primary/5">
                    {rooms.length} hab. — {totalBeds} camas
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {rooms.map((room) => (
                      <div key={room.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-primary/10 rounded-full">
                            <BedDouble className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-base">{room.name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="font-semibold text-foreground">{room.beds.length} camas</span> 
                                <span className="text-gray-300">|</span> 
                                <span className="text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded text-xs border border-green-200">
                                    {room.priceDefault || 0}€ / noche
                                </span>
                            </p>
                          </div>
                        </div>
                        
                        {/* NUEVA BOTONERA (LÁPIZ + PAPELERA) */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={() => openEditRoomDialog(room)}
                            title="Editar habitación"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveRoom(room.id)}
                            title="Eliminar habitación"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row items-end gap-3 pt-4 border-t bg-secondary/30 p-4 rounded-xl mt-4">
                    <div className="flex-1 space-y-1 w-full">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Nueva habitación</Label>
                      <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Ej: Hab. Azul" className="bg-white shadow-sm border-gray-200" />
                    </div>
                    <div className="w-full md:w-24 space-y-1">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Camas</Label>
                      <Input type="number" min={1} max={50} value={newRoomBeds} onChange={(e) => setNewRoomBeds(Number(e.target.value))} className="bg-white shadow-sm border-gray-200" />
                    </div>
                    <div className="w-full md:w-28 space-y-1">
                      <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1"><Euro className="h-3 w-3"/> Precio</Label>
                      <Input type="number" min={0} value={newRoomPrice} onChange={(e) => setNewRoomPrice(Number(e.target.value))} className="bg-white shadow-sm border-gray-200" />
                    </div>
                    <Button onClick={handleAddRoom} className="shrink-0 w-full md:w-auto shadow-sm" disabled={loading}>
                      {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Añadir
                    </Button>
                  </div>
                </CardContent>
              </Card>
          </div>

          <div className="mt-12 p-5 bg-red-50/50 border border-red-100 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
                <h4 className="font-bold text-red-800">Cerrar sesión</h4>
                <p className="text-sm text-red-600/80">Cierra tu sesión de forma segura en este dispositivo.</p>
            </div>
            <Button variant="outline" onClick={logout} className="text-destructive border-destructive hover:bg-destructive/10 w-full sm:w-auto bg-white shadow-sm">
                <LogOut className="mr-2 h-4 w-4" /> Salir de la cuenta
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="tarifas" className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Tu Plan de Hostly</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-border p-6 space-y-4 relative">
                  <Badge variant="secondary">Actual</Badge>
                  <h3 className="font-display text-xl font-bold">Gratuito</h3>
                  <p className="text-3xl font-bold text-foreground">0€<span className="text-sm font-normal text-muted-foreground"> / mes</span></p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Uso personal</li>
                    <li>✓ Gestión de camas</li>
                    <li>✓ Funciones básicas</li>
                  </ul>
                </div>
                <div className="rounded-xl border-2 border-gold p-6 space-y-4 relative bg-accent/5">
                  <Badge className="bg-gold text-accent-foreground">Pro</Badge>
                  <h3 className="font-display text-xl font-bold">Profesional</h3>
                  <p className="text-3xl font-bold text-foreground">15€<span className="text-sm font-normal text-muted-foreground"> / mes</span></p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Copias de seguridad en nube</li>
                    <li>✓ Soporte prioritario</li>
                    <li>✓ Módulos avanzados (Facturación PDF)</li>
                  </ul>
                  <Button className="w-full bg-gold hover:bg-gold/90 text-accent-foreground">
                    Actualizar Plan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- MODAL PARA EDITAR HABITACIÓN --- */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Habitación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la habitación</Label>
              <Input 
                  value={editRoomName} 
                  onChange={(e) => setEditRoomName(e.target.value)} 
                  placeholder="Ej: Hab. Roja" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Camas totales</Label>
                    <Input 
                        type="number" 
                        min={1} 
                        value={editRoomBeds} 
                        onChange={(e) => setEditRoomBeds(Number(e.target.value))} 
                    />
                </div>
                <div className="space-y-2">
                    <Label>Precio base (€)</Label>
                    <Input 
                        type="number" 
                        min={0} 
                        value={editRoomPrice} 
                        onChange={(e) => setEditRoomPrice(Number(e.target.value))} 
                    />
                </div>
            </div>
            <p className="text-xs text-muted-foreground bg-blue-50 text-blue-800 p-2 rounded border border-blue-100">
               ℹ️ Si reduces las camas, se ocultarán las últimas de la lista. Las reservas antiguas seguirán a salvo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoom(null)}>
                Cancelar
            </Button>
            <Button onClick={handleSaveRoomEdit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HostelProfile;
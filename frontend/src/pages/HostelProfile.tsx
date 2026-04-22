import React, { useState, useEffect } from "react";
import { useHostelStore, HostelData } from "@/stores/hostelStore";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Building2, CreditCard, Plus, Trash2, BedDouble, Euro, Loader2, 
  LogOut, Pencil, X, Percent, ChevronDown, ChevronUp, Hammer, Power, Save, FileText, AlertTriangle, Lock,
  FolderOpen, Camera // <-- Añadido icono Camera
} from "lucide-react"; 
import { Badge } from "@/components/ui/badge";

// --- COMPONENTE DE CAMPO PROTEGIDO / EDITABLE ---
const ProfileField = ({ label, value, isEditing, onChange, placeholder, type = "text", icon: Icon }: any) => (
    <div className="space-y-1.5 relative">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
            {label}
        </Label>
        <div className="relative">
            <Input 
                type={type}
                value={value} 
                onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} 
                placeholder={placeholder} 
                disabled={!isEditing}
                className={`transition-all bg-background text-foreground ${!isEditing ? 'opacity-70 cursor-not-allowed border-border' : 'focus:ring-primary/30 border-input'} ${Icon ? 'pr-8' : ''}`}
            />
            {Icon && <Icon className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />}
            
            {!isEditing && (
                <div className="absolute right-3 top-2.5 text-muted-foreground/50">
                    {!Icon && <Lock className="h-4 w-4" />}
                </div>
            )}
        </div>
    </div>
);

const HostelProfile = () => {
  const { hostel, setHostel, rooms, setRooms } = useHostelStore();
  const { user, logout } = useAuth(); 
  
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomBeds, setNewRoomBeds] = useState(4);
  const [newRoomPrice, setNewRoomPrice] = useState(15);
  const [loading, setLoading] = useState(false);

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editFormData, setEditFormData] = useState(hostel); 
  
  // --- NUEVOS ESTADOS PARA EL LOGO ---
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomBeds, setEditRoomBeds] = useState(0);
  const [editRoomPrice, setEditRoomPrice] = useState(0);
  const [editRoomMaintenance, setEditRoomMaintenance] = useState(false);
  const [showBedEditor, setShowBedEditor] = useState(false); 

  const [scannerPath, setScannerPath] = useState(localStorage.getItem('hostly_scanner_path') || 'D:\\Escaneos');

  const fetchAllData = async () => {
    setLoading(true);
    try {
        const roomsData = await apiService.getRooms();
        const formattedRooms = roomsData.map((r: any) => ({
            id: r.id, 
            name: r.name,
            priceDefault: r.price_default,
            is_maintenance: r.is_maintenance, 
            beds: r.beds.map((b: any) => ({ 
                id: b.id, 
                label: b.label, 
                is_maintenance: b.is_maintenance 
            }))
        }));
        setRooms(formattedRooms);

        const profile = await apiService.getProfile();
        const loadedHostel: HostelData= {
            name: profile.hostel_name,
            address: profile.address || "",
            phone: profile.phone || "",
            email: profile.email || "",
            razonSocial: profile.razon_social || "",
            nif: profile.nif || "",
            domicilioFiscal: profile.domicilio_fiscal || "",
            taxRate: profile.tax_rate || 10,
            logoUrl: profile.logo_url || null // <-- Añadimos la lectura del logo
        };
        setHostel(loadedHostel);
        setEditFormData(loadedHostel);
        if (loadedHostel.logoUrl) setLogoPreview(loadedHostel.logoUrl);

    } catch (error) {
        console.error("Error cargando datos:", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleStartEdit = () => {
      setEditFormData(hostel);
      setIsEditingInfo(true);
  };

  const handleCancelEdit = () => {
      setIsEditingInfo(false);
      setLogoFile(null);
      setLogoPreview(hostel.logoUrl || null); // Restauramos el logo original si cancela
  };

  // --- NUEVA FUNCIÓN: Manejar selección de imagen ---
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) { // Límite de 2MB
              toast.error("La imagen es demasiado grande. Máximo 2MB.");
              return;
          }
          setLogoFile(file);
          setLogoPreview(URL.createObjectURL(file)); // Creamos URL temporal para previsualizar
      }
  };

const handleSaveHostel = async () => {
    try {
        setLoading(true);
        
        // 1. Preparamos el objeto con los datos actuales del formulario
        // Usamos una copia para no mutar el estado directamente antes de tiempo
        const updatedData = { ...editFormData };

        // 2. Si el usuario ha seleccionado un archivo nuevo, lo subimos primero
        if (logoFile) {
            const uploadRes = await apiService.uploadLogo(logoFile);
            // IMPORTANTE: Guardamos la URL que nos da el servidor en nuestro objeto
            updatedData.logoUrl = uploadRes.logo_url; 
            // También actualizamos la previsualización local
            setLogoPreview(uploadRes.logo_url);
        }

        // 3. Guardamos todos los datos (texto + la posible nueva URL del logo) en el perfil
        await apiService.updateProfile({
            hostel_name: updatedData.name,
            address: updatedData.address,
            phone: updatedData.phone,
            email: updatedData.email,
            razon_social: updatedData.razonSocial,
            nif: updatedData.nif,
            domicilio_fiscal: updatedData.domicilioFiscal,
            tax_rate: updatedData.taxRate,
            // Enviamos la URL del logo al perfil para que el backend la asocie al usuario
            logo_url: updatedData.logoUrl 
        });
        
        // 4. ACTUALIZACIÓN CRÍTICA: Guardamos en el Store global
        // Esto es lo que hace que la Sidebar reaccione y cambie la letra por la imagen
        setHostel(updatedData); 

        setIsEditingInfo(false);
        setLogoFile(null); // Limpiamos el archivo temporal
        toast.success("Perfil y logotipo actualizados correctamente");

    } catch (error) {
        console.error("Error al guardar:", error);
        toast.error("Error al guardar los cambios");
    } finally {
        setLoading(false);
    }
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

  const openEditRoomDialog = (room: any) => {
      setEditingRoom(room);
      setEditRoomName(room.name);
      setEditRoomBeds(room.beds.length);
      setEditRoomPrice(room.priceDefault || 0);
      setEditRoomMaintenance(room.is_maintenance || false); 
      setShowBedEditor(false); 
  };

  const handleSaveRoomEdit = async () => {
      if (!editingRoom) return;
      if (!editRoomName.trim()) {
          toast.error("El nombre no puede estar vacío");
          return;
      }

      setLoading(true);
      try {
          await apiService.updateRoom(editingRoom.id, editRoomName, editRoomBeds, editRoomPrice, editRoomMaintenance);
          
          const promises = editingRoom.beds.map((bed: any) => 
             apiService.updateBedLabel(bed.id, bed.label, bed.is_maintenance || false)
          );
          await Promise.all(promises);

          toast.success("Habitación actualizada");
          setEditingRoom(null);
          fetchAllData(); 
      } catch (error) {
          toast.error("Error al actualizar la habitación");
      } finally {
          setLoading(false);
      }
  };

  const handleBedLabelChange = (bedId: string, newLabel: string) => {
      setEditingRoom((prev: any) => ({
          ...prev,
          beds: prev.beds.map((b: any) => b.id === bedId ? { ...b, label: newLabel } : b)
      }));
  };

  const toggleMaintenance = (bedId: string) => {
      setEditingRoom((prev: any) => ({
          ...prev,
          beds: prev.beds.map((b: any) => 
              b.id === bedId ? { ...b, is_maintenance: !b.is_maintenance } : b
          )
      }));
  };

  const handleSelectFolder = async () => {
      try {
          // @ts-ignore
          if (typeof window !== 'undefined' && window.require) {
              // @ts-ignore
              const { ipcRenderer } = window.require('electron');
              const folder = await ipcRenderer.invoke('select-folder');
              if (folder) setScannerPath(folder);
          } else {
              toast.info("Abre el programa desde el acceso directo (Electron) para usar el explorador de Windows.");
          }
      } catch (e) {
          console.error(e);
      }
  };

const handleSaveScannerPath = async () => {
      localStorage.setItem('hostly_scanner_path', scannerPath);
      try {
          // @ts-ignore
          if (typeof window !== 'undefined' && window.require) {
              // @ts-ignore
              const { ipcRenderer } = window.require('electron');
              
              // AÑADIMOS EL ID DEL USUARIO A LA LLAMADA (user?.id)
              ipcRenderer.send('update-scanner-path', scannerPath, user?.id);
          }
      } catch (e) {}

      toast.success("Ruta del escáner guardada en este ordenador.");
  };

  const totalBeds = rooms.reduce((acc, r) => acc + r.beds.length, 0);

  return (
    <div className="mx-auto max-w-4xl animate-fade-in pb-10 mt-6 text-foreground">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Configuración</h1>
            <p className="text-muted-foreground mt-1">Gestiona los datos legales y las habitaciones de tu negocio.</p>
        </div>
        {loading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      </div>

      <Tabs defaultValue="datos" className="space-y-6">
        <TabsList className="bg-muted p-1 h-auto border border-border">
          <TabsTrigger value="datos" className="gap-2 py-2 px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" />
            Datos del Albergue
          </TabsTrigger>
          <TabsTrigger value="tarifas" className="gap-2 py-2 px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" />
            Suscripción Hostly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-6">
          
          <div className="flex justify-between items-center border-b border-border pb-3 mt-4 mb-6">
              <h2 className="text-xl font-bold text-foreground">Ficha del Establecimiento</h2>
              
              {!isEditingInfo && (
                  <Button onClick={handleStartEdit} className="gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
                      <Pencil className="h-4 w-4" /> Editar Datos
                  </Button>
              )}
          </div>

          {isEditingInfo && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 px-5 py-4 rounded-xl flex items-start gap-3 mb-8 animate-in fade-in slide-in-from-top-2 shadow-sm">
                  <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                  <div>
                      <p className="font-bold text-base">Atención: Información Legal</p>
                      <p className="text-sm mt-1 opacity-90 leading-relaxed">
                          Verifica cuidadosamente que los datos fiscales sean correctos. Esta información es la que se utilizará para generar tus facturas oficiales y cumplir con la normativa antifraude (VeriFactu) de la Agencia Tributaria.
                      </p>
                  </div>
              </div>
          )}

          {/* --- NUEVO: SECCIÓN LOGOTIPO --- */}
          <div className="mb-8 flex items-center gap-5 bg-card p-5 rounded-xl border border-border shadow-sm">
            <div className="relative h-24 w-24 shrink-0 rounded-2xl border border-border bg-muted overflow-hidden flex items-center justify-center shadow-inner">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display font-bold text-4xl text-muted-foreground/50">
                  {editFormData.name ? editFormData.name.charAt(0).toUpperCase() : "A"}
                </span>
              )}
              
              {isEditingInfo && (
                <label className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-foreground mb-1" />
                  <span className="text-[10px] font-bold">Cambiar</span>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/png, image/jpeg"
                    onChange={handleLogoChange}
                  />
                </label>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Logotipo del Albergue</h3>
              <p className="text-sm text-muted-foreground mt-1">Este logo se imprimirá en las cabeceras de tus facturas PDF.</p>
              {isEditingInfo && <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1"><Camera className="w-3 h-3"/> Haz clic en la imagen para subir una nueva (JPG/PNG).</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <Card className={`bg-card shadow-sm transition-all duration-300 ${isEditingInfo ? 'border-primary/50 shadow-md ring-1 ring-primary/20' : 'border-border'}`}>
                <CardHeader className="pb-4 border-b border-border bg-muted/30">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      Información Comercial
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-5 pt-6">
                  <ProfileField 
                      label="Nombre Comercial" 
                      value={isEditingInfo ? editFormData.name : hostel.name} 
                      isEditing={isEditingInfo}
                      onChange={(v: string) => setEditFormData({...editFormData, name: v})}
                      placeholder="Ej: Albergue del Camino" 
                  />
                  <ProfileField 
                      label="Dirección Física" 
                      value={isEditingInfo ? editFormData.address : hostel.address} 
                      isEditing={isEditingInfo}
                      onChange={(v: string) => setEditFormData({...editFormData, address: v})}
                      placeholder="Ej: Calle Mayor, 1" 
                  />
                  <ProfileField 
                      label="Teléfono de Contacto" 
                      value={isEditingInfo ? editFormData.phone : hostel.phone} 
                      isEditing={isEditingInfo}
                      onChange={(v: string) => setEditFormData({...editFormData, phone: v})}
                      placeholder="+34 600 000 000" 
                  />
                  <ProfileField 
                      label="Correo Electrónico" 
                      value={isEditingInfo ? editFormData.email : hostel.email} 
                      isEditing={isEditingInfo}
                      onChange={(v: string) => setEditFormData({...editFormData, email: v})}
                      placeholder="info@albergue.com" 
                  />
                </CardContent>
              </Card>

              <Card className={`bg-card shadow-sm transition-all duration-300 ${isEditingInfo ? 'border-primary/50 shadow-md ring-1 ring-primary/20' : 'border-border'}`}>
                <CardHeader className="pb-4 border-b border-border bg-muted/30">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      Datos Fiscales (Facturación)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-5 pt-6">
                  <ProfileField 
                      label="Razón Social" 
                      value={isEditingInfo ? editFormData.razonSocial : hostel.razonSocial} 
                      isEditing={isEditingInfo}
                      onChange={(v: string) => setEditFormData({...editFormData, razonSocial: v})}
                      placeholder="Albergue Camino S.L." 
                  />
                  <ProfileField 
                      label="NIF / CIF" 
                      value={isEditingInfo ? editFormData.nif : hostel.nif} 
                      isEditing={isEditingInfo}
                      onChange={(v: string) => setEditFormData({...editFormData, nif: v})}
                      placeholder="B12345678" 
                  />
                  <ProfileField 
                      label="Domicilio Fiscal" 
                      value={isEditingInfo ? editFormData.domicilioFiscal : hostel.domicilioFiscal} 
                      isEditing={isEditingInfo}
                      onChange={(v: string) => setEditFormData({...editFormData, domicilioFiscal: v})}
                      placeholder="Calle Mayor, 1, 28001 Madrid" 
                  />
                  <ProfileField 
                      label="IVA / Impuesto por defecto (%)" 
                      type="number"
                      value={isEditingInfo ? editFormData.taxRate : hostel.taxRate} 
                      isEditing={isEditingInfo}
                      onChange={(v: number) => setEditFormData({...editFormData, taxRate: v})}
                      icon={Percent}
                  />
                </CardContent>
              </Card>

          </div>

          {isEditingInfo && (
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-6 border-t border-border animate-in fade-in slide-in-from-bottom-4">
                  <Button variant="outline" onClick={handleCancelEdit} className="bg-transparent border-border hover:bg-muted text-foreground h-12 px-6 w-full sm:w-auto">
                      <X className="h-4 w-4 mr-2" /> Cancelar Edición
                  </Button>
                  <Button onClick={handleSaveHostel} disabled={loading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md h-12 px-8 text-md font-bold w-full sm:w-auto transition-transform hover:scale-105">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} 
                      Confirmar y Guardar
                  </Button>
              </div>
          )}

          <div className="pt-4 border-t border-border mt-8">
              <Card className="bg-card shadow-sm border-border">
                <CardHeader className="pb-4 border-b border-border bg-muted/30">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      Ajustes del Escáner (Local)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                      Configura la carpeta de este ordenador donde tu escáner físico guarda automáticamente las imágenes. Hostly vigilará esta carpeta en segundo plano.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                      <Input 
                          value={scannerPath} 
                          onChange={(e) => setScannerPath(e.target.value)} 
                          placeholder="Ej: C:\Users\Recepcion\Escaneos" 
                          className="bg-background border-border flex-1 text-foreground" 
                      />
                      <Button variant="secondary" onClick={handleSelectFolder} className="shrink-0 border-border bg-muted hover:bg-muted/80">
                          Explorar Windows...
                      </Button>
                      <Button onClick={handleSaveScannerPath} className="shrink-0">
                          Guardar Ruta
                      </Button>
                  </div>
                </CardContent>
              </Card>
          </div>

          <div className="pt-4 border-t border-border mt-8">
              <Card className="bg-card shadow-sm border-l-4 border-l-primary border-y-border border-r-border">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-lg text-foreground">Configuración de Habitaciones</CardTitle>
                  <Badge variant="outline" className="text-primary border-primary bg-primary/10">
                    {rooms.length} hab. — {totalBeds} camas
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {rooms.map((room) => (
                      <div key={room.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm transition-colors ${room.is_maintenance ? 'border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20' : 'bg-background border-border hover:border-primary/30'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${room.is_maintenance ? 'bg-red-100 dark:bg-red-900/50' : 'bg-primary/10'}`}>
                            {room.is_maintenance ? <Hammer className="h-5 w-5 text-red-600 dark:text-red-400" /> : <BedDouble className="h-5 w-5 text-primary" />}
                          </div>
                          <div>
                            <p className="font-bold text-base flex items-center gap-2 text-foreground">
                                {room.name}
                                {room.is_maintenance && <Badge variant="destructive" className="h-5 text-[10px] px-1">AVERÍA</Badge>}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="font-semibold text-foreground">{room.beds.length} camas</span> 
                                <span className="text-muted-foreground/50">|</span> 
                                <span className="text-green-700 dark:text-green-500 font-semibold bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded text-xs border border-green-200 dark:border-green-900">
                                    {room.priceDefault || 0}€ / noche
                                </span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => openEditRoomDialog(room)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveRoom(room.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row items-end gap-3 pt-4 border-t border-border bg-muted/30 p-4 rounded-xl mt-4">
                    <div className="flex-1 space-y-1 w-full">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Nueva habitación</Label>
                      <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Ej: Hab. Azul" className="bg-background shadow-sm border-border text-foreground" />
                    </div>
                    <div className="w-full md:w-24 space-y-1">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Camas</Label>
                      <Input type="number" min={1} max={50} value={newRoomBeds} onChange={(e) => setNewRoomBeds(Number(e.target.value))} className="bg-background shadow-sm border-border text-foreground" />
                    </div>
                    <div className="w-full md:w-28 space-y-1">
                      <Label className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1"><Euro className="h-3 w-3"/> Precio</Label>
                      <Input type="number" min={0} value={newRoomPrice} onChange={(e) => setNewRoomPrice(Number(e.target.value))} className="bg-background shadow-sm border-border text-foreground" />
                    </div>
                    <Button onClick={handleAddRoom} className="shrink-0 w-full md:w-auto shadow-sm text-primary-foreground" disabled={loading}>
                      {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Añadir
                    </Button>
                  </div>
                </CardContent>
              </Card>
          </div>

          <div className="mt-12 p-5 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
                <h4 className="font-bold text-red-800 dark:text-red-400">Cerrar sesión</h4>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">Cierra tu sesión de forma segura en este dispositivo.</p>
            </div>
            <Button variant="outline" onClick={logout} className="text-destructive border-destructive hover:bg-destructive/10 w-full sm:w-auto bg-transparent shadow-sm">
                <LogOut className="mr-2 h-4 w-4" /> Salir de la cuenta
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="tarifas" className="space-y-6">
          <Card className="bg-card shadow-sm border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Tu Plan de Hostly</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border-2 border-border p-6 space-y-4 relative bg-background">
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">Actual</Badge>
                  <h3 className="font-display text-xl font-bold text-foreground">Gratuito</h3>
                  <p className="text-3xl font-bold text-foreground">0€<span className="text-sm font-normal text-muted-foreground"> / mes</span></p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Uso personal</li>
                    <li>✓ Gestión de camas</li>
                    <li>✓ Funciones básicas</li>
                  </ul>
                </div>
                <div className="rounded-xl border-2 border-gold p-6 space-y-4 relative bg-gold/5 dark:bg-gold/10">
                  <Badge className="bg-gold text-white">Pro</Badge>
                  <h3 className="font-display text-xl font-bold text-foreground">Profesional</h3>
                  <p className="text-3xl font-bold text-foreground">15€<span className="text-sm font-normal text-muted-foreground"> / mes</span></p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>✓ Copias de seguridad en nube</li>
                    <li>✓ Soporte prioritario</li>
                    <li>✓ Módulos avanzados (Facturación PDF)</li>
                  </ul>
                  <Button className="w-full bg-gold hover:bg-gold/90 text-white">
                    Actualizar Plan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- MODAL PARA EDITAR HABITACIÓN Y CAMAS --- */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border text-foreground">
          
          <div className="px-6 py-4 border-b border-border bg-muted/30">
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Habitación</DialogTitle>
              <DialogDescription className="sr-only">Personaliza los nombres de las camas y el estado de mantenimiento.</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-5">
                <div className={`space-y-4 p-4 border rounded-xl transition-colors ${editRoomMaintenance ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' : 'bg-muted/30 border-border'}`}>
                    <div className="space-y-2">
                        <Label>Nombre de la habitación</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={editRoomName} 
                                onChange={(e) => setEditRoomName(e.target.value)} 
                                placeholder="Ej: Hab. Roja" 
                                className={`bg-background text-foreground ${editRoomMaintenance ? 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-800' : 'border-input'}`}
                            />
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setEditRoomMaintenance(!editRoomMaintenance)}
                                className={`shrink-0 border shadow-sm ${editRoomMaintenance ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-800' : 'bg-background text-muted-foreground hover:text-foreground border-border'}`}
                                title={editRoomMaintenance ? "Reactivar habitación" : "Poner en mantenimiento (bloquear)"}
                            >
                                {editRoomMaintenance ? <Power className="h-4 w-4" /> : <Hammer className="h-4 w-4" />}
                            </Button>
                        </div>
                        {editRoomMaintenance && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium animate-pulse">
                                ⚠️ Habitación en mantenimiento. No se podrán recibir reservas.
                            </p>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Camas totales</Label>
                            <Input 
                                type="number" 
                                min={1} 
                                max={50} 
                                value={editRoomBeds} 
                                onChange={(e) => setEditRoomBeds(Number(e.target.value))} 
                                className="bg-background text-foreground border-input"
                                disabled={editRoomMaintenance}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Precio base (€)</Label>
                            <Input 
                                type="number" 
                                min={0} 
                                value={editRoomPrice} 
                                onChange={(e) => setEditRoomPrice(Number(e.target.value))} 
                                className="bg-background text-foreground border-input"
                            />
                        </div>
                    </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                    <button 
                        onClick={() => setShowBedEditor(!showBedEditor)}
                        className="w-full flex items-center justify-between p-4 bg-background hover:bg-muted/50 transition-colors text-sm font-medium text-foreground"
                    >
                        <span>Personalizar camas y estado</span>
                        {showBedEditor ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    
                    {showBedEditor && editingRoom?.beds && (
                        <div className="p-4 bg-muted/30 border-t border-border space-y-2">
                            <p className="text-xs text-muted-foreground mb-3">
                                Cambia el nombre o deshabilita camas (icono martillo).
                            </p>
                            
                            <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2">
                                {editingRoom.beds.slice(0, editRoomBeds).map((bed: any, index: number) => (
                                    <div key={bed.id} className="flex items-center gap-3">
                                        
                                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 transition-colors 
                                            ${bed.is_maintenance || editRoomMaintenance 
                                                ? 'bg-red-100 dark:bg-red-900/50 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400' 
                                                : 'bg-background border-border text-muted-foreground'}`}
                                        >
                                            {(bed.is_maintenance || editRoomMaintenance) ? <Hammer className="h-4 w-4"/> : index + 1}
                                        </div>

                                        <Input 
                                            value={bed.label} 
                                            onChange={(e) => handleBedLabelChange(bed.id, e.target.value)}
                                            className={`h-9 border-input text-foreground ${bed.is_maintenance ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-100 dark:border-red-900' : 'bg-background'}`}
                                            placeholder={`Cama ${index + 1}`}
                                            disabled={editRoomMaintenance}
                                        />

                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            title={bed.is_maintenance ? "Habilitar cama" : "Poner en mantenimiento"}
                                            className={`h-9 w-9 shrink-0 ${bed.is_maintenance 
                                                ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800' 
                                                : 'text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'}`}
                                            onClick={() => toggleMaintenance(bed.id)}
                                            disabled={editRoomMaintenance} 
                                        >
                                            {bed.is_maintenance ? <Power className="h-4 w-4" /> : <Hammer className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                ))}
                                
                                {editRoomBeds > editingRoom.beds.length && (
                                    <div className="p-2 text-xs text-center text-muted-foreground italic border border-dashed border-border rounded bg-background/50">
                                        + {editRoomBeds - editingRoom.beds.length} camas nuevas se generarán automáticamente al guardar.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-2 rounded border border-blue-100 dark:border-blue-900">
                    ℹ️ Las camas en mantenimiento aparecerán bloqueadas en el calendario y no se podrán vender.
                </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRoom(null)} className="bg-transparent border-border text-foreground hover:bg-muted">
                    Cancelar
                </Button>
                <Button onClick={handleSaveRoomEdit} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Guardar Cambios
                </Button>
            </DialogFooter>
          </div>

        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HostelProfile;
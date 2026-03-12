import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useHostelStore, Booking, Guest } from '@/stores/hostelStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
    format,
    addDays,
    subDays,
    differenceInCalendarDays,
    parseISO,
    isBefore,
    startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    UserPlus,
    X,
    BedDouble,
    MoreVertical,
    Phone,
    Pencil,
    Euro,
    Copy,
    Users,
    FileText,
    Trash2,
    Camera,
    Loader2,
    Cake,
    CreditCard,
    AlertTriangle,
    CheckCircle2,
    Split,
    FolderOpen,
    Hammer, 
    Ban,
    Landmark,
    Bed,
    ArrowRight,
} from 'lucide-react';

import { apiService, BookingData } from '../services/api';

// @ts-expect-error: Librería sin tipos definidos
import countries from 'i18n-iso-countries';
// @ts-expect-error: Librería sin tipos definidos
import esLocale from 'i18n-iso-countries/langs/es.json';
countries.registerLocale(esLocale);
const ALL_COUNTRIES = Object.values(
    countries.getNames('es', { select: 'official' }),
) as string[];

const emptyGuest = (): Guest => ({
    id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    surname: '',
    dni: '',
    dniType: 'DNI',
    birthDate: '',
    sex: 'M',
    nationality: 'ESPAÑA',
    phone: '',
    email: '',
    checkedIn: false,
});

const esCumpleaños = (fechaNacimiento: string) => {
    if (!fechaNacimiento) return false;
    const hoy = new Date();
    const cumple = new Date(fechaNacimiento + 'T12:00:00');
    return (
        hoy.getDate() === cumple.getDate() && hoy.getMonth() === cumple.getMonth()
    );
};

const DayView = () => {
    // --- CAMBIO 1: USAMOS setSearchParams PARA EVITAR EL PARPADEO ---
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const dateParam =
        searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
    const currentDate = new Date(dateParam + 'T12:00:00');

    const {
        rooms,
        bookings,
        addBookings,
        setBookings,
        updateBooking,
        removeBooking,
        getBookingForBed,
        setRooms,
        pendingScans,
        removePendingScan
    } = useHostelStore();

    useEffect(() => {
        const loadData = async () => {
            try {
                const roomsData = await apiService.getRooms();
                const formattedRooms = roomsData.map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    priceDefault: r.price_default,
                    is_maintenance: r.is_maintenance, // IMPORTANTE: Capturar mantenimiento
                    beds: r.beds.map((b: any) => ({ 
                        id: b.id, 
                        label: b.label, 
                        is_maintenance: b.is_maintenance 
                    })),
                }));
                setRooms(formattedRooms);

                const bookingsData = await apiService.getBookings();
                const formattedBookings: Booking[] = bookingsData.map((b) => ({
                    id: b.id,
                    bedId: b.bedId,
                    roomId: b.bedId.split('-')[0],
                    date: b.date,
                    totalPrice: b.totalPrice || 0,
                    paid: b.paid || false,
                    paymentMethod:
                        (b.paymentMethod as Booking['paymentMethod']) || 'EFECTIVO',
                    groupId: b.groupId,
                    guest: {
                        id: `g-${b.id}`,
                        name: b.guestName.split(' ')[0] || 'Huésped',
                        surname: b.guestName.split(' ')[1] || '',
                        phone: b.phone || '',
                        dni: b.dni || '',
                        dniType: (b.dniType as Guest['dniType']) || 'DNI',
                        birthDate: b.birthDate || '',
                        sex: (b.sex as Guest['sex']) || 'M',
                        nationality: b.nationality || 'ESPAÑA', 
                        checkedIn: b.checkedIn,
                    },
                }));

                setBookings(formattedBookings);
            } catch (error) {
                console.error('Error cargando datos del servidor:', error);
            }
        };

        loadData();
    }, [dateParam, setBookings, setRooms]);
    
    // --- NUEVO: POLLING DE LA COLA DE ESCÁNER ---
    useEffect(() => {
        // Pregunta al backend cada 3 segundos si hay DNIs nuevos en la cola
        const interval = setInterval(async () => {
            try {
                const scans = await apiService.getPendingScans();
                useHostelStore.setState({ pendingScans: scans });
            } catch (e) {
                // Silenciamos errores de red temporales
            }
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const [selectedBeds, setSelectedBeds] = useState<
        { bedId: string; roomId: string; bookingId?: string }[]
    >([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    
    // --- ESTADO PARA EL MODAL DE CANCELACIÓN Y DEVOLUCIONES ---
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    
    const [guestForms, setGuestForms] = useState<Guest[]>([]);
    const [departureDate, setDepartureDate] = useState('');

    const [showQueueSelector, setShowQueueSelector] = useState(false);
    const [targetIndexForQueue, setTargetIndexForQueue] = useState<number | null>(null);

    const [isIndividualPaymentMode, setIsIndividualPaymentMode] = useState(false);
    const [individualPayments, setIndividualPayments] = useState<{paid: boolean, method: string}[]>([]);

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isPaid, setIsPaid] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<
        'EFECTIVO' | 'TARJETA' | 'BIZUM' | 'OTRO'
    >('EFECTIVO');
    const [currentPrice, setCurrentPrice] = useState(0);

    const [scanningIndex, setScanningIndex] = useState<number | null>(null);

    // --- CAMBIO 1: FUNCION DE NAVEGACIÓN SIN PARPADEO ---
    const navigateDay = (offset: number) => {
        const newDate = offset > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1);
        setSearchParams({ date: format(newDate, 'yyyy-MM-dd') });
        setSelectedBeds([]); // Limpiar selección para que no se queden marcadas en otro día
    };

    const dayBookings = useMemo(
        () => bookings.filter((b) => b.date === dateParam),
        [bookings, dateParam],
    );

    const availableBedsList = useMemo(() => {
        const occupiedBedIds = dayBookings.map((b) => b.bedId);
        const list: { id: string; label: string; roomId: string }[] = [];

        rooms.forEach((r) => {
            r.beds.forEach((b: any) => {
                const isOccupied = occupiedBedIds.includes(b.id);
                // Si la habitación O la cama están en mantenimiento, NO sale en el selector
                const isMaintenance = b.is_maintenance || r.is_maintenance;
                
                const isCurrentlySelected = selectedBeds.some(
                    (sb) => sb.bedId === b.id,
                );
                
                // NOTA: Para el selector de "mover reserva", solo mostramos camas 100% operativas
                if ((!isOccupied && !isMaintenance) || isCurrentlySelected) {
                    list.push({
                        id: b.id,
                        label: `${r.name} - ${b.label}`,
                        roomId: String(r.id),
                    });
                }
            });
        });
        return list;
    }, [rooms, dayBookings, selectedBeds]);

    const handleDialogChange = (isOpen: boolean) => {
        setDialogOpen(isOpen);
        if (!isOpen) {
            setSelectedBeds([]);
            setIsEditing(false);
            setEditingId(null);
            setIsIndividualPaymentMode(false); 
        }
    };

    const handleUseFromQueue = async (scan: any) => {
        if (targetIndexForQueue === null) return;
        
        setGuestForms(prev => prev.map((g, i) => {
            if (i === targetIndexForQueue) {
                return {
                    ...g,
                    ...scan.data,
                    // Buscamos guestName primero, luego name, o dejamos lo que había
                    name: scan.data.guestName || scan.data.name || g.name,
                    surname: scan.data.surname || g.surname,
                    dni: scan.data.dni || g.dni,
                    dniType: scan.data.dniType || 'DNI',
                    sex: scan.data.sex || 'M',
                    nationality: scan.data.nationality || g.nationality,
                    birthDate: scan.data.birthDate || g.birthDate,
                };
            }
            return g;
        }));
        
        setShowQueueSelector(false);
        setTargetIndexForQueue(null);
        toast.success("Datos cargados desde la cola");
        
        try {
            await apiService.deletePendingScan(scan.id);
            useHostelStore.setState((state) => ({
                pendingScans: state.pendingScans.filter((s) => s.id !== scan.id)
            }));
        } catch (error) {
            console.error("Error al borrar el escaneo de la cola:", error);
        }
    };

    const handleBedClick = (bedId: string, roomId: string) => {
        const existing = getBookingForBed(bedId, dateParam);

        if (existing) {
            let groupBookings = [existing];

            if (existing.groupId) {
                const siblings = bookings.filter(
                    (b) => b.groupId === existing.groupId && b.date === dateParam,
                );
                if (siblings.length > 0) {
                    groupBookings = siblings;
                }
            }

            const bedsToSelect = groupBookings.map((b) => ({
                bedId: b.bedId,
                roomId: b.roomId,
                bookingId: b.id,
            }));

            const guestsToEdit = groupBookings.map((b) => b.guest);
            const totalGroupPrice = groupBookings.reduce(
                (acc, b) => acc + b.totalPrice,
                0,
            );

            setSelectedBeds(bedsToSelect);
            setGuestForms(guestsToEdit);
            setEditingId(existing.id);
            setIsEditing(true);

            setIsPaid(groupBookings[0].paid);
            setPaymentMethod(groupBookings[0].paymentMethod);
            
            setIndividualPayments(groupBookings.map(b => ({
                paid: b.paid,
                method: b.paymentMethod
            })));

            setCurrentPrice(totalGroupPrice);

            const nextDay = addDays(parseISO(dateParam), 1);
            setDepartureDate(format(nextDay, 'yyyy-MM-dd'));

            setDialogOpen(true);
            return;
        }

        setIsEditing(false);
        setEditingId(null);
        setSelectedBeds((prev) => {
            const found = prev.find((b) => b.bedId === bedId);
            if (found) return prev.filter((b) => b.bedId !== bedId);
            return [...prev, { bedId, roomId }];
        });
    };

    const openCreateDialog = () => {
        if (selectedBeds.length === 0) {
            toast.error('Selecciona al menos una cama');
            return;
        }
        setIsEditing(false);
        setEditingId(null);
        setIsIndividualPaymentMode(false);

        const firstRoomId = selectedBeds[0].roomId;
        const room = rooms.find((r) => String(r.id) === String(firstRoomId));
        const pricePerNight = room?.priceDefault || 15;

        setIsPaid(false);
        setPaymentMethod('EFECTIVO');
        setCurrentPrice(pricePerNight * selectedBeds.length);

        const tomorrow = addDays(currentDate, 1);
        setDepartureDate(format(tomorrow, 'yyyy-MM-dd'));

        setGuestForms(selectedBeds.map(() => emptyGuest()));
        setIndividualPayments(selectedBeds.map(() => ({ paid: false, method: 'EFECTIVO' })));
        
        setDialogOpen(true);
    };

    const updateGuestField = (
        index: number,
        field: keyof Guest,
        value: string | boolean,
    ) => {
        setGuestForms((prev) => {
            let processedValue = value;
            if (
                typeof value === 'string' &&
                ['name', 'surname', 'dni', 'nationality'].includes(field)
            ) {
                processedValue = value.toUpperCase();
            }

            return prev.map((g, i) =>
                i === index ? { ...g, [field]: processedValue } : g,
            );
        });
    };

    const updateIndividualPayment = (index: number, field: 'paid' | 'method', value: any) => {
        setIndividualPayments(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
    };

    const handleScanFile = async (
        index: number,
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setScanningIndex(index);
        toast.info('Analizando documento con Inteligencia Artificial...');

        try {
            const result = await apiService.scanDocument(file);

            if (result.error) {
                toast.error(result.error);
            } else {
                const data = result.data;
                console.log('Datos extraídos por el backend:', data);

                setGuestForms((prev) =>
                    prev.map((guest, i) => {
                        if (i === index) {
                            return {
                                ...guest,
                                ...data,
                                name: data.guestName || guest.name,
                                dniType: data.dniType || guest.dniType,
                            };
                        }
                        return guest;
                    }),
                );
                toast.success('¡Datos extraídos correctamente!');
            }
        } catch (error) {
            toast.error('Fallo al conectar con el servidor de escaneo');
        } finally {
            setScanningIndex(null);
            e.target.value = '';
        }
    };

    useEffect(() => {
        if (dialogOpen && !isEditing && selectedBeds.length > 0) {
            const nights = differenceInCalendarDays(
                parseISO(departureDate || dateParam),
                currentDate,
            );
            const realNights = nights > 0 ? nights : 1;

            const firstRoomId = selectedBeds[0].roomId;
            const room = rooms.find((r) => String(r.id) === String(firstRoomId));
            const pricePerNight = room?.priceDefault || 15;

            setCurrentPrice(pricePerNight * realNights * selectedBeds.length);
        }
    }, [
        departureDate,
        selectedBeds,
        dialogOpen,
        isEditing,
        rooms,
        currentDate,
        dateParam,
    ]);

    const getDatesInRange = (startStr: string, endStr: string) => {
        const dates = [];
        let current = parseISO(startStr);
        const end = parseISO(endStr);
        while (current < end) {
            dates.push(format(current, 'yyyy-MM-dd'));
            current = addDays(current, 1);
        }
        if (dates.length === 0) dates.push(startStr);
        return dates;
    };

    const handleSave = async (asReservation: boolean) => {
        for (let i = 0; i < guestForms.length; i++) {
            const g = guestForms[i];
            if (!asReservation && (!g.name || !g.surname || !g.dni || !g.birthDate)) {
                toast.error(
                    `Cama ${i + 1}: Faltan datos legales (DNI, Nacimiento) para el check-in`,
                );
                return;
            }
            if (asReservation && !g.name) {
                toast.error(`Cama ${i + 1}: El nombre es obligatorio para reservar`);
                return;
            }
        }

        if (!isEditing) {
            const datesToBook = getDatesInRange(dateParam, departureDate);
            const hasConflict = selectedBeds.some((bed) =>
                datesToBook.some((date) =>
                    bookings.some((b) => b.bedId === bed.bedId && b.date === date),
                ),
            );

            if (hasConflict) {
                toast.error(
                    'Conflicto: Alguna de las camas ya está ocupada en las fechas seleccionadas',
                );
                return;
            }
        }

        try {
            const apiPromises = [];
            const newBookings: Booking[] = [];
            const groupId = selectedBeds.length > 1 ? `group-${Date.now()}` : undefined;
            const datesToBook = getDatesInRange(dateParam, departureDate);
            const nightsCount = datesToBook.length;
            const effectiveGroupId = groupId || (nightsCount > 1 ? `group-${Date.now()}` : undefined);
            
            const pricePerHead = currentPrice / (guestForms.length || 1);
            const pricePerRecord = isEditing ? pricePerHead : (currentPrice / (guestForms.length * datesToBook.length || 1));

            for (let i = 0; i < guestForms.length; i++) {
                const guest = guestForms[i];
                const bedInfo = selectedBeds[i];
                
                let thisGuestPaid = isPaid;
                let thisGuestMethod = paymentMethod;

                if (isIndividualPaymentMode && individualPayments[i]) {
                    thisGuestPaid = individualPayments[i].paid;
                    thisGuestMethod = individualPayments[i].method as any;
                }

                if (isEditing) {
                    const originalBooking = bookings.find(
                        (b) => b.id === bedInfo.bookingId,
                    );

                    if (originalBooking) {
                        const bookingForApi: BookingData = {
                            id: originalBooking.id,
                            bedId: bedInfo.bedId,
                            guestName: `${guest.name} ${guest.surname}`.trim(),
                            date: dateParam,
                            checkedIn: !asReservation,
                            phone: guest.phone,
                            dni: guest.dni,
                            dniType: guest.dniType,
                            nationality: guest.nationality,
                            sex: guest.sex,
                            birthDate: guest.birthDate,
                            totalPrice: pricePerRecord,
                            paid: thisGuestPaid,
                            paymentMethod: thisGuestMethod,
                            groupId: originalBooking.groupId,
                        };

                        apiPromises.push(apiService.saveBooking(bookingForApi));

                        updateBooking(originalBooking.id, {
                            bedId: bedInfo.bedId,
                            roomId: bedInfo.roomId,
                            guest: { ...guest, checkedIn: !asReservation },
                            totalPrice: pricePerRecord,
                            paid: thisGuestPaid,
                            paymentMethod: thisGuestMethod,
                        });
                    }
                } else {
                    datesToBook.forEach((dateString) => {
                        const bookingId = `bk-${Date.now()}-${i}-${dateString}`;
                        const bookingForApi: BookingData = {
                            id: bookingId,
                            bedId: selectedBeds[i].bedId,
                            guestName: `${guest.name} ${guest.surname}`.trim(),
                            date: dateString,
                            checkedIn: !asReservation,
                            phone: guest.phone,
                            dni: guest.dni,
                            dniType: guest.dniType,
                            nationality: guest.nationality,
                            sex: guest.sex,
                            birthDate: guest.birthDate,
                            totalPrice: pricePerRecord,
                            paid: thisGuestPaid,
                            paymentMethod: thisGuestMethod,
                            groupId: effectiveGroupId,
                        };
                        apiPromises.push(apiService.saveBooking(bookingForApi));

                        newBookings.push({
                            id: bookingId,
                            bedId: selectedBeds[i].bedId,
                            roomId: selectedBeds[i].roomId,
                            date: dateString,
                            groupId: effectiveGroupId,
                            guest: { ...guest, checkedIn: !asReservation },
                            totalPrice: pricePerRecord,
                            paid: thisGuestPaid,
                            paymentMethod: thisGuestMethod,
                        });
                    });
                }
            }

            await Promise.all(apiPromises);
            if (!isEditing) addBookings(newBookings);
            
            toast.success(asReservation ? 'Reserva actualizada' : 'Check-in realizado');
            setDialogOpen(false);
            setSelectedBeds([]);
            setIsEditing(false);
            setEditingId(null);
        } catch (error) {
            console.error("Error completo:", error);
            toast.error('Error al conectar con el backend. Revisa la consola.');
        }
    };

    const handleCheckIn = (bookingId: string) => {
        const booking = bookings.find((b) => b.id === bookingId);
        if (booking && (!booking.guest.name || !booking.guest.dni)) {
            toast.error('Faltan datos. Edita primero.');
            return;
        }
        updateBooking(bookingId, { guest: { ...booking!.guest, checkedIn: true } });
        toast.success('Check-in realizado');
    };

    // --- CAMBIO 2: CANCELACIÓN CON MODAL Y RECTIFICATIVA ---
    const handleDeleteCurrentEdit = () => {
        setCancelDialogOpen(true);
    };

    const confirmCancellation = async () => {
        try {
            const promises = selectedBeds.map((b) => {
                if (b.bookingId) return apiService.deleteBooking(b.bookingId);
                return Promise.resolve();
            });
            await Promise.all(promises);

            selectedBeds.forEach((b) => {
                if (b.bookingId) removeBooking(b.bookingId);
            });

            toast.success('Reserva cancelada y cama liberada.');
            setCancelDialogOpen(false);
            setDialogOpen(false);
            setSelectedBeds([]);
            setIsEditing(false);
        } catch (e) {
            toast.error('Error al cancelar la reserva');
        }
    };

    // --- CÁLCULO DE ESTADÍSTICAS ---
    const totalBeds = rooms.reduce((acc, r) => acc + r.beds.length, 0);
    const maintenanceBedsCount = rooms.reduce((acc, r) => 
        acc + r.beds.filter((b: any) => b.is_maintenance || r.is_maintenance).length, 0
    );
    
    const occupied = dayBookings.filter((b) => b.guest.checkedIn).length;
    const reserved = dayBookings.filter((b) => !b.guest.checkedIn).length;
    const available = totalBeds - occupied - reserved - maintenanceBedsCount;

    if (rooms.length === 0) {
      return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
          <div className="max-w-2xl w-full bg-white p-8 md:p-12 rounded-3xl border shadow-xl text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10">
              <Landmark className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground mb-3 relative z-10">¡Te damos la bienvenida a Hostly! 👋</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto relative z-10">
              Para empezar a registrar peregrinos y emitir facturas legales, solo necesitas configurar tu albergue en dos sencillos pasos.
            </p>
            <div className="grid md:grid-cols-2 gap-6 text-left mb-10 relative z-10">
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 relative overflow-hidden group hover:border-blue-300 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                  <FileText className="w-24 h-24 text-blue-900" />
                </div>
                <div className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-4">1</div>
                <h3 className="font-bold text-lg mb-1">Datos del Negocio</h3>
                <p className="text-sm text-muted-foreground">Configura tu NIF, razón social y dirección para que tus facturas sean válidas para la ley.</p>
              </div>
              <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 relative overflow-hidden group hover:border-emerald-300 hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                  <Bed className="w-24 h-24 text-emerald-900" />
                </div>
                <div className="bg-emerald-100 text-emerald-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-4">2</div>
                <h3 className="font-bold text-lg mb-1">Tus Habitaciones</h3>
                <p className="text-sm text-muted-foreground">Crea tus habitaciones y diles cuántas camas tienen para organizar tu planning.</p>
              </div>
            </div>
            <Button 
              className="w-full md:w-auto md:px-12 bg-primary hover:bg-primary/90 h-14 text-lg rounded-xl shadow-md transition-all hover:scale-105 relative z-10"
              onClick={() => navigate('/perfil')}
            >
              Empezar Configuración <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      );
    }

    return (
        <div className='mx-auto max-w-5xl animate-fade-in pb-20'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6'>
                <h1 className='font-display text-3xl font-bold text-foreground'>
                    Gestión de Camas
                </h1>
                <div className='flex items-center gap-2'>
                    <Button variant='ghost' size='icon' onClick={() => navigateDay(-1)}>
                        <ChevronLeft />
                    </Button>
                    <span className='font-display text-lg font-semibold capitalize text-center w-48'>
                        {format(currentDate, 'EEEE, d MMM', { locale: es })}
                    </span>
                    <Button variant='ghost' size='icon' onClick={() => navigateDay(1)}>
                        <ChevronRight />
                    </Button>
                </div>
            </div>

            <div className='flex flex-wrap gap-3 mb-6'>
                <Badge
                    variant='outline'
                    className='border-primary/30 text-muted-foreground'>
                    {available} libres
                </Badge>
                <Badge variant='outline' className='border-gold text-gold bg-gold/5'>
                    {reserved} reservas
                </Badge>
                <Badge
                    variant='outline'
                    className='border-primary text-primary bg-primary/5'>
                    {occupied} en albergue
                </Badge>
                {/* Badge para camas en mantenimiento */}
                {maintenanceBedsCount > 0 && (
                    <Badge variant='outline' className='border-red-200 text-red-400 bg-red-50/50'>
                        {maintenanceBedsCount} deshabilitadas
                    </Badge>
                )}
            </div>

            {/* --- BURBUJA DE SELECCIÓN FLOTANTE --- */}
            {selectedBeds.length > 0 && !isEditing && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 flex items-center gap-2">
                    <Button onClick={openCreateDialog} size="lg" className="shadow-xl bg-primary hover:bg-primary/90 text-white gap-2 px-6 h-14 rounded-full transition-all hover:scale-105">
                        <UserPlus className="h-6 w-6" />
                        Registrar Selección ({selectedBeds.length})
                    </Button>
                    <Button 
                        onClick={() => setSelectedBeds([])} 
                        size="icon" 
                        variant="outline" 
                        title="Cancelar selección"
                        className="h-14 w-14 rounded-full shadow-xl bg-red-500 hover:bg-red-600 text-white border-none transition-transform hover:scale-105"
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
            )}

            <div className='space-y-6'>
                {rooms.map((room: any) => ( // Usamos any para evitar errores de tipo en tiempo de desarrollo
                    <Card
                        key={room.id}
                        className={`overflow-hidden border-none shadow-sm ${room.is_maintenance ? 'bg-red-50/40' : 'bg-secondary/20'}`}>
                        <CardHeader className='bg-white/50 py-3'>
                            <CardTitle className='text-sm font-bold flex items-center justify-between'>
                                <div className='flex items-center gap-2'>
                                    {room.is_maintenance ? <Hammer className="h-4 w-4 text-red-500"/> : <BedDouble className='h-4 w-4 text-primary' />} 
                                    {room.name}
                                    {room.is_maintenance && <Badge variant="destructive" className="ml-2 h-4 text-[8px] px-1">CERRADA</Badge>}
                                </div>
                                <Badge variant='secondary' className='text-xs'>
                                    {room.priceDefault || 0}€
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='p-4'>
                            <div className='grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2'>
                                {room.beds.map((bed: any) => {
                                    const booking = getBookingForBed(bed.id, dateParam);
                                    const isSelected = selectedBeds.some(
                                        (b) => b.bedId === bed.id,
                                    );
                                    
                                    // --- LÓGICA DE TIEMPO + MANTENIMIENTO ---
                                    // 1. ¿Es fecha pasada?
                                    // Compara si la fecha vista (currentDate) es anterior al inicio del día de hoy.
                                    const isPast = isBefore(currentDate, startOfDay(new Date())); 

                                    // 2. ¿Está bloqueada? (Cama o Habitación)
                                    const rawMaintenance = bed.is_maintenance || room.is_maintenance;
                                    
                                    // 3. Regla Final:
                                    // - Si es pasado: NO bloqueado (ver historial)
                                    // - Si hay reserva: NO bloqueado (permitir gestión aunque esté roto hoy)
                                    // - Si es presente/futuro y no hay reserva: SÍ bloqueado
                                    const isBroken = rawMaintenance && !isPast && !booking;

                                    // LÓGICA DE COLORES DE LA CAMA
                                    let bgColor = 'bg-white hover:border-primary/50';
                                    let textColor = 'text-foreground';
                                    let cursorClass = 'cursor-pointer'; // Por defecto clicable
                                    
                                    if (isBroken) {
                                        // Estilo "Rayado" para indicar bloqueado
                                        bgColor = 'bg-slate-100 border-slate-200 opacity-60 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#e2e8f0_5px,#e2e8f0_10px)]';
                                        textColor = 'text-slate-400';
                                        cursorClass = 'cursor-not-allowed'; // No clicable
                                    } else if (isSelected) {
                                        bgColor = 'border-primary ring-2 ring-primary/20 bg-primary/5';
                                    } else if (booking?.guest.checkedIn) {
                                        bgColor = 'border-emerald-600 bg-emerald-600 text-white';
                                        textColor = 'text-white';
                                    } else if (booking) {
                                        bgColor = 'border-gold bg-gold text-white';
                                        textColor = 'text-white';
                                    }

                                    return (
                                        <div
                                            key={bed.id}
                                            onClick={() => {
                                                // Si está rota, no hacemos nada al clicar
                                                if (!isBroken) handleBedClick(bed.id, String(room.id))
                                            }}
                                            className={`h-16 flex flex-col items-center justify-center rounded-md border transition-all p-1 ${bgColor} ${cursorClass} relative overflow-hidden`}
                                        >
                                            
                                            {/* Si está averiada, mostramos icono de fondo */}
                                            {isBroken && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                                                    <Ban className="h-10 w-10 text-slate-900" />
                                                </div>
                                            )}

                                            <span className={`text-[10px] uppercase opacity-70 font-bold ${textColor} z-10`}>
                                                {bed.label}
                                            </span>
                                            
                                            {/* Contenido de la cama */}
                                            {isBroken ? (
                                                <span className="text-[9px] font-bold text-red-400 bg-red-50 border border-red-100 px-1 rounded mt-1 z-10 flex items-center gap-1">
                                                    <Hammer className="h-3 w-3" /> {room.is_maintenance ? "CERRADA" : "AVERÍA"}
                                                </span>
                                            ) : booking ? (
                                                <div className='flex items-center gap-1 mt-1'>
                                                    <div className='flex items-center gap-1'>
                                                        <span className='text-[10px] font-medium truncate max-w-[40px] text-center'>
                                                            {booking.guest.name}
                                                        </span>
                                                        {esCumpleaños(booking.guest.birthDate) && (
                                                            <Cake className='h-3 w-3 text-white animate-pulse' />
                                                        )}
                                                    </div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <MoreVertical className='h-3 w-3 cursor-pointer' />
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleBedClick(bed.id, String(room.id))
                                                                }>
                                                                <Pencil className='mr-2 h-3 w-3' /> Editar /
                                                                Mover
                                                            </DropdownMenuItem>
                                                            {!booking.guest.checkedIn && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleCheckIn(booking.id)}>
                                                                    Check-in
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className='text-destructive'
                                                                onClick={() => {
                                                                    // Capturamos la reserva actual y las vinculadas
                                                                    const existing = bookings.find(b => b.id === booking.id);
                                                                    if (existing) {
                                                                        let groupBookings = [existing];
                                                                        if (existing.groupId) {
                                                                            groupBookings = bookings.filter(b => b.groupId === existing.groupId && b.date === dateParam);
                                                                        }
                                                                        setSelectedBeds(groupBookings.map(b => ({ bedId: b.bedId, roomId: String(room.id), bookingId: b.id })));
                                                                        setIsPaid(groupBookings[0].paid);
                                                                        setEditingId(booking.id);
                                                                        setCancelDialogOpen(true);
                                                                    }
                                                                }}>
                                                                <Trash2 className='mr-2 h-3 w-3' /> Eliminar
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>

                                                    {/* ICONO DE WARNING AMARILLO SI DEBE DINERO */}
                                                    {booking.guest.checkedIn && !booking.paid && (
                                                        <div className='absolute top-1 right-1 z-10'>
                                                            <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className='text-[10px] mt-1 opacity-40'>
                                                    Libre
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* --- DIÁLOGOS Y MODALES (Sin cambios funcionales, solo se añade Factura) --- */}
            <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
                <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>
                            {isEditing
                                ? `Editar Grupo (${guestForms.length} pax)`
                                : 'Nueva Reserva'}
                        </DialogTitle>
                        <DialogDescription className="hidden">
                            Formulario de gestión de huéspedes y pagos
                        </DialogDescription>
                    </DialogHeader>

                    {/* BLOQUE FECHA SALIDA */}
                    {!isEditing && (
                        <div className='flex items-center gap-4 p-4 bg-secondary/10 rounded-lg mb-4'>
                            <div className='flex flex-col gap-1 flex-1'>
                                <Label className='text-xs text-muted-foreground'>
                                    Fecha Salida
                                </Label>
                                <Input
                                    type='date'
                                    value={departureDate}
                                    onChange={(e) => setDepartureDate(e.target.value)}
                                    min={format(addDays(currentDate, 1), 'yyyy-MM-dd')}
                                    className='bg-white'
                                />
                                <span className='text-xs text-muted-foreground'>
                                    {differenceInCalendarDays(
                                        parseISO(departureDate || dateParam),
                                        currentDate,
                                    )}{' '}
                                    noches
                                </span>
                            </div>
                        </div>
                    )}

                    {/* BOTÓN DE COPIAR Y SWITCH DE PAGOS */}
                    <div className="flex flex-col gap-2 mb-2">
                        {guestForms.length > 1 && (
                            <>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 mb-2'
                                    onClick={() => {
                                        const first = guestForms[0];
                                        setGuestForms((prev) =>
                                            prev.map((g, i) =>
                                                i === 0
                                                    ? g
                                                    : {
                                                          ...g,
                                                          name: first.name,
                                                          surname: first.surname,
                                                          nationality: first.nationality,
                                                          phone: first.phone,
                                                          email: first.email,
                                                      },
                                            ),
                                        );
                                        toast.info('Datos copiados del primer huésped al resto');
                                    }}>
                                    <Copy className='w-4 h-4 mr-2' /> Copiar datos del 1º huésped a todos
                                </Button>
                                <div
                                    className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${isIndividualPaymentMode ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-transparent'}`}>
                                    <input
                                        type='checkbox'
                                        id='splitPayment'
                                        checked={isIndividualPaymentMode}
                                        onChange={(e) => setIsIndividualPaymentMode(e.target.checked)}
                                        className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer'
                                    />
                                    <label
                                        htmlFor='splitPayment'
                                        className='text-sm font-medium cursor-pointer select-none text-foreground flex items-center gap-2'>
                                        <Split className='h-4 w-4 text-primary' />
                                        Gestionar pagos por separado
                                    </label>
                                </div>
                            </>
                        )}
                    </div>

                    <div className='space-y-8 py-2'>
                        {guestForms.map((guest, index) => (
                            <div
                                key={index}
                                className='space-y-4 p-4 border rounded-xl mt-2 relative transition-all bg-secondary/10'>
                                {/* --- SELECTOR DE CAMA --- */}
                                <div className='absolute -top-3 -left-2 z-10'>
                                    <Select
                                        value={selectedBeds[index]?.bedId}
                                        onValueChange={(newBedId) => {
                                            const bedInfo = availableBedsList.find(
                                                (b) => b.id === newBedId,
                                            );
                                            if (bedInfo) {
                                                const newBeds = [...selectedBeds];
                                                newBeds[index] = {
                                                    ...newBeds[index],
                                                    bedId: newBedId,
                                                    roomId: bedInfo.roomId,
                                                };
                                                setSelectedBeds(newBeds);
                                            }
                                        }}>
                                        <SelectTrigger className='h-6 text-[11px] bg-primary text-primary-foreground border-none rounded-full px-3 font-semibold shadow-sm focus:ring-0 w-fit min-w-[120px]'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableBedsList.map((b) => (
                                                <SelectItem
                                                    key={b.id}
                                                    value={b.id}
                                                    className='text-xs font-medium'>
                                                    {b.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* --- BOTONERA DE ESCANEO / COLA --- */}
                                <div className='pt-2 flex gap-2'>
                                    <div className='flex-1 flex gap-2'>
                                        <input
                                            type='file'
                                            accept='image/*'
                                            capture='environment'
                                            id={`dni-scanner-${index}`}
                                            className='hidden'
                                            onChange={(e) => handleScanFile(index, e)}
                                        />
                                        <Button
                                            type='button'
                                            variant='outline'
                                            className='flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
                                            onClick={() =>
                                                document.getElementById(`dni-scanner-${index}`)?.click()
                                            }
                                            disabled={scanningIndex === index}>
                                            {scanningIndex === index ? (
                                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                            ) : (
                                                <Camera className='mr-2 h-4 w-4' />
                                            )}
                                            {scanningIndex === index
                                                ? 'Procesando...'
                                                : 'Escanear DNI'}
                                        </Button>

                                        {/* NUEVO BOTÓN: CARGAR DE COLA (Solo si hay pendientes) */}
                                        {pendingScans.length > 0 && (
                                            <Button
                                                type='button'
                                                variant='outline'
                                                className='bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                                                onClick={() => {
                                                    setTargetIndexForQueue(index);
                                                    setShowQueueSelector(true);
                                                }}
                                                title="Usar escaneo guardado"
                                            >
                                                <FolderOpen className="h-4 w-4 sm:mr-2" />
                                                <span className="hidden sm:inline">Cola ({pendingScans.length})</span>
                                                <span className="sm:hidden">({pendingScans.length})</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Nombre y Apellidos */}
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-1'>
                                    <div className='space-y-2'>
                                        <Label className={index === 0 ? 'font-bold text-primary' : ''}>
                                            {index === 0 ? 'Nombre Titular' : 'Nombre'}
                                        </Label>
                                        <Input
                                            value={guest.name}
                                            onChange={(e) =>
                                                updateGuestField(index, 'name', e.target.value)
                                            }
                                            placeholder={index === 0 ? 'Ej: Juan' : 'Nombre'}
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>Apellidos</Label>
                                        <Input
                                            value={guest.surname}
                                            onChange={(e) =>
                                                updateGuestField(index, 'surname', e.target.value)
                                            }
                                            placeholder={index === 0 ? 'Ej: Pérez' : 'Apellidos'}
                                        />
                                    </div>
                                    {/* --- CAMPO TELÉFONO --- */}
                                    <div className='space-y-2 md:col-span-2'>
                                        <div className='relative'>
                                            <Phone className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                                            <Input
                                                value={guest.phone}
                                                onChange={(e) =>
                                                    updateGuestField(index, 'phone', e.target.value)
                                                }
                                                className='pl-9'
                                                placeholder='Teléfono / WhatsApp (Opcional)'
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                    <div className='space-y-2'>
                                        <Label>Tipo Doc.</Label>
                                        <Select
                                            value={guest.dniType}
                                            onValueChange={(v) =>
                                                updateGuestField(index, 'dniType', v as string)
                                            }>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='DNI'>DNI</SelectItem>
                                                <SelectItem value='Pasaporte'>Pasaporte</SelectItem>
                                                <SelectItem value='NIE'>NIE</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-2 md:col-span-2'>
                                        <Label>Nº Documento</Label>
                                        <Input
                                            value={guest.dni}
                                            onChange={(e) =>
                                                updateGuestField(index, 'dni', e.target.value)
                                            }
                                            placeholder='Obligatorio para Check-in'
                                        />
                                    </div>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                    <div className='space-y-2'>
                                        <Label>País de Origen</Label>
                                        <Input
                                            list={`countries-list-${index}`}
                                            value={guest.nationality}
                                            onChange={(e) =>
                                                updateGuestField(index, 'nationality', e.target.value)
                                            }
                                            placeholder='Ej: ESPAÑA'
                                            autoComplete='off'
                                        />
                                        <datalist id={`countries-list-${index}`}>
                                            {ALL_COUNTRIES.map((c: string) => (
                                                <option key={c} value={c} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>Sexo</Label>
                                        <Select
                                            value={guest.sex}
                                            onValueChange={(v) =>
                                                updateGuestField(index, 'sex', v as string)
                                            }>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='M'>Hombre</SelectItem>
                                                <SelectItem value='F'>Mujer</SelectItem>
                                                <SelectItem value='O'>Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-2'>
                                        <div className='flex items-center gap-2'>
                                            <Label>F. Nacimiento</Label>
                                            {esCumpleaños(guest.birthDate) && (
                                                <div className='flex items-center gap-1 animate-bounce'>
                                                    <Cake className='h-4 w-4 text-pink-500' />
                                                    <span className='text-[10px] font-bold text-pink-500 uppercase'>
                                                        ¡Felicidades!
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <Input
                                            type='date'
                                            value={guest.birthDate}
                                            onChange={(e) =>
                                                updateGuestField(index, 'birthDate', e.target.value)
                                            }
                                            className={
                                                esCumpleaños(guest.birthDate)
                                                    ? 'border-pink-300 bg-pink-50/30'
                                                    : ''
                                            }
                                        />
                                    </div>
                                </div>

                                {/* SECCIÓN DE PAGO INDIVIDUAL MEJORADA (SOLO SI EL SWITCH ESTÁ ACTIVO) */}
                                {isIndividualPaymentMode && (
                                    <div className='mt-2 p-3 bg-slate-50 border rounded-lg flex items-center justify-between gap-3 animate-fade-in'>
                                        <div 
                                            className='flex items-center space-x-3 cursor-pointer select-none'
                                            onClick={() => updateIndividualPayment(index, 'paid', !individualPayments[index]?.paid)}
                                        >
                                            <input
                                                type='checkbox'
                                                checked={individualPayments[index]?.paid || false}
                                                readOnly
                                                className='h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer'
                                            />
                                            <span className={`text-sm font-bold ${individualPayments[index]?.paid ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                {individualPayments[index]?.paid ? "PAGADO" : "Marcar como Pagado"}
                                            </span>
                                        </div>
                                        {individualPayments[index]?.paid && (
                                            <Select
                                                value={individualPayments[index]?.method || 'EFECTIVO'}
                                                onValueChange={(v) => updateIndividualPayment(index, 'method', v)}
                                            >
                                                <SelectTrigger className='h-9 w-[130px] bg-white'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='EFECTIVO'>Efectivo</SelectItem>
                                                    <SelectItem value='TARJETA'>Tarjeta</SelectItem>
                                                    <SelectItem value='BIZUM'>Bizum</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* BLOQUE DE PAGO GLOBAL: SOLO SE MUESTRA SI NO ESTAMOS EN MODO INDIVIDUAL */}
                    {!isIndividualPaymentMode && (
                        <div className='flex flex-col gap-2 border-t pt-4 border-gray-200 mt-4 bg-slate-50 p-4 rounded-lg animate-fade-in'>
                            <div className='flex items-center justify-between'>
                                <Label className='font-bold flex items-center gap-1 text-lg'>
                                    <Euro className='h-5 w-5' /> Total a Cobrar:
                                </Label>
                                <Input
                                    type='number'
                                    value={currentPrice}
                                    onChange={(e) => setCurrentPrice(Number(e.target.value))}
                                    className='w-32 text-right font-bold bg-white text-lg h-10'
                                />
                            </div>
                            <div className='flex items-center justify-between gap-3 mt-2'>
                                <div className='flex items-center space-x-2 bg-white px-3 py-2 rounded-md border flex-1 cursor-pointer hover:bg-slate-50 transition-colors' onClick={() => setIsPaid(!isPaid)}>
                                    <input
                                        type='checkbox'
                                        id='paid'
                                        checked={isPaid}
                                        readOnly
                                        className='h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer'
                                    />
                                    <label htmlFor='paid' className={`text-sm font-bold cursor-pointer flex-1 ${isPaid ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                        {isPaid ? "PAGADO (TODO EL GRUPO)" : "Marcar como Pagado"}
                                    </label>
                                </div>
                                
                                {isPaid && (
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                                        <Select
                                            value={paymentMethod}
                                            onValueChange={(v) =>
                                                setPaymentMethod(v as typeof paymentMethod)
                                            }>
                                            <SelectTrigger className='w-[140px] h-10 bg-white font-medium'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='EFECTIVO'>Efectivo</SelectItem>
                                                <SelectItem value='TARJETA'>Tarjeta</SelectItem>
                                                <SelectItem value='BIZUM'>Bizum</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className='gap-2 sm:gap-0 mt-4'>
                        <div className='mr-auto flex gap-2'>
                            {/* --- CAMBIO 2: BOTÓN CANCELAR USA EL MODAL --- */}
                            {isEditing && (
                                <Button
                                    type='button'
                                    variant='destructive'
                                    onClick={handleDeleteCurrentEdit}
                                    title='Eliminar reserva y dejar la cama libre'>
                                    <Trash2 className='h-4 w-4 sm:mr-2' />
                                    <span className='hidden sm:inline'>Eliminar</span>
                                </Button>
                            )}

                            {/* --- CAMBIO 3: BOTÓN DE FACTURA LEGAL (RESTRINGIDO A PAGADOS) --- */}
                            {isEditing && editingId && bookings.find(b => b.id === editingId)?.paid && (
                                <Button type="button" variant="secondary" onClick={() => { 
                                    toast.info("Descargando factura legal..."); 
                                    apiService.downloadInvoice(editingId).catch(() => toast.error("Error al descargar factura")); 
                                }}>
                                    <FileText className="h-4 w-4 sm:mr-2 text-primary" /> 
                                    <span className="hidden sm:inline">Factura Legal</span>
                                </Button>
                            )}
                        </div>

                        <Button
                            variant='outline'
                            className='border-gold text-gold'
                            onClick={() => handleSave(true)}>
                            {isEditing ? 'Guardar Cambios' : 'Reservar'}
                        </Button>
                        <Button onClick={() => handleSave(false)}>
                            {isEditing ? 'Confirmar y Check-in' : 'Confirmar Check-in'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- MODAL PARA LA COLA DE ESCÁNER --- */}
            <Dialog open={showQueueSelector} onOpenChange={setShowQueueSelector}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Seleccionar de la Cola</DialogTitle>
                        <DialogDescription>Elige un DNI escaneado previamente para rellenar los datos.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-2">
                        {pendingScans.map(scan => {
                            // CORRECCIÓN TYPESCRIPT: Evitamos el error de 'guestName'
                            const rawData = scan.data as any;
                            
                            // VARIABLES SEGURAS
                            const rawName = rawData.guestName || scan.data.name || "";
                            const safeName = rawName || "Desconocido";
                            const safeSurname = scan.data.surname || "";
                            const safeDni = scan.data.dni || "Sin DNI";
                            const safeBirthDate = scan.data.birthDate || "";
                            
                            // LÓGICA SIMPLE: Pinta de amarillo si algún dato vital falta
                            const isIncomplete = !rawName || !safeSurname || safeDni === "Sin DNI" || !safeBirthDate;

                            return (
                                <div 
                                    key={scan.id} 
                                    onClick={() => handleUseFromQueue(scan)} 
                                    className={`p-3 border rounded-lg cursor-pointer flex justify-between items-center group transition-colors ${isIncomplete ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {isIncomplete ? (
                                            <div title="Faltan datos por extraer" className="bg-yellow-100 h-8 w-8 rounded-full flex items-center justify-center shrink-0">
                                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                                                {safeName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm text-foreground truncate">{safeName} {safeSurname}</p>
                                            <p className="text-xs text-muted-foreground">{safeDni} • {format(scan.timestamp, 'HH:mm')}</p>
                                        </div>
                                    </div>
                                    <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 text-green-600 transition-opacity shrink-0">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            );
                        })}
                        {pendingScans.length === 0 && <p className="text-center text-muted-foreground py-4">La cola está vacía.</p>}
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- NUEVO: MODAL DE CANCELACIÓN Y DEVOLUCIONES --- */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                    <div className="flex items-center gap-3 text-destructive mb-2">
                        <AlertTriangle className="h-6 w-6" />
                        <DialogTitle>¿Cancelar y liberar cama?</DialogTitle>
                    </div>
                    <DialogDescription className="text-base pt-2">
                        Al confirmar, las camas quedarán libres inmediatamente y desaparecerán de este calendario.
                    </DialogDescription>
                    </DialogHeader>

                    {/* Si estaba pagado, advertimos sobre la Factura Rectificativa */}
                    {isPaid && (
                        <div className="bg-amber-50 text-amber-900 border border-amber-200 p-4 rounded-lg my-2 text-sm flex gap-3 shadow-sm animate-in zoom-in-95">
                            <FileText className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                            <div>
                                <p className="font-bold">Factura Rectificativa Automática</p>
                                <p className="mt-1 opacity-90">Como esta reserva ya estaba cobrada, el sistema emitirá automáticamente de fondo una factura en negativo para cuadrar tu contabilidad con Hacienda.</p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 mt-6">
                    <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="w-full sm:w-auto">
                        Atrás
                    </Button>
                    <Button variant="destructive" onClick={confirmCancellation} className="w-full sm:w-auto font-bold">
                        <Trash2 className="h-4 w-4 mr-2" /> 
                        Confirmar Cancelación
                    </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DayView;
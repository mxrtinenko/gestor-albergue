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
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
    format,
    addDays,
    subDays,
    differenceInCalendarDays,
    parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    UserPlus,
    X,
    BedDouble,
    MoreVertical,
    CalendarDays,
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
    PartyPopper,
} from 'lucide-react';

import { apiService, BookingData } from '../services/api';

// @ts-ignore
import countries from 'i18n-iso-countries';
// @ts-ignore
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
    nationality: 'España',
    phone: '',
    email: '',
    checkedIn: false,
});

const esCumpleaños = (fechaNacimiento: string) => {
    if (!fechaNacimiento) return false;
    const hoy = new Date();
    // Añadimos T12:00:00 para evitar problemas de zona horaria al comparar
    const cumple = new Date(fechaNacimiento + 'T12:00:00');

    return (
        hoy.getDate() === cumple.getDate() && hoy.getMonth() === cumple.getMonth()
    );
};

const DayView = () => {
    const [searchParams] = useSearchParams();
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
    } = useHostelStore();

    useEffect(() => {
        const loadData = async () => {
            try {
                const roomsData = await apiService.getRooms();
                const formattedRooms = roomsData.map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    priceDefault: r.price_default,
                    beds: r.beds.map((b: any) => ({ id: b.id, label: b.label })),
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
                        nationality: b.nationality || 'España', 
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

    const [selectedBeds, setSelectedBeds] = useState<
        { bedId: string; roomId: string; bookingId?: string }[]
    >([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [guestForms, setGuestForms] = useState<Guest[]>([]);
    const [departureDate, setDepartureDate] = useState('');

    const [isGroupMode, setIsGroupMode] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isPaid, setIsPaid] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<
        'EFECTIVO' | 'TARJETA' | 'BIZUM' | 'OTRO'
    >('EFECTIVO');
    const [currentPrice, setCurrentPrice] = useState(0);

    // --- NUEVO ESTADO PARA EL ESCÁNER ---
    const [scanningIndex, setScanningIndex] = useState<number | null>(null);

    const navigateDay = (offset: number) => {
        const newDate =
            offset > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1);
        navigate(`/registro?date=${format(newDate, 'yyyy-MM-dd')}`);
    };

    const dayBookings = useMemo(
        () => bookings.filter((b) => b.date === dateParam),
        [bookings, dateParam],
    );

    const availableBedsList = useMemo(() => {
        const occupiedBedIds = dayBookings.map((b) => b.bedId);
        const list: { id: string; label: string; roomId: string }[] = [];

        rooms.forEach((r) => {
            r.beds.forEach((b) => {
                const isOccupied = occupiedBedIds.includes(b.id);
                const isCurrentlySelected = selectedBeds.some(
                    (sb) => sb.bedId === b.id,
                );
                if (!isOccupied || isCurrentlySelected) {
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
            setIsGroupMode(false);

            setIsPaid(groupBookings[0].paid);
            setPaymentMethod(groupBookings[0].paymentMethod);
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
        setIsGroupMode(selectedBeds.length > 1);

        const firstRoomId = selectedBeds[0].roomId;
        const room = rooms.find((r) => String(r.id) === String(firstRoomId));
        const pricePerNight = room?.priceDefault || 15;

        setIsPaid(false);
        setPaymentMethod('EFECTIVO');
        setCurrentPrice(pricePerNight * selectedBeds.length);

        const tomorrow = addDays(currentDate, 1);
        setDepartureDate(format(tomorrow, 'yyyy-MM-dd'));

        setGuestForms(selectedBeds.map(() => emptyGuest()));
        setDialogOpen(true);
    };

    const updateGuestField = (
        index: number,
        field: keyof Guest,
        value: string | boolean,
    ) => {
        setGuestForms((prev) => {
            // 1. Forzamos mayúsculas solo para los campos de texto relevantes
            let processedValue = value;
            if (
                typeof value === 'string' &&
                ['name', 'surname', 'dni', 'nationality'].includes(field)
            ) {
                processedValue = value.toUpperCase();
            }

            // 2. Aplicamos el cambio
            const newForms = prev.map((g, i) =>
                i === index ? { ...g, [field]: processedValue } : g,
            );

            // 3. Lógica de "Reserva Rápida" (copiar al resto del grupo)
            if (isGroupMode && index === 0) {
                return newForms.map((g, i) => {
                    if (i === 0) return g;
                    if (
                        ['name', 'surname', 'phone', 'email', 'nationality'].includes(field)
                    ) {
                        return { ...g, [field]: processedValue };
                    }
                    return g;
                });
            }
            return newForms;
        });
    };

    // --- NUEVA FUNCIÓN: MANEJAR EL ESCÁNER ---
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
                        // Actualizamos el huésped que hemos escaneado
                        if (i === index) {
                            return {
                                ...guest,
                                name: data.guestName || guest.name,
                                surname: data.surname || guest.surname,
                                dni: data.dni || guest.dni,
                                dniType: data.dniType || guest.dniType, // ¡AQUÍ ESTÁ LA MAGIA DEL DOCUMENTO!
                                birthDate: data.birthDate || guest.birthDate,
                                nationality: data.nationality || guest.nationality,
                                sex: data.sex || guest.sex, // ¡Y AQUÍ LA MAGIA DEL SEXO!
                            };
                        }
                        // Si estamos en Reserva Rápida (Grupo) y es el titular, copiamos al resto
                        if (isGroupMode && index === 0 && i !== 0) {
                            return {
                                ...guest,
                                name: data.guestName || guest.name,
                                surname: data.surname || guest.surname,
                                nationality: data.nationality || guest.nationality,
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
            e.target.value = ''; // Reseteamos el input
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

    const handleDownloadInvoice = async (id: string) => {
        try {
            toast.info('Generando recibo PDF...');
            await apiService.downloadInvoice(id);
            toast.success('Recibo descargado');
        } catch (error) {
            toast.error('Error al descargar el recibo');
        }
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
            if (isEditing) {
                const apiPromises = [];
                const pricePerHead = currentPrice / (guestForms.length || 1);

                for (let i = 0; i < guestForms.length; i++) {
                    const guest = guestForms[i];
                    const bedInfo = selectedBeds[i];
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
                            totalPrice: pricePerHead,
                            paid: isPaid,
                            paymentMethod: paymentMethod,
                            groupId: originalBooking.groupId,
                        };

                        apiPromises.push(apiService.saveBooking(bookingForApi));

                        updateBooking(originalBooking.id, {
                            bedId: bedInfo.bedId,
                            roomId: bedInfo.roomId,
                            guest: { ...guest, checkedIn: !asReservation },
                            totalPrice: pricePerHead,
                            paid: isPaid,
                            paymentMethod: paymentMethod,
                        });
                    }
                }

                await Promise.all(apiPromises);
                toast.success(
                    asReservation ? 'Reserva actualizada' : 'Check-in realizado',
                );
            } else {
                const newBookings: Booking[] = [];
                const groupId =
                    selectedBeds.length > 1 ? `group-${Date.now()}` : undefined;
                const datesToBook = getDatesInRange(dateParam, departureDate);
                const nightsCount = datesToBook.length;
                const effectiveGroupId =
                    groupId || (nightsCount > 1 ? `group-${Date.now()}` : undefined);
                const apiPromises: Promise<unknown>[] = [];
                const totalRecords = guestForms.length * datesToBook.length;
                const pricePerRecord = currentPrice / (totalRecords || 1);

                guestForms.forEach((g, i) => {
                    datesToBook.forEach((dateString) => {
                        const bookingId = `bk-${Date.now()}-${i}-${dateString}`;
                        const bookingForApi: BookingData = {
                            id: bookingId,
                            bedId: selectedBeds[i].bedId,
                            guestName: `${g.name} ${g.surname}`.trim(),
                            date: dateString,
                            checkedIn: !asReservation,
                            phone: g.phone,
                            dni: g.dni,
                            dniType: g.dniType,
                            nationality: g.nationality,
                            sex: g.sex,
                            birthDate: g.birthDate,
                            totalPrice: pricePerRecord,
                            paid: isPaid,
                            paymentMethod: paymentMethod,
                            groupId: effectiveGroupId,
                        };
                        apiPromises.push(apiService.saveBooking(bookingForApi));

                        newBookings.push({
                            id: bookingId,
                            bedId: selectedBeds[i].bedId,
                            roomId: selectedBeds[i].roomId,
                            date: dateString,
                            groupId: effectiveGroupId,
                            guest: { ...g, checkedIn: !asReservation },
                            totalPrice: pricePerRecord,
                            paid: isPaid,
                            paymentMethod: paymentMethod,
                        });
                    });
                });

                await Promise.all(apiPromises);
                addBookings(newBookings);
                toast.success(
                    asReservation ? `Reserva guardada` : `Check-in realizado`,
                );
            }

            setDialogOpen(false);
            setSelectedBeds([]);
            setIsEditing(false);
            setEditingId(null);
        } catch (error) {
            toast.error('Error al conectar con el backend.');
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

    const handleCancel = async (bookingId: string) => {
        try {
            await apiService.deleteBooking(bookingId);
            removeBooking(bookingId);
            toast.success('Reserva eliminada');
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleDeleteCurrentEdit = async () => {
        if (
            !confirm(
                '¿Estás seguro de que deseas eliminar esta reserva/check-in? La cama quedará libre al instante.',
            )
        )
            return;
        try {
            const promises = selectedBeds.map((b) => {
                if (b.bookingId) return apiService.deleteBooking(b.bookingId);
                return Promise.resolve();
            });
            await Promise.all(promises);

            selectedBeds.forEach((b) => {
                if (b.bookingId) removeBooking(b.bookingId);
            });

            toast.success('Eliminado correctamente');
            setDialogOpen(false);
            setSelectedBeds([]);
            setIsEditing(false);
        } catch (e) {
            toast.error('Error al eliminar');
        }
    };

    const totalBeds = rooms.reduce((acc, r) => acc + r.beds.length, 0);
    const occupied = dayBookings.filter((b) => b.guest.checkedIn).length;
    const reserved = dayBookings.filter((b) => !b.guest.checkedIn).length;
    const available = totalBeds - occupied - reserved;

    function roomLabels(bedInfo: { bedId: string; roomId: string }) {
        const room = rooms.find((r) => String(r.id) === String(bedInfo?.roomId));
        const bed = room?.beds.find((b) => b.id === bedInfo?.bedId);
        return `${room?.name} - ${bed?.label}`;
    }

    return (
        <div className='mx-auto max-w-5xl animate-fade-in'>
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
            </div>

            {selectedBeds.length > 0 && !isEditing && (
                <div className='mb-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 animate-in fade-in slide-in-from-top-2'>
                    <span className='text-sm font-medium'>
                        {selectedBeds.length} cama(s) seleccionada(s)
                    </span>
                    <div className='flex gap-2'>
                        <Button size='sm' onClick={openCreateDialog}>
                            <UserPlus className='mr-2 h-4 w-4' /> Registrar
                        </Button>
                        <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => setSelectedBeds([])}>
                            <X className='h-4 w-4' />
                        </Button>
                    </div>
                </div>
            )}

            <div className='space-y-6'>
                {rooms.map((room) => (
                    <Card
                        key={room.id}
                        className='overflow-hidden border-none shadow-sm bg-secondary/20'>
                        <CardHeader className='bg-white/50 py-3'>
                            <CardTitle className='text-sm font-bold flex items-center justify-between'>
                                <div className='flex items-center gap-2'>
                                    <BedDouble className='h-4 w-4 text-primary' /> {room.name}
                                </div>
                                <Badge variant='secondary' className='text-xs'>
                                    {room.priceDefault || 0}€
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className='p-4'>
                            <div className='grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2'>
                                {room.beds.map((bed) => {
                                    const booking = getBookingForBed(bed.id, dateParam);
                                    const isSelected = selectedBeds.some(
                                        (b) => b.bedId === bed.id,
                                    );

                                    let bgColor = 'bg-white hover:border-primary/50';
                                    if (isSelected)
                                        bgColor =
                                            'border-primary ring-2 ring-primary/20 bg-primary/5';
                                    if (booking?.guest.checkedIn)
                                        bgColor = 'border-primary bg-primary text-white';
                                    else if (booking) bgColor = 'border-gold bg-gold text-white';

                                    return (
                                        <div
                                            key={bed.id}
                                            onClick={() => handleBedClick(bed.id, String(room.id))}
                                            className={`h-16 flex flex-col items-center justify-center rounded-md border transition-all cursor-pointer p-1 ${bgColor} relative`}>
                                            <span className='text-[10px] uppercase opacity-70 font-bold'>
                                                {bed.label}
                                            </span>
                                            {booking ? (
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
                                                            <DropdownMenuItem
                                                                className='text-destructive'
                                                                onClick={() => handleCancel(booking.id)}>
                                                                Eliminar
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>

                                                    {booking.paid && (
                                                        <div className='absolute top-1 right-1 bg-green-500 rounded-full w-2 h-2 border border-white' />
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
                {rooms.length === 0 && (
                    <div className='col-span-full text-center py-10 text-muted-foreground bg-slate-50 rounded-xl border border-dashed'>
                        <p>No tienes habitaciones configuradas.</p>
                        <p className='text-sm mt-2'>
                            Ve a "Mi Albergue" para crear tus habitaciones.
                        </p>
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
                <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
                    <DialogHeader>
                        <DialogTitle>
                            {isEditing
                                ? `Editar Grupo (${guestForms.length} pax)`
                                : 'Nueva Reserva'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-secondary/20 rounded-lg mb-4'>
                        {!isEditing && (
                            <div className='flex flex-col gap-1'>
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
                        )}

                        <div className='flex flex-col gap-2 border-l pl-4 border-gray-300'>
                            <div className='flex items-center justify-between'>
                                <Label className='font-bold flex items-center gap-1'>
                                    <Euro className='h-4 w-4' /> Total:
                                </Label>
                                <Input
                                    type='number'
                                    value={currentPrice}
                                    onChange={(e) => setCurrentPrice(Number(e.target.value))}
                                    className='w-24 text-right font-bold bg-white'
                                />
                            </div>
                            <div className='flex items-center gap-3 mt-1'>
                                <div className='flex items-center space-x-2'>
                                    <input
                                        type='checkbox'
                                        id='paid'
                                        checked={isPaid}
                                        onChange={(e) => setIsPaid(e.target.checked)}
                                        className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
                                    />
                                    <label htmlFor='paid' className='text-sm font-medium'>
                                        Pagado
                                    </label>
                                </div>
                                {isPaid && (
                                    <Select
                                        value={paymentMethod}
                                        onValueChange={(v) =>
                                            setPaymentMethod(v as typeof paymentMethod)
                                        }>
                                        <SelectTrigger className='w-[140px] h-8 bg-white'>
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
                        </div>
                    </div>

                    {guestForms.length > 1 && !isGroupMode && (
                        <div className='flex justify-end mb-2 px-1'>
                            <Button
                                type='button'
                                variant='ghost'
                                size='sm'
                                className='text-xs text-primary hover:bg-primary/10 h-8'
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
                                    toast.info('Datos copiados del primer huésped');
                                }}>
                                <Copy className='w-3 h-3 mr-2' /> Copiar datos del 1º a todos
                            </Button>
                        </div>
                    )}

                    {guestForms.length > 1 && (
                        <div
                            className={`flex items-center gap-2 mb-4 p-3 border rounded-lg transition-colors ${isGroupMode ? 'bg-primary/5 border-primary/30' : 'bg-secondary/20 border-transparent'}`}>
                            <input
                                type='checkbox'
                                id='groupMode'
                                checked={isGroupMode}
                                onChange={(e) => setIsGroupMode(e.target.checked)}
                                className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer'
                            />
                            <label
                                htmlFor='groupMode'
                                className='text-sm font-medium cursor-pointer select-none text-foreground flex items-center gap-2'>
                                <Users className='h-4 w-4 text-primary' />
                                Reserva Rápida: Usar nombre y datos del titular para todo el
                                grupo
                            </label>
                        </div>
                    )}

                    <div className='space-y-8 py-4'>
                        {guestForms.map((guest, index) => (
                            <div
                                key={index}
                                className={`space-y-4 p-4 border rounded-xl mt-2 relative transition-all ${isGroupMode && index > 0 ? 'bg-primary/5 border-primary/20 opacity-80' : 'bg-secondary/10'}`}>
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

                                {/* --- BOTÓN DE ESCANEAR DNI --- */}
                                {!(isGroupMode && index > 0) && (
                                    <div className='pt-2'>
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
                                            className='w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'
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
                                                ? 'Procesando imagen...'
                                                : 'Escanear DNI / Pasaporte'}
                                        </Button>
                                    </div>
                                )}

                                {/* Nombre y Apellidos */}
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-1'>
                                    <div className='space-y-2'>
                                        <Label
                                            className={
                                                index === 0 && isGroupMode
                                                    ? 'font-bold text-primary'
                                                    : ''
                                            }>
                                            {index === 0 && isGroupMode ? 'Nombre Titular' : 'Nombre'}
                                        </Label>
                                        <Input
                                            value={guest.name}
                                            onChange={(e) =>
                                                updateGuestField(index, 'name', e.target.value)
                                            }
                                            placeholder={index === 0 ? 'Ej: Juan' : 'Nombre'}
                                            disabled={isGroupMode && index > 0}
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
                                            disabled={isGroupMode && index > 0}
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
                                                disabled={isGroupMode && index > 0}
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
                                            disabled={isGroupMode && index > 0}
                                            placeholder='Ej: España'
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
                            </div>
                        ))}
                    </div>

                    {/* BOTONES INFERIORES */}
                    <DialogFooter className='gap-2 sm:gap-0 mt-4'>
                        <div className='mr-auto flex gap-2'>
                            {/* BOTÓN DE ELIMINAR RESERVA */}
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

                            {isEditing && editingId && (
                                <Button
                                    type='button'
                                    variant='secondary'
                                    onClick={() => {
                                        toast.info('Descargando recibo...');
                                        apiService
                                            .downloadInvoice(editingId)
                                            .catch(() => toast.error('Error al descargar'));
                                    }}>
                                    <FileText className='h-4 w-4 sm:mr-2' />
                                    <span className='hidden sm:inline'>Recibo</span>
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
        </div>
    );
};

export default DayView;
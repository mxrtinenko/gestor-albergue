from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import cm
from datetime import datetime

def generate_invoice_pdf(bookings_list, filename, user):
    """
    Genera una factura con estilo corporativo (Verde Hostly),
    usando los datos dinámicos del usuario (SaaS) y eliminando campos innecesarios.
    """
    if not bookings_list:
        return

    # Titular de la reserva (usamos el primero de la lista si es un grupo)
    main_booking = bookings_list[0]
    
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    # --- COLORES ---
    # Verde oscuro elegante (similar al de la UI)
    primary_color = colors.HexColor("#022c22") 
    
    # 1. CABECERA CON FONDO DE COLOR
    # Dibujamos el rectángulo verde superior
    c.setFillColor(primary_color)
    c.rect(0, height - 100, width, 100, fill=True, stroke=False)
    
    # Nombre del Albergue (Izquierda, Grande y Blanco)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    # Usamos el nombre real del albergue del usuario
    header_name = user.hostel_name if user.hostel_name else "Mi Albergue"
    c.drawString(50, height - 60, header_name)
    
    # Datos Fiscales (Derecha, Blanco, alineados)
    c.setFont("Helvetica", 10)
    y_header = height - 40
    
    def draw_right_header(text):
        nonlocal y_header
        if text:
            c.drawRightString(width - 50, y_header, str(text))
            y_header -= 14

    # Imprimimos los datos que existan en el perfil
    if user.razon_social: draw_right_header(user.razon_social)
    if user.nif: draw_right_header(f"NIF: {user.nif}")
    if user.address: draw_right_header(user.address)
    if user.phone: draw_right_header(f"Tel: {user.phone}")
    if user.email: draw_right_header(user.email)

    # Título del documento (Debajo de la cabecera verde)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 140, "FACTURA / RECIBO")

    # 2. DATOS DEL CLIENTE Y REFERENCIA
    # Columna Izquierda: Cliente
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.gray)
    c.drawString(50, height - 170, "CLIENTE TITULAR:")
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    guest_name = f"{main_booking.guest_name} {main_booking.surname or ''}"
    c.drawString(50, height - 185, guest_name.upper())
    
    c.setFont("Helvetica", 10)
    # Mostramos DNI solo si existe
    doc_info = f"{main_booking.dni_type}: {main_booking.dni}" if main_booking.dni else "Documento: ---"
    c.drawString(50, height - 200, doc_info)

    # Columna Derecha: Detalles Factura
    fecha_emision = datetime.now().strftime("%d/%m/%Y")
    # Limpiamos un poco el ID para que no sea tan largo en el PDF
    ref_short = main_booking.id.replace("bk-", "") 
    
    c.drawRightString(width - 50, height - 170, f"Fecha Emisión: {fecha_emision}")
    c.drawRightString(width - 50, height - 185, f"Ref: {ref_short}")

    # 3. TABLA DE CONCEPTOS
    y = height - 240
    
    # Encabezados
    c.setStrokeColor(colors.lightgrey)
    c.line(50, y, width-50, y) # Línea superior
    y -= 15
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.darkgray)
    
    c.drawString(50, y, "CONCEPTO")
    c.drawString(320, y, "FECHA ESTANCIA")
    c.drawRightString(width-50, y, "IMPORTE")
    
    y -= 10
    c.line(50, y, width-50, y) # Línea inferior encabezado
    y -= 20

    # Filas
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    
    total_invoice = 0.0
    
    for b in bookings_list:
        # Descripción limpia
        desc = f"Alojamiento - {b.guest_name}"
        
        c.drawString(50, y, desc)
        c.drawString(320, y, b.date)
        c.drawRightString(width-50, y, f"{b.total_price:.2f} €")
        
        total_invoice += b.total_price
        y -= 20

    # 4. TOTALES
    y -= 10
    c.setStrokeColor(colors.black)
    c.line(320, y, width-50, y) # Línea de cierre
    y -= 25
    
    # Total Grande
    c.setFont("Helvetica-Bold", 12)
    c.drawString(320, y, "TOTAL (Impuestos Inc.)")
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width-50, y, f"{total_invoice:.2f} €")

    # Desglose Impuestos Dinámico
    y -= 15
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.gray)
    
    user_tax = getattr(user, 'tax_rate', 10.0) # Por si acaso leemos de una base de datos antigua
    divisor_impuestos = 1 + (user_tax / 100)
    
    base = round(total_invoice / divisor_impuestos, 2)
    impuestos = round(total_invoice - base, 2)
    
    # Si el IVA es 0, no lo mostramos, si no, mostramos el % exacto
    tax_label = f"Impuestos ({user_tax}%):" if user_tax > 0 else "Impuestos:"
    
    c.drawRightString(width-50, y, f"Base Imponible: {base:.2f} €  |  {tax_label} {impuestos:.2f} €")
    # 5. ESTADO DEL PAGO (EN UN RECUADRO)
    y_status = y - 50
    c.setFont("Helvetica-Bold", 10)
    
    all_paid = all(b.paid for b in bookings_list)
    
    if all_paid:
        # Detectar método de pago
        methods = list(set(b.payment_method for b in bookings_list if b.payment_method))
        method_str = methods[0] if len(methods) == 1 else "Varios"
        
        # Color Verde
        green_color = colors.HexColor("#16a34a")
        c.setFillColor(green_color)
        c.setStrokeColor(green_color)
        
        # Dibujamos recuadro redondeado
        c.roundRect(50, y_status, 200, 25, 4, fill=False, stroke=True)
        # Texto dentro
        c.drawString(65, y_status + 8, f"ESTADO: PAGADO ({method_str})")
    else:
        # Color Rojo
        red_color = colors.HexColor("#dc2626")
        c.setFillColor(red_color)
        c.setStrokeColor(red_color)
        
        c.roundRect(50, y_status, 200, 25, 4, fill=False, stroke=True)
        c.drawString(65, y_status + 8, "ESTADO: PENDIENTE DE PAGO")

    # 6. PIE DE PÁGINA
    c.setFillColor(colors.gray)
    c.setFont("Helvetica", 8)
    
    footer_y = 40
    c.drawCentredString(width / 2, footer_y, "Gracias por su visita.")
    c.drawCentredString(width / 2, footer_y - 12, "Documento generado por Hostly PMS")
    
    c.save()
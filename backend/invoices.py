import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from datetime import datetime

def generate_invoice_pdf(bookings_list, filename, user):
    """
    Genera una factura con estilo corporativo (Verde Hostly),
    incluyendo el logo y un diseño de tabla profesional.
    """
    if not bookings_list:
        return

    main_booking = bookings_list[0]
    
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    # --- COLORES CORPORATIVOS ---
    primary_color = colors.HexColor("#022c22") # Verde Oscuro
    accent_color = colors.HexColor("#10b981")  # Verde Claro (Detalles)
    text_muted = colors.HexColor("#64748b")    # Gris texto
    
    # --- 1. CABECERA CON FONDO Y LOGO ---
    # Rectángulo verde superior
    c.setFillColor(primary_color)
    c.rect(0, height - 100, width, 100, fill=True, stroke=False)
    
    # Intentamos cargar el logo (Debe estar en la carpeta backend)
    logo_path = "logo.png"
    text_x_start = 50
    
    if os.path.exists(logo_path):
        try:
            # preserveAspectRatio evita que el logo se estire o deforme
            c.drawImage(ImageReader(logo_path), 50, height - 80, width=90, height=60, mask='auto', preserveAspectRatio=True)
            text_x_start = 160 # Desplazamos el texto a la derecha si hay logo
        except Exception as e:
            print(f"No se pudo cargar el logo: {e}")

    # Nombre del Albergue (Blanco)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 20)
    header_name = user.hostel_name if user.hostel_name else "Mi Albergue"
    c.drawString(text_x_start, height - 55, header_name.upper())
    
    # Línea decorativa sutil debajo del nombre
    c.setStrokeColor(accent_color)
    c.setLineWidth(2)
    c.line(text_x_start, height - 65, text_x_start + 150, height - 65)

    # Datos Fiscales del Albergue (Alineados a la derecha, en la banda verde)
    c.setFont("Helvetica", 9)
    y_header = height - 35
    
    def draw_right_header(text):
        nonlocal y_header
        if text:
            c.drawRightString(width - 50, y_header, str(text))
            y_header -= 13

    if user.razon_social: draw_right_header(user.razon_social)
    if user.nif: draw_right_header(f"NIF: {user.nif}")
    if user.address: draw_right_header(user.address)
    if user.phone: draw_right_header(f"Tel: {user.phone}")
    if user.email: draw_right_header(user.email)

    # --- 2. INFORMACIÓN DEL DOCUMENTO Y CLIENTE ---
    y_info = height - 140
    
    # Título (Izquierda)
    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y_info, "FACTURA / RECIBO")
    
    # Referencia y Fecha (Derecha)
    fecha_emision = datetime.now().strftime("%d/%m/%Y")
    ref_short = main_booking.id.replace("bk-", "")[:12].upper() 
    
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - 50, y_info, f"Nº REF: {ref_short}")
    c.setFont("Helvetica", 10)
    c.setFillColor(text_muted)
    c.drawRightString(width - 50, y_info - 15, f"Fecha: {fecha_emision}")

    # Datos del Cliente (Recuadro gris claro)
    y_client = y_info - 60
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.roundRect(50, y_client - 40, width - 100, 70, 4, fill=True, stroke=True)

    c.setFillColor(text_muted)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(65, y_client + 15, "FACTURAR A:")
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    guest_name = f"{main_booking.guest_name} {main_booking.surname or ''}".strip().upper()
    c.drawString(65, y_client - 5, guest_name)
    
    c.setFont("Helvetica", 10)
    doc_info = f"{main_booking.dni_type}: {main_booking.dni}" if main_booking.dni else "Doc: No especificado"
    c.drawString(65, y_client - 20, doc_info)

    # --- 3. TABLA DE CONCEPTOS ---
    y_table = y_client - 80
    
    # Encabezado de la tabla (Fondo oscuro)
    c.setFillColor(primary_color)
    c.rect(50, y_table, width - 100, 20, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    
    # POSICIONES DE LAS COLUMNAS (Movidas para que nada se solape)
    col_desc = 60
    col_date = 390
    col_import = width - 60
    
    c.drawString(col_desc, y_table + 6, "DESCRIPCIÓN")
    c.drawCentredString(col_date, y_table + 6, "FECHA")
    c.drawRightString(col_import, y_table + 6, "IMPORTE")
    
    y_table -= 20
    
    # Filas de la tabla (Color alterno)
    total_invoice = 0.0
    c.setFont("Helvetica", 10)
    
    for i, b in enumerate(bookings_list):
        if i % 2 == 0:
            c.setFillColor(colors.HexColor("#f1f5f9"))
            c.rect(50, y_table, width - 100, 20, fill=True, stroke=False)
            
        c.setFillColor(colors.black)
        
        try:
            fecha_bonita = datetime.strptime(b.date, "%Y-%m-%d").strftime("%d/%m/%Y")
        except:
            fecha_bonita = b.date
            
        desc = f"Alojamiento - {b.guest_name}".upper()
        
        # Recorte inteligente: si es más de 32 letras, le pone puntos suspensivos
        short_desc = (desc[:32] + '...') if len(desc) > 32 else desc
        
        c.drawString(col_desc, y_table + 6, short_desc) 
        c.drawCentredString(col_date, y_table + 6, fecha_bonita)
        c.drawRightString(col_import, y_table + 6, f"{b.total_price:.2f} €")
        
        total_invoice += b.total_price
        y_table -= 20

    # Línea de cierre tabla
    c.setStrokeColor(primary_color)
    c.setLineWidth(1)
    c.line(50, y_table, width - 50, y_table)

    # --- 4. TOTALES Y DESGLOSE DE IMPUESTOS ---
    y_totals = y_table - 30
    
    user_tax = getattr(user, 'tax_rate', 10.0) 
    divisor = 1 + (user_tax / 100)
    base = round(total_invoice / divisor, 2)
    impuestos = round(total_invoice - base, 2)
    
    c.setFont("Helvetica", 9)
    c.setFillColor(text_muted)
    c.drawString(width - 250, y_totals, "Base Imponible:")
    c.drawRightString(width - 50, y_totals, f"{base:.2f} €")
    
    tax_label = f"IVA ({user_tax}%):" if user_tax > 0 else "Impuestos:"
    c.drawString(width - 250, y_totals - 15, tax_label)
    c.drawRightString(width - 50, y_totals - 15, f"{impuestos:.2f} €")
    
    c.setStrokeColor(colors.lightgrey)
    c.line(width - 250, y_totals - 25, width - 50, y_totals - 25)
    
    y_totals -= 45
    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(width - 250, y_totals, "TOTAL FACTURA:")
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - 50, y_totals, f"{total_invoice:.2f} €")

    # --- 5. ESTADO DEL PAGO ---
    y_status = y_table - 45
    all_paid = all(b.paid for b in bookings_list)
    
    c.setFont("Helvetica-Bold", 11)
    if all_paid:
        methods = list(set(b.payment_method for b in bookings_list if b.payment_method))
        method_str = methods[0] if len(methods) == 1 else "VARIOS"
        
        c.setFillColor(accent_color)
        c.drawString(50, y_status, f"ESTADO: PAGADO ({method_str})")
    else:
        c.setFillColor(colors.HexColor("#dc2626"))
        c.drawString(50, y_status, "ESTADO: PENDIENTE DE PAGO")

    # --- 6. PIE DE PÁGINA ---
    c.setFillColor(text_muted)
    c.setFont("Helvetica", 8)
    
    c.line(50, 50, width - 50, 50)
    c.drawCentredString(width / 2, 35, "Gracias por confiar en nosotros.")
    c.drawCentredString(width / 2, 23, "Documento generado por Hostly | Software de Gestión de Albergues")
    
    c.save()
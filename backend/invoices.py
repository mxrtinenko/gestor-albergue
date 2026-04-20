import os
import qrcode
import tempfile
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from datetime import datetime

def generate_invoice_pdf(bookings_list, filename, user, invoice_data=None):
    """
    Genera una factura con estilo corporativo (Verde Hostly) y QR VeriFactu.
    Si invoice_data viene relleno, pinta el QR y los datos legales.
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
    c.setFillColor(primary_color)
    c.rect(0, height - 100, width, 100, fill=True, stroke=False)
    
    text_x_start = 50
    logo_drawn = False

    # A. Intentar cargar el LOGO PERSONALIZADO del usuario
    if getattr(user, 'logo_url', None):
        # La DB guarda "http://.../uploads/logo_X.png". Extraemos el nombre final.
        file_name = user.logo_url.split("/")[-1]
        local_logo_path = os.path.join("uploads", file_name)
        
        if os.path.exists(local_logo_path):
            try:
                c.drawImage(ImageReader(local_logo_path), 50, height - 85, width=90, height=70, mask='auto', preserveAspectRatio=True)
                text_x_start = 160 
                logo_drawn = True
            except Exception as e:
                print(f"Error cargando logo personalizado: {e}")

    # B. Si no hay logo personalizado, intentar usar el LOGO POR DEFECTO
    if not logo_drawn:
        default_logo_path = "logo.png"
        if os.path.exists(default_logo_path):
            try:
                c.drawImage(ImageReader(default_logo_path), 50, height - 85, width=90, height=70, mask='auto', preserveAspectRatio=True)
                text_x_start = 160 
            except Exception as e:
                pass # Si no hay logo por defecto, simplemente el texto empieza más a la izquierda

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 20)
    header_name = user.hostel_name if user.hostel_name else "Mi Albergue"
    c.drawString(text_x_start, height - 55, header_name.upper())
    
    c.setStrokeColor(accent_color)
    c.setLineWidth(2)
    c.line(text_x_start, height - 65, text_x_start + 150, height - 65)

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

    # --- 2. INFORMACIÓN DEL DOCUMENTO ---
    y_info = height - 140
    
    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 16)
    
    # Si tenemos datos de factura real, ponemos el número oficial
    titulo = f"FACTURA {invoice_data['number']}" if invoice_data else "RECIBO / BORRADOR"
    c.drawString(50, y_info, titulo)
    
    fecha_emision = datetime.now().strftime("%d/%m/%Y")
    ref_short = main_booking.id.replace("bk-", "")[:12].upper() 
    
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - 50, y_info, f"Nº REF: {ref_short}")
    c.setFont("Helvetica", 10)
    c.setFillColor(text_muted)
    c.drawRightString(width - 50, y_info - 15, f"Fecha: {fecha_emision}")

    # Datos del Cliente
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
    
    c.setFillColor(primary_color)
    c.rect(50, y_table, width - 100, 20, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    
    col_desc = 60
    col_date = 390
    col_import = width - 60
    
    c.drawString(col_desc, y_table + 6, "DESCRIPCIÓN")
    c.drawCentredString(col_date, y_table + 6, "FECHA")
    c.drawRightString(col_import, y_table + 6, "IMPORTE")
    
    y_table -= 20
    
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
        short_desc = (desc[:32] + '...') if len(desc) > 32 else desc
        
        c.drawString(col_desc, y_table + 6, short_desc) 
        c.drawCentredString(col_date, y_table + 6, fecha_bonita)
        c.drawRightString(col_import, y_table + 6, f"{b.total_price:.2f} €")
        
        total_invoice += b.total_price
        y_table -= 20

    c.setStrokeColor(primary_color)
    c.setLineWidth(1)
    c.line(50, y_table, width - 50, y_table)

    # --- 4. TOTALES ---
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

    # --- 5. BLOQUE VERIFACTU (QR + HUELLA) ---
    if invoice_data and invoice_data.get("qr_code_url"):
        # Posición del QR: Abajo a la izquierda
        qr_size = 80
        qr_x = 50
        qr_y = 80 # Un poco por encima del pie de página
        
        # Generar QR
        qr = qrcode.QRCode(box_size=2, border=1)
        qr.add_data(invoice_data["qr_code_url"])
        qr.make(fit=True)
        img_qr = qr.make_image(fill_color="black", back_color="white")
        
        temp_qr_path = tempfile.mktemp(suffix=".png")
        img_qr.save(temp_qr_path)
        
        c.drawImage(ImageReader(temp_qr_path), qr_x, qr_y, width=qr_size, height=qr_size)
        os.remove(temp_qr_path)
        
        # Texto legal obligatorio al lado del QR
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 7)
        text_x = qr_x + qr_size + 10
        text_y_start = qr_y + qr_size - 10
        
        c.drawString(text_x, text_y_start, "Factura verificable en la sede electrónica de la AEAT")
        c.drawString(text_x, text_y_start - 10, "VERI*FACTU")
        
        c.setFillColor(text_muted)
        c.drawString(text_x, text_y_start - 25, "Huella Digital (Hash):")
        c.setFont("Courier", 6) # Fuente monoespaciada para el hash
        c.drawString(text_x, text_y_start - 35, invoice_data.get("hash", "")[:40] + "...") # Hash truncado si es muy largo

    # --- 6. PIE DE PÁGINA ---
    c.setFillColor(text_muted)
    c.setFont("Helvetica", 8)
    
    c.line(50, 50, width - 50, 50)
    c.drawCentredString(width / 2, 35, "Gracias por confiar en nosotros.")
    c.drawCentredString(width / 2, 23, "Documento generado por Hostly")
    
    c.save()
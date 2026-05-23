# ============================================================
#  services/reporte.py — RF8 Generación de Reporte PDF
#  FIX: observaciones dinámicas desde el frontend
#  Paleta: #051F20 | #173831 | #235347 | #8CB79B | #DBF0DD
# ============================================================

import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_CENTER

from services.lecturas     import obtener_estadisticos, obtener_lecturas
from services.diagnosticos import historial_diagnosticos

C_BOSQUE = colors.HexColor('#051F20')
C_VERDE  = colors.HexColor('#173831')
C_MEDIO  = colors.HexColor('#235347')
C_SALVIA = colors.HexColor('#8CB79B')
C_MENTA  = colors.HexColor('#DBF0DD')
C_BLANCO = colors.white
C_GRIS   = colors.HexColor('#f0f5f1')


def generar_pdf(area_id: int, area_nombre: str, cultivo: str,
                desde: str, hasta: str, usuario: str,
                observaciones: str = '') -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm,  bottomMargin=2*cm,
    )

    estilos = _estilos()
    story   = []

    # Encabezado
    story += _encabezado(area_nombre, cultivo, desde, hasta, usuario, estilos)
    story.append(Spacer(1, 0.4*cm))

    # Estadísticos
    stats = obtener_estadisticos(area_id, desde, hasta)
    if stats:
        story.append(Paragraph("Estadísticos del período", estilos['seccion']))
        story.append(Spacer(1, 0.2*cm))
        story.append(_tabla_estadisticos(stats))
        story.append(Spacer(1, 0.5*cm))

    # Historial de diagnósticos
    diags = historial_diagnosticos(area_id, desde, hasta)
    story.append(Paragraph("Historial de diagnósticos", estilos['seccion']))
    story.append(Spacer(1, 0.2*cm))
    story.append(_tabla_diagnosticos(diags, estilos))
    story.append(Spacer(1, 0.5*cm))

    # Observaciones — dinámicas si el usuario las escribió, vacías si no
    story.append(Paragraph("Observaciones", estilos['seccion']))
    story.append(Spacer(1, 0.2*cm))
    story.append(_caja_observaciones(observaciones, estilos))

    # Pie
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=C_SALVIA))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"Sistema de monitoreo agrícola — TecNM  ·  Generado por: {usuario}",
        estilos['pie']
    ))

    doc.build(story)
    return buffer.getvalue()


def _encabezado(nombre, cultivo, desde, hasta, usuario, estilos):
    titulo = [[Paragraph("Reporte integrado de monitoreo agrícola", estilos['titulo_hdr'])]]
    meta   = [[Paragraph(
        f"Área: <b>{nombre}</b>  ·  Cultivo: <b>{cultivo}</b>  ·  "
        f"Período: <b>{desde}</b> – <b>{hasta}</b>  ·  Generado por: <b>{usuario}</b>",
        estilos['meta_hdr']
    )]]
    t = Table(titulo + meta, colWidths=[17*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), C_BOSQUE),
        ('BACKGROUND',   (0,1), (-1,1), C_VERDE),
        ('TOPPADDING',   (0,0), (-1,-1), 10),
        ('BOTTOMPADDING',(0,0), (-1,-1), 10),
        ('LEFTPADDING',  (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
    ]))
    return [t]


def _tabla_estadisticos(stats: dict) -> Table:
    VARS = [
        ('Humedad',       'Humedad_Prom','Humedad_Max','Humedad_Min', '%'),
        ('Temperatura',   'Temp_Prom',   'Temp_Max',   'Temp_Min',   '°C'),
        ('pH',            'pH_Prom',     'pH_Max',     'pH_Min',     ''),
        ('Conductividad', 'CE_Prom',     'CE_Max',     'CE_Min',     'µS/cm'),
        ('Salinidad',     'Sal_Prom',    'Sal_Max',    'Sal_Min',    'ppt'),
        ('Nitrógeno (N)', 'N_Prom',      'N_Max',      'N_Min',      'ppm'),
        ('Fósforo (P)',   'P_Prom',      'P_Max',      'P_Min',      'ppm'),
        ('Potasio (K)',   'K_Prom',      'K_Max',      'K_Min',      'ppm'),
    ]
    def v(key):
        val = stats.get(key)
        return f"{float(val):.2f}" if val is not None else "—"

    encab = [['Variable', 'Promedio', 'Máximo', 'Mínimo', 'Unidad']]
    filas = [[nom, v(p), v(mx), v(mn), uni] for nom,p,mx,mn,uni in VARS]
    t = Table(encab + filas, colWidths=[4*cm,3*cm,3*cm,3*cm,3*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),  C_VERDE),
        ('TEXTCOLOR',     (0,0), (-1,0),  C_MENTA),
        ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [C_BLANCO, C_GRIS]),
        ('GRID',          (0,0), (-1,-1), 0.3, C_SALVIA),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('ALIGN',         (1,0), (-1,-1), 'CENTER'),
    ]))
    return t


def _tabla_diagnosticos(diags: list, estilos) -> Table:
    if not diags:
        return Paragraph("Sin diagnósticos en el período seleccionado.", estilos['body'])
    encab = [['Fecha', 'Usuario', 'Cultivo', 'Resultado']]
    filas = [[d['fechaHora'][:10], d['usuario'], d['cultivoEvaluado'], d['resultado']]
             for d in diags]
    t = Table(encab + filas, colWidths=[3.5*cm,4*cm,3.5*cm,6*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),  C_VERDE),
        ('TEXTCOLOR',     (0,0), (-1,0),  C_MENTA),
        ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [C_BLANCO, C_GRIS]),
        ('GRID',          (0,0), (-1,-1), 0.3, C_SALVIA),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
    ]))
    return t


def _caja_observaciones(texto: str, estilos) -> Table:
    # Si el usuario escribió observaciones las muestra; si no, texto de placeholder
    contenido = texto if texto else "Sin observaciones registradas para este período."
    t = Table(
        [[Paragraph(contenido, estilos['obs'])]],
        colWidths=[17*cm],
        rowHeights=[max(2*cm, len(contenido) // 80 * 0.5*cm + 1.5*cm)]
    )
    t.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), C_MENTA),
        ('BOX',          (0,0), (-1,-1), 0.5, C_SALVIA),
        ('TOPPADDING',   (0,0), (-1,-1), 10),
        ('BOTTOMPADDING',(0,0), (-1,-1), 10),
        ('LEFTPADDING',  (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    return t


def _estilos() -> dict:
    return {
        'titulo_hdr': ParagraphStyle('th', fontSize=14, textColor=C_MENTA,  fontName='Helvetica-Bold'),
        'meta_hdr':   ParagraphStyle('mh', fontSize=9,  textColor=C_SALVIA, fontName='Helvetica'),
        'seccion':    ParagraphStyle('sec',fontSize=11, textColor=C_BOSQUE, fontName='Helvetica-Bold', spaceAfter=4),
        'body':       ParagraphStyle('bd', fontSize=9,  textColor=C_BOSQUE, fontName='Helvetica'),
        'obs':        ParagraphStyle('obs',fontSize=9,  textColor=C_MEDIO,  fontName='Helvetica', leading=14),
        'pie':        ParagraphStyle('pie',fontSize=8,  textColor=C_SALVIA, fontName='Helvetica', alignment=TA_CENTER),
    }
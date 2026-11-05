from pathlib import Path
from io import BytesIO
import math

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/pdf/Pampa_Brava_Reglamento_Fisico_v7.pdf"
PUBLIC_OUTPUT = ROOT / "public/reglamento/Pampa_Brava_Reglamento_Fisico_v7.pdf"
ART = ROOT / "public/art"

PAGE_W, PAGE_H = landscape(A3)

INK = HexColor("#213e32")
INK_2 = HexColor("#173126")
PAPER = HexColor("#f7efde")
PANEL = HexColor("#fffaf0")
GOLD = HexColor("#c9952f")
GOLD_DARK = HexColor("#8b6120")
RED = HexColor("#b44e40")
BLUE = HexColor("#39758f")
GREEN = HexColor("#3f704d")
MUTED = HexColor("#695f50")
LINE = HexColor("#d7c39d")
SIERRA = HexColor("#747d83")
PULPERIA = HexColor("#914b31")

STYLES = {
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=10.2, leading=13.2, textColor=HexColor("#342f28")),
    "body_bold": ParagraphStyle("body_bold", fontName="Helvetica-Bold", fontSize=10.2, leading=13.2, textColor=INK),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.4, leading=10.7, textColor=MUTED),
    "small_bold": ParagraphStyle("small_bold", fontName="Helvetica-Bold", fontSize=8.4, leading=10.7, textColor=INK),
    "tiny": ParagraphStyle("tiny", fontName="Helvetica", fontSize=7.3, leading=9, textColor=MUTED),
    "center": ParagraphStyle("center", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=INK, alignment=TA_CENTER),
}

IMAGE_CACHE = {}


def art_reader(path):
    key = str(path)
    if key not in IMAGE_CACHE:
        image = Image.open(path).convert("RGB")
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        stream = BytesIO()
        image.save(stream, format="JPEG", quality=88, optimize=True, progressive=True)
        stream.seek(0)
        IMAGE_CACHE[key] = ImageReader(stream)
    return IMAGE_CACHE[key]


def para(c, text, x, y_top, width, style="body"):
    p = Paragraph(text, STYLES[style])
    _, height = p.wrap(width, 1000)
    p.drawOn(c, x, y_top - height)
    return height


def cover_image(c, path, x, y, width, height, focus_x=0.5, focus_y=0.5):
    image = art_reader(path)
    iw, ih = image.getSize()
    scale = max(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    dx = x - (dw - width) * focus_x
    dy = y - (dh - height) * focus_y
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, width, height)
    c.clipPath(clip, stroke=0)
    c.drawImage(image, dx, dy, dw, dh, mask="auto")
    c.restoreState()


def rounded_image(c, path, x, y, width, height, radius=10, focus_x=0.5, focus_y=0.5):
    image = art_reader(path)
    iw, ih = image.getSize()
    scale = max(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    dx = x - (dw - width) * focus_x
    dy = y - (dh - height) * focus_y
    c.saveState()
    clip = c.beginPath()
    clip.roundRect(x, y, width, height, radius)
    c.clipPath(clip, stroke=0)
    c.drawImage(image, dx, dy, dw, dh, mask="auto")
    c.restoreState()
    c.setStrokeColor(HexColor("#e7cf9d"))
    c.setLineWidth(1.2)
    c.roundRect(x, y, width, height, radius, fill=0, stroke=1)


def hexagon(c, cx, cy, radius, fill, label=None, font_size=7):
    points = []
    for angle in (0, 60, 120, 180, 240, 300):
        radians = math.radians(angle)
        points.append((cx + radius * math.cos(radians), cy + radius * math.sin(radians)))
    path = c.beginPath()
    path.moveTo(*points[0])
    for point in points[1:]:
        path.lineTo(*point)
    path.close()
    c.setFillColor(fill)
    c.setStrokeColor(HexColor("#f6dfa8"))
    c.setLineWidth(1.2)
    c.drawPath(path, fill=1, stroke=1)
    if label:
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", font_size)
        c.drawCentredString(cx, cy - font_size * 0.35, label.upper())


def panel(c, x, y, width, height, number, title, accent=GOLD):
    c.setFillColor(PANEL)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.roundRect(x, y, width, height, 10, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y + height - 45, width, 45, 10, fill=1, stroke=0)
    c.rect(x, y + height - 45, width, 12, fill=1, stroke=0)
    c.setFillColor(INK_2)
    c.roundRect(x + 14, y + height - 34, 32, 24, 4, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x + 30, y + height - 26, number)
    c.setFont("Times-Bold", 19)
    c.drawString(x + 58, y + height - 30, title)
    return y + height - 60


def label(c, text, x, y, color=INK):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x, y, text.upper())


def badge(c, text, x, y, width, fill=INK, text_color=colors.white):
    c.setFillColor(fill)
    c.roundRect(x, y, width, 22, 11, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x + width / 2, y + 7.5, text.upper())


def step_card(c, x, y, width, height, number, title, text, accent):
    c.setFillColor(HexColor("#f4ead6"))
    c.setStrokeColor(HexColor("#ddc9a3"))
    c.roundRect(x, y, width, height, 8, fill=1, stroke=1)
    c.setFillColor(accent)
    c.circle(x + 28, y + height - 28, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 18)
    c.drawCentredString(x + 28, y + height - 34, number)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 53, y + height - 24, title.upper())
    para(c, text, x + 53, y + height - 34, width - 66, "small")


def flow_node(c, x, y, width, height, title, text, accent, title_color=colors.white):
    c.setFillColor(PANEL)
    c.setStrokeColor(accent)
    c.setLineWidth(1.5)
    c.roundRect(x, y, width, height, 9, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y + height - 28, width, 28, 9, fill=1, stroke=0)
    c.rect(x, y + height - 28, width, 8, fill=1, stroke=0)
    c.setFillColor(title_color)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + width / 2, y + height - 19, title.upper())
    para(c, text, x + 10, y + height - 38, width - 20, "small")


def arrow(c, x1, y1, x2, y2, color=GOLD_DARK):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.5)
    c.line(x1, y1, x2, y2)
    angle = math.atan2(y2 - y1, x2 - x1)
    for offset in (2.65, -2.65):
        c.line(x2, y2, x2 + 8 * math.cos(angle + offset), y2 + 8 * math.sin(angle + offset))


def page_header(c, page, title, subtitle, image_path, image_focus=0.5):
    cover_image(c, image_path, 0, PAGE_H - 138, PAGE_W, 138, focus_y=image_focus)
    c.saveState()
    c.setFillAlpha(0.82)
    c.setFillColor(INK_2)
    c.rect(0, PAGE_H - 138, PAGE_W, 138, fill=1, stroke=0)
    c.restoreState()
    c.setStrokeColor(HexColor("#dbc27d"))
    c.setLineWidth(1)
    c.line(42, PAGE_H - 19, PAGE_W - 42, PAGE_H - 19)
    c.setFillColor(HexColor("#f3d78d"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(45, PAGE_H - 38, f"PAMPA BRAVA  /  REGLAMENTO 07.1  /  PÁGINA {page} DE 2")
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 31)
    c.drawString(45, PAGE_H - 80, title)
    c.setFillColor(HexColor("#f4dfaa"))
    c.setFont("Helvetica", 11)
    c.drawString(46, PAGE_H - 101, subtitle)
    c.setFillColor(colors.white)
    c.setFont("Times-Italic", 13)
    c.drawRightString(PAGE_W - 45, PAGE_H - 69, "No hace falta tener la mejor carta.")
    c.setFont("Times-BoldItalic", 18)
    c.drawRightString(PAGE_W - 45, PAGE_H - 92, "Hace falta que te crean.")


def footer(c, page, text):
    c.setStrokeColor(LINE)
    c.line(42, 37, PAGE_W - 42, 37)
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(42, 20, "RECORDÁ")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(105, 20, text)
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(PAGE_W - 42, 20, f"{page} / 2")


def draw_board(c, x, y, scale=1.0):
    row_counts = [8, 7, 6, 5, 4, 3, 2]
    fills = [GOLD, GREEN, SIERRA]
    radius = 11 * scale
    for row, count in enumerate(row_counts):
        cy = y + row * radius * 1.55
        offset = (8 - count) * radius * 0.87
        for col in range(count):
            fill = PULPERIA if row == 3 and col == 2 else fills[(row + col) % 3]
            hexagon(c, x + offset + col * radius * 1.74, cy, radius, fill)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(x + radius * 6.1, y - 14, "CAMPAMENTOS")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(x + radius * 6.1, y + radius * 11.3, "META")


def draw_page_one(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(
        c,
        1,
        "Empezar a jugar",
        "Objetivo, preparación, turno y movimiento en una sola mirada.",
        ART / "terrenos-costumbristas.png",
        0.68,
    )

    margin, gap = 42, 20
    width = (PAGE_W - margin * 2 - gap) / 2
    left, right = margin, margin + width + gap
    top_y, top_h = 397, 277
    bottom_y, bottom_h = 62, 315

    content = panel(c, left, top_y, width, top_h, "01", "Objetivo y preparación", GOLD)
    c.setFillColor(RED)
    c.setFont("Times-Bold", 48)
    c.drawString(left + 24, content - 41, "2")
    c.setFillColor(INK)
    c.setFont("Times-Bold", 22)
    c.drawString(left + 71, content - 25, "gauchos en la Meta")
    para(c, "El primer equipo que lleva dos gauchos propios a la cima gana inmediatamente.", left + 72, content - 35, 285, "body")
    c.setStrokeColor(LINE)
    c.line(left + 22, content - 67, left + width - 22, content - 67)
    label(c, "Preparación", left + 24, content - 88, RED)
    para(c, "<b>1.</b> Elegí 2, 3 o 4 jugadores.<br/><b>2.</b> Cada equipo recibe 4 gauchos y 1 naturaleza.<br/><b>3.</b> Repartí 1 naipe secreto por gaucho; en cuatro, 2 naipes por gaucho, uno para cada compañero.<br/><b>4.</b> Mezclá terrenos, sorteá Meta, Pulpería y primer turno.", left + 24, content - 99, 342, "body")
    c.setFillColor(HexColor("#efe2c8"))
    c.roundRect(left + width - 158, top_y + 24, 136, 126, 9, fill=1, stroke=0)
    label(c, "Modo 4 jugadores", left + width - 145, top_y + 128, RED)
    para(c, "<b>A + C:</b> equipo Azul<br/><b>B + D:</b> equipo Rojo<br/>Turnos: A → B → C → D.<br/>Los compañeros comparten gauchos y naturalezas, pero no muestran sus naipes.", left + width - 145, top_y + 117, 110, "tiny")

    content = panel(c, right, top_y, width, top_h, "02", "El tablero y la Meta", BLUE)
    rounded_image(c, ART / "terrenos-costumbristas.png", right + 22, content - 98, width - 44, 82, 9, 0.5, 0.5)
    labels = [("PAMPA", GOLD), ("MONTE", GREEN), ("SIERRA", SIERRA)]
    for idx, (name, color) in enumerate(labels):
        badge(c, name, right + 32 + idx * 116, content - 124, 94, color)
    para(c, "El recorrido tiene <b>7 filas</b>: 8 + 7 + 6 + 5 + 4 + 3 + 2 casillas. Nadie puede compartir un terreno.", right + 22, content - 145, width - 44, "body")
    c.setFillColor(HexColor("#f1e7d2"))
    c.roundRect(right + 22, top_y + 22, width - 44, 54, 7, fill=1, stroke=0)
    label(c, "La Meta también es terreno", right + 36, top_y + 58, RED)
    para(c, "Desde la última fila sólo entrás si el dado coincide con Pampa, Monte o Sierra. Llegar no entrega naturaleza.", right + 36, top_y + 48, width - 72, "small")

    content = panel(c, left, bottom_y, width, bottom_h, "03", "Tu turno", GREEN)
    c.setFillColor(INK)
    c.circle(left + width - 72, content - 35, 35, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 24)
    c.drawCentredString(left + width - 72, content - 32, "30")
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(left + width - 72, content - 45, "SEGUNDOS")
    step_card(c, left + 22, content - 94, width - 118, 72, "1", "Tirá el dado", "El resultado habilita movimientos hacia Pampa, Monte o Sierra.", GOLD)
    step_card(c, left + 22, content - 176, width - 44, 72, "2", "Realizá hasta dos activaciones", "Podés usar dos veces el mismo gaucho. Cada activación permite mover, desafiar, usar la Pulpería o sacrificar.", BLUE)
    step_card(c, left + 22, content - 258, width - 44, 72, "3", "Cerrá el turno", "Podés terminar antes. Tras un duelo a muerte perdido, tu siguiente turno tiene una sola activación.", RED)

    content = panel(c, right, bottom_y, width, bottom_h, "04", "Mover o desafiar", PULPERIA)
    c.setFillColor(HexColor("#f2e6cc"))
    c.roundRect(right + 22, content - 126, (width - 54) / 2, 106, 8, fill=1, stroke=0)
    c.roundRect(right + 32 + (width - 54) / 2, content - 126, (width - 54) / 2, 106, 8, fill=1, stroke=0)
    label(c, "Mover · usa el dado", right + 36, content - 43, BLUE)
    para(c, "• Desde Campamento: entrá a la fila 1.<br/>• En tablero: avanzá 1 fila o movete lateralmente.<br/>• El destino debe coincidir con el dado.<br/>• Nunca retrocedas voluntariamente.", right + 36, content - 52, (width - 84) / 2, "small")
    x2 = right + 46 + (width - 54) / 2
    label(c, "Desafiar · sin dado", x2, content - 43, RED)
    para(c, "• Rival vecino de la misma fila o la siguiente.<br/>• Nunca ataques hacia atrás.<br/>• Desde Campamento: cualquier rival en fila 1.<br/>• Atacar consume una activación.", x2, content - 52, (width - 84) / 2, "small")
    c.setFillColor(INK)
    c.roundRect(right + 22, bottom_y + 45, width - 44, 94, 8, fill=1, stroke=0)
    c.setFillColor(HexColor("#f5dd9e"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(right + 38, bottom_y + 116, "REGLA DE ORO")
    para(c, "<font color='#ffffff'><b>El dado decide por dónde te movés; nunca decide a quién podés desafiar.</b> Si una casilla está ocupada por un aliado, esperá. Si es rival, ganale o conseguí que rechace.</font>", right + 38, bottom_y + 104, width - 76, "body")

    footer(c, 1, "El dado habilita movimientos; los desafíos dependen de la posición.")


def draw_page_two(c):
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    page_header(
        c,
        2,
        "Duelos, farol y retirada",
        "Cómo sube la apuesta, qué se descarta y dónde termina cada gaucho.",
        ART / "cartas-costumbristas.png",
        0.55,
    )

    margin = 42
    flow_y, flow_h = 423, 253
    content = panel(c, margin, flow_y, PAGE_W - margin * 2, flow_h, "05", "Flujo de un desafío", RED)
    para(c, "Las cartas de duelo valen del <b>1 al 12</b>. El atacante revela primero y toda subida se declara antes de mostrar el naipe propio. Sólo se reemplazan las cartas reveladas. <b>En cuatro jugadores:</b> revelan A → B → C → D; desafiante y primer defensor son obligatorios, los aliados pueden reservarse, y se compara A + C contra B + D. Responde cada subida el rival siguiente.", margin + 22, content, 850, "body")
    node_y, node_h, node_w = flow_y + 30, 116, 188
    xs = [margin + 22, margin + 230, margin + 438, margin + 646, margin + 854]
    flow_node(c, xs[0], node_y, node_w, node_h, "Rechaza", "Intercambian posiciones. Conservan sus naipes de duelo. Si había naturaleza, se descarta.", GREEN)
    flow_node(c, xs[1], node_y, node_w, node_h, "Acepta", "El atacante revela primero. El defensor muestra su naipe para resolver normal o redobla antes de mostrar.", BLUE)
    flow_node(c, xs[2], node_y, node_w, node_h, "Redobla", "El defensor propone jugar <b>3 filas</b>, incluso tras ver el naipe atacante. Responde el atacante.", GOLD_DARK)
    flow_node(c, xs[3], node_y, node_w, node_h, "Atacante decide", "Puede rechazar y perder el duelo normal, aceptar el redoble o elevar a muerte antes del naipe defensor.", RED)
    flow_node(c, xs[4], node_y, node_w, node_h, "A muerte", "El defensor acepta y revela, o rechaza y pierde el redoble. Si acepta, el perdedor vuelve al Campamento.", INK)
    bracket_y = node_y + node_h + 9
    c.setStrokeColor(INK)
    c.setLineWidth(1.2)
    c.line(xs[0] + node_w / 2, bracket_y, xs[2] + node_w / 2, bracket_y)
    for index in range(3):
        center = xs[index] + node_w / 2
        c.line(center, bracket_y, center, node_y + node_h)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString((xs[0] + xs[2] + node_w) / 2, bracket_y + 5, "EL DEFENSOR ELIGE UNA RESPUESTA")
    c.setFillColor(RED)
    c.drawCentredString(xs[3] + node_w / 2, bracket_y + 5, "SI REDOBLA, RESPONDE EL ATACANTE")
    arrow(c, xs[2] + node_w, node_y + 58, xs[3] - 8, node_y + 58)
    arrow(c, xs[3] + node_w, node_y + 58, xs[4] - 8, node_y + 58)

    gap = 18
    lower_y, lower_h = 63, 340
    widths = [354, 354, PAGE_W - margin * 2 - gap * 2 - 708]
    x1, x2, x3 = margin, margin + widths[0] + gap, margin + widths[0] + widths[1] + gap * 2

    content = panel(c, x1, lower_y, widths[0], lower_h, "06", "Naturaleza y farol", GOLD)
    c.setFillColor(HexColor("#efe3c9"))
    c.roundRect(x1 + 18, content - 66, widths[0] - 36, 50, 7, fill=1, stroke=0)
    para(c, "El rival sabe que comprometiste <b>una carta</b>, pero nunca cuál. Puede potenciar o ser un farol. Toda naturaleza comprometida se descarta, aunque el desafío se rechace.", x1 + 30, content - 27, widths[0] - 60, "small")
    nature_rows = [
        ("Pampa", "8", "+3 si atacás o defendés desde Pampa", GOLD),
        ("Monte", "8", "+3 si atacás o defendés desde Monte", GREEN),
        ("Sierra", "8", "+3 si atacás o defendés desde Sierra", SIERRA),
        ("Cabalgata", "3", "Saltá una fila; destino según el dado", BLUE),
        ("Boleadora", "3", "Atacá a cualquier distancia; no se rechaza", RED),
    ]
    y = content - 91
    for name, count, description, color in nature_rows:
        c.setFillColor(color)
        c.circle(x1 + 29, y + 5, 7, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 8.7)
        c.drawString(x1 + 43, y + 2, name)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(x1 + 112, y + 2, description)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(x1 + widths[0] - 20, y + 2, count)
        y -= 27
    c.setFillColor(INK)
    c.roundRect(x1 + 18, lower_y + 17, widths[0] - 36, 45, 7, fill=1, stroke=0)
    para(c, "<font color='#ffffff'><b>Sacrificio:</b> una vez por partida, retirás un gaucho y elegís una naturaleza que todavía siga disponible.</font>", x1 + 30, lower_y + 51, widths[0] - 60, "small")

    content = panel(c, x2, lower_y, widths[1], lower_h, "07", "Retirada", BLUE)
    para(c, "Elegí una ruta hacia atrás: cada paso baja exactamente <b>una fila</b>. No se permite la retirada horizontal ni elegir casillas no iluminadas. El dado no interviene.", x2 + 20, content, widths[1] - 40, "body")
    hexagon(c, x2 + 74, content - 100, 24, GREEN, "F5")
    hexagon(c, x2 + 121, content - 148, 24, SIERRA, "F4")
    hexagon(c, x2 + 168, content - 196, 24, GOLD, "F3")
    arrow(c, x2 + 82, content - 108, x2 + 113, content - 140, RED)
    arrow(c, x2 + 129, content - 156, x2 + 160, content - 188, RED)
    c.setFillColor(HexColor("#efe3c9"))
    c.roundRect(x2 + 207, content - 216, 126, 141, 7, fill=1, stroke=0)
    penalties = [("Normal", "2 filas"), ("Redoble", "3 filas"), ("Rechaza redoble", "2 filas"), ("Rechaza muerte", "3 filas"), ("A muerte", "Campamento")]
    yy = content - 101
    for name, value in penalties:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(x2 + 219, yy, name)
        c.setFillColor(RED if name == "A muerte" else INK)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(x2 + 320, yy, value)
        c.setStrokeColor(LINE)
        c.line(x2 + 219, yy - 7, x2 + 320, yy - 7)
        yy -= 23
    para(c, "La casilla que deja libre el atacante puede formar parte del camino. Si no hay ruta válida o la penalización supera la fila 1, el gaucho vuelve al Campamento.", x2 + 20, lower_y + 63, widths[1] - 40, "small")

    content = panel(c, x3, lower_y, widths[2], lower_h, "08", "Pulpería y mazos", PULPERIA)
    rounded_image(c, ART / "pulperia-costumbrista.png", x3 + 18, content - 117, widths[2] - 36, 101, 9, 0.5, 0.58)
    c.saveState()
    c.setFillAlpha(0.84)
    c.setFillColor(INK_2)
    c.roundRect(x3 + 28, content - 106, 102, 25, 12, fill=1, stroke=0)
    c.restoreState()
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x3 + 79, content - 98, "PULPERÍA")
    para(c, "Entrá desde una casilla vecina sin depender del dado. Allí no podés atacar. En cada turno, gastá 1 activación para cambiar tu naipe o intercambiarlo con un aliado desplegado.", x3 + 20, content - 135, widths[2] - 40, "body")
    c.setStrokeColor(LINE)
    c.line(x3 + 20, lower_y + 103, x3 + widths[2] - 20, lower_y + 103)
    label(c, "Reciclado de naipes", x3 + 20, lower_y + 83, BLUE)
    para(c, "La baraja de duelo tiene <b>48 cartas</b>: cuatro de cada valor, del 1 al 12. Cuando se agota, mezclá el descarte y seguí repartiendo.", x3 + 20, lower_y + 72, widths[2] - 40, "small")
    label(c, "Información secreta", x3 + 20, lower_y + 34, RED)
    para(c, "Sólo ves tus naipes. En cuatro, cada jugador ve únicamente su carta de cada gaucho; las reservadas no suman ni se renuevan.", x3 + 135, lower_y + 43, widths[2] - 155, "tiny")

    footer(c, 2, "48 naipes de duelo · 30 naturalezas · 4 gauchos por equipo · 2 llegadas para ganar.")


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=landscape(A3))
    c.setTitle("Pampa Brava - Reglamento de mesa v7.1")
    c.setAuthor("Pampa Brava")
    c.setSubject("Reglamento visual para partidas de 2, 3 o 4 jugadores")
    draw_page_one(c)
    c.showPage()
    draw_page_two(c)
    c.save()
    PUBLIC_OUTPUT.write_bytes(OUTPUT.read_bytes())


if __name__ == "__main__":
    build()

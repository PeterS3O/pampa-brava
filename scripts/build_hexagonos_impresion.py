#!/usr/bin/env python3
"""Genera losetas y barajas físicas de Pampa Brava para imprenta."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ART_DIR = ROOT / "public" / "art"
PRINT_ART_DIR = ROOT / "assets" / "print"
OUTPUT = ROOT / "output" / "pdf" / "Pampa_Brava_Componentes_Imprimibles_v13_con_baraja_duelo.pdf"
CARD_SHEET = PUBLIC_ART_DIR / "cartas-naturaleza-clasicas.png"
CARD_BACK_SOURCE = PRINT_ART_DIR / "nature" / "reverso-v1.png"
CARD_ASSET_DIR = ROOT / "output" / "print" / "cartas-naturaleza" / "assets"

DUEL_ART = {
    "pampa": PRINT_ART_DIR / "duel" / "gaucho-pampa-v1.png",
    "monte": PRINT_ART_DIR / "duel" / "gaucho-monte-v1.png",
    "sierra": PRINT_ART_DIR / "duel" / "gaucho-sierra-v1.png",
}

PAGE_W, PAGE_H = A4
CUT_WIDTH = 55 * mm                  # cara plana a cara plana
CUT_HEIGHT = 2 * CUT_WIDTH / math.sqrt(3)
BLEED = 3 * mm
OUTER_WIDTH = CUT_WIDTH + 2 * BLEED
OUTER_HEIGHT = 2 * OUTER_WIDTH / math.sqrt(3)
COL_GAP = 4 * mm
ROW_GAP = 4 * mm

CARD_WIDTH = 60 * mm
CARD_HEIGHT = 91 * mm
CARD_GAP = 2 * mm

CARD_CROPS = {
    "monte": (48, 214, 299, 595),
    "pampa": (324, 214, 575, 595),
    "sierra": (600, 214, 851, 595),
    "boleadora": (180, 680, 437, 1062),
    "cabalgata": (465, 680, 720, 1062),
}

CARD_BACK_CROP = (13, 14, 1013, 1514)

CARD_PAGE_GROUPS = [
    ["pampa"] * 9,
    ["monte"] * 9,
    ["sierra"] * 9,
    ["boleadora"] * 4 + ["cabalgata"] * 4,
]


@dataclass(frozen=True)
class Tile:
    terrain: str
    label: str


@dataclass(frozen=True)
class DuelCard:
    terrain: str
    value: int


ART = {
    "pampa": PRINT_ART_DIR / "terrain" / "pampa-v6.png",
    "monte": PRINT_ART_DIR / "terrain" / "monte-v7.png",
    "sierra": PRINT_ART_DIR / "terrain" / "sierra-v7.png",
    "pulperia": PRINT_ART_DIR / "terrain" / "pulperia-v6.png",
}

COLORS = {
    "pampa": (HexColor("#8A5A0A"), HexColor("#F1D264")),
    "monte": (HexColor("#173E22"), HexColor("#8CCB61")),
    "sierra": (HexColor("#3F474A"), HexColor("#A99A79")),
    "pulperia": (HexColor("#5B2619"), HexColor("#D49A52")),
}


def hex_points(cx: float, cy: float, width: float) -> list[tuple[float, float]]:
    """Hexagono con vertices arriba y abajo y caras planas a izquierda/derecha."""
    height = 2 * width / math.sqrt(3)
    return [
        (cx, cy + height / 2),
        (cx + width / 2, cy + height / 4),
        (cx + width / 2, cy - height / 4),
        (cx, cy - height / 2),
        (cx - width / 2, cy - height / 4),
        (cx - width / 2, cy + height / 4),
    ]


def path_from_points(c: canvas.Canvas, points: list[tuple[float, float]]):
    path = c.beginPath()
    path.moveTo(*points[0])
    for point in points[1:]:
        path.lineTo(*point)
    path.close()
    return path


def draw_crop_marks(c: canvas.Canvas, cx: float, cy: float) -> None:
    points = hex_points(cx, cy, CUT_WIDTH)
    c.saveState()
    c.setStrokeColor(HexColor("#1C1814"))
    c.setLineWidth(0.18 * mm)
    c.setLineCap(0)
    mark = 2.2 * mm
    gap = 0.8 * mm
    for i, (x, y) in enumerate(points):
        prev_x, prev_y = points[(i - 1) % 6]
        next_x, next_y = points[(i + 1) % 6]
        for tx, ty in ((prev_x, prev_y), (next_x, next_y)):
            vx, vy = tx - x, ty - y
            length = math.hypot(vx, vy)
            ux, uy = vx / length, vy / length
            c.line(x + ux * gap, y + uy * gap, x + ux * (gap + mark), y + uy * (gap + mark))
    c.restoreState()


def draw_terrain_icon(c: canvas.Canvas, terrain: str, cx: float, cy: float) -> None:
    c.saveState()
    c.setStrokeColor(white)
    c.setFillColor(white)
    c.setLineWidth(0.65 * mm)
    c.setLineCap(1)
    c.setLineJoin(1)
    if terrain == "pampa":
        for dx, lean in ((-4, -1.4), (0, 0.8), (4, 1.4)):
            x = cx + dx * mm
            c.line(x, cy - 4 * mm, x + lean * mm, cy + 3.5 * mm)
            c.line(x + lean * 0.45 * mm, cy, x + (lean + 2.2) * mm, cy + 1.5 * mm)
    elif terrain == "monte":
        c.circle(cx - 3.5 * mm, cy + 1.2 * mm, 3.3 * mm, stroke=0, fill=1)
        c.circle(cx + 0.2 * mm, cy + 2.5 * mm, 4.1 * mm, stroke=0, fill=1)
        c.circle(cx + 4.0 * mm, cy + 0.9 * mm, 3.2 * mm, stroke=0, fill=1)
        c.setLineWidth(1.2 * mm)
        c.line(cx, cy - 4.2 * mm, cx + 0.4 * mm, cy + 0.6 * mm)
    elif terrain == "sierra":
        p = c.beginPath()
        p.moveTo(cx - 8 * mm, cy - 4 * mm)
        p.lineTo(cx - 2.5 * mm, cy + 4 * mm)
        p.lineTo(cx + 0.2 * mm, cy)
        p.lineTo(cx + 3.5 * mm, cy + 5 * mm)
        p.lineTo(cx + 8 * mm, cy - 4 * mm)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    else:
        c.rect(cx - 6 * mm, cy - 3.8 * mm, 12 * mm, 7.5 * mm, stroke=1, fill=0)
        roof = c.beginPath()
        roof.moveTo(cx - 7.5 * mm, cy + 3.7 * mm)
        roof.lineTo(cx, cy + 8 * mm)
        roof.lineTo(cx + 7.5 * mm, cy + 3.7 * mm)
        roof.close()
        c.drawPath(roof, stroke=1, fill=0)
        c.rect(cx - 1.5 * mm, cy - 3.8 * mm, 3 * mm, 4.5 * mm, stroke=1, fill=0)
    c.restoreState()


def draw_tile(c: canvas.Canvas, tile: Tile, cx: float, cy: float, variant: int) -> None:
    outer = path_from_points(c, hex_points(cx, cy, OUTER_WIDTH))
    cut = path_from_points(c, hex_points(cx, cy, CUT_WIDTH))
    dark, accent = COLORS[tile.terrain]

    # La imagen ocupa hasta la zona de sangrado.
    c.saveState()
    c.clipPath(outer, stroke=0, fill=0)
    image = ImageReader(str(ART[tile.terrain]))
    # El tablero jugable repite el mismo encuadre por terreno. La impresión
    # conserva exactamente esa composición, sin variaciones de zoom o paneo.
    art_side = OUTER_HEIGHT
    c.drawImage(
        image,
        cx - art_side / 2,
        cy - art_side / 2,
        art_side,
        art_side,
        preserveAspectRatio=True,
        mask="auto",
    )
    # Vignette sutil para legibilidad sin destruir la ilustración.
    c.setFillColor(dark)
    c.setFillAlpha(0.07 if tile.terrain in {"pampa", "monte"} else 0.14)
    c.drawPath(outer, stroke=0, fill=1)
    c.restoreState()

    # Bordes vectoriales: sangrado, corte e interior de seguridad.
    c.saveState()
    c.setStrokeColor(Color(1, 1, 1, alpha=0.58))
    c.setLineWidth(CUT_WIDTH * 0.0175)
    c.drawPath(cut, stroke=1, fill=0)
    c.setStrokeColor(dark)
    c.setLineWidth(CUT_WIDTH * 0.008)
    c.drawPath(cut, stroke=1, fill=0)
    inner = path_from_points(c, hex_points(cx, cy, CUT_WIDTH * 0.946667))
    c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.72))
    c.setLineWidth(CUT_WIDTH * 0.004667)
    c.drawPath(inner, stroke=1, fill=0)
    c.restoreState()

    draw_crop_marks(c, cx, cy)


def build_tiles() -> list[Tile]:
    tiles = [Tile("pampa", "Pampa") for _ in range(12)]
    tiles += [Tile("monte", "Monte") for _ in range(12)]
    tiles += [Tile("sierra", "Sierra") for _ in range(12)]
    tiles += [Tile("pulperia", "Pulpería")]
    return tiles


def build_duel_cards() -> list[DuelCard]:
    return [
        DuelCard(terrain, value)
        for terrain in ("pampa", "monte", "sierra")
        for value in range(1, 13)
    ]


def prepare_card_art() -> dict[str, Path]:
    """Separa los cinco frentes y los amplía sin alterar diseño ni textos."""
    if not CARD_SHEET.exists():
        raise FileNotFoundError(f"Falta la lámina de cartas: {CARD_SHEET}")
    CARD_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(CARD_SHEET).convert("RGB")
    assets: dict[str, Path] = {}
    for name, box in CARD_CROPS.items():
        crop = sheet.crop(box)
        crop = crop.resize(
            (crop.width * 4, crop.height * 4),
            Image.Resampling.LANCZOS,
        ).filter(ImageFilter.UnsharpMask(radius=1.0, percent=70, threshold=2))
        path = CARD_ASSET_DIR / f"naturaleza-{name}-frente.png"
        crop.save(path, format="PNG", optimize=True)
        assets[name] = path
    return assets


def prepare_card_back() -> Path:
    """Recorta el margen blanco del reverso sin alterar su composición."""
    if not CARD_BACK_SOURCE.exists():
        raise FileNotFoundError(f"Falta el reverso de cartas: {CARD_BACK_SOURCE}")
    CARD_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(CARD_BACK_SOURCE).convert("RGB")
    back = source.crop(CARD_BACK_CROP).filter(
        ImageFilter.UnsharpMask(radius=0.7, percent=45, threshold=2)
    )
    path = CARD_ASSET_DIR / "naturaleza-reverso.png"
    back.save(path, format="PNG", optimize=True)
    return path


def draw_card(c: canvas.Canvas, art: Path, cx: float, cy: float) -> None:
    x = cx - CARD_WIDTH / 2
    y = cy - CARD_HEIGHT / 2
    c.drawImage(
        ImageReader(str(art)),
        x,
        y,
        CARD_WIDTH,
        CARD_HEIGHT,
        preserveAspectRatio=False,
        mask="auto",
    )
    c.saveState()
    c.setStrokeColor(HexColor("#3A2A1E"))
    c.setLineWidth(0.15 * mm)
    c.rect(x, y, CARD_WIDTH, CARD_HEIGHT, stroke=1, fill=0)
    c.restoreState()


def draw_duel_card(c: canvas.Canvas, card: DuelCard, cx: float, cy: float) -> None:
    draw_card(c, DUEL_ART[card.terrain], cx, cy)
    font_size = 19 if card.value < 10 else 17
    medallion_center_y = cy + CARD_HEIGHT / 2 - 8.2 * mm
    c.saveState()
    c.setFillColor(HexColor("#3A1D0A"))
    c.setFont("Times-Bold", font_size)
    c.drawCentredString(
        cx,
        medallion_center_y - font_size * 0.34,
        str(card.value),
    )
    c.restoreState()


def draw_duel_back(c: canvas.Canvas, art: Path, cx: float, cy: float) -> None:
    draw_card(c, art, cx, cy)
    x = cx - CARD_WIDTH / 2
    y = cy - CARD_HEIGHT / 2
    c.saveState()
    c.setFillColor(Color(0.97, 0.82, 0.48, alpha=0.96))
    c.setStrokeColor(HexColor("#4A260C"))
    c.setLineWidth(0.35 * mm)
    c.roundRect(x + 17 * mm, y + 39 * mm, 26 * mm, 6.2 * mm, 2.2 * mm, stroke=1, fill=1)
    c.setFillColor(HexColor("#3A1D0A"))
    c.setFont("Times-Bold", 7.2)
    c.drawCentredString(cx, y + 41.0 * mm, "DUELO")
    c.restoreState()


def draw_card_sheet_marks(c: canvas.Canvas, page_no: int, pages: int, reverse: bool = False) -> None:
    c.saveState()
    c.setFillColor(HexColor("#2F2922"))
    c.setFont("Helvetica-Bold", 6.1)
    side = "REVERSOS" if reverse else "FRENTES"
    c.drawString(8 * mm, PAGE_H - 5.2 * mm, f"PAMPA BRAVA · CARTAS DE NATURALEZA · {side} · 60 x 91 mm · IMPRIMIR AL 100 %")
    c.setFont("Helvetica", 6.2)
    c.drawRightString(PAGE_W - 8 * mm, PAGE_H - 5.2 * mm, f"HOJA {page_no}/{pages}")
    y = 4.2 * mm
    x = (PAGE_W - 50 * mm) / 2
    c.setStrokeColor(HexColor("#2F2922"))
    c.setLineWidth(0.18 * mm)
    c.line(x, y, x + 50 * mm, y)
    c.line(x, y - 1.2 * mm, x, y + 1.2 * mm)
    c.line(x + 50 * mm, y - 1.2 * mm, x + 50 * mm, y + 1.2 * mm)
    c.setFont("Helvetica", 5.8)
    c.drawCentredString(PAGE_W / 2, y + 1.5 * mm, "CONTROL: ESTA LÍNEA DEBE MEDIR 50 mm")
    c.restoreState()


def draw_duel_sheet_marks(c: canvas.Canvas, page_no: int, pages: int, reverse: bool = False) -> None:
    c.saveState()
    c.setFillColor(HexColor("#2F2922"))
    c.setFont("Helvetica-Bold", 6.1)
    side = "REVERSOS" if reverse else "FRENTES"
    c.drawString(8 * mm, PAGE_H - 5.2 * mm, f"PAMPA BRAVA · NAIPES DE DUELO · {side} · 60 x 91 mm · IMPRIMIR AL 100 %")
    c.setFont("Helvetica", 6.2)
    c.drawRightString(PAGE_W - 8 * mm, PAGE_H - 5.2 * mm, f"HOJA {page_no}/{pages}")
    y = 4.2 * mm
    x = (PAGE_W - 50 * mm) / 2
    c.setStrokeColor(HexColor("#2F2922"))
    c.setLineWidth(0.18 * mm)
    c.line(x, y, x + 50 * mm, y)
    c.line(x, y - 1.2 * mm, x, y + 1.2 * mm)
    c.line(x + 50 * mm, y - 1.2 * mm, x + 50 * mm, y + 1.2 * mm)
    c.setFont("Helvetica", 5.8)
    c.drawCentredString(PAGE_W / 2, y + 1.5 * mm, "CONTROL: ESTA LÍNEA DEBE MEDIR 50 mm")
    c.restoreState()


def card_positions(count: int) -> list[tuple[float, float]]:
    rows = math.ceil(count / 3)
    grid_height = rows * CARD_HEIGHT + (rows - 1) * CARD_GAP
    top = (PAGE_H + grid_height) / 2
    positions: list[tuple[float, float]] = []
    remaining = count
    for row in range(rows):
        in_row = min(3, remaining)
        row_width = in_row * CARD_WIDTH + (in_row - 1) * CARD_GAP
        left = (PAGE_W - row_width) / 2
        cy = top - CARD_HEIGHT / 2 - row * (CARD_HEIGHT + CARD_GAP)
        for col in range(in_row):
            cx = left + CARD_WIDTH / 2 + col * (CARD_WIDTH + CARD_GAP)
            positions.append((cx, cy))
        remaining -= in_row
    return positions


def draw_sheet_marks(c: canvas.Canvas, page_no: int, pages: int) -> None:
    c.saveState()
    c.setFillColor(HexColor("#2F2922"))
    c.setFont("Helvetica-Bold", 6.4)
    c.drawString(8 * mm, PAGE_H - 5.2 * mm, "PAMPA BRAVA · HEXÁGONOS · 55 mm · IMPRIMIR AL 100 %")
    c.setFont("Helvetica", 6.2)
    c.drawRightString(PAGE_W - 8 * mm, PAGE_H - 5.2 * mm, f"HOJA {page_no}/{pages}")
    y = 4.2 * mm
    x = (PAGE_W - 50 * mm) / 2
    c.setStrokeColor(HexColor("#2F2922"))
    c.setLineWidth(0.18 * mm)
    c.line(x, y, x + 50 * mm, y)
    c.line(x, y - 1.2 * mm, x, y + 1.2 * mm)
    c.line(x + 50 * mm, y - 1.2 * mm, x + 50 * mm, y + 1.2 * mm)
    c.setFillColor(HexColor("#2F2922"))
    c.setFont("Helvetica", 5.8)
    c.drawCentredString(PAGE_W / 2, y + 1.5 * mm, "CONTROL: ESTA LÍNEA DEBE MEDIR 50 mm")
    c.restoreState()


def main() -> None:
    missing = [str(path) for path in [*ART.values(), *DUEL_ART.values()] if not path.exists()]
    if missing:
        raise FileNotFoundError("Faltan ilustraciones: " + ", ".join(missing))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    card_art = prepare_card_art()
    card_back = prepare_card_back()
    tiles = build_tiles()
    duel_cards = build_duel_cards()
    duel_page_groups = [duel_cards[index : index + 9] for index in range(0, len(duel_cards), 9)]
    per_page = 9
    tile_pages = math.ceil(len(tiles) / per_page)
    nature_pages = len(CARD_PAGE_GROUPS) * 2
    duel_pages = len(duel_page_groups) * 2
    pages = tile_pages + nature_pages + duel_pages
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    pdf.setTitle("Pampa Brava - Componentes para impresión")
    pdf.setAuthor("Pampa Brava")
    pdf.setSubject("Losetas físicas, 35 cartas de naturaleza y 36 naipes de duelo con reversos")

    grid_width = 3 * OUTER_WIDTH + 2 * COL_GAP
    grid_height = 3 * OUTER_HEIGHT + 2 * ROW_GAP
    left = (PAGE_W - grid_width) / 2
    bottom = (PAGE_H - grid_height) / 2
    centers_x = [
        left + OUTER_WIDTH / 2 + col * (OUTER_WIDTH + COL_GAP)
        for col in range(3)
    ]
    centers_y = [
        bottom + grid_height - OUTER_HEIGHT / 2 - row * (OUTER_HEIGHT + ROW_GAP)
        for row in range(3)
    ]

    for page_idx in range(tile_pages):
        draw_sheet_marks(pdf, page_idx + 1, pages)
        page_tiles = tiles[page_idx * per_page : (page_idx + 1) * per_page]
        for slot, tile in enumerate(page_tiles):
            if len(page_tiles) == 1:
                cx, cy = PAGE_W / 2, PAGE_H / 2
            else:
                row, col = divmod(slot, 3)
                cx, cy = centers_x[col], centers_y[row]
            draw_tile(pdf, tile, cx, cy, page_idx * per_page + slot)
        pdf.showPage()

    for card_page_idx, cards in enumerate(CARD_PAGE_GROUPS):
        front_page_no = tile_pages + card_page_idx * 2 + 1
        back_page_no = front_page_no + 1
        positions = card_positions(len(cards))

        draw_card_sheet_marks(pdf, front_page_no, pages)
        for name, (cx, cy) in zip(cards, positions):
            draw_card(pdf, card_art[name], cx, cy)
        pdf.showPage()

        draw_card_sheet_marks(pdf, back_page_no, pages, reverse=True)
        for cx, cy in positions:
            draw_card(pdf, card_back, cx, cy)
        pdf.showPage()

    duel_start_page = tile_pages + nature_pages
    for duel_page_idx, cards in enumerate(duel_page_groups):
        front_page_no = duel_start_page + duel_page_idx * 2 + 1
        back_page_no = front_page_no + 1
        positions = card_positions(len(cards))

        draw_duel_sheet_marks(pdf, front_page_no, pages)
        for card, (cx, cy) in zip(cards, positions):
            draw_duel_card(pdf, card, cx, cy)
        pdf.showPage()

        draw_duel_sheet_marks(pdf, back_page_no, pages, reverse=True)
        for cx, cy in positions:
            draw_duel_back(pdf, card_back, cx, cy)
        pdf.showPage()

    pdf.save()
    print(OUTPUT)
    card_count = sum(len(group) for group in CARD_PAGE_GROUPS)
    print(
        f"losetas={len(tiles)} cartas_naturaleza={card_count} reversos_naturaleza={card_count} "
        f"naipes_duelo={len(duel_cards)} reversos_duelo={len(duel_cards)} paginas={pages} "
        "corte_hex_mm=55 cartas_mm=60x91 sangrado_hex_mm=3"
    )


if __name__ == "__main__":
    main()

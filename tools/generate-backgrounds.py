"""Cartoon platformer backgrounds — Trisy tower (14 poschodí)."""
from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

W, H = 480, 1440
HD_SCALE = 2  # render 2×, downscale → ostrejšie pozadie
OUT = Path(__file__).resolve().parent.parent / "assets"
OUTLINE = (42, 58, 72)

THEMES: dict[str, dict] = {
    "forest": {
        "sky": ["#5eb8f0", "#87ceeb", "#b8e8ff", "#d4f1ff"],
        "far": "#7ec8e8",
        "mid": "#3d8b5a",
        "peak": "#2d6b42",
        "ground": "#4a9e4a",
        "seed": 11,
        "props": "jungle",
    },
    "ice": {
        "sky": ["#7eb8e0", "#b8dcf5", "#e8f4ff", "#ffffff"],
        "far": "#a8cce8",
        "mid": "#6a9ab8",
        "peak": "#8aa4be",
        "ground": "#c8e8f8",
        "seed": 22,
        "props": "ice",
    },
    "hell": {
        "sky": ["#4a1010", "#c83810", "#fb923c", "#fde68a"],
        "far": "#8a4020",
        "mid": "#5c1818",
        "peak": "#3a1010",
        "ground": "#7f1d1d",
        "seed": 33,
        "props": "hell",
    },
    "space": {
        "sky": ["#080018", "#281868", "#482898", "#6d28d9"],
        "far": "#382070",
        "mid": "#1e1b4b",
        "peak": "#312e81",
        "ground": "#4338ca",
        "seed": 44,
        "props": "space",
    },
    "desert": {
        "sky": ["#5eb0e8", "#87ceeb", "#fde68a", "#fef3c7"],
        "far": "#e8c878",
        "mid": "#c87830",
        "peak": "#a06020",
        "ground": "#d97706",
        "seed": 55,
        "props": "desert",
    },
    "ocean": {
        "sky": ["#38bdf8", "#7dd3fc", "#bae6fd", "#e0f2fe"],
        "far": "#60a5fa",
        "mid": "#0369a1",
        "peak": "#0c4a6e",
        "ground": "#0284c7",
        "seed": 66,
        "props": "ocean",
    },
    "cave": {
        "sky": ["#2a2826", "#44403c", "#57534e", "#78716c"],
        "far": "#57534e",
        "mid": "#44403c",
        "peak": "#292524",
        "ground": "#3d3835",
        "seed": 77,
        "props": "cave",
    },
    "clouds": {
        "sky": ["#38bdf8", "#7dd3fc", "#bae6fd", "#ffffff"],
        "far": "#93c5fd",
        "mid": "#60a5fa",
        "peak": "#3b82f6",
        "ground": "#bfdbfe",
        "seed": 88,
        "props": "clouds",
    },
    "swamp": {
        "sky": ["#5eb8a0", "#86efac", "#bbf7d0", "#dcfce7"],
        "far": "#6ee7a0",
        "mid": "#166534",
        "peak": "#14532d",
        "ground": "#22c55e",
        "seed": 99,
        "props": "swamp",
    },
    "city": {
        "sky": ["#1e293b", "#334155", "#6366f1", "#818cf8"],
        "far": "#475569",
        "mid": "#1e293b",
        "peak": "#0f172a",
        "ground": "#334155",
        "seed": 101,
        "props": "city",
    },
    "candy": {
        "sky": ["#fce7f3", "#f9a8d4", "#fbcfe8", "#ffffff"],
        "far": "#fda4af",
        "mid": "#f472b6",
        "peak": "#ec4899",
        "ground": "#fb7185",
        "seed": 112,
        "props": "candy",
    },
    "rainbow": {
        "sky": ["#6366f1", "#a855f7", "#f472b6", "#fde047"],
        "far": "#c084fc",
        "mid": "#7c3aed",
        "peak": "#6d28d9",
        "ground": "#e879f9",
        "seed": 123,
        "props": "rainbow",
    },
    "crystal": {
        "sky": ["#5eead4", "#99f6e4", "#ccfbf1", "#f0fdfa"],
        "far": "#5eead4",
        "mid": "#0d9488",
        "peak": "#0f766e",
        "ground": "#14b8a6",
        "seed": 134,
        "props": "crystal",
    },
    "gold": {
        "sky": ["#5eb8f0", "#fde047", "#fef08a", "#fef9c3"],
        "far": "#fcd34d",
        "mid": "#ca8a04",
        "peak": "#a16207",
        "ground": "#eab308",
        "seed": 145,
        "props": "gold",
    },
}


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_color(c1: str, c2: str, t: float) -> tuple[int, int, int]:
    r1, g1, b1 = hex_rgb(c1)
    r2, g2, b2 = hex_rgb(c2)
    return int(lerp(r1, r2, t)), int(lerp(g1, g2, t)), int(lerp(b1, b2, t))


def sky_at(sky: list[str], t: float) -> tuple[int, int, int]:
    stops = [0.0, 0.35, 0.7, 1.0]
    if t <= stops[1]:
        return lerp_color(sky[0], sky[1], t / stops[1])
    if t <= stops[2]:
        return lerp_color(sky[1], sky[2], (t - stops[1]) / (stops[2] - stops[1]))
    return lerp_color(sky[2], sky[3], (t - stops[2]) / (stops[3] - stops[2]))


def hill_y(x: float, seed: float, amp: float) -> float:
    return amp * (0.5 + 0.3 * math.sin(x * 0.04 + seed) + 0.2 * math.sin(x * 0.08 + seed * 1.5))


def draw_sky(img: Image.Image, sky: list[str]) -> None:
    iw, ih = img.size
    px = img.load()
    for y in range(ih):
        c = sky_at(sky, y / (ih - 1))
        for x in range(iw):
            px[x, y] = c


def stroke_poly(draw: ImageDraw.ImageDraw, pts: list[tuple[int, int]], width: int = 3) -> None:
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        draw.line([a, b], fill=OUTLINE, width=width)


def cartoon_cloud(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float) -> None:
    r = int(32 * scale)
    blobs = [
        (cx - r, cy - r // 3, cx + r, cy + r // 2),
        (cx - r - r // 2, cy, cx - r // 4, cy + r),
        (cx + r // 4, cy - r // 6, cx + r + r // 2, cy + r),
        (cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 4),
    ]
    for box in blobs:
        draw.ellipse(box, fill="#ffffff")
    draw.ellipse((cx - r, cy + r // 4, cx + r, cy + r), fill="#c8d8e8")
    for box in blobs:
        draw.ellipse(box, outline=OUTLINE, width=3)
    draw.arc((cx - r - 4, cy + r // 3, cx + r + 4, cy + r + 8), 0, 180, fill=OUTLINE, width=3)


def draw_far_hills(draw: ImageDraw.ImageDraw, color: str, y_base: int, amp: int, seed: float) -> None:
    pts: list[tuple[int, int]] = [(0, H)]
    for x in range(0, W + 1, 4):
        y = y_base - int(hill_y(x, seed, amp))
        pts.append((x, y))
    pts.append((W, H))
    draw.polygon(pts, fill=color, outline=OUTLINE)


def draw_mountain_peak(draw: ImageDraw.ImageDraw, cx: int, base: int, w: int, h: int, fill: str) -> None:
    pts = [(cx - w, base), (cx, base - h), (cx + w, base)]
    draw.polygon(pts, fill=fill, outline=OUTLINE, width=3)
    snow = [(cx - w // 3, base - h // 2), (cx, base - h), (cx + w // 3, base - h // 2)]
    if h > 80:
        draw.polygon(snow, fill="#ffffff", outline=OUTLINE, width=2)


def draw_palm(draw: ImageDraw.ImageDraw, x: int, base: int) -> None:
    draw.rounded_rectangle((x - 5, base - 55, x + 5, base), radius=3, fill="#8B5A2B", outline=OUTLINE, width=2)
    for angle in [-60, -30, 0, 30, 60]:
        rad = math.radians(angle - 90)
        ex = x + int(math.cos(rad) * 38)
        ey = base - 55 + int(math.sin(rad) * 28)
        draw.line([(x, base - 50), (ex, ey)], fill="#2d8a40", width=8)
    draw.ellipse((x - 6, base - 62, x + 6, base - 50), fill="#3d9958", outline=OUTLINE, width=2)


def draw_bush(draw: ImageDraw.ImageDraw, x: int, y: int, r: int) -> None:
    draw.ellipse((x - r, y - r, x + r, y + r), fill="#3d9958", outline=OUTLINE, width=2)


def _sw(w: int) -> int:
    return max(1, round(w * HD_SCALE))


def _hill_profile(x: float, seed: float, amp: float) -> float:
    return amp * (
        0.42
        + 0.28 * math.sin(x * 0.028 + seed)
        + 0.18 * math.sin(x * 0.061 + seed * 1.7)
        + 0.12 * math.sin(x * 0.013 + seed * 0.4)
    )


def draw_hill_layer_hd(
    draw: ImageDraw.ImageDraw,
    img: Image.Image,
    y_base: int,
    amp: int,
    seed: float,
    fill: str,
    shade: str,
    outline_w: int = 2,
) -> None:
    """Vlnité kopce s jemným tieňom na svahu."""
    s = HD_SCALE
    w, h = img.size
    pts: list[tuple[int, int]] = [(0, h)]
    step = max(2, 3 * s)
    crest: list[tuple[int, int]] = []
    for x in range(0, w + 1, step):
        y = y_base - int(_hill_profile(x / s, seed, amp * s))
        pts.append((x, y))
        crest.append((x, y))
    pts.append((w, h))
    draw.polygon(pts, fill=fill)

    # jemný svetelný pás na hrebeni kopca
    for i in range(len(crest) - 1):
        x0, y0 = crest[i]
        x1, y1 = crest[i + 1]
        draw.line([(x0, y0), (x1, y1)], fill=shade, width=_sw(2))

    # obrys len po hrebeni kopca (nie spodná hrana)
    for i in range(len(crest) - 1):
        x0, y0 = crest[i]
        x1, y1 = crest[i + 1]
        draw.line([(x0, y0), (x1, y1)], fill=OUTLINE, width=_sw(outline_w))


def draw_soft_cloud_hd(draw: ImageDraw.ImageDraw, cx: int, cy: int, scale: float) -> None:
    s = HD_SCALE
    r = int(34 * scale * s)
    blobs = [
        (cx - r, cy - r // 3, cx + r, cy + r // 2),
        (cx - r - r // 2, cy + r // 8, cx - r // 5, cy + r),
        (cx + r // 5, cy - r // 5, cx + r + r // 2, cy + r),
        (cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 5),
    ]
    for box in blobs:
        draw.ellipse(box, fill="#ffffff")
    draw.ellipse((cx - r, cy + r // 4, cx + r, cy + r), fill="#d8e8f4")
    for box in blobs:
        draw.ellipse(box, outline=OUTLINE, width=_sw(2))


def draw_round_tree_hd(
    draw: ImageDraw.ImageDraw,
    x: int,
    ground_y: int,
    scale: float = 1.0,
    lean: float = 0.0,
) -> None:
    """Listnatý strom — trup + vrstvená koruna."""
    s = HD_SCALE
    sc = scale * s
    trunk_w = int(9 * sc)
    trunk_h = int(52 * sc)
    lean_px = int(lean * sc)
    tx = x + lean_px
    ty = ground_y

    # tieň
    draw.ellipse(
        (tx - int(14 * sc), ty - int(4 * sc), tx + int(14 * sc), ty + int(5 * sc)),
        fill="#1a4a28",
    )

    # kmeň s gradientom (svetlejší pruh vľavo)
    draw.rounded_rectangle(
        (tx - trunk_w // 2, ty - trunk_h, tx + trunk_w // 2, ty),
        radius=int(3 * sc),
        fill="#6b4423",
        outline=OUTLINE,
        width=_sw(2),
    )
    draw.rounded_rectangle(
        (tx - trunk_w // 2 + int(2 * sc), ty - trunk_h, tx - trunk_w // 2 + int(4 * sc), ty - int(4 * sc)),
        radius=int(2 * sc),
        fill="#8b5a3c",
    )

    crown_cy = ty - trunk_h - int(8 * sc)
    layers = [
        (int(30 * sc), "#2d7a45", 0),
        (int(26 * sc), "#3d9958", -int(6 * sc)),
        (int(22 * sc), "#4aad62", -int(12 * sc)),
        (int(16 * sc), "#5cd675", -int(18 * sc)),
    ]
    for r, col, dy in layers:
        draw.ellipse(
            (tx - r + lean_px // 2, crown_cy - r + dy, tx + r + lean_px // 2, crown_cy + r + dy),
            fill=col,
            outline=OUTLINE,
            width=_sw(2),
        )
    # svetelný odlesk
    draw.ellipse(
        (tx - int(10 * sc), crown_cy - int(22 * sc), tx - int(2 * sc), crown_cy - int(10 * sc)),
        fill="#7aea74",
    )


def draw_pine_tree_hd(draw: ImageDraw.ImageDraw, x: int, ground_y: int, scale: float = 1.0) -> None:
    """Jedlej borovicový strom."""
    s = HD_SCALE
    sc = scale * s
    trunk_w = int(7 * sc)
    trunk_h = int(38 * sc)

    draw.ellipse(
        (x - int(12 * sc), ground_y - int(3 * sc), x + int(12 * sc), ground_y + int(4 * sc)),
        fill="#1a4a28",
    )
    draw.rounded_rectangle(
        (x - trunk_w // 2, ground_y - trunk_h, x + trunk_w // 2, ground_y),
        radius=int(2 * sc),
        fill="#5c3d28",
        outline=OUTLINE,
        width=_sw(2),
    )

    tiers = [
        (int(34 * sc), int(28 * sc), "#2a6b3a"),
        (int(28 * sc), int(22 * sc), "#358a48"),
        (int(22 * sc), int(16 * sc), "#3d9958"),
    ]
    base = ground_y - trunk_h
    for i, (half_w, half_h, col) in enumerate(tiers):
        top = base - half_h - i * int(14 * sc)
        pts = [(x, top - half_h), (x - half_w, top + half_h), (x + half_w, top + half_h)]
        draw.polygon(pts, fill=col, outline=OUTLINE, width=_sw(2))


def generate_forest_hd(data: dict) -> Image.Image:
    """HD les — kopce v hĺbke, len pár stromov."""
    s = HD_SCALE
    w, h = W * s, H * s
    img = Image.new("RGB", (w, h))
    draw_sky(img, data["sky"])
    draw = ImageDraw.Draw(img)

    rng = random.Random(data["seed"])

    # mraky — jemné, nie príliš veľa
    draw_soft_cloud_hd(draw, int(110 * s), int(190 * s), 1.1)
    draw_soft_cloud_hd(draw, int(360 * s), int(260 * s), 0.9)
    draw_soft_cloud_hd(draw, int(230 * s), int(120 * s), 0.65)

    # vrstvy kopcov (diaľka → popredie)
    draw_hill_layer_hd(draw, img, int((H - 310) * s), 38, data["seed"], "#6aabcc", "#8ec4dc", 2)
    draw_hill_layer_hd(draw, img, int((H - 250) * s), 32, data["seed"] + 1.3, "#4a9468", "#62b07e", 2)
    draw_hill_layer_hd(draw, img, int((H - 185) * s), 28, data["seed"] + 2.6, "#358a52", "#48a866", 2)
    draw_hill_layer_hd(draw, img, int((H - 125) * s), 24, data["seed"] + 4.1, "#2d7a45", "#3d9958", 3)

    # len pár stromov — rozložené po šírke, nie hustý les
    tree_base = int((H - 125) * s) - int(8 * s)
    trees = [
        (int(72 * s), 0.95, "round", -0.15),
        (int(175 * s), 1.15, "pine", 0.0),
        (int(310 * s), 1.05, "round", 0.12),
        (int(410 * s), 0.88, "pine", 0.0),
    ]
    for tx, sc, kind, lean in trees:
        ty = tree_base - int(_hill_profile(tx / s, data["seed"] + 4.1, 24 * s))
        if kind == "round":
            draw_round_tree_hd(draw, tx, ty, scale=sc, lean=lean)
        else:
            draw_pine_tree_hd(draw, tx, ty, scale=sc)

    # malé kríky medzi stromami (nie stromy)
    for bx in (int(130 * s), int(250 * s), int(370 * s)):
        by = tree_base - int(_hill_profile(bx / s, data["seed"] + 4.1, 24 * s)) - int(4 * s)
        br = int(rng.randint(8, 11) * s)
        draw.ellipse((bx - br, by - br, bx + br, by + br), fill="#358a52", outline=OUTLINE, width=_sw(2))

    return img.resize((W, H), Image.Resampling.LANCZOS)


def draw_props(props: str, draw: ImageDraw.ImageDraw, data: dict, rng: random.Random) -> None:
    if props == "jungle":
        draw_palm(draw, 55, H - 95)
        draw_palm(draw, W - 55, H - 110)
        draw_bush(draw, 130, H - 88, 14)
        draw_bush(draw, 350, H - 92, 12)
    elif props == "ice":
        draw_mountain_peak(draw, 240, H - 60, 90, 140, data["peak"])
        for cx in [100, 380]:
            draw_mountain_peak(draw, cx, H - 50, 55, 90, data["mid"])
    elif props == "hell":
        draw.rectangle((0, H - 35, W, H), fill="#f97316", outline=OUTLINE, width=2)
        draw_mountain_peak(draw, 120, H - 40, 40, 100, data["peak"])
        draw_mountain_peak(draw, 360, H - 40, 45, 110, data["peak"])
    elif props == "space":
        for i in range(40):
            x, y = rng.randint(0, W), rng.randint(0, H // 2)
            s = rng.choice([2, 2, 3])
            draw.ellipse((x, y, x + s, y + s), fill="#ffffff")
        draw.ellipse((300, 150, 390, 240), fill="#818cf8", outline=OUTLINE, width=3)
    elif props == "desert":
        draw.ellipse((310, 100, 390, 180), fill="#fde047", outline=OUTLINE, width=3)
        draw_palm(draw, W - 70, H - 100)
    elif props == "ocean":
        draw.ellipse((350, 110, 410, 170), fill="#fef08a", outline=OUTLINE, width=2)
        draw.rectangle((0, H - 120, W, H), fill="#0ea5e9", outline=OUTLINE, width=2)
    elif props == "cave":
        for i in range(8):
            cx = i * 62
            draw.polygon([(cx, 0), (cx + 14, 50 + i * 8), (cx - 8, 55)], fill=data["peak"], outline=OUTLINE)
    elif props == "clouds":
        for i in range(6):
            cartoon_cloud(draw, 60 + i * 75, 180 + (i % 3) * 100, 0.8 + (i % 2) * 0.2)
    elif props == "city":
        draw.ellipse((360, 90, 420, 150), fill="#fef9c3", outline=OUTLINE, width=2)
        for bx, bh in [(30, 100), (100, 140), (170, 80), (240, 130), (310, 95), (380, 120)]:
            draw.rectangle((bx, H - bh, bx + 50, H), fill=data["peak"], outline=OUTLINE, width=2)
    elif props == "candy":
        for i, col in enumerate(["#f472b6", "#fde047", "#38bdf8"]):
            cx = 80 + i * 130
            draw.line((cx, 280, cx, 340), fill=OUTLINE, width=4)
            draw.ellipse((cx - 24, 230, cx + 24, 278), fill=col, outline=OUTLINE, width=3)
    elif props == "rainbow":
        colors = ["#ef4444", "#f97316", "#fde047", "#22c55e", "#3b82f6", "#a855f7"]
        for i, col in enumerate(colors):
            draw.arc((20, H - 350 + i * 12, W - 20, H + 60 + i * 12), 200, 340, fill=col, width=8)
    elif props == "crystal":
        for cx in [90, 240, 390]:
            draw.polygon([(cx, H - 130), (cx + 22, H - 80), (cx, H - 55), (cx - 22, H - 80)], fill="#5eead4", outline=OUTLINE, width=3)
    elif props == "gold":
        draw.ellipse((280, 110, 380, 210), fill="#fde047", outline=OUTLINE, width=3)


def generate(deco: str, data: dict) -> None:
    if deco == "forest":
        img = generate_forest_hd(data)
    else:
        img = Image.new("RGB", (W, H))
        draw_sky(img, data["sky"])
        draw = ImageDraw.Draw(img)

        rng = random.Random(data["seed"])

        cartoon_cloud(draw, 120, 220, 1.15)
        cartoon_cloud(draw, 340, 300, 0.95)
        cartoon_cloud(draw, 220, 140, 0.75)

        draw_far_hills(draw, data["far"], H - 280, 35, data["seed"])
        draw_far_hills(draw, data["mid"], H - 200, 28, data["seed"] + 2)
        draw_far_hills(draw, data["ground"], H - 120, 22, data["seed"] + 4)

        draw_mountain_peak(draw, 30, H - 80, 70, 160, data["peak"])
        draw_mountain_peak(draw, W - 30, H - 90, 80, 180, data["peak"])
        draw_mountain_peak(draw, W // 2, H - 70, 100, 120, data["mid"])

        draw_props(data["props"], draw, data, rng)

    out = OUT / f"bg-{deco}.png"
    img.save(out, optimize=True)
    print(f"Wrote {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generuj pozadia pre Trisy Tower")
    parser.add_argument("--only", type=str, help="Generuj len jednu tému (napr. forest)")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    items = THEMES.items()
    if args.only:
        key = args.only.strip().lower()
        if key not in THEMES:
            raise SystemExit(f"Neznáma téma: {key}. Dostupné: {', '.join(THEMES)}")
        items = [(key, THEMES[key])]
    for deco, data in items:
        generate(deco, data)


if __name__ == "__main__":
    main()

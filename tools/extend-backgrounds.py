"""Predĺži pozadia o bezšvové nebo navrchu (480×2880) pre parallax."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

W, FRAME_H, SKY_H = 480, 720, 2160
ASSETS = Path(__file__).resolve().parent.parent / "assets"

SKIES: dict[str, list[str]] = {
    "forest": ["#5eb8f0", "#87ceeb", "#b8e8ff"],
    "ice": ["#7eb8e0", "#b8dcf5", "#e8f4ff"],
    "hell": ["#1a0505", "#7f1d1d", "#fb923c"],
    "space": ["#080018", "#281868", "#482898"],
    "desert": ["#5eb0e8", "#87ceeb", "#fde68a"],
    "ocean": ["#38bdf8", "#7dd3fc", "#bae6fd"],
    "cave": ["#2a2826", "#44403c", "#57534e"],
    "clouds": ["#38bdf8", "#bae6fd", "#ffffff"],
    "swamp": ["#5eb8a0", "#86efac", "#bbf7d0"],
    "city": ["#1e293b", "#334155", "#6366f1"],
    "candy": ["#fce7f3", "#f9a8d4", "#fbcfe8"],
    "rainbow": ["#6366f1", "#a855f7", "#f472b6"],
    "crystal": ["#5eead4", "#99f6e4", "#ccfbf1"],
    "gold": ["#5eb8f0", "#fde047", "#fef9c3"],
}


def hex_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def lerp_color(c1: str, c2: str, t: float) -> tuple[int, int, int]:
    r1, g1, b1 = hex_rgb(c1)
    r2, g2, b2 = hex_rgb(c2)
    return lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t)


def bottom_frame(im: Image.Image) -> Image.Image:
    if im.height >= FRAME_H:
        return im.crop((0, im.height - FRAME_H, W, im.height))
    return im.resize((W, FRAME_H), Image.Resampling.LANCZOS)


def extend(path: Path, sky: list[str]) -> None:
    frame = bottom_frame(Image.open(path))
    total_h = FRAME_H + SKY_H
    out = Image.new("RGB", (W, total_h))
    out.paste(frame, (0, SKY_H))

    top_avg = tuple(
        sum(frame.getpixel((x, 0))[i] for x in range(W)) // W for i in range(3)
    )
    px = out.load()
    c0, c1 = sky[0], sky[1] if len(sky) > 1 else sky[0]
    c2 = sky[2] if len(sky) > 2 else c1

    for y in range(SKY_H):
        t = y / SKY_H
        if t < 0.55:
            col = lerp_color(c0, c1, t / 0.55)
        elif t < 0.88:
            col = lerp_color(c1, c2, (t - 0.55) / 0.33)
        else:
            col = tuple(lerp(col[i], top_avg[i], (t - 0.88) / 0.12) for i in range(3))
        for x in range(W):
            px[x, y] = col

    out.save(path, optimize=True)
    print(f"Wrote {path} ({W}x{total_h})")


def main() -> None:
    for deco, sky in SKIES.items():
        path = ASSETS / f"bg-{deco}.png"
        if path.exists():
            extend(path, sky)


if __name__ == "__main__":
    main()

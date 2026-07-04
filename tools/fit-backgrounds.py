"""Oreže vygenerované pozadia na presných 480×720 — vertikálne, ukotvené dole."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

TW, TH = 480, 720
BASE = Path(__file__).resolve().parent.parent
SRC = BASE.parent / "assets"
OUT = BASE / "assets"

THEMES = [
    "forest", "ice", "hell", "space", "desert", "ocean", "cave", "clouds",
    "swamp", "city", "candy", "rainbow", "crystal", "gold",
]


def fit_portrait(path: Path) -> Image.Image:
    im = Image.open(path)
    sw, sh = im.size
    scale = max(TW / sw, TH / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - TW) // 2)
    top = max(0, nh - TH)
    return im.crop((left, top, left + TW, top + TH))


def main() -> None:
    for deco in THEMES:
        src = SRC / f"bg-v-{deco}.png"
        if not src.exists():
            src = OUT / f"bg-{deco}.png"
        if not src.exists():
            print("MISSING", deco)
            continue
        frame = fit_portrait(src)
        out = OUT / f"bg-{deco}.png"
        frame.save(out, optimize=True)
        print(f"OK {deco} {frame.size} <- {src.name}")


if __name__ == "__main__":
    main()

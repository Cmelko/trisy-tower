"""Oreže pôvodné AI pozadia (bg-*-new) na 480×720 — vertikálne, ukotvené dole."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

TW, TH = 480, 720
BASE = Path(__file__).resolve().parent.parent
PARENT = BASE.parent / "assets"
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


def find_source(deco: str) -> Path | None:
    """Prvá dávka 14 pozadí (bg-*-new), pred neskoršími bg-v regeneráciami."""
    candidates = [
        PARENT / f"bg-{deco}-new.png",
        PARENT / f"bg-{deco}.png",
        PARENT / f"bg-{deco}-gen.png",
        PARENT / f"bg-v-{deco}.png",
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def main() -> None:
    for deco in THEMES:
        src = find_source(deco)
        if not src:
            print("MISSING", deco)
            continue
        frame = fit_portrait(src)
        out = OUT / f"bg-{deco}.png"
        frame.save(out, optimize=True)
        print(f"OK {deco} {frame.size} <- {src.name}")


if __name__ == "__main__":
    main()

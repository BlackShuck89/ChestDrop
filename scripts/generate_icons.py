#!/usr/bin/env python3
"""Render the ChestDrop mimic vector art into Firefox toolbar/application PNG icons.

Requires: pip install cairosvg
The SVG remains the editable source of truth. This script produces reproducible
PNG resources in icons/ that are checked in for loading the extension directly.
"""
from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "branding" / "mimic-logo.svg"
ICONS = ROOT / "icons"
SIZES = (16, 32, 48, 96, 128)

def main():
    ICONS.mkdir(exist_ok=True)
    for size in SIZES:
        dest = ICONS / f"icon-{size}.png"
        cairosvg.svg2png(url=str(SOURCE), write_to=str(dest),
                         output_width=size, output_height=size)
        print(f"Generated {dest.relative_to(ROOT)}")

if __name__ == "__main__":
    main()

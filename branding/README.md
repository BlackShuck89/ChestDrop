# ChestDrop graphic resources

The browser extension uses a mischievous treasure-chest mimic: walnut wood and gold trim, an expressive golden eye, ivory teeth, and a pink tongue. The wordmark uses dark **Chest** and amber **Drop**.

## Checked-in art

- `mimic-logo.svg` — editable simplified vector reconstruction of the approved mascot.
- `icon-master-512.png` — 512px high-resolution brand graphic generated from that SVG.
- `../icons/icon-{16,32,48,96,128}.png` — Firefox toolbar/app icons generated from the same SVG.
- `../scripts/generate_icons.py` — reproducible asset generator (requires `cairosvg`).

CI runs the generator and packages the produced PNGs into an unsigned XPI. Run `python scripts/generate_icons.py` locally to regenerate them.

## Original raster art

The approved high-resolution mascot image and original concept-board mockups were included in the v0.1.3 source/import bundle but have **not** been imported into this GitHub repository. They are different from the SVG-derived version checked in here. Preserve those originals before deleting the downloaded ZIP if you want to commit them separately.

ChestDrop is an independent project and is not affiliated with ImgChest.

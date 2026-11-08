"""Generate the official NACALL Windows icon from the existing Jacall mascot asset.

Source stays in the web brand folder, so the desktop and web share one identity.
Requires Pillow; run during the Windows GitHub Actions build.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / "public" / "brand" / "jacall-avatar.webp"
destination = ROOT / "desktop" / "build" / "icon.ico"
destination.parent.mkdir(parents=True, exist_ok=True)

with Image.open(source) as original:
    image = original.convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS)
    image.save(
        destination,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
print(f"NACALL Windows icon ready: {destination}")

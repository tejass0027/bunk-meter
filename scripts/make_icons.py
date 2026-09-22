"""
One-off script used to generate the app icons for Bunk Meter.
Not needed to run the app — the PNG files it produces are already
committed in /icons. Kept here in case you want to tweak the design.
Run with: python scripts/make_icons.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(BASE_DIR, "icons")
os.makedirs(ICONS_DIR, exist_ok=True)

BG = (20, 184, 130)       # teal/green brand color
BG_DARK = (13, 148, 105)  # darker shade for gradient-ish ring
RING = (255, 255, 255)
CHECK = (255, 255, 255)


def rounded_square(size, radius_ratio=0.22, bg=BG):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg)
    return img, draw


def draw_icon(size, padding_ratio=0.0):
    img, draw = rounded_square(size)
    pad = int(size * padding_ratio)
    cx, cy = size / 2, size / 2

    # progress ring (circle) representing attendance percent
    ring_w = max(2, int(size * 0.055))
    r = size * 0.30
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw.arc(bbox, start=0, end=360, fill=(255, 255, 255, 90), width=ring_w)
    # ~80% progress arc, starting at top (-90deg)
    draw.arc(bbox, start=-90, end=198, fill=RING, width=ring_w)

    # checkmark in the middle
    check_w = max(3, int(size * 0.06))
    x1, y1 = cx - r * 0.42, cy + r * 0.02
    x2, y2 = cx - r * 0.08, cy + r * 0.32
    x3, y3 = cx + r * 0.48, cy - r * 0.30
    draw.line([x1, y1, x2, y2], fill=CHECK, width=check_w, joint="curve")
    draw.line([x2, y2, x3, y3], fill=CHECK, width=check_w, joint="curve")

    return img


def draw_maskable(size):
    # maskable icons need ~safe-zone padding (icon content within inner 80%)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, size, size], fill=BG)
    inner = draw_icon(int(size * 0.7))
    offset = ((size - inner.width) // 2, (size - inner.height) // 2)
    img.paste(inner, offset, inner)
    return img


for s in (192, 512):
    draw_icon(s).save(os.path.join(ICONS_DIR, f"icon-{s}.png"))
    draw_maskable(s).save(os.path.join(ICONS_DIR, f"icon-maskable-{s}.png"))

print("Icons written to", ICONS_DIR)

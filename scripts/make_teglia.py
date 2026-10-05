"""Build square "pizza in teglia" assets from the photoreal topping texture of the round source pizza.

Outputs (assets/img/):
  teglia-top.webp, teglia-top-900.webp   top-down rectangular margherita in teglia (transparent)
  teglia/slice-<row>-<col>.webp          the same pizza cut in 3x2 square slices (transparent)
  crumb-side.webp                        tileable airy crumb texture for the cut sides (3D)

Usage: python3 scripts/make_teglia.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/_src/src-pizza-top.png"
OUT = ROOT / "assets/img"
rng = np.random.default_rng(7)

W, H = 1800, 1200          # canvas
MARGIN = 26                # transparent margin around the pizza
CORNER = 70                # corner radius of the teglia shape
BAND = 92                  # crust band width (compressed real rim)


def value_noise(w, h, cell, octaves=4, persistence=0.5):
    """Smooth multi-octave value noise in [0, 1]."""
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        c = max(2, int(cell / (2 ** o)))
        gw, gh = w // c + 3, h // c + 3
        grid = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8))
        layer = np.asarray(grid.resize((gw * c, gh * c), Image.BICUBIC), np.float32)[:h, :w] / 255.0
        total += layer * amp
        norm += amp
        amp *= persistence
    return total / norm


def rounded_rect_sdf(w, h, x0, y0, x1, y1, r):
    """Signed distance (px) to a rounded rectangle; negative inside."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx, qy = np.abs(xs - cx) - hx, np.abs(ys - cy) - hy
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0))
    inside = np.minimum(np.maximum(qx, qy), 0)
    return outside + inside - r


def topping_texture():
    """Largest 3:2 rectangle of pure topping inside the round pizza, upscaled to the canvas."""
    im = Image.open(SRC).convert("RGB")
    a = Image.open(SRC).split()[-1].point(lambda v: 255 if v > 8 else 0)
    x0, y0, x1, y1 = a.getbbox()
    cx, cy, R = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2
    r = 0.79 * R
    w, h = 2 * r * 0.832, 2 * r * 0.5547          # inscribed 3:2 rectangle
    crop = im.crop((int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2)))
    crop = crop.filter(ImageFilter.MedianFilter(3)).resize((W, H), Image.LANCZOS)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=1.6, percent=35, threshold=3))
    return np.asarray(crop, np.float32) / 255.0


def bilinear(img, xs, ys):
    """Sample an HxWxC float array at fractional coords (edge-clamped)."""
    h, w = img.shape[:2]
    xs = np.clip(xs, 0, w - 1.001); ys = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    fx = (xs - x0)[..., None]; fy = (ys - y0)[..., None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def build_top():
    """Rectangular teglia: real crust unwrapped from the round pizza's rim, mapped along a rounded rectangle."""
    src = np.asarray(Image.open(SRC).convert("RGBA"), np.float32) / 255.0
    # alpha-bleed: push edge colours into the transparent area so bilinear sampling has no dark fringe
    al = src[..., 3:4]
    prem = Image.fromarray((src[..., :3] * al * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    abl = Image.fromarray((al[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    bled = np.asarray(prem, np.float32) / np.maximum(np.asarray(abl, np.float32)[..., None], 1)
    src[..., :3] = np.where(al > 0.98, src[..., :3], np.clip(bled, 0, 1))
    a = Image.open(SRC).split()[-1].point(lambda v: 255 if v > 8 else 0)
    bx0, by0, bx1, by1 = a.getbbox()
    cx, cy, R = (bx0 + bx1) / 2, (by0 + by1) / 2, (bx1 - bx0) / 2

    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    px, py = xs - W / 2, ys - H / 2
    hx, hy = W / 2 - MARGIN - CORNER, H / 2 - MARGIN - CORNER     # straight half-lengths
    qx, qy = np.abs(px) - hx, np.abs(py) - hy
    d_out = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - CORNER
    d_in = -d_out                                                   # px inside the outline

    # arc-length position s along the outline (clockwise from the top-left end of the top edge)
    arc = CORNER * np.pi / 2
    seg = [2 * hx, arc, 2 * hy, arc, 2 * hx, arc, 2 * hy, arc]
    off = np.cumsum([0] + seg[:-1])
    P = float(sum(seg))
    s = np.zeros_like(px)
    corner = (qx > 0) & (qy > 0)
    top = (~corner) & (py < 0) & (qy >= qx); bottom = (~corner) & (py >= 0) & (qy >= qx)
    right = (~corner) & (px >= 0) & (qx > qy); left = (~corner) & (px < 0) & (qx > qy)
    s[top] = off[0] + (px[top] + hx)
    s[right] = off[2] + (py[right] + hy)
    s[bottom] = off[4] + (hx - px[bottom])
    s[left] = off[6] + (hy - py[left])
    ang = np.arctan2(qy, qx)                                         # 0..pi/2 inside a corner quadrant
    tr = corner & (px >= 0) & (py < 0); br = corner & (px >= 0) & (py >= 0)
    bl = corner & (px < 0) & (py >= 0); tl = corner & (px < 0) & (py < 0)
    s[tr] = off[1] + (np.pi / 2 - ang[tr]) * CORNER
    s[br] = off[3] + ang[br] * CORNER
    s[bl] = off[5] + (np.pi / 2 - ang[bl]) * CORNER
    s[tl] = off[7] + ang[tl] * CORNER

    # map (s, depth) -> polar coords on the round pizza: top edge centre <-> top of the rim (theta = -90deg)
    theta = (s - hx) / P * 2 * np.pi - np.pi / 2
    r_out, r_in = 1.035 * R, 0.80 * R                               # include a bit of outside -> natural silhouette
    depth = np.clip(d_in + 14, 0, None)                              # 14px of outside margin in the band
    r = r_out - depth / (BAND + 14) * (r_out - r_in)
    rim = bilinear(src, cx + r * np.cos(theta), cy + r * np.sin(theta))

    # teglia edges bake golden, not leopard-spotted: pull the darkest char toward golden brown
    lum = rim[..., :3].mean(-1, keepdims=True)
    char = np.clip((0.40 - lum) / 0.28, 0, 1) * 0.6
    rim[..., :3] = rim[..., :3] * (1 - char) + np.array([0.68, 0.43, 0.19]) * char

    tex = topping_texture()
    blend = np.clip((d_in - (BAND - 26)) / 26.0, 0, 1)[..., None]   # rim -> topping crossfade
    rgb = rim[..., :3] * (1 - blend) + tex * blend
    alpha = np.where(d_in > BAND - 26, 1.0, np.clip((rim[..., 3] - 0.5) * 2.2 + 0.5, 0, 1)) * np.clip(d_in + 16, 0, 1)
    out = np.dstack([np.clip(rgb, 0, 1), alpha])
    return Image.fromarray((out * 255).astype(np.uint8))


def build_crumb(w=1024, h=300):
    """Tileable side texture: the real cut face of the slice photo, perspective-corrected and mirrored."""
    sl = Image.open(ROOT / "assets/_src/src-slice.png").convert("RGB")
    # quad of the cut face (TL, BL, BR, TR) in source pixels
    quad = (60, 845, 108, 1190, 935, 1650, 975, 1305)
    face = sl.transform((w, h), Image.QUAD, quad, Image.BICUBIC)
    tile = Image.new("RGB", (w * 2, h))
    tile.paste(face, (0, 0)); tile.paste(face.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    return tile.filter(ImageFilter.MedianFilter(3))


def save(im, path, maxside=None, q=84):
    im = im.copy()
    if maxside:
        im.thumbnail((maxside, maxside), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)
    print(path.relative_to(ROOT), im.size, f"{path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    top = build_top()
    save(top, OUT / "teglia-top.webp")
    save(top, OUT / "teglia-top-900.webp", 900, 82)
    # 3x2 square slices (cuts are straight; outer slices keep their crust edges)
    cw, ch = (W - 2 * MARGIN) / 3, (H - 2 * MARGIN) / 2
    for r in range(2):
        for c in range(3):
            box = (int(MARGIN + c * cw) - (MARGIN if c == 0 else 0), int(MARGIN + r * ch) - (MARGIN if r == 0 else 0),
                   int(MARGIN + (c + 1) * cw) + (MARGIN if c == 2 else 0), int(MARGIN + (r + 1) * ch) + (MARGIN if r == 1 else 0))
            save(top.crop(box), OUT / f"teglia/slice-{r}-{c}.webp", 640, 84)
    save(build_crumb(), OUT / "crumb-side.webp", None, 86)

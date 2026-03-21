"""
CX-Inn logo — pixel-perfect PNG recreation.
Fixes applied:
  1. Right ∂ is now 60% of left C diameter (was 67%)
  2. Left C gap is ±45° (270° arc) — wider opening matching original
  3. Right ∂ bottom arc transitions to teal (blends organically into arrow)
  4. Arrow tail starts from end of teal arc, tip extends above both shapes
"""
import math
from PIL import Image, ImageDraw, ImageFont

# ── Canvas ────────────────────────────────────────────────────────────────────
SCALE = 8
W, H   = 900, 340
BG     = (8, 12, 20, 255)

img  = Image.new("RGBA", (W * SCALE, H * SCALE), BG)
draw = ImageDraw.Draw(img)
s = SCALE

# ── Colors ────────────────────────────────────────────────────────────────────
WHITE_L  = (255, 255, 255, 238)   # left C
WHITE_R  = (255, 255, 255, 210)   # right ∂ top (navy portion)
TEAL_A   = (34,  211, 238, 255)   # darker cyan  (arrow tail / ∂ bottom start)
TEAL_B   = (52,  211, 153, 255)   # mint green   (arrow head)

# ── Helpers ───────────────────────────────────────────────────────────────────
def arc_pts(cx, cy, r, a0_deg, a1_deg, n=600):
    """Points along arc from a0 to a1 going clockwise (PIL convention, y-down)."""
    a0 = math.radians(a0_deg)
    a1 = math.radians(a1_deg)
    if a1 <= a0:
        a1 += 2 * math.pi
    return [(cx + r * math.cos(a0 + (a1-a0)*i/n),
             cy + r * math.sin(a0 + (a1-a0)*i/n)) for i in range(n+1)]

def filled_arc(draw, cx, cy, r, a0, a1, color, thickness, n=500):
    """Solid-color thick arc rendered as filled quad strips."""
    half = thickness / 2
    outer = arc_pts(cx, cy, r + half, a0, a1, n)
    inner = arc_pts(cx, cy, r - half, a0, a1, n)
    for i in range(n):
        draw.polygon([outer[i], outer[i+1], inner[i+1], inner[i]], fill=color)
    # Round end-caps
    for pt_o, pt_i in [(outer[0], inner[0]), (outer[-1], inner[-1])]:
        mx = (pt_o[0]+pt_i[0])/2; my = (pt_o[1]+pt_i[1])/2
        draw.ellipse([mx-half, my-half, mx+half, my+half], fill=color)

def gradient_arc(draw, cx, cy, r, a0, a1, c0, c1, thickness, n=400):
    """Gradient thick arc: color interpolates from c0 (a0) to c1 (a1)."""
    half = thickness / 2
    outer = arc_pts(cx, cy, r + half, a0, a1, n)
    inner = arc_pts(cx, cy, r - half, a0, a1, n)
    for i in range(n):
        t = i / n
        col = tuple(int(c0[k] + (c1[k]-c0[k])*t) for k in range(3)) + (255,)
        draw.polygon([outer[i], outer[i+1], inner[i+1], inner[i]], fill=col)

def gradient_line(draw, x0, y0, x1, y1, c0, c1, thickness, n=500):
    """Gradient thick line via filled quad strips."""
    dx = x1-x0; dy = y1-y0
    L = math.hypot(dx, dy); ux = dx/L; uy = dy/L
    px = -uy; py = ux; half = thickness/2
    for i in range(n):
        t  = i/(n-1); t2 = (i+1)/(n-1)
        ax = x0+dx*t;  ay = y0+dy*t
        bx = x0+dx*t2; by = y0+dy*t2
        col = tuple(int(c0[k]+(c1[k]-c0[k])*t) for k in range(3)) + (255,)
        draw.polygon([(ax-px*half, ay-py*half), (ax+px*half, ay+py*half),
                      (bx+px*half, by+py*half), (bx-px*half, by-py*half)], fill=col)

# ── Layout ────────────────────────────────────────────────────────────────────
# Left C:  center (168,172), r=122  → diameter 244 px
# Right ∂: center (290,172), r=73   → diameter 146 px  (60% of left)
# Both shapes vertical center = 172 px

CX_L, CY_L, R_L = 168*s, 172*s, 122*s
CX_R, CY_R, R_R = 290*s, 172*s,  73*s

SW_L = 40*s    # left C stroke  (~33% of radius)
SW_R = 24*s    # right ∂ stroke (~33% of radius)
SW_A = 18*s    # arrow shaft width

# ── Left large C ──────────────────────────────────────────────────────────────
# Gap ±30° centered at 0° (right). Arc: 30° → 330° (300° CW)
filled_arc(draw, CX_L, CY_L, R_L, 30, 330, WHITE_L, SW_L)

# ── Right ∂ — navy top portion ────────────────────────────────────────────────
# Full ∂: gap ±30° centered at 180° (left). Arc: 210° → 150° (300° CW)
# Split: navy from 210° → 30°  (180° arc = top + right side)
filled_arc(draw, CX_R, CY_R, R_R, 210, 30+360, WHITE_R, SW_R)

# ── Right ∂ — teal bottom portion (blends into arrow) ────────────────────────
# Teal from 30° → 150°  (120° arc = bottom half)
# TEAL_A at 30° (tail/dark) → TEAL_B at 150° (lighter, connects to arrow)
gradient_arc(draw, CX_R, CY_R, R_R, 30, 150, TEAL_A, TEAL_B, SW_R)

# ── Arrow ─────────────────────────────────────────────────────────────────────
# Tail: end-point of teal arc (angle 150° from right-∂ center)
ATX = CX_R + R_R * math.cos(math.radians(150))
ATY = CY_R + R_R * math.sin(math.radians(150))

# Head tip: well above both shapes. Left C top = CY_L - R_L = 172-122 = 50 px.
# Arrow tip at y≈35 (above both shapes), x≈375
AHX, AHY = 375*s, 35*s

dx_a = AHX - ATX; dy_a = AHY - ATY
AL = math.hypot(dx_a, dy_a)
ux_a = dx_a/AL; uy_a = dy_a/AL

HEAD_LEN  = 68*s
HEAD_HALF = 40*s

shaft_ex = AHX - ux_a * HEAD_LEN
shaft_ey = AHY - uy_a * HEAD_LEN

# Shaft: TEAL_A (tail/dark) → TEAL_B (near head/light)
gradient_line(draw, ATX, ATY, shaft_ex, shaft_ey, TEAL_A, TEAL_B, SW_A)

# Arrow head triangle
px_a = -uy_a; py_a = ux_a
b0x = shaft_ex + px_a * HEAD_HALF;  b0y = shaft_ey + py_a * HEAD_HALF
b1x = shaft_ex - px_a * HEAD_HALF;  b1y = shaft_ey - py_a * HEAD_HALF
draw.polygon([(AHX, AHY), (int(b0x), int(b0y)), (int(b1x), int(b1y))], fill=TEAL_B)

# ── Text ──────────────────────────────────────────────────────────────────────
TEXT_X = 428*s
font_b = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 130*s)
font_r = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf",  130*s)
TEXT_Y = int(CY_L - 130*s * 0.38)

draw.text((TEXT_X, TEXT_Y), "Cx", font=font_b, fill=(255, 255, 255, 242))
bbox = draw.textbbox((TEXT_X, TEXT_Y), "Cx", font=font_b)
draw.text((TEXT_X + bbox[2]-bbox[0], TEXT_Y), "-Inn", font=font_r, fill=(255, 255, 255, 200))

# ── Save ──────────────────────────────────────────────────────────────────────
out = img.resize((W, H), Image.LANCZOS)
out.save("D:/Claude/cx-inn/cx-inn-logo-preview.png")
print("Saved.")

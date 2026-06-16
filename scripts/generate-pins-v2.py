#!/usr/bin/env python3
"""
Generate Pinterest pins with photo backgrounds.

Usage:
  python3 scripts/generate-pins-v2.py
"""

import os
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

PINS_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/pins"
POSTS_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/posts"
RAW_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/raw"
W, H = 800, 1200
FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
PALETTES = [
    [(255, 244, 238), (255, 231, 219), (235, 212, 198)],
    [(255, 241, 244), (251, 226, 234), (240, 208, 220)],
    [(250, 244, 233), (235, 228, 214), (217, 208, 190)],
    [(244, 247, 242), (227, 236, 225), (203, 218, 206)],
    [(241, 246, 251), (222, 233, 244), (198, 214, 230)],
]

def load_font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except:
        return ImageFont.load_default()

def load_base_image(slug):
    for path in (
        os.path.join(POSTS_DIR, f"{slug}.webp"),
        os.path.join(RAW_DIR, f"{slug}.jpg"),
        os.path.join(RAW_DIR, f"{slug}.jpeg"),
        os.path.join(RAW_DIR, f"{slug}.png"),
        os.path.join(RAW_DIR, f"{slug}.webp"),
    ):
        if os.path.exists(path):
            return Image.open(path).convert("RGBA")
    return None

def abstract_fallback(slug):
    rng = random.Random(slug)
    palette = PALETTES[rng.randrange(len(PALETTES))]
    bg = Image.new("RGBA", (W, H), (*palette[0], 255))
    draw = ImageDraw.Draw(bg)
    for x in range(W):
        t = x / max(1, W - 1)
        color = tuple(int(palette[0][i] * (1 - t) + palette[-1][i] * t) for i in range(3))
        draw.line([(x, 0), (x, H)], fill=(*color, 255))
    for cx_f, cy_f, r_f, idx in [
        (0.20, 0.18, 0.22, 1),
        (0.78, 0.24, 0.18, 2),
        (0.68, 0.76, 0.30, 1),
    ]:
        cx = int(cx_f * W) + rng.randint(-40, 40)
        cy = int(cy_f * H) + rng.randint(-50, 50)
        r = int(min(W, H) * r_f)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx-r, cy-r, cx+r, cy+r], fill=(*palette[idx % len(palette)], 130))
        bg = Image.alpha_composite(bg, layer.filter(ImageFilter.GaussianBlur(radius=r // 3)))
    return bg

def get_photo(slug, variant=1):
    img = load_base_image(slug)
    if img:
        centering = {
            1: (0.62, 0.38),
            2: (0.70, 0.34),
            3: (0.55, 0.42),
        }.get(variant, (0.62, 0.38))
        return ImageOps.fit(img, (W, H), method=Image.Resampling.LANCZOS, centering=centering)
    return abstract_fallback(slug)

def wrap_text(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], []
    for w in words:
        test = " ".join(cur + [w])
        if draw.textbbox((0,0), test, font=font)[2] <= max_w:
            cur.append(w)
        else:
            if cur: lines.append(" ".join(cur))
            cur = [w]
    if cur: lines.append(" ".join(cur))
    return lines

def rounded_rect(draw, xy, r, fill, outline=None, outline_w=0):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0+r, y0, x1-r, y1], fill=fill)
    draw.rectangle([x0, y0+r, x1, y1-r], fill=fill)
    for cx, cy in [(x0,y0),(x1-2*r,y0),(x0,y1-2*r),(x1-2*r,y1-2*r)]:
        draw.ellipse([cx, cy, cx+2*r, cy+2*r], fill=fill)
    if outline and outline_w:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=outline, width=outline_w)

def make_pin(slug, headline, subtitle, bullets, variant, out_path):
    print(f"  Building {os.path.basename(out_path)}...")

    # --- Photo background (top 52% of pin) ---
    photo = get_photo(slug, variant)
    img = Image.new("RGBA", (W, H), (255, 250, 246, 255))

    PHOTO_H = int(H * 0.52)
    if photo:
        photo = photo.resize((W, PHOTO_H), Image.LANCZOS)
        # Darken bottom edge of photo for readability
        fade = Image.new("RGBA", (W, PHOTO_H), (0,0,0,0))
        fd = ImageDraw.Draw(fade)
        for i in range(80):
            alpha = int(140 * (i/80))
            fd.line([(0, PHOTO_H-80+i),(W, PHOTO_H-80+i)], fill=(0,0,0,alpha))
        photo.paste(fade, (0,0), fade)
        img.paste(photo, (0, 0))

    draw = ImageDraw.Draw(img)

    # --- Category badge (top-left on photo) ---
    f_badge = load_font(22)
    badge_text = "MOM BABY PICKS"
    bb = draw.textbbox((0,0), badge_text, font=f_badge)
    bw = bb[2]-bb[0]+28; bh = 36
    bx, by = 28, 28
    rounded_rect(draw, (bx, by, bx+bw, by+bh), 18, (255,255,255,220))
    draw.text((bx+14, by+7), badge_text, font=f_badge, fill=(158,85,77,255))

    # --- White content card (lower 52%) ---
    CARD_TOP = PHOTO_H - 30
    CARD_PAD = 30
    rounded_rect(draw, (0, CARD_TOP, W, H), 32, (255,250,246,255))

    # Pull-tab visual divider
    draw.rounded_rectangle([W//2-28, CARD_TOP+12, W//2+28, CARD_TOP+18], radius=3,
                            fill=(200,180,170,255))

    TEXT_X = CARD_PAD + 10
    TEXT_MAX = W - 2*(CARD_PAD+10)

    # --- Headline ---
    f_title = load_font(56)
    ty = CARD_TOP + 48
    for line in wrap_text(draw, headline, f_title, TEXT_MAX)[:3]:
        draw.text((TEXT_X, ty), line, font=f_title, fill=(47,32,28,255))
        ty += 66

    # --- Subtitle ---
    f_sub = load_font(30)
    ty += 4
    for line in wrap_text(draw, subtitle, f_sub, TEXT_MAX)[:2]:
        draw.text((TEXT_X, ty), line, font=f_sub, fill=(120,95,85,255))
        ty += 40

    # --- Bullet points ---
    if bullets:
        f_bullet = load_font(26)
        ty += 18
        for b in bullets[:3]:
            # Dot
            draw.ellipse([TEXT_X, ty+8, TEXT_X+10, ty+18], fill=(214,112,74,255))
            draw.text((TEXT_X+20, ty), b, font=f_bullet, fill=(80,58,50,255))
            ty += 38

    # --- CTA button ---
    btn_text = "Read the guide  >"
    f_btn = load_font(28)
    bb = draw.textbbox((0,0), btn_text, font=f_btn)
    btn_w = bb[2]-bb[0]+52; btn_h = 52
    btn_x = TEXT_X; btn_y = H - 112
    rounded_rect(draw, (btn_x, btn_y, btn_x+btn_w, btn_y+btn_h), 26, (43,29,24,255))
    draw.text((btn_x+26, btn_y+12), btn_text, font=f_btn, fill=(255,255,255,255))

    # --- URL + year ---
    f_url = load_font(22)
    url_text = "mombabypicks.com"
    yr_text = "2026"
    draw.text((TEXT_X, H-58), url_text, font=f_url, fill=(158,85,77,255))
    bb_yr = draw.textbbox((0,0), yr_text, font=f_url)
    draw.text((W - CARD_PAD - 10 - (bb_yr[2]-bb_yr[0]), H-58),
              yr_text, font=f_url, fill=(175,145,130,255))

    # Save
    final = img.convert("RGB")
    final.save(out_path, "PNG", optimize=True)
    print(f"    Saved: {os.path.basename(out_path)}")


ARTICLES = [
    dict(
        slug="best-bottle-warmers",
        headline="Best Bottle Warmers for Newborns",
        subtitle="Fast, safe picks for 2026 — no hot spots",
        bullets=["Heats in 3–5 minutes", "No microwave needed", "Auto-shutoff safety"],
    ),
    dict(
        slug="best-baby-bouncers-for-2026",
        headline="Best Baby Bouncers 2026",
        subtitle="5 picks from budget to app-controlled",
        bullets=["Battery-free options", "Machine-washable covers", "Up to 29–30 lbs"],
    ),
    dict(
        slug="best-breast-pumps",
        headline="Best Breast Pumps of 2026",
        subtitle="Wearable & electric compared honestly",
        bullets=["Hands-free wearable picks", "Hospital-grade suction", "Insurance-eligible"],
    ),
    dict(
        slug="bottle-warmer-safety-guide",
        headline="Bottle Warmer Safety",
        subtitle="What new parents should know",
        bullets=["Avoid hot spots", "Use safe water levels", "Check bottle temp"],
    ),
    dict(
        slug="breast-pump-cleaning-guide",
        headline="Breast Pump Cleaning Guide",
        subtitle="A busy-mom routine that works",
        bullets=["Sterilize key parts", "Dry fully before use", "Prevent mold build-up"],
    ),
    dict(
        slug="best-baby-sleep-sacks-for-2026",
        headline="Best Baby Sleep Sacks 2026",
        subtitle="TOG ratings, organic fabrics & safe sleep",
        bullets=["From birth to toddler", "Multiple TOG weights", "IHDI hip-healthy options"],
    ),
    dict(
        slug="best-baby-bottles-for-newborns-2026",
        headline="Best Baby Bottles for Newborns",
        subtitle="Anti-colic venting & breast-like nipples",
        bullets=["Works for breastfed babies", "Fewer parts to wash", "BPA-free materials"],
    ),
    dict(
        slug="best-baby-carriers-for-2026",
        headline="Best Baby Carriers 2026",
        subtitle="From wraps to structured — find your fit",
        bullets=["Newborn-ready options", "IHDI hip-healthy picks", "From $32 to $195"],
    ),
    dict(
        slug="how-to-choose-breast-pump",
        headline="How to Choose a Breast Pump",
        subtitle="Wearable vs electric, explained",
        bullets=["Suction matters", "Comfort is key", "Portability changes everything"],
    ),
    dict(
        slug="best-diapers-for-newborns-2026",
        headline="Best Newborn Diapers 2026",
        subtitle="Softness, fit & sensitive skin compared",
        bullets=["Umbilical cord notch", "Fragrance-free options", "Eco & organic picks"],
    ),
    dict(
        slug="best-high-chairs-for-babies-2026",
        headline="Best High Chairs 2026",
        subtitle="From $25 IKEA to grows-to-adult chairs",
        bullets=["Easy to clean tray", "Folds slim for small spaces", "5-point harness safety"],
    ),
    dict(
        slug="best-baby-monitors-long-battery-life",
        headline="Best Baby Monitors — Long Battery",
        subtitle="No-WiFi picks that last through the night",
        bullets=["Private non-WiFi connection", "8–12 hour battery life", "No app required"],
    ),
    dict(
        slug="best-hands-free-wearable-breast-pumps",
        headline="Best Wearable Breast Pumps",
        subtitle="Hands-free pumping while you work or move",
        bullets=["Fits inside nursing bra", "Whisper-quiet motors", "USB-C rechargeable"],
    ),
    dict(
        slug="breastfeeding-essentials",
        headline="Breastfeeding Essentials 2026",
        subtitle="What you actually need from day one",
        bullets=["Nursing pillow", "Nipple cream that works", "Haakaa silicone pump"],
    ),
    dict(
        slug="newborn-essentials-checklist",
        headline="Newborn Essentials Checklist",
        subtitle="Skip the noise — here's what you need",
        bullets=["0–3 month gear only", "Nothing that collects dust", "Budget-friendly picks"],
    ),
    dict(
        slug="newborn-feeding-station",
        headline="How to Set Up a Newborn Feeding Station",
        subtitle="Keep feeding supplies within reach",
        bullets=["Night-feeding ready", "Easy to restock", "Small-space friendly"],
    ),
    dict(
        slug="newborn-feeding-essentials",
        headline="Newborn Feeding Essentials",
        subtitle="Bottles, burp cloths & nursing gear",
        bullets=["8–12 burp cloths minimum", "Slow-flow nipples only", "Haakaa = passive stash"],
    ),
    dict(
        slug="bottle-refusal-breastfed-babies",
        headline="Bottle Refusal: What Works",
        subtitle="Why breastfed babies refuse & how to fix it",
        bullets=["Try when slightly hungry", "Different caregiver feeds", "Breast-like nipple shapes"],
    ),
    dict(
        slug="eco-friendly-baby-gear-guide",
        headline="Eco-Friendly Baby Gear",
        subtitle="Sustainable picks worth buying in 2026",
        bullets=["OEKO-TEX certified fabrics", "Non-toxic silicone", "GOTS organic cotton"],
    ),
    dict(
        slug="pace-bottle-feeding-guide",
        headline="Pace Bottle Feeding Guide",
        subtitle="The technique every breastfed baby needs",
        bullets=["Upright position feeding", "Horizontal bottle angle", "Paced breaks every 30 sec"],
    ),
    dict(
        slug="silicone-baby-feeding-products",
        headline="Best Silicone Baby Products",
        subtitle="Safe, non-toxic gear for feeding time",
        bullets=["Food-grade silicone only", "No BPA, BPS, phthalates", "Easy to sterilize"],
    ),
    dict(
        slug="momcozy-m5-review",
        headline="Momcozy M5 Review 2026",
        subtitle="Is it really worth the hype?",
        bullets=["Tested: suction & comfort", "Battery life results", "Vs Spectra S1 comparison"],
    ),
    dict(
        slug="what-not-to-buy-newborn",
        headline="What Not to Buy for a Newborn",
        subtitle="Skip the stuff that gathers dust",
        bullets=["Avoid duplicate gear", "Skip gimmicks", "Save budget for essentials"],
    ),
]

def pin_path(slug, n=1):
    return os.path.join(PINS_DIR, f"{slug}-pin-{n}.png")

if __name__ == "__main__":
    print("Generating pins — local cover base images + abstract fallback\n")

    for art in ARTICLES:
        for n in (1, 2, 3):
            out = pin_path(art["slug"], n)
            make_pin(
                slug=art["slug"],
                headline=art["headline"],
                subtitle=art["subtitle"],
                bullets=art.get("bullets", []),
                variant=n,
                out_path=out,
            )

    print(f"\nDone! Check {PINS_DIR}")

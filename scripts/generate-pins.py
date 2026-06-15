#!/usr/bin/env python3
"""Generate Pinterest pin images for MomBabyPicks articles.

Style per AGENTS.md:
- 2:3 portrait ratio (800x1200)
- Warm beige/cream gradient background
- White overlay card at bottom 1/3 with rounded corners
- "Mom Baby Picks" brand at top in warm brown
- Headline in large bold dark font
- Subtitle in grey
- Dark navy "Read the guide →" button
- mombabypicks.com URL at bottom
"""

import os
from PIL import Image, ImageDraw, ImageFont

PINS_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/pins"
W, H = 800, 1200

# Color palette (warm, baby-safe tones)
BG_TOP    = (255, 236, 225)   # peach-cream top
BG_BTM    = (255, 248, 240)   # warm cream bottom
CARD_BG   = (255, 255, 255)   # white card
BRAND_CLR = (158, 85, 77)     # warm brown for "Mom Baby Picks"
TITLE_CLR = (47, 32, 28)      # dark brown for headline
SUB_CLR   = (125, 101, 92)    # muted warm grey for subtitle
BTN_BG    = (35, 45, 75)      # dark navy button
BTN_TXT   = (255, 255, 255)   # white button text
URL_CLR   = (158, 85, 77)     # warm brown for URL

def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
f_brand   = load_font(FONT_PATH, 28)
f_title   = load_font(FONT_PATH, 52)
f_sub     = load_font(FONT_PATH, 30)
f_btn     = load_font(FONT_PATH, 26)
f_url     = load_font(FONT_PATH, 22)


def draw_gradient(draw, w, h, top_color, btm_color):
    for y in range(h):
        t = y / h
        r = int(top_color[0] + (btm_color[0] - top_color[0]) * t)
        g = int(top_color[1] + (btm_color[1] - top_color[1]) * t)
        b = int(top_color[2] + (btm_color[2] - top_color[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))


def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + 2 * radius, y0 + 2 * radius], fill=fill)
    draw.ellipse([x1 - 2 * radius, y0, x1, y0 + 2 * radius], fill=fill)
    draw.ellipse([x0, y1 - 2 * radius, x0 + 2 * radius, y1], fill=fill)
    draw.ellipse([x1 - 2 * radius, y1 - 2 * radius, x1, y1], fill=fill)


def wrap_text(text, font, max_width, draw):
    words = text.split()
    lines = []
    current = []
    for word in words:
        test = " ".join(current + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def make_pin(slug, headline, subtitle, out_path):
    img = Image.new("RGB", (W, H), BG_TOP)
    draw = ImageDraw.Draw(img)

    # Background gradient
    draw_gradient(draw, W, H, BG_TOP, BG_BTM)

    # Decorative circles (soft)
    draw.ellipse([-80, -80, 240, 240], fill=(255, 210, 190, 60))
    draw.ellipse([W - 160, -60, W + 60, 160], fill=(255, 228, 210, 50))

    # Top brand bar
    brand_y = 52
    brand_text = "Mom Baby Picks"
    bb = draw.textbbox((0, 0), brand_text, font=f_brand)
    bw = bb[2] - bb[0]
    draw.text(((W - bw) / 2, brand_y), brand_text, font=f_brand, fill=BRAND_CLR)

    # Decorative line under brand
    line_y = brand_y + 44
    draw.line([(W // 2 - 40, line_y), (W // 2 + 40, line_y)], fill=(220, 175, 160), width=2)

    # White card overlay (bottom 52% of image)
    card_top = int(H * 0.44)
    card_pad = 28
    draw_rounded_rect(draw, (card_pad, card_top, W - card_pad, H - card_pad), 28, CARD_BG)

    # Shadow illusion below card top edge
    for i in range(6):
        alpha = 12 - i * 2
        draw.line(
            [(card_pad + 28, card_top + i), (W - card_pad - 28, card_top + i)],
            fill=(180, 140, 130),
            width=1,
        )

    # Headline text (bold large)
    text_x = card_pad + 32
    text_max_w = W - 2 * (card_pad + 32)
    title_y = card_top + 38

    title_lines = wrap_text(headline, f_title, text_max_w, draw)
    for line in title_lines[:3]:  # max 3 lines
        draw.text((text_x, title_y), line, font=f_title, fill=TITLE_CLR)
        title_y += 62

    # Subtitle text
    sub_y = title_y + 12
    sub_lines = wrap_text(subtitle, f_sub, text_max_w, draw)
    for line in sub_lines[:3]:
        draw.text((text_x, sub_y), line, font=f_sub, fill=SUB_CLR)
        sub_y += 40

    # "Read the guide →" button
    btn_text = "Read the guide  >"
    btn_bb = draw.textbbox((0, 0), btn_text, font=f_btn)
    btn_w = btn_bb[2] - btn_bb[0] + 48
    btn_h = 48
    btn_x = text_x
    btn_y = H - card_pad - btn_h - 54
    draw_rounded_rect(draw, (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h), 14, BTN_BG)
    draw.text((btn_x + 24, btn_y + 10), btn_text, font=f_btn, fill=BTN_TXT)

    # URL at very bottom
    url_text = "mombabypicks.com"
    url_bb = draw.textbbox((0, 0), url_text, font=f_url)
    url_w = url_bb[2] - url_bb[0]
    draw.text(((W - url_w) / 2, H - card_pad - 28), url_text, font=f_url, fill=URL_CLR)

    img.save(out_path, "PNG", optimize=True)
    print(f"  Created: {os.path.basename(out_path)}")


# Articles needing pins — (slug, headline, subtitle)
ARTICLES = [
    (
        "best-baby-carriers-for-2026",
        "Best Baby Carriers for 2026",
        "5 top-rated carriers compared by comfort, fit, and newborn readiness",
    ),
    (
        "best-high-chairs-for-babies-2026",
        "Best High Chairs for Babies 2026",
        "From budget IKEA picks to grow-with-me chairs — find yours here",
    ),
    (
        "bottle-refusal-breastfed-babies",
        "Bottle Refusal in Breastfed Babies",
        "Why it happens and the bottle tricks that actually work",
    ),
    (
        "eco-friendly-baby-gear-guide",
        "Eco-Friendly Baby Gear Guide",
        "Safe, sustainable picks for conscious parents in 2026",
    ),
    (
        "newborn-feeding-essentials",
        "Newborn Feeding Essentials",
        "What you actually need for the first 3 months — nothing extra",
    ),
    (
        "pace-bottle-feeding-guide",
        "Pace Bottle Feeding Guide",
        "The technique that protects milk supply and reduces overfeeding",
    ),
    (
        "silicone-baby-feeding-products",
        "Best Silicone Baby Feeding Products",
        "Safe, non-toxic silicone gear worth adding to your feeding setup",
    ),
    # Articles with only 1 pin — add pin-2
    (
        "best-baby-bouncers-for-2026",
        "Best Baby Bouncers 2026",
        "Battery-free to app-controlled — 5 picks for every budget",
    ),
    (
        "best-baby-sleep-sacks-for-2026",
        "Best Baby Sleep Sacks 2026",
        "TOG ratings, organic fabrics, and the right warmth for every season",
    ),
    (
        "best-bottle-warmers",
        "Best Bottle Warmers for Newborns",
        "Fast, safe, and compatible — 5 warmers compared for 2026",
    ),
    (
        "best-breast-pumps",
        "Best Breast Pumps of 2026",
        "Wearable and electric pumps compared for suction, comfort, and value",
    ),
    (
        "breastfeeding-essentials",
        "Breastfeeding Essentials for New Moms",
        "Everything you actually need for a smooth breastfeeding start",
    ),
    (
        "momcozy-m5-review",
        "Momcozy M5 Review 2026",
        "Is it really the best wearable pump? An honest look at the specs",
    ),
    (
        "newborn-essentials-checklist",
        "Newborn Essentials Checklist",
        "The only baby gear list you need before baby arrives",
    ),
]

def pin_path(slug, n):
    return os.path.join(PINS_DIR, f"{slug}-pin-{n}.png")

def existing_pins(slug):
    n = 0
    while os.path.exists(pin_path(slug, n + 1)):
        n += 1
    return n

print("Generating Pinterest pins...\n")
for slug, headline, subtitle in ARTICLES:
    existing = existing_pins(slug)
    next_n = existing + 1
    # Generate pin-1 if missing, otherwise generate pin-2/3
    if existing == 0:
        out = pin_path(slug, 1)
    else:
        out = pin_path(slug, next_n)
    make_pin(slug, headline, subtitle, out)

print(f"\nDone! Check {PINS_DIR}")

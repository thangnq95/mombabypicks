#!/usr/bin/env python3
"""
Generate Pinterest pins with photo backgrounds.

Usage:
  python3 scripts/generate-pins-v2.py                    # demo mode (random photos)
  PEXELS_API_KEY=xxx python3 scripts/generate-pins-v2.py # real relevant photos
"""

import os
import io
import urllib.request
import urllib.parse
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

PINS_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/pins"
W, H = 800, 1200
FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
PEXELS_KEY = os.environ.get("PEXELS_API_KEY", "")

def load_font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except:
        return ImageFont.load_default()

def fetch_photo_pexels(query, w=800, h=600):
    """Fetch a relevant photo from Pexels API."""
    url = f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page=3&orientation=portrait"
    headers = {"User-Agent": "Mozilla/5.0"}
    if PEXELS_KEY:
        headers["Authorization"] = PEXELS_KEY
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        if data.get("photos"):
            img_url = data["photos"][0]["src"]["large"]
            img_req = urllib.request.Request(img_url, headers=headers)
            with urllib.request.urlopen(img_req, timeout=15) as r:
                return Image.open(io.BytesIO(r.read())).convert("RGBA")
    except Exception as e:
        print(f"  Pexels error: {e}")
    return None

def fetch_photo_picsum(seed, w=800, h=600):
    """Fallback: random lifestyle photo from Lorem Picsum."""
    url = f"https://picsum.photos/seed/{seed}/{w}/{h}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGBA")
    except Exception as e:
        print(f"  Picsum error: {e}")
        return None

def get_photo(query, seed):
    img = fetch_photo_pexels(query)
    if img:
        return img
    print(f"  Pexels miss for '{query}', using Picsum fallback")
    return fetch_photo_picsum(seed)

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

def make_pin(slug, headline, subtitle, bullets, pexels_query, picsum_seed, out_path):
    print(f"  Building {os.path.basename(out_path)}...")

    # --- Photo background (top 52% of pin) ---
    photo = get_photo(pexels_query, picsum_seed)
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
        query="baby bottle warmer kitchen",
        seed="bottle-warmer-2026",
    ),
    dict(
        slug="best-baby-bouncers-for-2026",
        headline="Best Baby Bouncers 2026",
        subtitle="5 picks from budget to app-controlled",
        bullets=["Battery-free options", "Machine-washable covers", "Up to 29–30 lbs"],
        query="baby bouncer seat newborn nursery",
        seed="baby-bouncer-2026",
    ),
    dict(
        slug="best-breast-pumps",
        headline="Best Breast Pumps of 2026",
        subtitle="Wearable & electric compared honestly",
        bullets=["Hands-free wearable picks", "Hospital-grade suction", "Insurance-eligible"],
        query="breast pump nursing mom",
        seed="breast-pump-2026",
    ),
    dict(
        slug="best-baby-sleep-sacks-for-2026",
        headline="Best Baby Sleep Sacks 2026",
        subtitle="TOG ratings, organic fabrics & safe sleep",
        bullets=["From birth to toddler", "Multiple TOG weights", "IHDI hip-healthy options"],
        query="baby sleep sack nursery cozy",
        seed="sleep-sack-2026",
    ),
    dict(
        slug="best-baby-bottles-for-newborns-2026",
        headline="Best Baby Bottles for Newborns",
        subtitle="Anti-colic venting & breast-like nipples",
        bullets=["Works for breastfed babies", "Fewer parts to wash", "BPA-free materials"],
        query="baby bottle feeding newborn",
        seed="baby-bottles-2026",
    ),
    dict(
        slug="best-baby-carriers-for-2026",
        headline="Best Baby Carriers 2026",
        subtitle="From wraps to structured — find your fit",
        bullets=["Newborn-ready options", "IHDI hip-healthy picks", "From $32 to $195"],
        query="babywearing carrier newborn parent",
        seed="baby-carrier-2026",
    ),
    dict(
        slug="best-diapers-for-newborns-2026",
        headline="Best Newborn Diapers 2026",
        subtitle="Softness, fit & sensitive skin compared",
        bullets=["Umbilical cord notch", "Fragrance-free options", "Eco & organic picks"],
        query="newborn diaper baby soft",
        seed="diapers-2026",
    ),
    dict(
        slug="best-high-chairs-for-babies-2026",
        headline="Best High Chairs 2026",
        subtitle="From $25 IKEA to grows-to-adult chairs",
        bullets=["Easy to clean tray", "Folds slim for small spaces", "5-point harness safety"],
        query="baby high chair feeding mealtime",
        seed="high-chair-2026",
    ),
    dict(
        slug="best-baby-monitors-long-battery-life",
        headline="Best Baby Monitors — Long Battery",
        subtitle="No-WiFi picks that last through the night",
        bullets=["Private non-WiFi connection", "8–12 hour battery life", "No app required"],
        query="baby monitor nursery night",
        seed="baby-monitor-2026",
    ),
    dict(
        slug="best-hands-free-wearable-breast-pumps",
        headline="Best Wearable Breast Pumps",
        subtitle="Hands-free pumping while you work or move",
        bullets=["Fits inside nursing bra", "Whisper-quiet motors", "USB-C rechargeable"],
        query="wearable breast pump nursing mom",
        seed="wearable-pump-2026",
    ),
    dict(
        slug="best-baby-sleep-sacks-for-2026",
        headline="Baby Sleep Sack Guide",
        subtitle="Choose the right TOG for your room temp",
        bullets=["0.5 for summer nights", "1.5 for mild rooms", "3.5 for cold climates"],
        query="baby sleeping cozy warm nursery",
        seed="sleep-sack-2026-b",
        pin_n=2,
    ),
    dict(
        slug="breastfeeding-essentials",
        headline="Breastfeeding Essentials 2026",
        subtitle="What you actually need from day one",
        bullets=["Nursing pillow", "Nipple cream that works", "Haakaa silicone pump"],
        query="breastfeeding mom newborn nursing",
        seed="breastfeeding-2026",
    ),
    dict(
        slug="newborn-essentials-checklist",
        headline="Newborn Essentials Checklist",
        subtitle="Skip the noise — here's what you need",
        bullets=["0–3 month gear only", "Nothing that collects dust", "Budget-friendly picks"],
        query="newborn baby essentials nursery",
        seed="newborn-checklist-2026",
    ),
    dict(
        slug="newborn-feeding-essentials",
        headline="Newborn Feeding Essentials",
        subtitle="Bottles, burp cloths & nursing gear",
        bullets=["8–12 burp cloths minimum", "Slow-flow nipples only", "Haakaa = passive stash"],
        query="newborn feeding bottles nursing",
        seed="feeding-essentials-2026",
    ),
    dict(
        slug="bottle-refusal-breastfed-babies",
        headline="Bottle Refusal: What Works",
        subtitle="Why breastfed babies refuse & how to fix it",
        bullets=["Try when slightly hungry", "Different caregiver feeds", "Breast-like nipple shapes"],
        query="baby bottle feeding mother breastfed",
        seed="bottle-refusal-2026",
    ),
    dict(
        slug="eco-friendly-baby-gear-guide",
        headline="Eco-Friendly Baby Gear",
        subtitle="Sustainable picks worth buying in 2026",
        bullets=["OEKO-TEX certified fabrics", "Non-toxic silicone", "GOTS organic cotton"],
        query="eco organic baby products natural",
        seed="eco-baby-2026",
    ),
    dict(
        slug="pace-bottle-feeding-guide",
        headline="Pace Bottle Feeding Guide",
        subtitle="The technique every breastfed baby needs",
        bullets=["Upright position feeding", "Horizontal bottle angle", "Paced breaks every 30 sec"],
        query="baby bottle feeding paced technique",
        seed="pace-feeding-2026",
    ),
    dict(
        slug="silicone-baby-feeding-products",
        headline="Best Silicone Baby Products",
        subtitle="Safe, non-toxic gear for feeding time",
        bullets=["Food-grade silicone only", "No BPA, BPS, phthalates", "Easy to sterilize"],
        query="silicone baby feeding spoon bib bowl",
        seed="silicone-products-2026",
    ),
    dict(
        slug="momcozy-m5-review",
        headline="Momcozy M5 Review 2026",
        subtitle="Is it really worth the hype?",
        bullets=["Tested: suction & comfort", "Battery life results", "Vs Spectra S1 comparison"],
        query="wearable breast pump review honest",
        seed="momcozy-review-2026",
    ),
]

def pin_path(slug, n=1):
    return os.path.join(PINS_DIR, f"{slug}-pin-{n}.png")

if __name__ == "__main__":
    mode = "Pexels API" if PEXELS_KEY else "Picsum (demo photos)"
    print(f"Generating pins — mode: {mode}\n")
    if not PEXELS_KEY:
        print("  TIP: Set PEXELS_API_KEY env var for relevant product photos\n")

    for art in ARTICLES:
        n = art.get("pin_n", 1)
        out = pin_path(art["slug"], n)
        make_pin(
            slug=art["slug"],
            headline=art["headline"],
            subtitle=art["subtitle"],
            bullets=art.get("bullets", []),
            pexels_query=art["query"],
            picsum_seed=art["seed"],
            out_path=out,
        )

    print(f"\nDone! Check {PINS_DIR}")

#!/usr/bin/env python3
"""
Generate 1200x630 cover images — two-tone split layout.
Left 43%: warm cream panel with headline + branding.
Right 57%: Pexels lifestyle photo.

Usage:
  python3 scripts/generate-covers.py                    # Picsum fallback
  PEXELS_API_KEY=xxx python3 scripts/generate-covers.py # real photos
  PEXELS_API_KEY=xxx python3 scripts/generate-covers.py best-baby-bouncers-for-2026
"""

import os
import io
import sys
import urllib.request
import urllib.parse
import json
from PIL import Image, ImageDraw, ImageFont

COVERS_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/posts"
W, H = 1200, 630
LEFT_W = 520          # text panel width
RIGHT_W = W - LEFT_W  # 680

FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
PEXELS_KEY = os.environ.get("PEXELS_API_KEY", "")

CREAM       = (255, 244, 238, 255)  # #fff4ee
DARK        = (47,  32,  28,  255)  # #2f201c
CORAL       = (158, 85,  77,  255)  # #9e554d
CORAL_LIGHT = (240, 212, 202, 255)  # #f0d4ca
MUTED       = (160, 128, 112, 255)  # #a08070
WHITE       = (255, 255, 255, 255)


def load_font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:
        return ImageFont.load_default()


def fetch_pexels(query):
    url = (f"https://api.pexels.com/v1/search"
           f"?query={urllib.parse.quote(query)}&per_page=5&orientation=landscape")
    headers = {"Authorization": PEXELS_KEY, "User-Agent": "Mozilla/5.0"}
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, headers=headers), timeout=10
        ) as r:
            data = json.loads(r.read())
        photos = data.get("photos", [])
        if photos:
            img_url = photos[0]["src"].get("large2x") or photos[0]["src"]["large"]
            with urllib.request.urlopen(
                urllib.request.Request(img_url, headers=headers), timeout=15
            ) as r:
                return Image.open(io.BytesIO(r.read())).convert("RGBA")
    except Exception as e:
        print(f"    Pexels error: {e}")
    return None


def fetch_picsum(seed):
    url = f"https://picsum.photos/seed/{seed}/680/630"
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}),
            timeout=10,
        ) as r:
            return Image.open(io.BytesIO(r.read())).convert("RGBA")
    except Exception as e:
        print(f"    Picsum error: {e}")
    return None


def get_photo(query, seed):
    if PEXELS_KEY:
        photo = fetch_pexels(query)
        if photo:
            return photo
        print(f"    Pexels miss for '{query}', falling back to Picsum")
    return fetch_picsum(seed)


def wrap_text(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], []
    for word in words:
        test = " ".join(cur + [word])
        if draw.textbbox((0, 0), test, font=font)[2] <= max_w:
            cur.append(word)
        else:
            if cur:
                lines.append(" ".join(cur))
            cur = [word]
    if cur:
        lines.append(" ".join(cur))
    return lines


def rounded_rect(draw, xy, r, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    for cx, cy in [(x0, y0), (x1 - 2*r, y0), (x0, y1 - 2*r), (x1 - 2*r, y1 - 2*r)]:
        draw.ellipse([cx, cy, cx + 2*r, cy + 2*r], fill=fill)


def make_cover(slug, headline, subtitle, query, seed):
    out_path = os.path.join(COVERS_DIR, f"{slug}.webp")
    print(f"  {slug}...")

    img = Image.new("RGBA", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # --- Right panel: photo ---
    photo = get_photo(query, seed)
    if photo:
        pw, ph = photo.size
        scale = max(RIGHT_W / pw, H / ph)
        nw, nh = int(pw * scale), int(ph * scale)
        photo = photo.resize((nw, nh), Image.LANCZOS)
        lx = (nw - RIGHT_W) // 2
        ty_crop = (nh - H) // 2
        photo = photo.crop((lx, ty_crop, lx + RIGHT_W, ty_crop + H))
        img.paste(photo, (LEFT_W, 0))

    # Soft cream-to-transparent blend at the join edge
    blend_w = 80
    overlay = Image.new("RGBA", (blend_w, H), (0, 0, 0, 0))
    for i in range(blend_w):
        alpha = int(255 * (1 - i / blend_w) ** 1.6)
        ImageDraw.Draw(overlay).line([(i, 0), (i, H)], fill=(255, 244, 238, alpha))
    img.paste(overlay, (LEFT_W, 0), overlay)

    draw = ImageDraw.Draw(img)

    # Coral accent bar on far left
    draw.rectangle([0, 0, 5, H], fill=CORAL)

    # --- Brand badge ---
    f_badge = load_font(17)
    badge_text = "MOM BABY PICKS"
    bb = draw.textbbox((0, 0), badge_text, font=f_badge)
    bw = bb[2] - bb[0] + 28
    bh = 34
    bx, by = 40, 38
    rounded_rect(draw, (bx, by, bx + bw, by + bh), 17, CORAL_LIGHT)
    draw.text((bx + 14, by + 9), badge_text, font=f_badge, fill=CORAL)

    # --- Headline: auto-size to fit in 3 lines ---
    PAD = 40
    MAX_TW = LEFT_W - PAD * 2  # 440px

    f_title = load_font(72)
    lines = wrap_text(draw, headline, f_title, MAX_TW)
    if len(lines) > 3:
        f_title = load_font(58)
        lines = wrap_text(draw, headline, f_title, MAX_TW)
    line_h = int(f_title.size * 1.18)

    # Vertical center with subtitle and button in mind
    text_block_h = len(lines) * line_h
    ty = max(110, (H - text_block_h - 180) // 2)

    for line in lines[:4]:
        draw.text((PAD, ty), line, font=f_title, fill=DARK)
        ty += line_h

    # --- Subtitle ---
    f_sub = load_font(24)
    ty += 14
    for line in wrap_text(draw, subtitle, f_sub, MAX_TW)[:2]:
        draw.text((PAD, ty), line, font=f_sub, fill=CORAL)
        ty += 34

    # --- CTA button ---
    f_btn = load_font(21)
    btn_text = "Read the guide  >"
    bb = draw.textbbox((0, 0), btn_text, font=f_btn)
    btn_w = bb[2] - bb[0] + 44
    btn_h = 46
    btn_y = H - 104
    rounded_rect(draw, (PAD, btn_y, PAD + btn_w, btn_y + btn_h), 23, CORAL)
    draw.text((PAD + 22, btn_y + 12), btn_text, font=f_btn, fill=WHITE)

    # --- URL ---
    f_url = load_font(19)
    draw.text((PAD, H - 36), "mombabypicks.com", font=f_url, fill=MUTED)

    final = img.convert("RGB")
    final.save(out_path, "WEBP", quality=90, optimize=True)
    print(f"    Saved: {os.path.basename(out_path)}")


ARTICLES = [
    dict(slug="best-bottle-warmers",
         headline="Best Bottle Warmers",
         subtitle="Fast, safe picks for newborns · 2026",
         query="baby bottle warmer kitchen counter",
         seed="cover-bottle-warmer"),
    dict(slug="best-baby-bouncers-for-2026",
         headline="Best Baby Bouncers for 2026",
         subtitle="5 picks from budget to app-controlled",
         query="baby bouncer seat infant cozy",
         seed="cover-bouncer"),
    dict(slug="best-breast-pumps",
         headline="Best Breast Pumps of 2026",
         subtitle="Wearable & electric compared honestly",
         query="breast pump nursing mom",
         seed="cover-breast-pump"),
    dict(slug="best-baby-sleep-sacks-for-2026",
         headline="Best Baby Sleep Sacks 2026",
         subtitle="TOG ratings, organic fabrics & safe sleep",
         query="baby sleeping cozy nursery warm",
         seed="cover-sleep-sack"),
    dict(slug="best-baby-bottles-for-newborns-2026",
         headline="Best Baby Bottles for Newborns",
         subtitle="Anti-colic venting & breast-like nipples",
         query="baby bottle feeding newborn",
         seed="cover-bottles"),
    dict(slug="best-baby-carriers-for-2026",
         headline="Best Baby Carriers 2026",
         subtitle="From wraps to structured carriers",
         query="babywearing baby carrier parent",
         seed="cover-carriers"),
    dict(slug="best-diapers-for-newborns-2026",
         headline="Best Newborn Diapers 2026",
         subtitle="Softness, fit & sensitive skin compared",
         query="newborn baby diaper soft",
         seed="cover-diapers"),
    dict(slug="best-high-chairs-for-babies-2026",
         headline="Best High Chairs 2026",
         subtitle="From budget IKEA to grows-to-adult",
         query="baby high chair mealtime kitchen",
         seed="cover-high-chair"),
    dict(slug="best-baby-monitors-long-battery-life",
         headline="Best Baby Monitors Long Battery",
         subtitle="No-WiFi picks that last through the night",
         query="baby monitor nursery night",
         seed="cover-monitor"),
    dict(slug="best-hands-free-wearable-breast-pumps",
         headline="Best Wearable Breast Pumps",
         subtitle="Hands-free pumping while you move",
         query="wearable breast pump nursing mom",
         seed="cover-wearable-pump"),
    dict(slug="breastfeeding-essentials",
         headline="Breastfeeding Essentials 2026",
         subtitle="What you actually need from day one",
         query="breastfeeding mom newborn nursing",
         seed="cover-bf-essentials"),
    dict(slug="newborn-essentials-checklist",
         headline="Newborn Essentials Checklist",
         subtitle="Skip the noise — here's what you need",
         query="newborn baby essentials nursery",
         seed="cover-newborn"),
    dict(slug="newborn-feeding-essentials",
         headline="Newborn Feeding Essentials",
         subtitle="Bottles, burp cloths & nursing gear",
         query="newborn feeding baby bottles",
         seed="cover-feeding"),
    dict(slug="bottle-refusal-breastfed-babies",
         headline="Bottle Refusal: What Works",
         subtitle="Why breastfed babies refuse & how to fix it",
         query="baby bottle feeding breastfed mother",
         seed="cover-bottle-refusal"),
    dict(slug="eco-friendly-baby-gear-guide",
         headline="Eco-Friendly Baby Gear",
         subtitle="Sustainable picks worth buying in 2026",
         query="eco organic baby products natural",
         seed="cover-eco"),
    dict(slug="pace-bottle-feeding-guide",
         headline="Pace Bottle Feeding Guide",
         subtitle="The technique every breastfed baby needs",
         query="baby bottle paced feeding technique",
         seed="cover-pace"),
    dict(slug="silicone-baby-feeding-products",
         headline="Best Silicone Baby Products",
         subtitle="Safe, non-toxic gear for feeding time",
         query="silicone baby feeding bowl spoon",
         seed="cover-silicone"),
    dict(slug="momcozy-m5-review",
         headline="Momcozy M5 Review 2026",
         subtitle="Is it really worth the hype?",
         query="wearable breast pump review honest",
         seed="cover-momcozy"),
]


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    mode = "Pexels API" if PEXELS_KEY else "Picsum (demo photos)"
    print(f"Generating covers — mode: {mode}\n")

    for art in ARTICLES:
        if target and art["slug"] != target:
            continue
        make_cover(
            slug=art["slug"],
            headline=art["headline"],
            subtitle=art["subtitle"],
            query=art["query"],
            seed=art["seed"],
        )

    print(f"\nDone! Check {COVERS_DIR}")

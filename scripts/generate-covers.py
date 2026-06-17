#!/usr/bin/env python3
"""
Generate 1200x630 cover images — clean web-cover format.
The cover image is a visual-only asset with no baked-in text.
Preferred source order:
1. local AI-generated base image in static/images/raw/{slug}.*
2. deterministic soft abstract fallback

Usage:
  python3 scripts/generate-covers.py                              # all
  python3 scripts/generate-covers.py best-baby-bouncers-for-2026
"""

import os
import sys
import random
from PIL import Image, ImageDraw, ImageFilter, ImageOps

COVERS_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/posts"
RAW_DIR = "/Users/thangnguyen/GIT/PP/mombabypicks/static/images/raw"
W, H = 1200, 630
PALETTES = [
    [(255, 244, 238), (255, 231, 219), (235, 212, 198)],
    [(255, 241, 244), (251, 226, 234), (240, 208, 220)],
    [(250, 244, 233), (235, 228, 214), (217, 208, 190)],
    [(244, 247, 242), (227, 236, 225), (203, 218, 206)],
    [(241, 246, 251), (222, 233, 244), (198, 214, 230)],
]

def load_raw_image(slug):
    """Load local AI base image if present."""
    for ext in ("jpg", "jpeg", "png", "webp"):
        path = os.path.join(RAW_DIR, f"{slug}.{ext}")
        if os.path.exists(path):
            return Image.open(path).convert("RGBA")
    return None


def make_abstract_bg(slug, palette_index):
    """Deterministic soft abstract fallback."""
    rng = random.Random(slug)
    palette = PALETTES[palette_index % len(PALETTES)]
    bg = Image.new("RGBA", (W, H), (*palette[0], 255))
    base = ImageDraw.Draw(bg)
    # soft gradient bands
    for x in range(W):
        t = x / max(1, W - 1)
        left = palette[0]
        right = palette[-1]
        color = tuple(int(left[i] * (1 - t) + right[i] * t) for i in range(3))
        base.line([(x, 0), (x, H)], fill=(*color, 255))
    # blurred floating shapes
    for cx_f, cy_f, scale_f, idx in [
        (0.22, 0.18, 0.42, 1),
        (0.78, 0.24, 0.34, 2),
        (0.66, 0.76, 0.52, 1),
    ]:
        cx = int(cx_f * W) + rng.randint(-40, 40)
        cy = int(cy_f * H) + rng.randint(-35, 35)
        r = int(min(W, H) * scale_f)
        color = palette[idx % len(palette)]
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, 130))
        layer = layer.filter(ImageFilter.GaussianBlur(radius=r // 3))
        bg = Image.alpha_composite(bg, layer)
    return bg


def get_base_image(slug, palette_index):
    raw = load_raw_image(slug)
    if raw:
        return ImageOps.fit(raw, (W, H), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    return make_abstract_bg(slug, palette_index)


def make_cover(slug, headline, subtitle, query, palette):
    out_path = os.path.join(COVERS_DIR, f"{slug}.webp")
    print(f"  {slug}...")

    img = get_base_image(slug, palette)
    img.convert("RGB").save(out_path, "WEBP", quality=92, optimize=True)
    print(f"    Saved: {os.path.basename(out_path)}")


ARTICLES = [
    dict(slug="best-bottle-warmers",
         headline="Best Bottle Warmers",
         subtitle="Fast, safe picks for newborns · 2026",
         query="cozy kitchen counter warm pastel objects minimal flat lay",
         palette=0,
         ai_prompt="Flat lay product photo of a white electric bottle warmer on a warm cream background, with a small baby bottle beside it. Clean minimal product photography. No people, no hands."),
    dict(slug="best-baby-bouncers-for-2026",
         headline="Best Baby Bouncers for 2026",
         subtitle="5 picks from budget to app-controlled",
         query="cozy nursery armchair rocking chair soft neutral decor",
         palette=1,
         ai_prompt="A cozy infant bouncer seat on a soft neutral/cream background. Clean product photography, no people. Warm pastel tones, minimal composition."),
    dict(slug="best-breast-pumps",
         headline="Best Breast Pumps of 2026",
         subtitle="Wearable & electric compared honestly",
         query="",
         palette=1,
         ai_prompt="Flat lay product photo of an electric breast pump device (white/cream) with accessories — flanges, bottles, tubing — on a soft pink pastel background. No people, no hands, no faces."),
    dict(slug="best-baby-sleep-sacks-for-2026",
         headline="Best Baby Sleep Sacks 2026",
         subtitle="TOG ratings, organic fabrics & safe sleep",
         query="soft knit blanket folded cozy cream textile fabric texture",
         palette=4,
         ai_prompt="Flat lay of a folded soft cotton sleep sack/wearable blanket in cream or white, on a warm pastel background. Clean product photography, no people."),
    dict(slug="best-baby-bottles-for-newborns-2026",
         headline="Best Baby Bottles for Newborns",
         subtitle="Anti-colic venting & breast-like nipples",
         query="formula powder milk bottle spoon measuring flat lay",
         palette=0,
         ai_prompt="Flat lay of 3-4 different baby feeding bottles arranged on a soft cream/peach background. Clean product photography style. No people, no hands."),
    dict(slug="best-baby-carriers-for-2026",
         headline="Best Baby Carriers 2026",
         subtitle="From wraps to structured carriers",
         query="soft woven fabric wrap textile cotton pastel product",
         palette=3,
         ai_prompt="Flat lay of a structured baby carrier (ergonomic, no baby inside) in neutral/cream color on a soft sage-green or cream background. Clean product shot. No people."),
    dict(slug="best-diapers-for-newborns-2026",
         headline="Best Newborn Diapers 2026",
         subtitle="Softness, fit & sensitive skin compared",
         query="",
         palette=0,
         ai_prompt="Flat lay product photo of 3-4 white disposable newborn diapers neatly stacked on a soft cream/ivory background. Clean minimalist product photography. No people, no hands."),
    dict(slug="best-high-chairs-for-babies-2026",
         headline="Best High Chairs 2026",
         subtitle="From budget IKEA to grows-to-adult",
         query="wooden chair seat furniture product white background minimal",
         palette=2,
         ai_prompt="Product photo of a modern wooden high chair for babies on a clean white or warm cream background. Minimal composition. No people, no child."),
    dict(slug="best-baby-monitors-long-battery-life",
         headline="Best Baby Monitors Long Battery",
         subtitle="No-WiFi picks that last through the night",
         query="wireless camera security device product flat lay white",
         palette=4,
         ai_prompt="Product photo of a baby monitor camera unit on a soft lavender or cream background. Clean minimal product photography. No people."),
    dict(slug="best-hands-free-wearable-breast-pumps",
         headline="Best Wearable Breast Pumps",
         subtitle="Hands-free pumping while you move",
         query="",
         palette=1,
         ai_prompt="Flat lay of two round white wearable breast pump pods on a soft blush pink background with nursing accessories (breast pads, small milk bottle). No people, no hands."),
    dict(slug="how-to-choose-breast-pump",
         headline="How to Choose a Breast Pump",
         subtitle="Wearable vs standard and what matters most",
         query="",
         palette=1,
         ai_prompt="Landscape product photo of two breast pump styles side by side: one wearable pump and one standard electric pump with flanges and bottles, on a soft blush pink and cream background. No people, no hands."),
    dict(slug="breastfeeding-essentials",
         headline="Breastfeeding Essentials 2026",
         subtitle="What you actually need from day one",
         query="nursing accessories bottle pastel pink flat lay product",
         palette=1,
         ai_prompt="Flat lay of breastfeeding essentials: nursing pads, a breast pump flange, a milk storage bottle, nipple cream tube, on a soft pink background. No people, no hands."),
    dict(slug="breast-pump-cleaning-guide",
         headline="Breast Pump Cleaning Guide",
         subtitle="Tools that make cleaning faster and safer",
         query="",
         palette=1,
         ai_prompt="Landscape product photo of breast pump cleaning tools including a drying rack, bottle brush, pump parts, cleaning wipes, and sterilizing tools on a cream and blush background. No people, no hands."),
    dict(slug="newborn-essentials-checklist",
         headline="Newborn Essentials Checklist",
         subtitle="Skip the noise — here's what you need",
         query="gift box pastel items flat lay product photography elegant",
         palette=3,
         ai_prompt="Flat lay of newborn essentials: small folded onesie, tiny socks, a soft toy, a small bottle — on a sage green or cream background. Minimal, elegant product photography. No people."),
    dict(slug="newborn-feeding-essentials",
         headline="Newborn Feeding Essentials",
         subtitle="Bottles, burp cloths & nursing gear",
         query="soft cloth fabric accessories bottles flat lay pastel",
         palette=0,
         ai_prompt="Flat lay of newborn feeding items: baby bottle, burp cloth, bottle brush, on a soft peach/cream background. Clean product photography. No people, no hands."),
    dict(slug="newborn-feeding-station",
         headline="Newborn Feeding Station",
         subtitle="Keep the setup tidy and easy to use",
         query="",
         palette=0,
         ai_prompt="Landscape product photo of a newborn feeding station setup with wipes dispenser, nursing pillow, bottle drying rack, and small baby feeding accessories on a warm cream background. No people, no hands."),
    dict(slug="bottle-refusal-breastfed-babies",
         headline="Bottle Refusal: What Works",
         subtitle="Why breastfed babies refuse & how to fix it",
         query="glass bottles collection still life minimal pastel",
         palette=2,
         ai_prompt="Flat lay of 2-3 different baby bottles (different nipple shapes) on a soft warm background. Clean minimal still-life photography. No people."),
    dict(slug="eco-friendly-baby-gear-guide",
         headline="Eco-Friendly Baby Gear",
         subtitle="Sustainable picks worth buying in 2026",
         query="natural organic cotton linen eco flat lay neutral wood",
         palette=3,
         ai_prompt="Flat lay of eco-friendly baby items: organic cotton cloth, wooden toy, bamboo spoon, on a natural linen/wood background. Earthy, minimal. No people."),
    dict(slug="pace-bottle-feeding-guide",
         headline="Pace Bottle Feeding Guide",
         subtitle="The technique every breastfed baby needs",
         query="bottle jar glass minimal product flat lay still life",
         palette=0,
         ai_prompt="Close-up product photo of a slow-flow baby bottle lying on its side on a soft cream background. Minimal, clean. No people, no hands."),
    dict(slug="silicone-baby-feeding-products",
         headline="Best Silicone Baby Products",
         subtitle="Safe, non-toxic gear for feeding time",
         query="colorful silicone spoons bowls plates flat lay product",
         palette=2,
         ai_prompt="Flat lay of colorful silicone baby feeding products: spoons, suction bowl, plate in soft pastel colors on a white background. Clean product photography. No people."),
    dict(slug="momcozy-m5-review",
         headline="Momcozy M5 Review 2026",
         subtitle="Is it really worth the hype?",
         query="",
         palette=1,
         ai_prompt="Flat lay of two Momcozy M5 wearable breast pump pods with nursing accessories: breast pads, a milk bottle, soft cloth — on a pink pastel background. No people, no hands."),
    dict(slug="what-not-to-buy-newborn",
         headline="What Not to Buy for a Newborn",
         subtitle="Avoid overbuying the wrong extras",
         query="",
         palette=2,
         ai_prompt="Landscape editorial product photo suggesting overbuying newborn gear: duplicate blankets, extra bottles, extra pacifiers, and small gadgets in a neat overfilled basket, with no faces or character toys."),
    dict(slug="best-baby-swings-2026",
         headline="Best Baby Swings 2026",
         subtitle="Soothe your baby with motion that works",
         query="",
         palette=2,
         ai_prompt="Landscape product photo of a baby swing in a neutral nursery setting, soft cream and warm beige tones, clean composition, no people, no faces, no hands."),
    dict(slug="best-baby-play-mats-2026",
         headline="Best Baby Play Mats 2026",
         subtitle="Safe and soft for tummy time and play",
         query="",
         palette=3,
         ai_prompt="Flat lay of a colorful baby play mat on a soft neutral floor, clean composition, no people, no faces, no hands."),
    dict(slug="best-infant-car-seats-2026",
         headline="Best Infant Car Seats 2026",
         subtitle="Safety ratings, installation & budget picks",
         query="",
         palette=4,
         ai_prompt="Landscape product photo of an infant car seat on a clean white or light grey background, minimal, no people, no faces, no hands."),
    dict(slug="best-baby-bath-tubs-2026",
         headline="Best Baby Bath Tubs 2026",
         subtitle="Safe and easy options for newborns to toddlers",
         query="",
         palette=0,
         ai_prompt="Landscape product photo of a baby bath tub on a clean white background with soft towels, minimal, no people, no faces, no hands."),
    dict(slug="best-baby-outdoor-gear-summer",
         headline="Best Baby Outdoor Gear for Summer 2026",
         subtitle="Keep your baby cool and safe outside all summer long",
         query="",
         palette=3,
         ai_prompt="Landscape product photo of baby outdoor summer gear on a sunny patio, stroller, sun hat, no people."),
]


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    print("Generating covers — local AI base images + abstract fallback\n")
    matched = False
    for art in ARTICLES:
        if target and art["slug"] != target:
            continue
        matched = True
        make_cover(
            slug=art["slug"],
            headline=art["headline"],
            subtitle=art["subtitle"],
            query=art["query"],
            palette=art["palette"],
        )
    if target and not matched:
        print(f"Unknown slug: {target}")
        sys.exit(1)
    print(f"\nDone! Check {COVERS_DIR}")

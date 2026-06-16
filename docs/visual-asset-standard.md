# Visual Asset Standard

This is the canonical rule set for all MomBabyPicks visual assets.
If another document disagrees with this one, follow this file.

## Web Covers

- Every article must have one cover image in front matter.
- Cover path: `/images/posts/{slug}.webp`
- Cover size: `1200x630`
- Cover style: visual only.
- Never bake title text, subtitles, badges, or CTA text into the cover image.
- Never use real people, hands, or faces.
- Preferred source: local AI base image in `static/images/raw/{slug}.png` or `.jpg`.
- Fallback: abstract pastel composition when no local base image exists.
- Generate with `python3 scripts/generate-covers.py {slug}`.

## Pinterest Pins

- Every article must ship with 3 Pinterest pin images.
- Pin path format: `static/images/pins/{slug}-pin-{N}.png`
- Pin size: `1000x1500`
- Pin style: HTML/CSS-rendered editorial pin with strong typography and one primary message.
- Pin layout:
  - brand chip
  - large headline
  - optional short subtitle
  - site URL footer
- Pin variant rule:
  - `pin-1`: headline-led primary Pinterest pin
  - `pin-2`: headline-led alternate layout
  - `pin-3`: visual-heavy layout with minimal text
- Each pin should be a different crop or variant of the same base scene.
- Use the same base visual language as the cover image.
- Never stretch or squash the base image. Always use cover-cropping only.
- Avoid bullet lists and fake CTA buttons inside pins.
- First share image in front matter must be `/images/pins/{slug}-pin-1.png`.
- Generate with `python3 scripts/generate-pins-v2.py`.

## Pinterest Publishing

- Only publish pins after the article URL is live.
- Use Pinterest create-button URLs with separate `url=` and `media=` parameters.
- The `url=` value must be the canonical article URL, with no `utm_*` tracking params or raw image URLs.
- Never publish a raw image URL as the destination.
- Save pins to `Baby Gear & New Mom Essentials` unless the sprint explicitly says otherwise.
- Record the live Pinterest URL in `data/pinterest/{slug}.json`.

## Agent Decision Rule

- Claude/Hermes should plan the image.
- Codex should generate the local asset and verify the output.
- If a file says "Pinterest image," it means the overlay-card pin style.
- If a file says "cover image," it means the visual-only landscape style.

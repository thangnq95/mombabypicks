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
- Pin size: `800x1200`
- Pin style: photo background plus a text overlay card.
- Pin layout:
  - top badge
  - large headline
  - short subtitle
  - CTA button
  - site URL footer
- Each pin should be a different crop or variant of the same base scene.
- Use the same base visual language as the cover image.
- First share image in front matter must be `/images/pins/{slug}-pin-1.png`.
- Generate with `python3 scripts/generate-pins-v2.py`.

## Pinterest Publishing

- Only publish pins after the article URL is live.
- Use Pinterest create-button URLs with separate `url=` and `media=` parameters.
- Never publish a raw image URL as the destination.
- Save pins to `Baby Gear & New Mom Essentials` unless the sprint explicitly says otherwise.
- Record the live Pinterest URL in `data/pinterest/{slug}.json`.

## Agent Decision Rule

- Claude/Hermes should plan the image.
- Codex should generate the local asset and verify the output.
- If a file says "Pinterest image," it means the overlay-card pin style.
- If a file says "cover image," it means the visual-only landscape style.


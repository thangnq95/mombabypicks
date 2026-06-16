#!/usr/bin/env python3
"""Validate MomBabyPicks visual assets for a post or for the full site."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


REPO = Path("/Users/thangnguyen/GIT/PP/mombabypicks")
CONTENT_DIR = REPO / "content" / "posts"
STATIC_DIR = REPO / "static"
PIN_DIR = REPO / "data" / "pinterest"


def iter_posts() -> list[Path]:
    if len(sys.argv) > 1:
        return [Path(sys.argv[1])]
    return sorted(CONTENT_DIR.glob("*.md"))


def read_frontmatter(path: Path) -> str | None:
    text = path.read_text()
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    return text[4:end]


def extract_cover(frontmatter: str) -> str | None:
    match = re.search(r"^cover:\n(?:[ \t].*\n)*?[ \t]+image:\s*(?:\"([^\"]+)\"|([^ \n]+))\s*$", frontmatter, re.M)
    if not match:
        return None
    return match.group(1) or match.group(2)


def extract_first_image(frontmatter: str) -> str | None:
    match = re.search(r"^images:\n(?:[ \t]+-\s*(?:\"([^\"]+)\"|([^ \n]+))\s*\n)+", frontmatter, re.M)
    if not match:
        return None
    block = match.group(0)
    item = re.search(r"^[ \t]+-\s*(?:\"([^\"]+)\"|([^ \n]+))\s*$", block, re.M)
    if not item:
        return None
    return item.group(1) or item.group(2)


def validate_post(path: Path) -> list[str]:
    errors: list[str] = []
    slug = path.stem
    frontmatter = read_frontmatter(path)
    if frontmatter is None:
        return [f"{path.name}: missing or malformed front matter"]

    cover = extract_cover(frontmatter)
    if cover != f"/images/posts/{slug}.webp":
        errors.append(
            f"{path.name}: cover.image should be /images/posts/{slug}.webp (found {cover!r})"
        )
    elif not (STATIC_DIR / cover.lstrip("/")).exists():
        errors.append(f"{path.name}: cover asset missing at static{cover}")

    first_image = extract_first_image(frontmatter)
    expected_pin = f"/images/pins/{slug}-pin-1.png"
    if first_image != expected_pin:
        errors.append(
            f"{path.name}: first images entry should be {expected_pin} (found {first_image!r})"
        )
    elif not (STATIC_DIR / first_image.lstrip("/")).exists():
        errors.append(f"{path.name}: pin asset missing at static{first_image}")

    pin_pack = PIN_DIR / f"{slug}.json"
    if pin_pack.exists():
        try:
            items = json.loads(pin_pack.read_text())
        except Exception as exc:  # pragma: no cover
            errors.append(f"{path.name}: invalid Pinterest pack JSON ({exc})")
            return errors

        if not isinstance(items, list) or not items:
            errors.append(f"{path.name}: Pinterest pack is empty")
        else:
            published = 0
            for idx, item in enumerate(items, start=1):
                if not isinstance(item, dict):
                    errors.append(f"{path.name}: Pinterest pack item {idx} is not an object")
                    continue
                image_path = str(item.get("image_path", ""))
                if image_path and not (STATIC_DIR / image_path.lstrip("/")).exists():
                    errors.append(f"{path.name}: missing pin asset {image_path}")
                destination_url = str(item.get("destination_url", ""))
                if destination_url:
                    if "?" in destination_url or "utm_" in destination_url.lower():
                        errors.append(f"{path.name}: destination_url must be canonical and query-free ({destination_url})")
                    elif not destination_url.startswith("https://mombabypicks.com/posts/"):
                        errors.append(f"{path.name}: destination_url must point to a MomBabyPicks post ({destination_url})")
                if item.get("status") in {"published", "backfilled"} and item.get("published_pin_url"):
                    published += 1
            if published < 1:
                errors.append(f"{path.name}: no published Pinterest pin recorded")
    else:
        errors.append(f"{path.name}: missing Pinterest pack")

    return errors


def main() -> int:
    failures: list[str] = []
    for post in iter_posts():
        if not post.exists():
            failures.append(f"{post}: file not found")
            continue
        failures.extend(validate_post(post))

    if failures:
        for line in failures:
            print(f"❌ {line}")
        return 1

    print("✅ Visual asset validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

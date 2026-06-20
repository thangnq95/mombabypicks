#!/usr/bin/env python3
"""Pinterest QA Check — kiểm tra tất cả bài viết đã publish."""
import json
import os
import re
import sys

BASE = "/Users/thangnguyen/GIT/PP/mombabypicks"
POSTS_DIR = os.path.join(BASE, "content/posts")
PINTEREST_DIR = os.path.join(BASE, "data/pinterest")

PASS = []
FAIL = []

def get_slug(filename):
    return os.path.splitext(filename)[0]

def check_pin_url(url):
    """Real Pinterest URL must contain /pin/ and NOT be pin/create/button"""
    if not url:
        return False
    if "pin/create/button" in url:
        return False
    if "/pin/" in url:
        return True
    # Also accept full pin URLs like https://www.pinterest.com/pin/848647123576680913
    return False

# Get all post slugs
post_files = sorted(f for f in os.listdir(POSTS_DIR) if f.endswith(".md"))
total = len(post_files)
print(f"=== Pinterest QA Check ===")
print(f"Total articles: {total}")
print()

for pf in post_files:
    slug = get_slug(pf)
    pinfile = os.path.join(PINTEREST_DIR, f"{slug}.json")
    
    if not os.path.exists(pinfile):
        FAIL.append((slug, "Missing pinterest JSON file"))
        continue
    
    try:
        with open(pinfile, "r") as f:
            pins = json.load(f)
    except json.JSONDecodeError as e:
        FAIL.append((slug, f"Invalid JSON: {e}"))
        continue
    
    if not isinstance(pins, list) or len(pins) == 0:
        FAIL.append((slug, "Empty or invalid pins array"))
        continue
    
    published_pins = [p for p in pins if p.get("status") == "published"]
    if len(published_pins) == 0:
        FAIL.append((slug, "No pin with status='published'"))
        continue
    
    # Check that at least one published pin has a real URL
    valid_url_pins = [p for p in published_pins if check_pin_url(p.get("published_pin_url", ""))]
    if len(valid_url_pins) == 0:
        bad_url = published_pins[0].get("published_pin_url", "N/A")
        FAIL.append((slug, f"Published pin URL is invalid: {bad_url}"))
        continue
    
    PASS.append(slug)

# Print report
print(f"PASS: {len(PASS)}/{total}")
print(f"FAIL: {len(FAIL)}/{total}")
print()

for slug in PASS:
    print(f"  ✅ {slug}")

print()
if FAIL:
    print("FAILED ARTICLES:")
    for slug, reason in FAIL:
        print(f"  ❌ {slug}")
        print(f"     Reason: {reason}")
    print()

# Output machine-readable
print(f"---SUMMARY---")
print(f"TOTAL={total}")
print(f"PASS={len(PASS)}")
print(f"FAIL={len(FAIL)}")
if FAIL:
    print(f"FAIL_LIST_JSON={json.dumps([{'slug': s, 'reason': r} for s, r in FAIL])}")

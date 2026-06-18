#!/usr/bin/env python3
"""Pinterest QA Check — MomBabyPicks"""
import json
import os
import re
import glob

REPO = "/Users/thangnguyen/GIT/PP/mombabypicks"
POSTS_DIR = os.path.join(REPO, "content", "posts")
PINTEREST_DIR = os.path.join(REPO, "data", "pinterest")

results = {"pass": [], "fail": [], "total": 0}

# Get all post slugs
post_files = sorted(glob.glob(os.path.join(POSTS_DIR, "*.md")))
slugs = []
for pf in post_files:
    slug = os.path.splitext(os.path.basename(pf))[0]
    slugs.append(slug)

results["total"] = len(slugs)
print(f"=== MomBabyPicks Pinterest QA Check ===")
print(f"Total posts: {len(slugs)}")
print()

for slug in slugs:
    pinterest_file = os.path.join(PINTEREST_DIR, f"{slug}.json")
    
    # RULE 1: Must have data/pinterest/<slug>.json
    if not os.path.exists(pinterest_file):
        reason = f"Missing data/pinterest/{slug}.json"
        results["fail"].append({"slug": slug, "reason": reason, "rule": 1})
        print(f"  FAIL  {slug} — {reason}")
        continue
    
    # Parse the JSON
    try:
        with open(pinterest_file, "r") as f:
            pins = json.load(f)
    except json.JSONDecodeError as e:
        reason = f"Invalid JSON in data/pinterest/{slug}.json: {e}"
        results["fail"].append({"slug": slug, "reason": reason, "rule": "json"})
        print(f"  FAIL  {slug} — {reason}")
        continue
    
    if not isinstance(pins, list):
        reason = f"data/pinterest/{slug}.json is not a list"
        results["fail"].append({"slug": slug, "reason": reason, "rule": "format"})
        print(f"  FAIL  {slug} — {reason}")
        continue
    
    # RULE 2: At least 1 pin with status: "published"
    published_pins = [p for p in pins if p.get("status") == "published"]
    if not published_pins:
        reason = f"No pins with status='published' in data/pinterest/{slug}.json"
        results["fail"].append({"slug": slug, "reason": reason, "rule": 2})
        print(f"  FAIL  {slug} — {reason}")
        continue
    
    # RULE 3: published_pin_url must be real Pinterest URL (contains /pin/), NOT pin/create/button
    for pin in published_pins:
        url = pin.get("published_pin_url", "")
        if not url:
            reason = f"published_pin_url is empty for a published pin in {slug}"
            results["fail"].append({"slug": slug, "reason": reason, "rule": 3})
            print(f"  FAIL  {slug} — {reason}")
            break
        if "/pin/" not in url:
            reason = f"published_pin_url '{url}' is not a real Pinterest pin URL (missing /pin/) in {slug}"
            results["fail"].append({"slug": slug, "reason": reason, "rule": 3})
            print(f"  FAIL  {slug} — {reason}")
            break
        if "pin/create/button" in url:
            reason = f"published_pin_url '{url}' contains pin/create/button (not a real pin) in {slug}"
            results["fail"].append({"slug": slug, "reason": reason, "rule": 3})
            print(f"  FAIL  {slug} — {reason}")
            break
    else:
        # All checks passed
        results["pass"].append({"slug": slug, "count": len(published_pins)})
        print(f"  PASS  {slug} — {len(published_pins)} published pin(s)")

print()
print("=" * 60)
print(f"SUMMARY: {results['total']} total | {len(results['pass'])} PASS | {len(results['fail'])} FAIL")
print()

if results["fail"]:
    print("FAILED POSTS:")
    for f in results["fail"]:
        print(f"  - {f['slug']}: {f['reason']}")
    print()
else:
    print("All posts passed QA! ✨")

# Output JSON for downstream processing
print("---JSON_OUTPUT---")
print(json.dumps(results, indent=2))

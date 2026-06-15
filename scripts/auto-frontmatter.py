#!/usr/bin/env python3
"""auto-frontmatter.py — Ensure article has proper Hugo frontmatter.

Usage: cat article.md | python3 scripts/auto-frontmatter.py <keyword> <slug> [brief_file]

Reads article markdown from stdin. If frontmatter is empty (--- followed
directly by body content), auto-generates frontmatter fields from keyword/slug/brief.
Outputs cleaned markdown to stdout.
"""
import sys, json, re

text = sys.stdin.read()

# 1. Strip code fences
text = text.lstrip()
text = re.sub(r'^```\w*\n?', '', text)
text = re.sub(r'\n```\s*$', '', text)

# 2. Strip greeting text before frontmatter
idx = text.find('\n---')
if idx > 0 and '---' in text[:idx]:
    text = text[idx+1:]
elif not text.startswith('---') and '---' in text:
    idx = text.index('---')
    text = text[idx:]

# 3. Check if frontmatter exists and is not empty
keyword = sys.argv[1] if len(sys.argv) > 1 else 'baby product'
slug = sys.argv[2] if len(sys.argv) > 2 else 'baby-product'

# Determine if frontmatter is empty
has_fm = False
if text.startswith('---'):
    end_idx = text.find('---', 3)
    if end_idx != -1:
        fm_block = text[3:end_idx].strip()
        has_fm = bool(fm_block) and bool(re.search(r'^\w+\s*:', fm_block, re.MULTILINE))

if not has_fm:
    # Auto-generate frontmatter
    kw_no_best = keyword.lower().replace('best ', '', 1).strip()
    description = f'Best {kw_no_best} — comprehensive guide for parents'[:155]
    title = keyword.title().replace(' For ', ' for ').replace(' In ', ' in ').replace(' And ', ' and ').replace(' Of ', ' of ')
    tags_list = kw_no_best.replace(',', '').split()
    tags_str = ', '.join(tags_list[:3])

    # Try to get description from brief file
    if len(sys.argv) > 3:
        try:
            with open(sys.argv[3]) as f:
                brief = json.load(f)
            keyword = brief.get('keyword', keyword)
            slug = sys.argv[2]
            kw_no_best = keyword.lower().replace('best ', '', 1).strip()
            description = f'Best {kw_no_best} — comprehensive guide for parents'[:155]
            title = keyword.title().replace(' For ', ' for ').replace(' In ', ' in ').replace(' And ', ' and ').replace(' Of ', ' of ')
            tags_list = kw_no_best.replace(',', '').split()
            tags_str = ', '.join(tags_list[:3])
        except:
            pass

    new_fm = f"""title: "{title}"
date: 2026-06-15
draft: false
description: "{description}"
tags: [baby gear, {tags_str}]
author: "MomBabyPicks Team"
cover:
  image: /images/posts/{slug}.webp
  alt: "{title}"
---
"""

    if text.startswith('---'):
        end_idx = text.find('---', 3)
        if end_idx != -1:
            text = '---\n' + new_fm + text[end_idx+3:].lstrip()
        else:
            text = '---\n' + new_fm + text
    else:
        text = '---\n' + new_fm + text

sys.stdout.write(text)

---
title: "Handoff for Hermes"
date: 2026-06-18
draft: true
---

## Handoff Summary

Codex đã xử lý các lỗi source-level rõ ràng trong repo và giữ thay đổi ở phạm vi hẹp.

### Completed

- Fixed the CSS syntax issue in `assets/css/extended/mombabypicks.css` that could break styles after the mobile media query.
- Added conversion-oriented styling for `amazon-subtext` and `home-trust-note`.
- Updated Amazon shortcode behavior in `layouts/shortcodes/amazon.html`:
  - trims input
  - only appends the affiliate tag for real Amazon URLs
  - uses safer `rel` attributes for outbound links
- Tightened affiliate `rel` attributes in `layouts/shortcodes/product-card.html` and `layouts/shortcodes/top-pick.html`.
- Fixed the broken shortcode quoting bug in `content/posts/newborn-feeding-essentials.md`.
- Removed Hugo deprecation warnings in the theme templates:
  - `themes/PaperMod/layouts/baseof.html`
  - `themes/PaperMod/layouts/_partials/templates/opengraph.html`
  - `themes/PaperMod/layouts/rss.xml`

### Verified

- `hugo --gc --minify` passes.
- `bash scripts/verify.sh` passes.
- `git diff --check` passes on the touched source files.

### Next For Hermes

1. Review the remaining `content/posts/*.md` files for shortcode/CTA consistency.
2. Look for posts with generic affiliate disclosures and standardize wording where it improves clarity.
3. Keep an eye on `content/agents/*` outputs if future pipeline runs generate broken or low-score revisions.

### Notes

- `scripts/generate-covers.py` and `scripts/generate-pins-v2.mjs` still have pre-existing changes in the worktree and were not modified in this pass.
- `themes/PaperMod` remains a modified submodule because of the deprecation fixes above.

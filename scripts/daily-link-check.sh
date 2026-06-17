#!/bin/bash
# scripts/daily-link-check.sh — Daily link checker for MomBabyPicks
# Checks: cover images, pin images, internal links, Pinterest pin URLs, live article URLs
# Exit 0 = all ok, Exit 1 = issues found
# Designed to run as a cron job

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
ISSUES=0
REPORT=""
REPORT_FILE="pipeline/logs/link-check-$TIMESTAMP.log"
mkdir -p pipeline/logs

log() { echo "$*" | tee -a "$REPORT_FILE"; }

log "🔗 MomBabyPicks — Daily Link Check"
log "Date: $(date)"
log "========================================="
log ""

# =========================================
# 1. COVER IMAGES — all must exist
# =========================================
log "📷 1. Cover image check"
MISSING_COVERS=0
for article in content/posts/*.md; do
  slug=$(basename "$article" .md)
  cover=$(grep -A2 '^cover:' "$article" | grep 'image:' | sed 's/.*image:[[:space:]]*//' | sed 's/"//g')
  if [ -n "$cover" ]; then
    full="static${cover}"
    if [ ! -f "$full" ]; then
      log "  ❌ $slug — MISSING cover: $cover"
      MISSING_COVERS=$((MISSING_COVERS + 1))
    fi
  else
    log "  ❌ $slug — No cover.image in frontmatter"
    MISSING_COVERS=$((MISSING_COVERS + 1))
  fi
done
if [ "$MISSING_COVERS" -eq 0 ]; then
  log "  ✅ All cover images exist"
fi
log ""

# =========================================
# 2. PIN IMAGES — at least 1 per article
# =========================================
log "📌 2. Pin image check"
MISSING_PINS=0
for article in content/posts/*.md; do
  slug=$(basename "$article" .md)
  pin_count=$(ls "static/images/pins/${slug}-pin-"*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$pin_count" -lt 1 ]; then
    log "  ❌ $slug — No pin images"
    MISSING_PINS=$((MISSING_PINS + 1))
  fi
done
if [ "$MISSING_PINS" -eq 0 ]; then
  log "  ✅ All articles have pin images"
fi
log ""

# =========================================
# 3. INTERNAL LINKS — no broken links
# =========================================
log "🔗 3. Internal link check"
ALL_SLUGS=$(basename -s .md content/posts/*.md | sort)
BROKEN_INTERNAL=0
for article in content/posts/*.md; do
  slug=$(basename "$article" .md)
  for link in $(grep -oP '/posts/[a-zA-Z0-9_-]+' "$article" 2>/dev/null); do
    link_slug=$(echo "$link" | sed 's|/posts/||')
    if ! echo "$ALL_SLUGS" | grep -qx "$link_slug"; then
      log "  ❌ $slug → Broken internal link: $link"
      BROKEN_INTERNAL=$((BROKEN_INTERNAL + 1))
    fi
  done
done
if [ "$BROKEN_INTERNAL" -eq 0 ]; then
  log "  ✅ All internal links valid"
fi
log ""

# =========================================
# 4. PINTEREST PIN URLS — try HTTP check
# =========================================
log "📌 4. Pinterest pin URL check"
BROKEN_PINS=0
for f in data/pinterest/*.json; do
  slug=$(basename "$f" .json)
  url=$(python3 -c "import json; d=json.load(open('$f')); 
if isinstance(d, list):
    for p in d:
        if p.get('status')=='published' and '/pin/' in p.get('published_pin_url',''):
            print(p['published_pin_url']); break
elif isinstance(d, dict):
    if d.get('status')=='published' and '/pin/' in d.get('published_pin_url',''):
        print(d['published_pin_url'])
" 2>/dev/null || true)
  
  if [ -z "$url" ]; then
    log "  ⚠️  $slug — NEED_PUBLISH (no published URL)"
    continue
  fi
  
  # Quick HTTP check via curl (just check if reachable, not content)
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "TIMEOUT/ERR")
  if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ] || [ "$http_code" = "429" ]; then
    log "  ✅ $slug — HTTP $http_code"
  else
    log "  ❌ $slug — HTTP $http_code — pin URL may be broken: $url"
    BROKEN_PINS=$((BROKEN_PINS + 1))
  fi
done
if [ "$BROKEN_PINS" -eq 0 ]; then
  log "  ✅ All published pin URLs reachable"
fi
log ""

# =========================================
# 5. LIVE ARTICLE URLs — check site
# =========================================
log "🌐 5. Live article URL check"
BROKEN_ARTICLES=0
for article in content/posts/*.md; do
  slug=$(basename "$article" .md)
  url="https://mombabypicks.com/posts/${slug}/"
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "TIMEOUT/ERR")
  if [ "$http_code" = "200" ]; then
    log "  ✅ $slug — HTTP 200"
  else
    log "  ❌ $slug — HTTP $http_code: $url"
    BROKEN_ARTICLES=$((BROKEN_ARTICLES + 1))
  fi
done
if [ "$BROKEN_ARTICLES" -eq 0 ]; then
  log "  ✅ All article URLs live"
fi
log ""

# =========================================
# SUMMARY
# =========================================
TOTAL_ISSUES=$((MISSING_COVERS + MISSING_PINS + BROKEN_INTERNAL + BROKEN_PINS + BROKEN_ARTICLES))
log "========================================="
if [ "$TOTAL_ISSUES" -eq 0 ]; then
  log "✅ LINK CHECK: ALL PASS — no issues found"
  # Silent for cron if nothing to report
  echo "[SILENT]"
else
  log "❌ LINK CHECK: $TOTAL_ISSUES issue(s) found"
  log "  Cover images: $MISSING_COVERS missing"
  log "  Pin images: $MISSING_PINS missing"  
  log "  Internal links: $BROKEN_INTERNAL broken"
  log "  Pinterest URLs: $BROKEN_PINS broken"
  log "  Article URLs: $BROKEN_ARTICLES broken"
  log "  Report: $REPORT_FILE"
fi

exit $TOTAL_ISSUES

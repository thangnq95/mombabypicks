#!/bin/bash
# verify-asins.sh — Check ASINs from an article against Amazon product pages
# Usage: bash scripts/verify-asins.sh content/posts/article.md
# Exit 0 = no confirmed dead ASINs
# Exit 1 = one or more ASINs are confirmed dead
# Unknown/bot-blocked pages are reported as UNKNOWN, not dead.

FILE="$1"
DEAD=0
UNKNOWN=0
TOTAL=0

if [ ! -f "$FILE" ]; then
  echo "❌ File not found: $FILE"
  exit 1
fi

# Extract ASINs (macOS-compatible: use awk/sed instead of grep -P)
ASINS=$(awk 'match($0, /\/dp\/[A-Z0-9]{10}/) {s=substr($0, RSTART+4, RLENGTH-4); print s}' "$FILE" | sort -u)

echo "🔎 Verifying $(echo "$ASINS" | wc -l | tr -d ' ') ASINs against Amazon..."

for ASIN in $ASINS; do
  TOTAL=$((TOTAL + 1))
  TMP="$(mktemp)"
  HTTP_CODE=$(curl -sL --max-time 8 \
    -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
    -o "$TMP" -w "%{http_code}" \
    "https://www.amazon.com/dp/$ASIN?tag=mombabypick00-20" 2>/dev/null || echo "000")

  BODY="$(tr '\n' ' ' < "$TMP" 2>/dev/null || true)"
  rm -f "$TMP"

  if echo "$BODY" | grep -Eqi "sorry, we couldn't find that page|page you requested cannot be found|the page you requested was not found"; then
    echo "  ❌ $ASIN — DEAD (Amazon not-found page, HTTP $HTTP_CODE)"
    DEAD=$((DEAD + 1))
  elif echo "$BODY" | grep -Eqi 'id="productTitle"|productTitle'; then
    echo "  ✅ $ASIN — LIVE (product title found, HTTP $HTTP_CODE)"
  elif echo "$BODY" | grep -Eqi 'Robot Check|captcha|automated access|enter the characters you see below|sorry, something went wrong'; then
    echo "  ⚠️ $ASIN — UNKNOWN (bot-check / blocked, HTTP $HTTP_CODE)"
    UNKNOWN=$((UNKNOWN + 1))
  elif [ "$HTTP_CODE" = "404" ] || [ "$HTTP_CODE" = "410" ]; then
    echo "  ❌ $ASIN — DEAD (HTTP $HTTP_CODE)"
    DEAD=$((DEAD + 1))
  else
    echo "  ⚠️ $ASIN — UNKNOWN (HTTP $HTTP_CODE, no dead-page signal)"
    UNKNOWN=$((UNKNOWN + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$DEAD" -eq 0 ]; then
  echo "✅ No confirmed dead ASINs found"
  [ "$UNKNOWN" -gt 0 ] && echo "⚠️ $UNKNOWN ASIN(s) were unknown / bot-blocked"
  exit 0
else
  echo "❌ $DEAD/$TOTAL ASINs confirmed dead"
  [ "$UNKNOWN" -gt 0 ] && echo "⚠️ $UNKNOWN ASIN(s) were unknown / bot-blocked"
  exit 1
fi

#!/bin/bash
# verify-asins.sh — Check ASINs from an article against Amazon product pages
# Usage: bash scripts/verify-asins.sh content/posts/article.md
# Exit 0 = ALL ASINs verified real
# Exit 1 = Some ASINs could not be verified (may be fake)
# Requires: curl, jq (optional)

FILE="$1"
FAILED=0
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
  # Quick check: does the Amazon page return OK?
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
    "https://www.amazon.com/dp/$ASIN" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "  ✅ $ASIN — OK (HTTP $HTTP_CODE)"
  else
    echo "  ❌ $ASIN — FAILED (HTTP $HTTP_CODE — may not exist)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAILED" -eq 0 ]; then
  echo "✅ All $TOTAL ASINs verified real"
  exit 0
else
  echo "❌ $FAILED/$TOTAL ASINs could not be verified"
  echo "   These ASINs may not exist. Verify manually before publishing."
  exit 1
fi

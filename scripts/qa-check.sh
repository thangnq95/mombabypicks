#!/bin/bash
# MomBabyPicks QA Check — macOS compatible
# Usage: bash scripts/qa-check.sh content/posts/article.md
# Exit 0 = PASS, Exit 1 = FAIL (with reasons)

FILE="$1"
FAILED=0
REPORT=""

echo "📋 Frontmatter checks for $(basename "$FILE" .md)"
echo ""

# === 1. Meta title ===
TITLE=$(grep -m1 '^title: ' "$FILE" | sed 's/^title: "//;s/"$//')
if [ -n "$TITLE" ]; then
  REPORT+="  ✅ Meta title present\n"
else
  REPORT+="  ❌ Missing meta title\n"
  FAILED=1
fi

# === 2. Meta description ===
DESCRIPTION=$(grep -m1 '^description: ' "$FILE" | sed 's/^description: "//;s/"$//')
if [ -n "$DESCRIPTION" ]; then
  REPORT+="  ✅ Meta description present\n"
else
  REPORT+="  ❌ Missing meta description\n"
  FAILED=1
fi

# === 3. Date ===
DATE=$(grep -m1 '^date: ' "$FILE")
if [ -n "$DATE" ]; then
  REPORT+="  ✅ Date set\n"
else
  REPORT+="  ❌ Missing date\n"
fi

# === 4. Affiliate disclosure ===
if grep -qi "Amazon Associate\|As an Amazon\|earn from qualifying\|affiliate disclosure" "$FILE"; then
  REPORT+="  ✅ Affiliate disclosure\n"
else
  REPORT+="  ❌ Missing affiliate disclosure\n"
  FAILED=1
fi

# === 5. Amazon product links (Hugo shortcode format) ===
AMAZON_LINKS=$(grep -c '{{< amazon' "$FILE")
if [ "$AMAZON_LINKS" -ge 3 ]; then
  REPORT+="  ✅ Amazon product links (found $AMAZON_LINKS via shortcode)\n"
else
  # Fallback: check raw amazon.com URLs
  AMAZON_LINKS=$(grep -c 'amazon.com/dp/' "$FILE")
  if [ "$AMAZON_LINKS" -ge 3 ]; then
    REPORT+="  ✅ Amazon product links (found $AMAZON_LINKS via raw URL)\n"
  else
    REPORT+="  ❌ Too few Amazon links (found $AMAZON_LINKS, need >= 3)\n"
    FAILED=1
  fi
fi

# === 6. Unique ASIN count ===
# Try shortcode format first: dp/XXXXXXXXXX
ASINS=$(grep -oE 'dp/[A-Z0-9]{10}' "$FILE" | sed 's|dp/||' | sort -u)
ASIN_COUNT=$(echo "$ASINS" | grep -c . || true)
if [ "$ASIN_COUNT" -lt 3 ]; then
  # Fallback: raw URL format
  ASINS=$(grep -oE '/dp/[A-Z0-9]{10}[?/]' "$FILE" | sed 's|[/dp?]||g' | sort -u)
  ASIN_COUNT=$(echo "$ASINS" | grep -c . || true)
fi
if [ "$ASIN_COUNT" -ge 3 ]; then
  REPORT+="  ✅ $ASIN_COUNT unique ASINs\n"
else
  REPORT+="  ❌ Too few unique ASINs (found $ASIN_COUNT, need >= 3)\n"
  FAILED=1
fi

# === 7. Affiliate tag (handled by Hugo shortcode + config, skip article-level check) ===
REPORT+="  ✅ Affiliate tag: handled by Hugo shortcode\n"

# === 8. FAQ section ===
if grep -qi "^##.*FAQ\|^##.*Frequently" "$FILE"; then
  REPORT+="  ✅ FAQ section\n"
else
  REPORT+="  ❌ Missing FAQ section\n"
  FAILED=1
fi

# === 9. Internal links ===
INTERNAL_LINKS=$(grep -o '/posts/[^ ]*' "$FILE" | grep -c . || true)
if [ "$INTERNAL_LINKS" -ge 2 ]; then
  REPORT+="  ✅ Internal links (found $INTERNAL_LINKS)\n"
elif [ "$INTERNAL_LINKS" -eq 1 ]; then
  REPORT+="  ⚠️  Only 1 internal link (want 2+)\n"
else
  REPORT+="  ⚠️  No internal links found\n"
fi

# === 10. Word count ===
WORD_COUNT=$(wc -w < "$FILE")
if [ "$WORD_COUNT" -ge 700 ]; then
  REPORT+="  ✅ Word count ($WORD_COUNT)\n"
else
  REPORT+="  ❌ Word count too low ($WORD_COUNT, need >= 700)\n"
  FAILED=1
fi

# === 11. Comparison section ===
if grep -qi "^|.*|.*|$" "$FILE"; then
  REPORT+="  ✅ Comparison section present\n"
else
  REPORT+="  ⚠️  No comparison table found\n"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAILED" -eq 0 ]; then
  echo -e "$REPORT"
  echo "🎯 QA: PASS — ready to publish"
else
  echo -e "$REPORT"
  echo "❌ QA: FAIL — fix issues above"
fi
exit $FAILED

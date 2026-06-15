#!/bin/bash
# QA Check — Automated pre-publish validation
# Usage: ./scripts/qa-check.sh content/posts/my-article.md
# Returns: exit 0 = PASS, exit 1 = FAIL with report

set -euo pipefail

FILE="$1"
SLUG=$(basename "$FILE" .md)
ERRORS=0
REPORT=""

check() {
  local desc="$1"
  local result="$2"
  if [ "$result" = "FAIL" ]; then
    ERRORS=$((ERRORS + 1))
    REPORT+="  ❌ $desc\n"
  else
    REPORT+="  ✅ $desc\n"
  fi
}

report_error() {
  local desc="$1"
  ERRORS=$((ERRORS + 1))
  REPORT+="  ❌ $desc\n"
}

# ==== Gate 1: File exists ====
if [ ! -f "$FILE" ]; then
  echo "❌ File not found: $FILE"
  exit 1
fi

CONTENT=$(cat "$FILE")
FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$FILE")
BODY=$(sed '1,/^---$/d' "$FILE")

# ==== Gate 2: Frontmatter ====
echo "📋 Frontmatter checks for $SLUG"

if echo "$FRONTMATTER" | grep -q '^title:'; then
  check "Meta title present" "PASS"
else
  report_error "Missing meta title"
fi

if echo "$FRONTMATTER" | grep -q '^description:'; then
  check "Meta description present" "PASS"
else
  report_error "Missing meta description"
fi

if echo "$FRONTMATTER" | grep -q '^date:'; then
  check "Date set" "PASS"
else
  report_error "Missing date"
fi

# ==== Gate 3: Affiliate disclosure ====
if echo "$CONTENT" | grep -qi "amazon associate"; then
  check "Affiliate disclosure" "PASS"
else
  report_error "Missing affiliate disclosure"
fi

# ==== Gate 4: Amazon links ====
AMAZON_LINKS=$(echo "$CONTENT" | grep -c "amazon.com/dp/" || true)
if [ "$AMAZON_LINKS" -ge 3 ]; then
  check "Amazon product links (found $AMAZON_LINKS)" "PASS"
else
  report_error "Too few Amazon links (found $AMAZON_LINKS, need >= 3)"
fi

# ==== Gate 5: ASIN format ====
ASINS=$(echo "$CONTENT" | grep -oP '/dp/[A-Z0-9]{10}' | sort -u || true)
ASIN_COUNT=$(echo "$ASINS" | wc -l | tr -d ' ')
if [ "$ASIN_COUNT" -ge 3 ]; then
  check "Unique ASINs (found $ASIN_COUNT)" "PASS"
else
  report_error "Too few unique ASINs (found $ASIN_COUNT, need >= 3)"
fi

# ==== Gate 6: Affiliate tag ====
if echo "$CONTENT" | grep -q "tag=mombabypick00-20"; then
  check "Affiliate tag (mombabypick00-20)" "PASS"
else
  report_error "Missing affiliate tag (mombabypick00-20)"
fi

# ==== Gate 7: FAQ section ====
if echo "$BODY" | grep -qi "^##.*faq"; then
  check "FAQ section present" "PASS"
else
  report_error "Missing FAQ section"
fi

# ==== Gate 8: Internal links to other posts ====
INTERNAL_LINKS=$(echo "$BODY" | grep -c "/posts/" || true)
if [ "$INTERNAL_LINKS" -ge 1 ]; then
  check "Internal links (found $INTERNAL_LINKS)" "PASS"
else
  report_error "No internal links to other posts"
fi

# ==== Gate 9: Word count ====
WORD_COUNT=$(echo "$BODY" | wc -w | tr -d ' ')
if [ "$WORD_COUNT" -ge 500 ]; then
  check "Word count ($WORD_COUNT)" "PASS"
else
  report_error "Word count too low ($WORD_COUNT, need >= 500)"
fi

# ==== Gate 10: Comparison section ====
if echo "$BODY" | grep -qi "comparison\|vs\.\|versus\|which.*should"; then
  check "Comparison section present" "PASS"
else
  report_error "Missing comparison or vs section"
fi

# ==== Summary ====
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ QA PASS — $SLUG is ready to publish"
  exit 0
else
  echo "❌ QA FAIL — $ERRORS error(s) in $SLUG"
  echo -e "$REPORT"
  exit 1
fi

#!/bin/bash
# Pinterest QA Check — MomBabyPicks
# Output: JSON report of PASS/FAIL per article

REPO="/Users/thangnguyen/GIT/PP/mombabypicks"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PASS_COUNT=0
FAIL_COUNT=0

echo "{"
echo "  \"timestamp\": \"$NOW\","
echo "  \"results\": ["

FIRST=true
for f in "$REPO"/content/posts/*.md; do
  SLUG=$(basename "$f" .md)
  PIN_FILE="$REPO/data/pinterest/$SLUG.json"
  PASS=true
  ISSUES=""

  if [ ! -f "$PIN_FILE" ]; then
    PASS=false
    ISSUES="$ISSUES no_pin_data"
  else
    if grep -q '"status": "published"' "$PIN_FILE" 2>/dev/null; then
      if grep -q 'pin/create/button' "$PIN_FILE" 2>/dev/null; then
        PASS=false
        ISSUES="$ISSUES fake_pin_url"
      fi
    else
      PASS=false
      ISSUES="$ISSUES no_published_pin"
    fi
  fi

  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo ","
  fi

  if [ "$PASS" = true ]; then
    echo "    {\"slug\": \"$SLUG\", \"status\": \"PASS\", \"issues\": \"\"}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "    {\"slug\": \"$SLUG\", \"status\": \"FAIL\", \"issues\": \"$ISSUES\"}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "  ],"
echo "  \"summary\": {"
echo "    \"total\": $(ls \"$REPO\"/content/posts/*.md | wc -l | tr -d ' '),"
echo "    \"pass\": $PASS_COUNT,"
echo "    \"fail\": $FAIL_COUNT"
echo "  }"
echo "}"

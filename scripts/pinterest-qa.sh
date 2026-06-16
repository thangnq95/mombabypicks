#!/bin/bash
# Pinterest QA Check — MomBabyPicks
# Output: JSON report of PASS/FAIL per article

REPO="/Users/thangnguyen/GIT/PP/mombabypicks"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "{"
echo "  \"timestamp\": \"$NOW\","
echo "  \"results\": ["

FIRST=true
for f in "$REPO"/content/posts/*.md; do
  SLUG=$(basename "$f" .md)
  PIN_FILE="$REPO/data/pinterest/$SLUG.json"
  PASS=true
  ISSUES=""

  # Check if pin data exists
  if [ ! -f "$PIN_FILE" ]; then
    PASS=false
    ISSUES="$ISSUES no_pin_data"
  else
    # Check if any pin has status "published"
    if grep -q '"status": "published"' "$PIN_FILE" 2>/dev/null; then
      # Check if published_pin_url is real (not create/button)
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
  else
    echo "    {\"slug\": \"$SLUG\", \"status\": \"FAIL\", \"issues\": \"$ISSUES\"}"
  fi
done

echo ""
echo "  ],"
echo "  \"summary\": {"
PASS_COUNT=$(grep -c '"status": "PASS"' /dev/stdin 2>/dev/null || echo 0)
FAIL_COUNT=$(grep -c '"status": "FAIL"' /dev/stdin 2>/dev/null || echo 0)
echo "    \"total\": $(ls "$REPO"/content/posts/*.md | wc -l | tr -d ' '),"
echo "    \"pass\": 0,"
echo "    \"fail\": 0"
echo "  }"
echo "}"

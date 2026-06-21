#!/bin/bash
# MomBabyPicks Daily Check-in Script
# Runs at 9AM daily via cron
set -euo pipefail

REPO="/Users/thangnguyen/GIT/PP/mombabypicks"
LOGS="$REPO/pipeline/logs"
DATE=$(date +%Y-%m-%d)
REPORT="$LOGS/codex-daily-$DATE.md"

cd "$REPO"
mkdir -p "$LOGS"

{
echo "# MomBabyPicks Daily Report — $DATE"
echo ""
echo "- Job: mombabypicks-codex-daily"
echo "- Time: $(date)"
echo ""

# ---- 1. GA4 snapshot (if available) ----
echo "## 1. GA4 Snapshot"
if [ -n "${GA4_PROPERTY_ID:-}" ] && [ -f "${GA4_SERVICE_ACCOUNT_KEY:-}" ]; then
  GA4_OUT="$LOGS/ga4-$(date +%Y-%m-%d).json"
  if python3 scripts/ga4-report.py \
    --key "$GA4_SERVICE_ACCOUNT_KEY" \
    --property "$GA4_PROPERTY_ID" \
    --days 1 \
    --limit 10 \
    --report affiliate-clicks \
    --output "$GA4_OUT" >/dev/null 2>&1; then
    top_page=$(python3 - <<'PY' "$GA4_OUT"
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
data = json.loads(p.read_text()) if p.exists() else {}
rows = data.get("rows", [])
if not rows:
    print("n/a")
else:
    dims = [d["name"] for d in data.get("dimensionHeaders", [])]
    mets = [m["name"] for m in data.get("metricHeaders", [])]
    row = rows[0]
    record = {}
    for i, v in enumerate(row.get("dimensionValues", [])):
        record[dims[i]] = v.get("value")
    for i, v in enumerate(row.get("metricValues", [])):
        record[mets[i]] = v.get("value")
    print(f"{record.get('pagePathPlusQueryString', 'n/a')} ({record.get('eventCount', '0')} clicks)")
PY
)
    echo "- GA4 property: $GA4_PROPERTY_ID"
    echo "- Top page: $top_page"
    echo "- Snapshot: $GA4_OUT"
  else
    echo "- ❌ GA4 fetch failed"
  fi
else
  echo "- ⚠️ GA4 not configured (missing env vars)"
fi
echo ""

# ---- 2. Site health ----
echo "## 2. Site Health"
curl -sL -o /dev/null -w "- Homepage: %{http_code} (%{time_total}s)\n" \
  "https://mombabypicks.com/" 2>/dev/null || echo "- ❌ Homepage unreachable"

# Count articles and pins
ARTICLES=$(ls content/posts/*.md 2>/dev/null | wc -l | tr -d ' ')
PINS=$(ls static/images/pins/*pin-1.png 2>/dev/null | wc -l | tr -d ' ')
echo "- Articles: $ARTICLES"
echo "- Pin sets: $PINS"
echo ""

# ---- 3. Git status ----
echo "## 3. Repo Status"
if git diff --quiet && git diff --cached --quiet; then
  echo "- ✅ Clean"
else
  echo "- ⚠️ Uncommitted changes"
fi
echo ""

echo "---"
echo "*Report auto-generated at $(date)*"

} > "$REPORT"

echo "✅ $REPORT"

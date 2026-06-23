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

# ---- 3. Priority pages ----
echo "## 3. Priority Pages"
python3 - <<'PY'
import json
import re
from pathlib import Path

roadmap = Path("pipeline/weekly-checklist.yaml")
if not roadmap.exists():
    print("- No weekly checklist found")
    raise SystemExit(0)

lines = roadmap.read_text().splitlines()
targets = []
capture = False
for line in lines:
    if re.match(r'^\s*next_targets:\s*$', line):
        capture = True
        continue
    if capture:
        m = re.match(r'^\s*-\s*"([^"]+)"\s*$', line)
        if m:
            targets.append(m.group(1))
            continue
        if line and not line.startswith(" "):
            break

if not targets:
    print("- No next targets listed")
    raise SystemExit(0)

for slug in targets[:3]:
    pin_path = Path("data/pinterest") / f"{slug}.json"
    image_count = len(list(Path("static/images/pins").glob(f"{slug}-pin-*.png")))
    if not pin_path.exists():
        print(f"- {slug}: no pin JSON")
        continue
    try:
        data = json.loads(pin_path.read_text())
    except Exception:
        print(f"- {slug}: unreadable pin JSON")
        continue
    if not isinstance(data, list):
        print(f"- {slug}: unexpected pin JSON shape")
        continue
    published = sum(1 for item in data if isinstance(item, dict) and item.get("status") in {"published", "backfilled"} and item.get("published_pin_url"))
    drafts = sum(1 for item in data if isinstance(item, dict) and item.get("status") == "draft")
    missing = max(image_count - len(data), 0)
    print(f"- {slug}: {published} published, {drafts} draft, {missing} missing")
PY
echo ""

# ---- 4. Git status ----
echo "## 4. Repo Status"
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

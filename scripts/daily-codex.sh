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
  GA4_CLICKS_OUT="$LOGS/ga4-$(date +%Y-%m-%d).json"
  GA4_TRAFFIC_OUT="$LOGS/ga4-traffic-$(date +%Y-%m-%d).json"
  clicks_ok=0
  traffic_ok=0
  if python3 scripts/ga4-report.py \
    --key "$GA4_SERVICE_ACCOUNT_KEY" \
    --property "$GA4_PROPERTY_ID" \
    --days 1 \
    --limit 10 \
    --report affiliate-clicks \
    --output "$GA4_CLICKS_OUT" >/dev/null 2>&1; then
    clicks_ok=1
  fi
  if python3 scripts/ga4-report.py \
    --key "$GA4_SERVICE_ACCOUNT_KEY" \
    --property "$GA4_PROPERTY_ID" \
    --days 7 \
    --limit 50 \
    --report traffic-sources \
    --output "$GA4_TRAFFIC_OUT" >/dev/null 2>&1; then
    traffic_ok=1
  fi

  if [ "$clicks_ok" -eq 1 ] || [ "$traffic_ok" -eq 1 ]; then
    python3 - <<'PY' "$GA4_CLICKS_OUT" "$GA4_TRAFFIC_OUT" "$GA4_PROPERTY_ID"
import json, sys
from pathlib import Path

clicks_path = Path(sys.argv[1])
traffic_path = Path(sys.argv[2])
property_id = sys.argv[3]

def rows_to_records(path):
    data = json.loads(path.read_text()) if path.exists() else {}
    dims = [d["name"] for d in data.get("dimensionHeaders", [])]
    mets = [m["name"] for m in data.get("metricHeaders", [])]
    records = []
    for row in data.get("rows", []):
        record = {}
        for i, value in enumerate(row.get("dimensionValues", [])):
            record[dims[i]] = value.get("value", "")
        for i, value in enumerate(row.get("metricValues", [])):
            raw = value.get("value", "0")
            try:
                record[mets[i]] = int(raw)
            except ValueError:
                record[mets[i]] = float(raw)
        records.append(record)
    return records

click_rows = rows_to_records(clicks_path)
traffic_rows = rows_to_records(traffic_path)

print(f"- GA4 property: {property_id}")
if click_rows:
    row = click_rows[0]
    print(f"- Top affiliate-click page (1d): {row.get('pagePathPlusQueryString', 'n/a')} ({row.get('eventCount', 0)} clicks)")
else:
    print("- Top affiliate-click page (1d): n/a")

groups = {
    "organic": {"sessions": 0, "views": 0},
    "direct": {"sessions": 0, "views": 0},
    "dev_referral": {"sessions": 0, "views": 0},
    "other": {"sessions": 0, "views": 0},
}

for row in traffic_rows:
    channel = str(row.get("sessionDefaultChannelGroup", "")).lower()
    source = str(row.get("sessionSourceMedium", "")).lower()
    sessions = int(row.get("sessions", 0) or 0)
    views = int(row.get("screenPageViews", 0) or 0)
    if "localhost" in source or "127.0.0.1" in source:
        bucket = "dev_referral"
    elif "organic" in channel or "organic" in source:
        bucket = "organic"
    elif channel == "direct" or source == "(direct) / (none)":
        bucket = "direct"
    else:
        bucket = "other"
    groups[bucket]["sessions"] += sessions
    groups[bucket]["views"] += views

print("- Traffic quality (7d):")
for label, key in [
    ("Organic search", "organic"),
    ("Direct", "direct"),
    ("Dev/referral noise", "dev_referral"),
    ("Other", "other"),
]:
    bucket = groups[key]
    print(f"  - {label}: {bucket['sessions']} sessions, {bucket['views']} views")

if traffic_rows:
    print("- Top traffic sources (7d):")
    for row in traffic_rows[:5]:
        print(
            f"  - {row.get('sessionDefaultChannelGroup', 'n/a')} | "
            f"{row.get('sessionSourceMedium', 'n/a')} | "
            f"{row.get('pagePathPlusQueryString', 'n/a')} "
            f"({row.get('sessions', 0)} sessions / {row.get('screenPageViews', 0)} views)"
        )

print(f"- Affiliate snapshot: {clicks_path}")
print(f"- Traffic-source snapshot: {traffic_path}")
PY
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

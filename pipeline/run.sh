#!/bin/bash
# pipeline/run.sh — MomBabyPicks v2 Content Pipeline
# Usage: ./pipeline/run.sh [topic-id]
#   If topic-id omitted, picks next ready topic from queue
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="pipeline/logs/$TIMESTAMP.log"
mkdir -p pipeline/logs

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG_FILE"; }

CLAUDECMD="$HOME/.local/bin/claude --dangerously-skip-permissions"

# ==== Step 0: Pick topic ====
if [ $# -ge 1 ]; then
  TOPIC_ID="$1"
  log "Topic specified: $TOPIC_ID"
else
  TOPIC_JSON=$(python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
ready = sorted([t for t in topics if t.get('status') == 'ready'], key=lambda x: x.get('priority', 99))
if ready: print(json.dumps(ready[0]))
else: print('{}')
")
  TOPIC_ID=$(echo "$TOPIC_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
  if [ -z "$TOPIC_ID" ]; then
    log "❌ No ready topics in queue"
    exit 1
  fi
  log "Picked next topic: $TOPIC_ID"
fi

# Get keyword
KEYWORD=$(python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        print(t['keyword'])
        break
")

SLUG=$(echo "$KEYWORD" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')
BRIEF_FILE="content/agents/content-briefs/${TOPIC_ID}-${SLUG}.json"
DRAFT_FILE="content/agents/drafts/${TOPIC_ID}-${SLUG}.json"
ARTICLE_FILE="content/posts/${SLUG}.md"
REVIEW_FILE="content/agents/drafts/${TOPIC_ID}-${SLUG}-review.json"

log "Topic: $KEYWORD"
log "Slug: $SLUG"

# ==== Step 1: Mark topic as in_progress ====
python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        t['status'] = 'in_progress'
        break
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
" 2>/dev/null || true

# ==== Step 2: Create content brief (Hermes proposes topic only — no deep Amazon data) ====
log "📋 Step 1: Creating content brief..."
cat > "$BRIEF_FILE" << CONTENTBRIEF
{
  "topic_id": "$TOPIC_ID",
  "keyword": "$KEYWORD",
  "slug": "$SLUG",
  "search_intent": "commercial - parent researching best product category for their baby",
  "article_type": "comparison_buyers_guide",
  "target_word_count": 1000,
  "recommended_products": [],
  "competitor_urls": [],
  "notes": "Hermes proposes topic only. Amazon product details are NOT researched here — will be determined at publish time via script verification.",
  "creation_date": "$(date +%Y-%m-%d)",
  "generator": "Hermes Agent"
}
CONTENTBRIEF
log "✅ Content brief saved: $BRIEF_FILE"

# ==== Step 3: Claude Code writes article ====
$CLAUDECMD -p "
You are Affiliate_Content_Producer for MomBabyPicks.com.

Write a 1500-2000 word buyer's guide / comparison article targeting the keyword: \"$KEYWORD\"

IMPORTANT:
- OUTPUT the COMPLETE ARTICLE with frontmatter as raw markdown.
- Do NOT say 'I wrote the article' or give a summary. ONLY output the article itself.
- Start with '---' (frontmatter delimiter).
- End with the affiliate disclosure.

CONTENT RULES:
- Recommend 5 products, each with pros/cons and 'Who it's for'
- Include a markdown comparison table
- FAQ: 5-6 questions
- Amazon links: use Hugo shortcode {{< amazon url=\"https://www.amazon.com/dp/XXXXXXXXXX\" text=\"Check Price on Amazon →\" >}} (do NOT add ?tag= — shortcode handles it)
- Include at least 3 internal links to different /posts/ pages (use relative paths)
- Add a 'How We Selected' paragraph after intro explaining criteria
- Add a 'Material Safety & Certifications' section covering BPA-free, phthalate-free, food-grade silicone, glass vs plastic
- NEVER make unsubstantiated claims like 'most recommended by pediatricians' or 'award-winning' — stick to verifiable product features
- Use practical parent-experience tone (not clinical)
- Affiliate disclosure at end
- Frontmatter: title, date, description (≤155 chars), tags, cover image, author: MomBabyPicks Team
- Output the article directly as raw markdown starting with ---. Do NOT wrap in code fences.

SEO STRUCTURE:
---
title: \"...\"
date: $(date +%Y-%m-%d)
draft: false
description: \"...\"
tags: [baby bottles, newborns, ...]
cover:
  image: /images/posts/${SLUG}.webp
  alt: \"...\"
---

## Introduction
## How We Selected These Bottles
## Comparison Table
## [Product 1 Name]
## [Product 2 Name]
## [Product 3 Name]
## [Product 4 Name]
## [Product 5 Name]
## Material Safety & Certifications
## FAQ
## Which Bottle Should You Choose?" 2>/dev/null > "$ARTICLE_FILE.tmp" || (echo "ERROR:claude_failed" > "$ARTICLE_FILE.tmp")

# Strip code fences from raw output (direct file processing)
python3 scripts/strip-fences.py < "$ARTICLE_FILE.tmp" > "$ARTICLE_FILE" 2>/dev/null || cp "$ARTICLE_FILE.tmp" "$ARTICLE_FILE"
rm -f "$ARTICLE_FILE.tmp"

# Check if article has real content (frontmatter marker)
if ! head -1 "$ARTICLE_FILE" | grep -q "^---"; then
  log "❌ Claude did not output valid article (no frontmatter)"
  log "Raw output (first 200 chars): $(head -c 200 "$ARTICLE_FILE")"
  python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        t['status'] = 'failed'
        t['fail_reason'] = 'claude_producer_error'
        break
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
"
  log "Topic $TOPIC_ID marked as failed"
  exit 1
fi

log "✅ Article written: $ARTICLE_FILE"

# ==== Step 2.5: Generate cover image if missing ====
log "🎨 Step 2.5: Checking cover image..."
COVER_PATH=$(python3 -c "
import re
with open('$ARTICLE_FILE') as f:
    content = f.read()
fm = content.split('---')[1] if content.startswith('---') else ''
match = re.search(r'image:\s*(.*?)(\s|$)', fm)
if match:
    path = match.group(1).strip().strip('\"').strip(\"'\").lstrip('/')
    print('static/' + path)
else:
    print('')
" 2>/dev/null)

if [ -n "$COVER_PATH" ] && [ ! -f "$COVER_PATH" ]; then
  log "📷 Cover image missing: $COVER_PATH — generating..."
  mkdir -p "$(dirname "$COVER_PATH")"
  python3 -c "
import re
from PIL import Image, ImageDraw, ImageFont
import textwrap

with open('$ARTICLE_FILE') as f:
    content = f.read()
title_match = re.search(r'title:\s*\"(.+?)\"', content)
title = title_match.group(1) if title_match else 'MomBabyPicks'

img = Image.new('RGB', (1200, 675), color=(245, 235, 220))
draw = ImageDraw.Draw(img)
draw.rectangle([(0, 600), (1200, 675)], fill=(230, 180, 140))

try:
    font_large = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 48)
    font_small = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 24)
except:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

lines = textwrap.wrap(title, width=25)
y = 200
for line in lines[:3]:
    bbox = draw.textbbox((0, 0), line, font=font_large)
    w = bbox[2] - bbox[0]
    draw.text(((1200-w)//2, y), line, fill=(120, 80, 60), font=font_large)
    y += 60

draw.text((50, 620), 'MomBabyPicks.com', fill=(100, 60, 40), font=font_small)
draw.text((900, 620), 'Honest Reviews', fill=(100, 60, 40), font=font_small)
img.save('$COVER_PATH', 'WEBP', quality=85)
import os
print(f'Generated: {os.path.getsize(\"$COVER_PATH\")} bytes')
" 2>&1 | tee -a "$LOG_FILE"
  log "✅ Cover image generated: $COVER_PATH"
else
  log "✅ Cover image exists (or not specified)"
fi

# ==== Step 4: Claude Code reviews article ====
log "🔍 Step 3: Claude Code reviewing article..."
REVIEW_RAW=$($CLAUDECMD -p "
You are Affiliate_Content_REVIEWER for MomBabyPicks.com.

Read the file $ARTICLE_FILE and score it.

SCORE EACH DIMENSION (0-100):
1. seo_quality
2. readability
3. affiliate_compliance
4. content_completeness
5. product_coverage
6. internal_linking
7. eeat_signals
8. hallucination_risk — LOW SCORE (e.g. 90+) = SAFE. HIGH hallucination risk = LOW score (e.g. 30).

Overall score 0-100.
>= 80 → PASS | 60-79 → REVISE | < 60 → REJECT

AUTO-REJECT if: no affiliate disclosure, missing FAQ, hallucination_risk < 50

OUTPUT ONLY raw JSON, no markdown, no code fences, no explanation:
{\"overall_score\": 82, \"decision\": \"PASS\", \"dimensions\": {\"seo_quality\": 82, \"readability\": 85, \"affiliate_compliance\": 90, \"content_completeness\": 80, \"product_coverage\": 82, \"internal_linking\": 75, \"eeat_signals\": 78, \"hallucination_risk\": 85}, \"issues\": [\"Minor: internal links could be more diverse\"], \"auto_reject_reasons\": []}
" --allowedTools "Read" --max-turns 3 --output-format json 2>/dev/null || echo '{"error":"claude_failed"}')

# Save raw output
echo "$REVIEW_RAW" > "$REVIEW_FILE"

# Parse: handle --output-format json wrapper: {type, subtype, result: '...'}
SCORE=$(python3 -c "
import sys, json
with open('$REVIEW_FILE') as f:
    text = f.read().strip()
try:
    d = json.loads(text)
    # If wrapped in --output-format json, extract result field
    if 'result' in d and isinstance(d['result'], str):
        inner = d['result'].strip()
        # Strip markdown code fences if present
        if inner.startswith('\`\`\`'):
            inner = inner.split('\n', 1)[1] if '\n' in inner else inner
            inner = inner.rsplit('\`\`\`', 1)[0].strip()
        d2 = json.loads(inner)
        print(d2.get('overall_score', 0))
    elif 'overall_score' in d:
        print(d.get('overall_score', 0))
    else:
        # Try to find JSON in text
        import re
        match = re.search(r'{\s*\"overall_score', text)
        if match:
            # Find balanced end
            depth = 0
            for i, c in enumerate(text[match.start():]):
                if c == '{': depth += 1
                elif c == '}': depth -= 1
                if depth == 0:
                    d3 = json.loads(text[match.start():match.start()+i+1])
                    print(d3.get('overall_score', 0))
                    break
            else:
                print(0)
        else:
            print(0)
except:
    print(0)

" 2>/dev/null || echo "0")

DECISION=$(python3 -c "
import sys, json, re
with open('$REVIEW_FILE') as f:
    text = f.read().strip()
try:
    d = json.loads(text)
    # If wrapped in --output-format json, extract result field
    if 'result' in d and isinstance(d['result'], str):
        inner = d['result'].strip()
        # Strip markdown code fences if present
        if inner.startswith('\`\`\`'):
            inner = inner.split('\n', 1)[1] if '\n' in inner else inner
            inner = inner.rsplit('\`\`\`', 1)[0].strip()
        d2 = json.loads(inner)
        print(d2.get('decision', 'REJECT'))
    elif 'decision' in d:
        print(d.get('decision', 'REJECT'))
    else:
        match = re.search(r'\"decision\":\s*\"(\w+)\"', text)
        if match:
            print(match.group(1))
        else:
            print('REJECT')
except:
    match = re.search(r'\"decision\":\s*\"(\w+)\"', text)
    if match:
        print(match.group(1))
    else:
        print('REJECT')
")

log "Review score: $SCORE — Decision: $DECISION"

log "Review threshold: score >= 80 AND decision == PASS"

# ==== Step 5: Gate — review score check ====
if [ "$DECISION" != "PASS" ] || [ "$SCORE" -lt 80 ]; then
  log "❌ Article failed review (score=$SCORE, decision=$DECISION)"
  cp "$ARTICLE_FILE" "content/agents/revisions/${TOPIC_ID}-${SLUG}.md"
  python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        t['status'] = 'needs_revision'
        t['review_score'] = $SCORE
        break
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
"
  log "Article moved to revisions/"
  exit 1
fi

# ==== Step 6: QA checks ====
log "🧪 Step 4: Running QA checks..."
if bash scripts/qa-check.sh "$ARTICLE_FILE" 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ QA passed"
else
  log "❌ QA failed"
  cp "$ARTICLE_FILE" "content/agents/revisions/${TOPIC_ID}-${SLUG}-qafail.md"
  python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        t['status'] = 'qa_failed'
        break
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
"
  exit 1
fi

# ==== Step 5: ASIN verification (non-blocking warning) ====
log "🔎 Step 5: Verifying ASINs against Amazon..."
if bash scripts/verify-asins.sh "$ARTICLE_FILE" 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ All ASINs verified real"
else
  log "⚠️ WARNING: Some ASINs could not be verified. Publishing anyway — flag for review."
  # Note the issue for manual follow-up
  python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        t['asin_flagged'] = True
        break
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
"
fi

# ==== Step 6: Hugo build ====
log "🏗️ Step 6: Hugo build..."
cd "$REPO_DIR"
if hugo 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ Hugo build succeeded"
else
  log "❌ Hugo build failed"
  exit 1
fi

# ==== Step 7: Git commit & push ====
log "📦 Step 7: Committing & pushing..."
git add content/posts/
git commit -m "feat: add $SLUG" 2>&1 | tee -a "$LOG_FILE"
git push origin main 2>&1 | tee -a "$LOG_FILE"

# ==== Step 8: Update queue ====
python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        t['status'] = 'published'
        t['published_date'] = '$(date +%Y-%m-%d)'
        t['review_score'] = $SCORE
        break
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
"

# ==== Step 9: Log sprint ====
python3 -c "
import json
with open('pipeline/sprint-log.json') as f:
    logdata = json.load(f)
logdata['last_run'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
logdata['published'].append({
    'id': '$TOPIC_ID',
    'keyword': '$KEYWORD',
    'slug': '$SLUG',
    'score': $SCORE,
    'date': '$(date +%Y-%m-%d)'
})
with open('pipeline/sprint-log.json', 'w') as f:
    json.dump(logdata, f, indent=2)
"

log ""
log "🎉 DONE! Article published: https://mombabypicks.com/posts/${SLUG}/"
log "Topic $TOPIC_ID — $KEYWORD"
log "Score: $SCORE/100"

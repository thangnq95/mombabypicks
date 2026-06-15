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

Write a ~1000-word buyer's guide / comparison article targeting the keyword: \"$KEYWORD\"

IMPORTANT:
- OUTPUT the COMPLETE ARTICLE with frontmatter as raw markdown.
- Do NOT say 'I wrote the article' or give a summary. ONLY output the article itself.
- Start with '---' (frontmatter delimiter).
- End with the affiliate disclosure.

CONTENT RULES:
- Recommend 5 products, each with pros/cons and 'Who it's for'
- Include a markdown comparison table
- FAQ: 4-5 questions
- Amazon links: use Hugo shortcode {{< amazon url=\"https://www.amazon.com/dp/XXXXXXXXXX\" text=\"Check Price on Amazon →\" >}} (do NOT add ?tag= — shortcode handles it)
- Include at least 3 internal links to different /posts/ pages (use relative paths)
- Add a brief 'How We Selected' paragraph after the intro explaining criteria
- Avoid unverifiable medical or scientific claims
- Use practical parent-experience tone (not clinical)
- Affiliate disclosure at end
- Frontmatter: title, date, description (≤155 chars), tags, cover image
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
## Comparison Table
## [Product 1 Name]
## [Product 2 Name]
## [Product 3 Name]
## [Product 4 Name]
## [Product 5 Name]
## FAQ
## Which Bottle Should You Choose?
" 2>/dev/null > "$ARTICLE_FILE.tmp" || (echo "ERROR:claude_failed" > "$ARTICLE_FILE.tmp")

# Strip code fences from raw output (direct file processing — no shell var)
python3 -c "
import re
with open('$ARTICLE_FILE.tmp') as f:
    text = f.read()
text = text.lstrip()
text = re.sub(r'^```\w*\n?', '', text)
text = re.sub(r'\n```\s*$', '', text)
text = text.strip() + '\n'
with open('$ARTICLE_FILE', 'w') as f:
    f.write(text)
"
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

# ==== Step 4: Claude Code reviews article ====
log "🔍 Step 3: Claude Code reviewing article..."
REVIEW_RAW=$($CLAUDECMD -p "
You are Affiliate_Content_ReviewER for MomBabyPicks.com.

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
" 2>/dev/null || echo '{"error":"claude_failed"}')

# Save review
echo "$REVIEW_RAW" > "$REVIEW_FILE"

# Parse score
SCORE=$(python3 -c "
import sys, json
with open('$REVIEW_FILE') as f:
    text = f.read()
try:
    d = json.loads(text)
    print(d.get('overall_score', 0))
except json.JSONDecodeError:
    # Try to find balanced JSON object
    depth = 0
    start = -1
    for i, c in enumerate(text):
        if c == '{':
            if start == -1:
                start = i
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    d = json.loads(text[start:i+1])
                    print(d.get('overall_score', 0))
                except:
                    print(0)
                break
            elif depth < 0:
                break
    else:
        print(0)
" 2>/dev/null || echo "0")

DECISION=$(python3 -c "
import sys, json
with open('$REVIEW_FILE') as f:
    text = f.read()
try:
    d = json.loads(text)
    print(d.get('decision', 'REJECT'))
except json.JSONDecodeError:
    import re
    match = re.search(r'\"decision\":\s*\"(\w+)\"', text)
    if match:
        print(match.group(1))
    else:
        print('REJECT')
")

log "Review score: $SCORE — Decision: $DECISION"

# ==== Step 5: Gate — review score check ====
if [ "$DECISION" != "PASS" ]; then
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

# ==== Step 5: ASIN verification ====
log "🔎 Step 5: Verifying ASINs against Amazon..."
if bash scripts/verify-asins.sh "$ARTICLE_FILE" 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ All ASINs verified real"
else
  log "❌ ASIN verification failed — some products may not exist"
  python3 -c "
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == '$TOPIC_ID':
        t['status'] = 'asin_failed'
        break
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
"
  exit 1
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

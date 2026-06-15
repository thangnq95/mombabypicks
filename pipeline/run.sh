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
CLAUDECMD="$HOME/.local/bin/claude"
log "✍️ Step 2: Claude Code writing article..."
CLAUDEOUT=$($CLAUDECMD -p "
You are Affiliate_Content_Producer for MomBabyPicks.com — an Amazon affiliate site helping parents find the best baby products.

Write a 1000-word buyer's guide / comparison article targeting the keyword: \"$KEYWORD\"

IMPORTANT RULES:
1. Write for real parents — practical, warm tone, not salesy
2. Recommend 4-5 products in each category. Use GENERIC amazon links with format: https://www.amazon.com/dp/XXXXXXXXXX?tag=mombabypick00-20
3. Each product needs: a paragraph about who it's best for, pros/cons, the downside
4. Include a comparison table (using markdown table)
5. Include FAQ section with 4-5 questions
6. Link to at least 1 existing post on this site using relative /posts/ URLs
7. End with affiliate disclosure: \"As an Amazon Associate I earn from qualifying purchases.\"
8. Frontmatter with title, date: $(date +%Y-%m-%d), description (max 155 chars), tags, cover image

SEO STRUCTURE:
- H2: Introduction (what the parent is looking for)
- H2: [Category] Comparison Table
- H2: Product 1
- H2: Product 2  
- H2: Product 3
- H2: Product 4
- H2: FAQ
- H2: Which One Should You Choose?

OUTPUT FORMAT: 
\`\`\`
---
title: \"...\"
date: $(date +%Y-%m-%d)
draft: false
description: \"155-char meta description\"
tags: [tag1, tag2, tag3]
cover:
  image: /images/posts/${SLUG}.webp
  alt: \"...\"
---

[article content...]
\`\`\`
" --allowedTools "Read,Write" --max-turns 10 --output-format json 2>/dev/null || echo '{"error":"claude failed"}')

# Extract article content from Claude output
ARTICLE_BODY=$(echo "$CLAUDEOUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'result' in data:
        print(data['result'])
    elif 'error' in data:
        print('ERROR: ' + data['error'])
    else:
        print(json.dumps(data, indent=2)[:500])
except:
    print(sys.stdin.read()[:500])
" 2>/dev/null || echo "ERROR: Could not parse Claude output")

# Check if Claude succeeded
if echo "$ARTICLE_BODY" | grep -q "^ERROR"; then
  log "❌ Claude failed: $ARTICLE_BODY"
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

# Save draft
echo "$ARTICLE_BODY" > "$ARTICLE_FILE"
log "✅ Article written: $ARTICLE_FILE"

# ==== Step 4: Claude Code reviews article ====
log "🔍 Step 3: Claude Code reviewing article..."
REVIEW_OUT=$($CLAUDECMD -p "
You are Affiliate_Content_ReviewER for MomBabyPicks.com. Review this article and score it.

ARTICLE FILE: $ARTICLE_FILE

SCORE EACH DIMENSION (0-100):
1. seo_quality — keyword in H1, H2s, meta, naturally used
2. readability — clear sentences, scannable, good paragraph breaks  
3. affiliate_compliance — disclosure present, Amazon links formatted correctly with tag
4. content_completeness — covers topic well, sufficient depth, 800+ words
5. product_coverage — 4+ products with pros/cons and who-it's-for
6. internal_linking — links to at least 1 other /posts/ page
7. eeat_signals — shows practical experience, trustworthy tone
8. hallucination_risk — LOW SCORE = safer. If you suspect fabricated claims, score LOW.

Overall score 0-100. Decision:
- >= 85 → PASS
- 70-84 → REVISE  
- < 70 → REJECT

AUTO-REJECT if:
- No affiliate disclosure
- Missing FAQ section
- hallucination_risk < 60

OUTPUT ONLY valid JSON with this exact schema:
\`\`\`json
{
  \"overall_score\": 85,
  \"decision\": \"PASS\",
  \"dimensions\": {
    \"seo_quality\": 85,
    \"readability\": 88,
    \"affiliate_compliance\": 90,
    \"content_completeness\": 82,
    \"product_coverage\": 80,
    \"internal_linking\": 75,
    \"eeat_signals\": 85,
    \"hallucination_risk\": 90
  },
  \"issues\": [
    \"Internal links could be stronger\"
  ],
  \"auto_reject_reasons\": []
}
\`\`\`
" --allowedTools "Read" --max-turns 3 --output-format json 2>/dev/null || echo '{"error":"review claude failed"}')

# Parse review result 
echo "$REVIEW_OUT" > "$REVIEW_FILE"
SCORE=$(echo "$REVIEW_OUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'result' in data:
        result = data['result']
        # Try to extract JSON from the result text
        import re
        match = re.search(r'\{.*\"overall_score\".*\}', result, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
            print(parsed.get('overall_score', 0))
        else:
            print(0)
    else:
        print(0)
except:
    print(0)
" 2>/dev/null || echo "0")

DECISION=$(echo "$REVIEW_OUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'result' in data:
        import re
        match = re.search(r'\"decision\":\s*\"(\w+)\"', data['result'])
        if match:
            print(match.group(1))
        else:
            print('REJECT')
    else:
        print('REJECT')
except:
    print('REJECT')
" 2>/dev/null || echo "REJECT")

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

# ==== Step 7: Hugo build ====
log "🏗️ Step 5: Hugo build..."
cd "$REPO_DIR"
if hugo 2>&1 | tee -a "$LOG_FILE"; then
  log "✅ Hugo build succeeded"
else
  log "❌ Hugo build failed"
  exit 1
fi

# ==== Step 8: Git commit ====
log "📦 Step 6: Committing..."
git add content/posts/ public/
git commit -m "feat: add $SLUG" 2>&1 | tee -a "$LOG_FILE"
git push origin main 2>&1 | tee -a "$LOG_FILE"

# ==== Step 9: Update queue ====
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

# ==== Step 10: Log sprint ====
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

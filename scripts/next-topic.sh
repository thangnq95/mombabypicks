#!/bin/bash
# next-topic.sh — pick next ready topic from queue
# Output: JSON with topic id, keyword, priority
# Usage: ./scripts/next-topic.sh
set -euo pipefail

TOPIC_FILE="pipeline/topic-queue.json"

if [ ! -f "$TOPIC_FILE" ]; then
  echo '{"error": "topic-queue.json not found"}'
  exit 1
fi

# Pick first topic with status "ready", sorted by priority
python3 -c "
import json, sys
with open('$TOPIC_FILE') as f:
    topics = json.load(f)
ready = sorted([t for t in topics if t.get('status') == 'ready'], key=lambda x: x.get('priority', 99))
if not ready:
    print(json.dumps({'error': 'no ready topics'}))
    sys.exit(1)
print(json.dumps(ready[0]))
"

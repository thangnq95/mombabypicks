#!/usr/bin/env python3
import json
with open('pipeline/topic-queue.json') as f:
    topics = json.load(f)
for t in topics:
    if t['id'] == 'S003':
        t['status'] = 'ready'
        t.pop('fail_reason', None)
        t.pop('review_score', None)
with open('pipeline/topic-queue.json', 'w') as f:
    json.dump(topics, f, indent=2)
print('S003 reset to ready')

import re, os

POSTS = os.path.expanduser('~/GIT/PP/mombabypicks/content/posts')

total = 0
updated = 0

# Patterns for amazon links
SHORTCODE = r'\{\{<\s*amazon\s+url="https?://[^"]*?/dp/([A-Z0-9]{10})(?:\?[^"]*)?"\s+text="[^"]*"\s*>\}\}'
MARKDOWN = r'\[Check[^\]]*\]\(https?://(?:www\.)?amazon\.com(?:/[^/]+)?/dp/([A-Z0-9]{10})[^)]*\)'

for fname in sorted(os.listdir(POSTS)):
    if not fname.endswith('.md'):
        continue
    fp = os.path.join(POSTS, fname)
    with open(fp) as f:
        content = f.read()
    orig = content
    
    # Get all matches with positions
    items = []
    for m in re.finditer(SHORTCODE, content):
        items.append((m.start(), m.end(), m.group(0), m.group(1)))
    for m in re.finditer(MARKDOWN, content):
        items.append((m.start(), m.end(), m.group(0), m.group(1)))
    
    items.sort(key=lambda x: -x[0])  # Reverse order for in-place replacement
    
    if not items:
        continue
    
    for start, end, full_match, asin in items:
        # Find last product heading before this position
        before = content[:end]
        h = re.findall(r'#{1,3}\s+(?:\d+\.\s+)?([^\n]+)', before)
        
        title = asin
        badge = ''
        price = ''
        
        if h:
            ht = h[-1].strip()
            parts = re.split(r'\s*[—–]\s*', ht, maxsplit=1)
            title = parts[0].strip()
            if len(parts) > 1:
                badge = parts[1].strip()
        
        # Get price from section between heading and amazon link
        section = before
        if h:
            last_idx = before.rfind('###')
            if last_idx == -1:
                last_idx = before.rfind('## ')
            section = before[last_idx:] if last_idx >= 0 else before
        
        pm = re.search(r'\*\*Price:\*\*\s*\$?([\d.]+)', section)
        if pm:
            price = '$' + pm.group(1)
        
        # Clean title
        title = title.split(' — ')[0].split(' – ')[0].split(' - ')[0].strip()
        title = re.sub(r'\s+', ' ', title)
        
        new = f'{{{{< product-card url="https://www.amazon.com/dp/{asin}?tag=mombabypick00-20" img="https://images-na.ssl-images-amazon.com/images/P/{asin}.01.L.jpg" title="{title}"'
        if badge:
            new += f' badge="{badge}"'
        if price:
            new += f' price="{price}"'
        new += ' >}}'
        
        content = content[:start] + new + content[end:]
        total += 1
    
    if content != orig:
        with open(fp, 'w') as f:
            f.write(content)
        updated += 1
        print('📝', fname)

print(f'\n✅ {updated} articles updated, {total} links migrated')

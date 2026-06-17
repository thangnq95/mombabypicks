import re, json, os, subprocess, time

POSTS = os.path.expanduser('~/GIT/PP/mombabypicks/content/posts')

# Get all unique ASINs
asins = set()
for fname in os.listdir(POSTS):
    if not fname.endswith('.md'): continue
    fp = os.path.join(POSTS, fname)
    with open(fp) as f:
        content = f.read()
    for m in re.finditer(r'/dp/([A-Z0-9]{10})\?tag=mombabypick00-20', content):
        asins.add(m.group(1))

print(f'Total unique ASINs: {len(asins)}')
print('Fetching ratings from Amazon...')

ratings = {}
for i, asin in enumerate(sorted(asins)):
    url = f'https://www.amazon.com/dp/{asin}'
    try:
        result = subprocess.run(
            ['curl', '-sL', '--max-time', '8', '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '--compressed', url],
            capture_output=True, text=True, timeout=10
        )
        html = result.stdout
        
        # Try JSON-LD structured data first
        rating = None
        reviews = None
        
        # Method 1: JSON-LD
        for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL):
            try:
                data = json.loads(m.group(1))
                if isinstance(data, dict):
                    agg = data.get('aggregateRating', {})
                    if agg.get('ratingValue'):
                        rating = agg['ratingValue']
                        reviews = agg.get('reviewCount', '')
                        break
            except: pass
        
        # Method 2: From page title or meta
        if not rating:
            m = re.search(r'★?\s*([\d.]+)\s*out of\s*5', html)
            if m: rating = m.group(1)
            m = re.search(r'([\d,]+)\s*(?:ratings?|reviews?)', html)
            if m: reviews = m.group(1)
        
        # Method 3: From review stars
        if not rating:
            m = re.search(r'"ratingValue":\s*"([\d.]+)"', html)
            if m: rating = m.group(1)
        
        if rating:
            ratings[asin] = {'rating': rating, 'reviews': reviews or ''}
            print(f'  ✅ {asin}: ★ {rating}' + (f' ({reviews} reviews)' if reviews else ''))
        else:
            print(f'  ❌ {asin}: could not find rating')
        
    except Exception as e:
        print(f'  ❌ {asin}: {e}')
    
    time.sleep(2)  # Rate limit

with open('/tmp/amazon-ratings.json', 'w') as f:
    json.dump(ratings, f, indent=2)

print(f'\n✅ {len(ratings)}/{len(asins)} ratings fetched')

import re, os, subprocess

POSTS = os.path.expanduser('~/GIT/PP/mombabypicks/content/posts')
COVERS = os.path.expanduser('~/GIT/PP/mombabypicks/static/images/posts')

for fname in sorted(os.listdir(POSTS)):
    if not fname.endswith('.md'):
        continue
    slug = fname.replace('.md', '')
    out = os.path.join(COVERS, f'{slug}.webp')
    
    # Skip articles that already have good covers (>5KB)
    if os.path.exists(out) and os.path.getsize(out) > 5000:
        continue
    
    fp = os.path.join(POSTS, fname)
    with open(fp) as f:
        content = f.read()
    
    # Find ALL ASINs in the article
    asins = re.findall(r'dp/([A-Z0-9]{10})\?tag=mombabypick00-20', content)
    if not asins:
        print(f'❌ {slug}: no ASINs')
        continue
    
    for asin in asins:
        url = f'https://images-na.ssl-images-amazon.com/images/P/{asin}.01.L.jpg'
        try:
            r = subprocess.run(['curl', '-sL', '-w', '%{size_download}', '-o', '/tmp/_amz.jpg', url],
                             capture_output=True, text=True, timeout=10)
            sz = int(r.stdout.strip())
            if sz < 5000:
                continue  # Try next ASIN
            
            subprocess.run(['python3', '-c', f'''
from PIL import Image
img = Image.open("/tmp/_amz.jpg")
img = img.resize((1200, 630), Image.LANCZOS)
img.save("{out}", "WEBP", quality=85)
'''], capture_output=True, timeout=10)
            sz2 = os.path.getsize(out) // 1024
            print(f'✅ {slug}: {asin} -> {sz2}KB')
            break
        except:
            continue
    else:
        print(f'❌ {slug}: no ASIN worked')

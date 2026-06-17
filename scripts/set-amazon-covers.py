import re, os, subprocess

POSTS = os.path.expanduser('~/GIT/PP/mombabypicks/content/posts')
COVERS = os.path.expanduser('~/GIT/PP/mombabypicks/static/images/posts')

for fname in sorted(os.listdir(POSTS)):
    if not fname.endswith('.md'):
        continue
    slug = fname.replace('.md', '')
    fp = os.path.join(POSTS, fname)
    with open(fp) as f:
        content = f.read()
    
    m = re.search(r'dp/([A-Z0-9]{10})\?tag=mombabypick00-20', content)
    if not m:
        print(f'❌ {slug}: no ASIN')
        continue
    
    asin = m.group(1)
    out = os.path.join(COVERS, f'{slug}.webp')
    
    try:
        subprocess.run(['curl', '-sL', '-o', f'/tmp/_c_{asin}.jpg', 
            f'https://images-na.ssl-images-amazon.com/images/P/{asin}.01.L.jpg'], 
            timeout=15, check=True)
        subprocess.run(['python3', '-c', f'''
from PIL import Image
img = Image.open("/tmp/_c_{asin}.jpg")
img = img.resize((1200, 630), Image.LANCZOS)
img.save("{out}", "WEBP", quality=85)
import os; os.remove("/tmp/_c_{asin}.jpg")
'''], timeout=15, check=True)
        # Get file size
        sz = os.path.getsize(out)
        print(f'✅ {slug} ({asin}) -> {sz//1024}KB')
    except Exception as e:
        print(f'❌ {slug} ({asin}): {e}')

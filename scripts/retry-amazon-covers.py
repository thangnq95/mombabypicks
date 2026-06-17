import subprocess, os, sys

# Fallback ASINs for articles whose first ASIN image failed
fallbacks = {
    'best-baby-monitors-long-battery-life': 'B08G8MBWZ8',
    'best-baby-sleep-sacks-for-2026': 'B09YL6CVQK',
    'best-breast-pumps': 'B0C5FGDYR4',
    'best-diapers-for-newborns-2026': 'B08GK3TVMS',
    'best-hands-free-wearable-breast-pumps': 'B0DLFKN6LL',
    'bottle-refusal-breastfed-babies': 'B09649R98Q',
    'breast-pump-cleaning-guide': 'B01N9NDTGV',
    'breastfeeding-essentials': 'B006XISCNA',
    'eco-friendly-baby-gear-guide': 'B0BNSMJ98X',
    'momcozy-m5-review': 'B0DNR1Z4L9',
    'newborn-essentials-checklist': 'B09WF3CNGS',
    'newborn-feeding-station': 'B0DJRQRGSK',
    'pace-bottle-feeding-guide': 'B01845QH7M',
    'silicone-baby-feeding-products': 'B0G6N65XVL',
    'what-not-to-buy-newborn': 'B0DVGJTFT8',
}

for slug, asin in fallbacks.items():
    out = os.path.expanduser(f'~/GIT/PP/mombabypicks/static/images/posts/{slug}.webp')
    url = f'https://images-na.ssl-images-amazon.com/images/P/{asin}.01.L.jpg'
    
    try:
        r = subprocess.run(['curl', '-sL', '-w', '%{size_download}', '-o', '/tmp/_amz.jpg', url],
                         capture_output=True, text=True, timeout=15)
        sz = int(r.stdout.strip())
        if sz < 5000:
            print(f'❌ {slug}: {sz}B too small')
            continue
        
        r2 = subprocess.run(['python3', '-c', f'''
from PIL import Image
img = Image.open("/tmp/_amz.jpg")
img = img.resize((1200, 630), Image.LANCZOS)
img.save("{out}", "WEBP", quality=85)
print("ok")
'''], capture_output=True, text=True, timeout=15)
        sz2 = os.path.getsize(out) // 1024
        print(f'✅ {slug}: {asin} -> {sz2}KB')
    except Exception as e:
        print(f'❌ {slug}: {e}')

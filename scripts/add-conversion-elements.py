import re, os, json

POSTS = os.path.expanduser('~/GIT/PP/mombabypicks/content/posts')

# Related articles mapping for cross-sell
CROSS_SELL = {
    'best-baby-bottles-for-newborns': ['bottle-warmer-safety-guide', 'pace-bottle-feeding-guide', 'newborn-feeding-essentials'],
    'best-baby-bouncers-for-2026': ['best-baby-carriers-for-2026', 'best-baby-monitors-long-battery-life', 'newborn-essentials-checklist'],
    'best-baby-carriers-for-2026': ['best-baby-bouncers-for-2026', 'best-high-chairs-for-babies-2026', 'newborn-essentials-checklist'],
    'best-baby-monitors-long-battery-life': ['best-baby-sleep-sacks-for-2026', 'baby-safety-guide', 'newborn-essentials-checklist'],
    'best-baby-sleep-sacks-for-2026': ['best-baby-monitors-long-battery-life', 'newborn-essentials-checklist', 'what-not-to-buy-newborn'],
    'best-bottle-warmers': ['bottle-warmer-safety-guide', 'best-baby-bottles-for-newborns', 'pace-bottle-feeding-guide'],
    'best-breast-pumps': ['best-hands-free-wearable-breast-pumps', 'how-to-choose-breast-pump', 'breast-pump-cleaning-guide'],
    'best-diapers-for-newborns-2026': ['newborn-essentials-checklist', 'what-not-to-buy-newborn', 'best-baby-bath-tubs-2026'],
    'best-hands-free-wearable-breast-pumps': ['best-breast-pumps', 'breastfeeding-essentials', 'how-to-choose-breast-pump'],
    'best-high-chairs-for-babies-2026': ['best-baby-bouncers-for-2026', 'eco-friendly-baby-gear-guide', 'newborn-feeding-station'],
    'best-infant-car-seats-2026': ['best-baby-monitors-long-battery-life', 'newborn-essentials-checklist', 'best-baby-carriers-for-2026'],
    'bottle-refusal-breastfed-babies': ['pace-bottle-feeding-guide', 'breastfeeding-essentials', 'best-baby-bottles-for-newborns'],
    'bottle-warmer-safety-guide': ['best-bottle-warmers', 'best-baby-bottles-for-newborns', 'newborn-feeding-essentials'],
    'breast-pump-cleaning-guide': ['best-breast-pumps', 'breastfeeding-essentials', 'how-to-choose-breast-pump'],
    'breastfeeding-essentials': ['breast-pump-cleaning-guide', 'bottle-refusal-breastfed-babies', 'best-hands-free-wearable-breast-pumps'],
    'eco-friendly-baby-gear-guide': ['best-high-chairs-for-babies-2026', 'silicone-baby-feeding-products', 'newborn-feeding-station'],
    'how-to-choose-breast-pump': ['best-breast-pumps', 'best-hands-free-wearable-breast-pumps', 'breast-feeding-station'],
    'momcozy-m5-review': ['best-breast-pumps', 'best-hands-free-wearable-breast-pumps', 'breast-pump-cleaning-guide'],
    'newborn-essentials-checklist': ['what-not-to-buy-newborn', 'newborn-feeding-essentials', 'best-baby-bath-tubs-2026'],
    'newborn-feeding-essentials': ['newborn-feeding-station', 'pace-bottle-feeding-guide', 'best-baby-bottles-for-newborns'],
    'newborn-feeding-station': ['newborn-feeding-essentials', 'silicone-baby-feeding-products', 'best-bottle-warmers'],
    'pace-bottle-feeding-guide': ['bottle-refusal-breastfed-babies', 'newborn-feeding-essentials', 'best-baby-bottles-for-newborns'],
    'silicone-baby-feeding-products': ['eco-friendly-baby-gear-guide', 'newborn-feeding-essentials', 'best-baby-bottles-for-newborns'],
    'what-not-to-buy-newborn': ['newborn-essentials-checklist', 'newborn-feeding-essentials', 'best-diapers-for-newborns-2026'],
}

for fname in sorted(os.listdir(POSTS)):
    if not fname.endswith('.md'):
        continue
    slug = fname.replace('.md', '')
    fp = os.path.join(POSTS, fname)
    with open(fp) as f:
        content = f.read()
    
    # Skip if already has author-bio or bath tubs (already done)
    if 'author-bio' in content:
        continue
    
    # Find first product heading with ASIN
    h_pat = r'(#{1,3})\s+\d+\.\s*([^—\n]+)'
    h_match = re.search(h_pat, content)
    asin_pat = r'/dp/([A-Z0-9]{10})\?tag=mombabypick00-20'
    asin_match = re.search(asin_pat, content)
    
    if not h_match or not asin_match:
        continue
    
    # Get first product heading text (clean)
    prod_name = h_match.group(2).strip()
    # Get price from product section
    section = content[h_match.start():]
    price_m = re.search(r'\*\*Price:\*\*\s*\$?([\d.]+)', section[:300])
    price = '$' + price_m.group(1) if price_m else ''
    asin = asin_match.group(1)
    
    # Build top-pick
    top_pick = '{{< top-pick url="https://www.amazon.com/dp/' + asin + '?tag=mombabypick00-20" img="https://images-na.ssl-images-amazon.com/images/P/' + asin + '.01.L.jpg" title="' + prod_name + '" price="' + price + '" rating="9.0" >}}'
    author = '{{< author-bio >}}'
    
    # Insert after intro paragraph (before pick-cards or first ---)
    # Find the intro end (before first ## heading)
    first_heading = re.search(r'\n##\s', content)
    if not first_heading:
        continue
    insert_pos = first_heading.start()
    
    # Insert top-pick + author before first ## heading
    content = content[:insert_pos] + '\n' + top_pick + '\n\n' + author + '\n' + content[insert_pos:]
    
    # Add cross-sell after comparison or FAQ (before Related Articles)
    related_pos = content.find('## Related Articles')
    if related_pos > 0:
        related_slugs = CROSS_SELL.get(slug, [])
        if related_slugs:
            slugs_str = ', '.join(related_slugs)
            cross = '{{< cross-sell slugs="' + slugs_str + '" >}}\n\n'
            content = content[:related_pos] + cross + content[related_pos:]
    
    with open(fp, 'w') as f:
        f.write(content)
    print('📝', slug)

print('\n✅ Done')

import re, os, json

POSTS = os.path.expanduser('~/GIT/PP/mombabypicks/content/posts')

for fname in sorted(os.listdir(POSTS)):
    if not fname.endswith('.md'):
        continue
    fp = os.path.join(POSTS, fname)
    with open(fp) as f:
        content = f.read()
    
    # Extract title, description
    title_m = re.search(r'title:\s*"([^"]+)"', content)
    desc_m = re.search(r'description:\s*"([^"]+)"', content)
    title = title_m.group(1) if title_m else fname.replace('.md','')
    desc = desc_m.group(1) if desc_m else ''
    
    # Extract FAQ questions and answers
    faq_section = re.search(r'## FAQ\s*\n((?:.|\n)*?)(?=\n## |\n---|\Z)', content)
    if not faq_section:
        print(f'❌ {fname}: no FAQ section')
        continue
    
    faq_text = faq_section.group(1)
    qas = re.findall(r'###\s+(.+?)\n((?:(?!###)[\s\S])*)', faq_text)
    
    if not qas:
        print(f'❌ {fname}: no Q&A in FAQ')
        continue
    
    # Build FAQ schema
    faq_items = []
    for q, a in qas[:5]:
        # Get first 1-2 paragraphs of answer
        answer_text = ' '.join(a.split('\n')[1:]).strip()[:500]
        if not answer_text:
            answer_text = a.strip()[:300]
        faq_items.append({
            "@type": "Question",
            "name": q.strip().strip('?') + '?',
            "acceptedAnswer": {
                "@type": "Answer",
                "text": answer_text
            }
        })
    
    if not faq_items:
        continue
    
    faq_schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq_items
    }
    
    schema_json = json.dumps(faq_schema, indent=2)
    
    # Add schema to frontmatter or bottom of file
    if 'schema_faq:' not in content:
        # Add after the last frontmatter line (after ---)
        parts = content.split('---', 2)
        if len(parts) >= 3:
            # Insert schema_faq into frontmatter
            fm_lines = parts[1].split('\n')
            new_fm = parts[1].rstrip() + f'\nschema_faq: {json.dumps(schema_json)}\n'
            new_content = parts[0] + '---' + new_fm + '---' + parts[2]
        else:
            continue
        
        with open(fp, 'w') as f:
            f.write(new_content)
        print(f'✅ {fname}: {len(faq_items)} Q&As')
    else:
        print(f'  {fname}: already has schema')

print('\n✅ Done')

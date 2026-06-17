// Script to migrate all articles from {{< amazon >}} to {{< product-card >}}
const fs = require('fs');
const path = require('path');
const POSTS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/content/posts');

const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

let total = 0;
let articles_updated = 0;

for (const file of files) {
  const fp = path.join(POSTS_DIR, file);
  let content = fs.readFileSync(fp, 'utf8');
  const original = content;
  
  // Find all {{< amazon >}} shortcodes
  const amazonRegex = /{{<\s*amazon\s+url="https:\/\/www\.amazon\.com\/(?:[^"]*\/)?dp\/([A-Z0-9]{10})(?:\?[^"]*)?"\s+text="[^"]*"\s*>}}/g;
  let match;
  let changed = false;
  
  while ((match = amazonRegex.exec(content)) !== null) {
    const asin = match[1];
    const fullMatch = match[0];
    const pos = match.index;
    
    // Find the nearest product heading (### N. Product Name — Badge) before this amazon link
    // Also try to get title and badge from nearby context
    const beforeMatch = content.substring(0, pos);
    const headingMatch = beforeMatch.match(/###\s+\d+\.\s+(.+?)(?:\s*[—–-]\s*(.+))?[\s\S]*?(?=###|\n\n|$)/);
    // Actually, simpler approach: just get the nearest ### heading
    const simpleHeading = beforeMatch.match(/###\s+\d+\.\s+([^\n]+)/);
    
    let title = asin;
    let badge = '';
    
    if (simpleHeading) {
      const headingText = simpleHeading[1].trim();
      // Extract badge if present (text after — or – or -)
      const badgeSep = headingText.match(/\s*[—–-]\s*(.+)/);
      if (badgeSep) {
        badge = badgeSep[1].trim();
        title = headingText.substring(0, headingText.indexOf(badgeSep[0])).trim();
      } else {
        title = headingText;
      }
    }
    
    // If no badge from heading, try pick-cards
    if (!badge) {
      const pickMatch = beforeMatch.match(new RegExp('card' + '\\d+' + 'label="([^"]*)"[\\s\\S]*?' + asin, 'i'));
      // simpler: look for any card label
      const labelMatch = beforeMatch.match(/card\d+label="([^"]+)"/g);
      if (labelMatch) {
        // Get the last one before position
        const lastLabel = labelMatch[labelMatch.length - 1];
        const lbl = lastLabel.match(/card\d+label="([^"]+)"/);
        if (lbl) badge = lbl[1];
      }
    }
    
    // Get price from the product section (look for "**Price:**" before this point but after the heading)
    const priceMatch = beforeMatch.match(/\*\*Price:\*\*\s*\$?([\d.]+)/);
    const price = priceMatch ? '$' + priceMatch[1] : '';
    
    // Clean title - remove anything after "—" since that's the badge
    const cleanTitle = title.replace(/\s*—\s*.*$/, '').trim();
    
    const newShortcode = `{{< product-card url="https://www.amazon.com/dp/${asin}?tag=mombabypick00-20" img="https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg" title="${cleanTitle}"${badge ? ` badge="${badge}"` : ''}${price ? ` price="${price}"` : ''} >}}`;
    
    content = content.replace(fullMatch, newShortcode);
    changed = true;
    total++;
  }
  
  if (changed) {
    fs.writeFileSync(fp, content);
    articles_updated++;
    process.stdout.write('📝');
  }
}

console.log(`\n✅ ${articles_updated} articles updated, ${total} total amazon links migrated`);

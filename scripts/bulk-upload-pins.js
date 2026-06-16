// Bulk upload — stays on same page, just changes image
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');

const ARTICLES = {
  'best-baby-bottles-for-newborns-2026': { title: 'Best Baby Bottles for Newborns 2026', url: 'https://mombabypicks.com/posts/best-baby-bottles-for-newborns-2026/' },
  'best-baby-bouncers-for-2026': { title: 'Best Baby Bouncers for 2026', url: 'https://mombabypicks.com/posts/best-baby-bouncers-for-2026/' },
  'best-baby-carriers-for-2026': { title: 'Best Baby Carriers for 2026', url: 'https://mombabypicks.com/posts/best-baby-carriers-for-2026/' },
  'best-baby-monitors-long-battery-life': { title: 'Best Baby Monitors with Long Battery Life', url: 'https://mombabypicks.com/posts/best-baby-monitors-long-battery-life/' },
  'best-baby-sleep-sacks-for-2026': { title: 'Best Baby Sleep Sacks for 2026', url: 'https://mombabypicks.com/posts/best-baby-sleep-sacks-for-2026/' },
  'best-bottle-warmers': { title: '5 Best Bottle Warmers for Newborns', url: 'https://mombabypicks.com/posts/best-bottle-warmers/' },
  'best-breast-pumps': { title: '5 Best Breast Pumps of 2026', url: 'https://mombabypicks.com/posts/best-breast-pumps/' },
  'best-diapers-for-newborns-2026': { title: 'Best Diapers for Newborns 2026', url: 'https://mombabypicks.com/posts/best-diapers-for-newborns-2026/' },
  'best-hands-free-wearable-breast-pumps': { title: 'Best Hands-Free Wearable Breast Pumps 2026', url: 'https://mombabypicks.com/posts/best-hands-free-wearable-breast-pumps/' },
  'best-high-chairs-for-babies-2026': { title: 'Best High Chairs for Babies 2026', url: 'https://mombabypicks.com/posts/best-high-chairs-for-babies-2026/' },
  'bottle-refusal-breastfed-babies': { title: 'Bottle Refusal in Breastfed Babies: What Actually Works', url: 'https://mombabypicks.com/posts/bottle-refusal-breastfed-babies/' },
  'bottle-warmer-safety-guide': { title: 'Bottle Warmer Safety: What New Parents Should Know', url: 'https://mombabypicks.com/posts/bottle-warmer-safety-guide/' },
  'breast-pump-cleaning-guide': { title: 'Breast Pump Cleaning Guide for Busy Moms', url: 'https://mombabypicks.com/posts/breast-pump-cleaning-guide/' },
  'breastfeeding-essentials': { title: '10 Breastfeeding Essentials Every New Mom Needs', url: 'https://mombabypicks.com/posts/breastfeeding-essentials/' },
  'eco-friendly-baby-gear-guide': { title: 'Eco-Friendly Baby Gear Guide', url: 'https://mombabypicks.com/posts/eco-friendly-baby-gear-guide/' },
  'how-to-choose-breast-pump': { title: 'How to Choose a Breast Pump', url: 'https://mombabypicks.com/posts/how-to-choose-breast-pump/' },
  'momcozy-m5-review': { title: 'Momcozy M5 Review: Is It Worth It in 2026?', url: 'https://mombabypicks.com/posts/momcozy-m5-review/' },
  'newborn-essentials-checklist': { title: 'Newborn Essentials Checklist', url: 'https://mombabypicks.com/posts/newborn-essentials-checklist/' },
  'newborn-feeding-essentials': { title: 'Newborn Feeding Essentials', url: 'https://mombabypicks.com/posts/newborn-feeding-essentials/' },
  'newborn-feeding-station': { title: 'How to Set Up a Newborn Feeding Station', url: 'https://mombabypicks.com/posts/newborn-feeding-station/' },
  'pace-bottle-feeding-guide': { title: 'Pace Bottle Feeding Guide', url: 'https://mombabypicks.com/posts/pace-bottle-feeding-guide/' },
  'silicone-baby-feeding-products': { title: 'Silicone Baby Feeding Products', url: 'https://mombabypicks.com/posts/silicone-baby-feeding-products/' },
  'what-not-to-buy-newborn': { title: 'What Not to Buy for a Newborn', url: 'https://mombabypicks.com/posts/what-not-to-buy-newborn/' },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).webSocketDebuggerUrl) } catch(e) { reject(e) } });
    }).on('error', reject);
  });
}

async function uploadOne(page, filePath, article) {
  // Upload via file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  await sleep(4000);

  // Fill fields via direct DOM
  await page.evaluate(({title, desc, url}) => {
    // Find all editable fields
    const fields = document.querySelectorAll('[contenteditable="true"], textarea, input[type="url"]');
    for (const el of fields) {
      if (el.tagName === 'TEXTAREA') {
        el.value = desc;
        el.dispatchEvent(new Event('input', {bubbles: true}));
      } else if (el.getAttribute('contenteditable') === 'true') {
        el.textContent = title;
        el.dispatchEvent(new Event('input', {bubbles: true}));
      } else if (el.type === 'url') {
        el.value = url;
        el.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  }, article);
  
  await sleep(2000);

  // Click Publish via XPath/text
  const published = await page.evaluate(() => {
    // Try all clickable elements with "Publish" text
    const all = document.querySelectorAll('button, [role="button"], a, div, span');
    for (const el of all) {
      if (el.textContent?.trim() === 'Publish' && el.offsetParent !== null) {
        el.click();
        return true;
      }
    }
    return false;
  });
  
  if (!published) {
    // Try the data-test-id approach
    const btn = page.locator('[data-test-id]').filter({hasText: 'Publish'}).first();
    if (await btn.isVisible({timeout: 2000}).catch(() => false)) {
      await btn.click();
      return true;
    }
    return false;
  }
  return true;
}

(async () => {
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || await ctx.newPage();

  // Navigate ONCE to pin builder
  console.log('📍 Opening pin builder...');
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  
  const files = fs.readdirSync(PINS_DIR).filter(f => f.endsWith('.png'));
  let uploaded = 0, errors = 0, skipped = 0;

  for (const file of files) {
    if (file === 'best-breast-pumps-pin-1.png') { skipped++; continue; }
    
    const match = file.match(/^(.+)-pin-\d+\.png$/);
    if (!match) { skipped++; continue; }
    const slug = match[1];
    const article = ARTICLES[slug];
    if (!article) { skipped++; continue; }
    
    const imagePath = path.join(PINS_DIR, file);
    process.stdout.write(`📤 ${file} → `);
    
    try {
      const ok = await uploadOne(page, imagePath, {
        title: article.title,
        desc: article.title + ' — Read the full guide at MomBabyPicks.com',
        url: article.url
      });
      
      if (ok) {
        await sleep(5000);
        console.log('✅');
        uploaded++;
      } else {
        console.log('❌ No publish btn');
        errors++;
      }
    } catch(e) {
      console.log(`❌ ${e.message.substring(0,60)}`);
      errors++;
    }
  }

  console.log(`\n📊 Done: ${uploaded} uploaded, ${errors} errors, ${skipped} skipped`);
  await browser.close();
})().catch(e => console.error('❌ Fatal:', e.message));

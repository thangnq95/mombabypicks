#!/usr/bin/env node
// Pinterest Manager: Upload all pins + delete old ones
// Uses CDP Chrome session for API access
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BOARD_NAME = 'Baby Gear & New Mom Essentials';
const BOARD_URL = 'https://www.pinterest.com/mombabypicks/baby-gear-new-mom-essentials/';

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
  'bottle-refusal-breastfed-babies': { title: 'Bottle Refusal in Breastfed Babies', url: 'https://mombabypicks.com/posts/bottle-refusal-breastfed-babies/' },
  'bottle-warmer-safety-guide': { title: 'Bottle Warmer Safety Guide', url: 'https://mombabypicks.com/posts/bottle-warmer-safety-guide/' },
  'breast-pump-cleaning-guide': { title: 'Breast Pump Cleaning Guide', url: 'https://mombabypicks.com/posts/breast-pump-cleaning-guide/' },
  'breastfeeding-essentials': { title: 'Breastfeeding Essentials Guide', url: 'https://mombabypicks.com/posts/breastfeeding-essentials/' },
  'eco-friendly-baby-gear-guide': { title: 'Eco-Friendly Baby Gear Guide', url: 'https://mombabypicks.com/posts/eco-friendly-baby-gear-guide/' },
  'how-to-choose-breast-pump': { title: 'How to Choose a Breast Pump', url: 'https://mombabypicks.com/posts/how-to-choose-breast-pump/' },
  'momcozy-m5-review': { title: 'Momcozy M5 Review 2026', url: 'https://mombabypicks.com/posts/momcozy-m5-review/' },
  'newborn-essentials-checklist': { title: 'Newborn Essentials Checklist', url: 'https://mombabypicks.com/posts/newborn-essentials-checklist/' },
  'newborn-feeding-essentials': { title: 'Newborn Feeding Essentials', url: 'https://mombabypicks.com/posts/newborn-feeding-essentials/' },
  'newborn-feeding-station': { title: 'Newborn Feeding Station Setup', url: 'https://mombabypicks.com/posts/newborn-feeding-station/' },
  'pace-bottle-feeding-guide': { title: 'Pace Bottle Feeding Guide', url: 'https://mombabypicks.com/posts/pace-bottle-feeding-guide/' },
  'silicone-baby-feeding-products': { title: 'Silicone Baby Feeding Products', url: 'https://mombabypicks.com/posts/silicone-baby-feeding-products/' },
  'what-not-to-buy-newborn': { title: 'What Not to Buy for a Newborn', url: 'https://mombabypicks.com/posts/what-not-to-buy-newborn/' },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).webSocketDebuggerUrl) } catch(e) { reject(e) } });
    }).on('error', reject);
  });
}

async function uploadOnePin(page, filePath, article) {
  // Go to pin builder fresh each time
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  
  // Upload image
  const fi = page.locator('input[type="file"]');
  await fi.waitFor({ state: 'visible', timeout: 15000 });
  await fi.setInputFiles(filePath);
  await sleep(4000);
  
  // Fill fields via JS
  await page.evaluate(({title, desc, url}) => {
    const fields = document.querySelectorAll('[contenteditable="true"], textarea, input[type="url"]');
    for (const el of fields) {
      if (el.getAttribute('contenteditable') === 'true') { el.textContent = title; el.dispatchEvent(new Event('input', {bubbles: true})); }
      else if (el.tagName === 'TEXTAREA') { el.value = desc; el.dispatchEvent(new Event('input', {bubbles: true})); }
      else if (el.type === 'url') { el.value = url; el.dispatchEvent(new Event('input', {bubbles: true})); }
    }
  }, article);
  await sleep(2000);
  
  // Click Publish — try every approach
  let published = false;
  for (let attempt = 0; attempt < 5 && !published; attempt++) {
    published = await page.evaluate(() => {
      const all = document.querySelectorAll('button, [role="button"], div[data-test-id], span, a');
      for (const el of all) {
        const t = el.textContent?.trim();
        if (t === 'Publish' && el.offsetParent !== null) {
          // Check it's not inside a hidden container
          try { el.click(); return true; } catch(e) {}
        }
      }
      return false;
    });
    if (!published) await sleep(1000);
  }
  await sleep(5000);
  
  // Close the "You created a Pin!" modal if it appears
  const closeBtn = page.locator('button, [role="button"], [aria-label="Close"]').filter({ hasText: /close|see your pin|done/i }).first();
  if (await closeBtn.isVisible({timeout: 3000}).catch(() => false)) {
    await closeBtn.click().catch(() => {});
    await sleep(1000);
  }
  
  return published;
}

async function deleteOldPins(page) {
  console.log('\n🗑️ Deleting old pins...');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  
  // Get all pin IDs from the page
  const pinIds = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/pin/"]');
    const ids = new Set();
    links.forEach(a => {
      const m = a.href.match(/\/pin\/(\d+)/);
      if (m) ids.add(m[1]);
    });
    return Array.from(ids);
  });
  
  console.log(`   Found ${pinIds.length} pins to delete`);
  let deleted = 0;
  
  for (const pinId of pinIds) {
    try {
      await page.goto(`https://www.pinterest.com/pin/${pinId}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(2000);
      
      // Click "..." menu
      const moreBtn = page.locator('[data-test-id="pin-more-button"], button[aria-label*="More"], [aria-label*="more"]').first();
      if (await moreBtn.isVisible({timeout: 3000}).catch(() => false)) {
        await moreBtn.click();
        await sleep(1000);
        
        // Click "Delete"
        const delBtn = page.locator('[data-test-id="delete-pin"], button:has-text("Delete"), div:has-text("Delete")[role="button"]').first();
        if (await delBtn.isVisible({timeout: 2000}).catch(() => false)) {
          await delBtn.click();
          await sleep(1000);
          
          // Confirm
          const confirmBtn = page.locator('button:has-text("Delete"), div:has-text("Delete")').last();
          if (await confirmBtn.isVisible({timeout: 2000}).catch(() => false)) {
            await confirmBtn.click();
            await sleep(2000);
            deleted++;
            process.stdout.write('🗑️');
          }
        }
      }
    } catch(e) {
      process.stdout.write('❌');
    }
  }
  console.log(`\n   Deleted ${deleted}/${pinIds.length}`);
  return deleted;
}

(async () => {
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const ctx = browser.contexts()[0];
  
  // STEP 1: Delete old pins first
  let page = ctx.pages()[0] || await ctx.newPage();
  await deleteOldPins(page);
  
  // STEP 2: Upload all new pins
  console.log('\n📤 Uploading new pins...');
  const files = fs.readdirSync(PINS_DIR)
    .filter(f => f.endsWith('.png'))
    .sort()
    .filter(f => f !== 'best-breast-pumps-pin-1.png'); // already uploaded
  
  let uploaded = 0, failed = 0;
  
  for (const file of files) {
    const match = file.match(/^(.+)-pin-\d+\.png$/);
    if (!match) continue;
    const slug = match[1];
    const article = ARTICLES[slug];
    if (!article) continue;
    
    process.stdout.write(`\n📤 ${file} → `);
    
    try {
      const ok = await uploadOnePin(page, path.join(PINS_DIR, file), {
        title: article.title,
        desc: article.title + ' — Full guide at MomBabyPicks.com',
        url: article.url
      });
      if (ok) { console.log('✅'); uploaded++; }
      else { console.log('❌ no publish'); failed++; }
    } catch(e) {
      console.log(`❌ ${e.message?.substring(0, 60)}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Done! Uploaded: ${uploaded}, Failed: ${failed}`);
  await browser.close();
})().catch(e => console.error('❌', e.message));

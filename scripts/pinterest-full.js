// Pinterest: delete old + upload all 69 new pins
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE_URL = 'https://mombabypicks.com/posts/';
const LOG = '/tmp/pin-work.txt';
const log = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

const ALL = [
  ['best-baby-bottles-for-newborns-2026', 'Best Baby Bottles for Newborns 2026'],
  ['best-baby-bouncers-for-2026', 'Best Baby Bouncers for 2026'],
  ['best-baby-carriers-for-2026', 'Best Baby Carriers for 2026'],
  ['best-baby-monitors-long-battery-life', 'Best Baby Monitors with Long Battery Life'],
  ['best-baby-sleep-sacks-for-2026', 'Best Baby Sleep Sacks for 2026'],
  ['best-bottle-warmers', '5 Best Bottle Warmers for Newborns'],
  ['best-breast-pumps', '5 Best Breast Pumps of 2026'],
  ['best-diapers-for-newborns-2026', 'Best Diapers for Newborns 2026'],
  ['best-hands-free-wearable-breast-pumps', 'Best Hands-Free Wearable Breast Pumps 2026'],
  ['best-high-chairs-for-babies-2026', 'Best High Chairs for Babies 2026'],
  ['bottle-refusal-breastfed-babies', 'Bottle Refusal in Breastfed Babies'],
  ['bottle-warmer-safety-guide', 'Bottle Warmer Safety Guide'],
  ['breast-pump-cleaning-guide', 'Breast Pump Cleaning Guide'],
  ['breastfeeding-essentials', 'Breastfeeding Essentials Guide'],
  ['eco-friendly-baby-gear-guide', 'Eco-Friendly Baby Gear Guide'],
  ['how-to-choose-breast-pump', 'How to Choose a Breast Pump'],
  ['momcozy-m5-review', 'Momcozy M5 Review 2026'],
  ['newborn-essentials-checklist', 'Newborn Essentials Checklist'],
  ['newborn-feeding-essentials', 'Newborn Feeding Essentials'],
  ['newborn-feeding-station', 'Newborn Feeding Station Setup'],
  ['pace-bottle-feeding-guide', 'Pace Bottle Feeding Guide'],
  ['silicone-baby-feeding-products', 'Silicone Baby Feeding Products'],
  ['what-not-to-buy-newborn', 'What Not to Buy for a Newborn'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).webSocketDebuggerUrl) } catch(e) { reject(e) } });
    }).on('error', reject);
  });
}

(async () => {
  log('START');
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];

  // STEP 1: Delete ALL existing pins
  log('STEP 1: Delete old pins');
  await page.goto('https://www.pinterest.com/mombabypicks/baby-gear-new-mom-essentials/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  
  // Get pin IDs from the saved pins data that's embedded in the page
  let pinIds = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/pin/"]');
    const ids = new Set();
    links.forEach(a => {
      const m = a.href.match(/\/pin\/(\d+)/);
      if (m) ids.add(m[1]);
    });
    return Array.from(ids);
  });
  
  if (pinIds.length === 0) {
    // Try getting from JSON data in the page
    pinIds = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      const ids = new Set();
      scripts.forEach(s => {
        const matches = s.textContent?.match(/"id":"(\d+)"/g) || [];
        matches.forEach(m => {
          const id = m.match(/"id":"(\d+)"/)?.[1];
          if (id && id.length > 10) ids.add(id);
        });
      });
      return Array.from(ids).slice(0, 50);
    });
  }
  
  log(`Found ${pinIds.length} pins to delete`);
  
  let deleted = 0;
  for (const pinId of pinIds) {
    try {
      await page.goto(`https://www.pinterest.com/pin/${pinId}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(2000);
      
      // Click "..." more options
      const moreBtn = page.locator('[data-test-id="pin-more-button"], button[aria-label*="More" i], div[aria-label*="More" i]').first();
      if (await moreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moreBtn.click();
        await sleep(1000);
        
        // Find and click "Delete pin" option
        const del = await page.evaluate(() => {
          const items = document.querySelectorAll('[role="menuitem"], div[role="button"], button, li');
          for (const el of items) {
            if (el.textContent?.trim().toLowerCase().includes('delete pin')) {
              el.click(); return true;
            }
          }
          return false;
        });
        
        if (del) {
          await sleep(1000);
          // Confirm delete
          const confirm = await page.evaluate(() => {
            const btns = document.querySelectorAll('button, div[role="button"]');
            for (const b of btns) {
              if (b.textContent?.trim().toLowerCase() === 'delete') {
                b.click(); return true;
              }
            }
            return false;
          });
          if (confirm) { deleted++; process.stdout.write('🗑️'); }
        }
      }
      await sleep(1000);
    } catch(e) {
      process.stdout.write('❌');
    }
  }
  log(`Deleted ${deleted}/${pinIds.length}`);

  // STEP 2: Upload all 69 pins fresh
  log('STEP 2: Upload fresh pins');
  let ok = 0, fail = 0;
  
  for (const [slug, title] of ALL) {
    // 3 pins per article (pin-1, pin-2, pin-3)
    for (let n = 1; n <= 3; n++) {
      const file = `${slug}-pin-${n}.png`;
      const fpath = path.join(PINS_DIR, file);
      if (!fs.existsSync(fpath)) { continue; }
      
      try {
        await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);
        
        // Upload image
        const fi = page.locator('input[type="file"]');
        if (!await fi.isVisible({ timeout: 10000 }).catch(() => false)) {
          log(`FAIL ${file} - no file input`);
          fail++; continue;
        }
        await fi.setInputFiles(fpath);
        await sleep(4000);
        
        // Fill fields
        await page.evaluate(({t, u}) => {
          const titleEl = document.querySelector('[contenteditable="true"]');
          if (titleEl) titleEl.textContent = t;
          const descEl = document.querySelector('textarea');
          if (descEl) { descEl.value = t + ' — Full guide at MomBabyPicks.com'; descEl.dispatchEvent(new Event('input', {bubbles:true})); }
          const linkEl = document.querySelector('input[type="url"]');
          if (linkEl) { linkEl.value = u; linkEl.dispatchEvent(new Event('input', {bubbles:true})); }
        }, {t: title, u: BASE_URL + slug + '/'});
        await sleep(2000);
        
        // Click Publish (search ALL elements, not just buttons)
        const pub = await page.evaluate(() => {
          const all = document.querySelectorAll('*');
          for (const el of all) {
            if (el.textContent?.trim() === 'Publish' && el.children.length === 0) {
              el.click(); return true;
            }
          }
          return false;
        });
        
        await sleep(6000);
        
        if (pub) { process.stdout.write('✅'); ok++; }
        else { process.stdout.write('❌'); fail++; }
        
      } catch(e) {
        process.stdout.write('❌');
        fail++;
      }
    }
  }
  
  log(`DONE upload ok=${ok} fail=${fail}`);
  log('ALL DONE');
  await browser.close();
})().catch(e => { log('FATAL: '+e.message); });

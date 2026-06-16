// Quick upload remaining pins
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');

const ARTICLES = {
  'best-baby-carriers-for-2026': 'Best Baby Carriers for 2026',
  'best-baby-monitors-long-battery-life': 'Best Baby Monitors with Long Battery Life',
  'best-baby-sleep-sacks-for-2026': 'Best Baby Sleep Sacks for 2026',
  'best-bottle-warmers': '5 Best Bottle Warmers for Newborns',
  'best-diapers-for-newborns-2026': 'Best Diapers for Newborns 2026',
  'best-hands-free-wearable-breast-pumps': 'Best Hands-Free Wearable Breast Pumps 2026',
  'best-high-chairs-for-babies-2026': 'Best High Chairs for Babies 2026',
  'bottle-refusal-breastfed-babies': 'Bottle Refusal in Breastfed Babies',
  'bottle-warmer-safety-guide': 'Bottle Warmer Safety Guide',
  'breast-pump-cleaning-guide': 'Breast Pump Cleaning Guide',
  'breastfeeding-essentials': 'Breastfeeding Essentials Guide',
  'eco-friendly-baby-gear-guide': 'Eco-Friendly Baby Gear Guide',
  'how-to-choose-breast-pump': 'How to Choose a Breast Pump',
  'momcozy-m5-review': 'Momcozy M5 Review 2026',
  'newborn-essentials-checklist': 'Newborn Essentials Checklist',
  'newborn-feeding-essentials': 'Newborn Feeding Essentials',
  'newborn-feeding-station': 'Newborn Feeding Station Setup',
  'pace-bottle-feeding-guide': 'Pace Bottle Feeding Guide',
  'silicone-baby-feeding-products': 'Silicone Baby Feeding Products',
  'what-not-to-buy-newborn': 'What Not to Buy for a Newborn',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).webSocketDebuggerUrl) } catch(e) { reject(e) } });
    }).on('error', reject);
  });
}

(async () => {
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];
  
  let ok = 0, fail = 0;
  const url = 'https://mombabypicks.com/posts/';
  
  for (const [slug, title] of Object.entries(ARTICLES)) {
    for (let n = 1; n <= 3; n++) {
      const file = `${slug}-pin-${n}.png`;
      const fpath = path.join(PINS_DIR, file);
      if (!fs.existsSync(fpath)) { process.stdout.write('⏭️'); continue; }
      
      process.stdout.write(`\n📤 ${file} `);
      try {
        await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);
        
        const fi = page.locator('input[type="file"]');
        await fi.waitFor({ state: 'visible', timeout: 15000 });
        await fi.setInputFiles(fpath);
        await sleep(5000);
        
        await page.evaluate(({t, u}) => {
          const els = document.querySelectorAll('[contenteditable="true"], textarea, input[type="url"]');
          for (const el of els) {
            if (el.getAttribute('contenteditable') === 'true') { el.textContent = t; }
            else if (el.tagName === 'TEXTAREA') { el.value = t + ' — See full guide at MomBabyPicks.com'; }
            else if (el.type === 'url') { el.value = u; }
            el.dispatchEvent?.(new Event('input', {bubbles: true}));
          }
        }, {t: title, u: url + slug + '/'});
        await sleep(2000);
        
        const pub = await page.evaluate(() => {
          for (const el of document.querySelectorAll('button, [role="button"], div, span')) {
            if (el.textContent?.trim() === 'Publish' && el.offsetParent) {
              try { el.click(); return true; } catch(e) {}
            }
          }
          return false;
        });
        
        await sleep(6000);
        if (pub) { process.stdout.write('✅'); ok++; }
        else { process.stdout.write('❌'); fail++; }
        
        // Close any modal
        await page.evaluate(() => {
          document.querySelectorAll('button, [role="button"]').forEach(el => {
            if (el.textContent?.match(/close|see|done|got it/i)) try { el.click(); } catch(e) {}
          });
        });
        await sleep(1000);
        
      } catch(e) {
        process.stdout.write(`❌${e.message.substring(0,30)}`);
        fail++;
      }
    }
  }
  
  console.log(`\n📊 Done: ${ok} OK, ${fail} failed`);
  await browser.close();
})().catch(e => console.error('❌', e.message));

const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE_URL = 'https://mombabypicks.com/posts/';

const ALL = {
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
  
  // Go to pin builder ONCE
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  console.log('📍 Pin builder loaded');
  
  let ok = 0, fail = 0;
  
  for (const [slug, title] of Object.entries(ALL)) {
    for (let n = 1; n <= 3; n++) {
      const file = `${slug}-pin-${n}.png`;
      const fpath = path.join(PINS_DIR, file);
      if (!fs.existsSync(fpath)) continue;
      
      process.stdout.write(`📤 ${file} `);
      try {
        // Upload image (no navigation, same page)
        const fi = page.locator('input[type="file"]');
        await fi.setInputFiles(fpath);
        await sleep(5000);
        
        // Fill fields
        await page.evaluate(({t, u}) => {
          const els = document.querySelectorAll('[contenteditable="true"], textarea, input[type="url"]');
          for (const el of els) {
            if (el.getAttribute('contenteditable') === 'true') el.textContent = t;
            else if (el.tagName === 'TEXTAREA') el.value = t + ' — Full guide at MomBabyPicks.com';
            else if (el.type === 'url') el.value = u;
            el.dispatchEvent?.(new Event('input', {bubbles: true}));
          }
        }, {t: title, u: BASE_URL + slug + '/'});
        await sleep(2000);
        
        // Click Publish
        const pub = await page.evaluate(() => {
          for (const el of document.querySelectorAll('button, [role="button"], div, span')) {
            if (el.textContent?.trim() === 'Publish' && el.offsetParent) {
              try { el.click(); return true; } catch(e) {}
            }
          }
          return false;
        });
        await sleep(7000);
        
        if (pub) { process.stdout.write('✅\n'); ok++; }
        else { process.stdout.write('❌ no pub\n'); fail++; }
        
        // Close "You created a Pin!" modal
        await page.evaluate(() => {
          document.querySelectorAll('button, [role="button"]').forEach(el => {
            if (el.textContent?.trim()?.match(/^See your Pin$|^Close$|^Done$|^Got it$/i)) {
              try { el.click(); } catch(e) {}
            }
          });
        });
        await sleep(2000);
        
      } catch(e) {
        process.stdout.write(`❌ ${e.message.substring(0,50)}\n`);
        fail++;
        // If error, reload page
        await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await sleep(3000);
      }
    }
  }
  
  console.log(`\n📊 Done: ${ok} OK, ${fail} failed`);
  await browser.close();
})().catch(e => console.error('❌', e.message));

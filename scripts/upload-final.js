const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE_URL = 'https://mombabypicks.com/posts/';
const LOG = '/tmp/pin-progress.txt';

function log(msg) { fs.appendFileSync(LOG, new Date().toISOString().slice(11,19) + ' ' + msg + '\n'); }

const ARTICLES = [
  ['best-baby-sleep-sacks-for-2026', 'Best Baby Sleep Sacks for 2026'],
  ['best-bottle-warmers', '5 Best Bottle Warmers for Newborns'],
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
  
  let ok = 0, fail = 0;
  
  for (const [slug, title] of ARTICLES) {
    for (let n = 1; n <= 3; n++) {
      const file = `${slug}-pin-${n}.png`;
      const fpath = path.join(PINS_DIR, file);
      if (!fs.existsSync(fpath)) { log(`SKIP ${file}`); continue; }
      
      try {
        await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);
        
        const fi = page.locator('input[type="file"]');
        if (!await fi.isVisible({ timeout: 10000 }).catch(() => false)) {
          log(`FAIL ${file} - no file input`);
          fail++; continue;
        }
        await fi.setInputFiles(fpath);
        await sleep(4000);
        
        await page.evaluate(({t, u}) => {
          // Title = first contenteditable div (large text area at top)
          const titleEl = document.querySelector('[contenteditable="true"]');
          if (titleEl) titleEl.textContent = t;
          
          // Description = textarea
          const descEl = document.querySelector('textarea');
          if (descEl) { descEl.value = t + ' — Full guide at MomBabyPicks.com'; descEl.dispatchEvent(new Event('input', {bubbles: true})); }
          
          // Link = input[type="url"]
          const linkEl = document.querySelector('input[type="url"]');
          if (linkEl) { linkEl.value = u; linkEl.dispatchEvent(new Event('input', {bubbles: true})); }
        }, {t: title, u: BASE_URL + slug + '/'});
        await sleep(2000);
        
        const pub = await page.evaluate(() => {
          // Publish button is a DIV, not BUTTON - search ALL elements
          const all = document.querySelectorAll('button, [role="button"], div, span, a');
          for (const el of all) {
            if (el.textContent?.trim() === 'Publish') {
              // Make sure it's a clickable element (not just text in a paragraph)
              const tag = el.tagName.toLowerCase();
              if (['button', 'div', 'a', 'span'].includes(tag) || el.getAttribute('role') === 'button') {
                el.click(); return true;
              }
            }
          }
          return false;
        });
        
        await sleep(7000);
        
        if (pub) { log(`OK ${file}`); ok++; }
        else { log(`FAIL ${file} - no publish btn`); fail++; }
        
      } catch(e) {
        log(`ERR ${file} - ${e.message?.substring(0,80)}`);
        fail++;
      }
    }
  }
  
  log(`DONE ok=${ok} fail=${fail}`);
  await browser.close();
})().catch(e => { log('FATAL: '+e.message); process.exit(1); });

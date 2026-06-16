const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE = 'https://mombabypicks.com/posts/';
const OUT = '/tmp/pin-bulk2.txt';
const w = m => fs.appendFileSync(OUT, new Date().toISOString().slice(11,19)+' '+m+'\n');

const DATA = [
  ['best-baby-bottles-for-newborns-2026','Best Baby Bottles for Newborns 2026'],
  ['best-baby-bouncers-for-2026','Best Baby Bouncers for 2026'],
  ['best-baby-carriers-for-2026','Best Baby Carriers for 2026'],
  ['best-baby-monitors-long-battery-life','Best Baby Monitors with Long Battery Life'],
  ['best-baby-sleep-sacks-for-2026','Best Baby Sleep Sacks for 2026'],
  ['best-bottle-warmers','5 Best Bottle Warmers for Newborns'],
  ['best-breast-pumps','5 Best Breast Pumps of 2026'],
  ['best-diapers-for-newborns-2026','Best Diapers for Newborns 2026'],
  ['best-hands-free-wearable-breast-pumps','Best Hands-Free Wearable Breast Pumps 2026'],
  ['best-high-chairs-for-babies-2026','Best High Chairs for Babies 2026'],
  ['best-infant-car-seats-2026','Best Infant Car Seats 2026'],
  ['bottle-refusal-breastfed-babies','Bottle Refusal in Breastfed Babies'],
  ['bottle-warmer-safety-guide','Bottle Warmer Safety Guide'],
  ['breast-pump-cleaning-guide','Breast Pump Cleaning Guide'],
  ['breastfeeding-essentials','Breastfeeding Essentials Guide'],
  ['eco-friendly-baby-gear-guide','Eco-Friendly Baby Gear Guide'],
  ['how-to-choose-breast-pump','How to Choose a Breast Pump'],
  ['momcozy-m5-review','Momcozy M5 Review 2026'],
  ['newborn-essentials-checklist','Newborn Essentials Checklist'],
  ['newborn-feeding-essentials','Newborn Feeding Essentials'],
  ['newborn-feeding-station','Newborn Feeding Station Setup'],
  ['pace-bottle-feeding-guide','Pace Bottle Feeding Guide'],
  ['silicone-baby-feeding-products','Silicone Baby Feeding Products'],
  ['what-not-to-buy-newborn','What Not to Buy for a Newborn'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
function getWS() {
  return new Promise((resolve) => {
    http.get('http://localhost:9222/json/version', (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d).webSocketDebuggerUrl)); });
  });
}

(async () => {
  w('START');
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];
  
  let ok = 0, fail = 0;
  for (const [slug, title] of DATA) {
    for (let n = 1; n <= 3; n++) {
      const fp = path.join(PINS_DIR, `${slug}-pin-${n}.png`);
      if (!fs.existsSync(fp)) continue;
      
      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await sleep(5000);
          
          const fi = page.locator('input[type="file"]');
          if (await fi.isVisible({timeout:15000}).catch(() => false)) {
            await fi.setInputFiles(fp);
            await sleep(5000);
            await page.locator('textarea[placeholder*="Add your title"]').fill(title);
            await page.locator('textarea[placeholder*="destination link"]').fill(BASE + slug + '/');
            await page.evaluate((t) => {
              const ce = document.querySelector('[contenteditable="true"]');
              if(ce) ce.textContent = t + ' — Full guide at MomBabyPicks.com';
            }, title);
            await sleep(2000);
            const pub = await page.evaluate(() => {
              const all = document.querySelectorAll('*');
              for(const el of all) {
                if(el.textContent?.trim()==='Publish' && !el.children.length) { el.click(); return true; }
              }
              return false;
            });
            await sleep(8000);
            if (pub) { ok++; success = true; break; }
          }
        } catch(e) {}
      }
      if (success) process.stdout.write('✅');
      else { fail++; process.stdout.write('❌'); }
    }
  }
  w(`DONE ok=${ok} fail=${fail}`);
  console.log(`\n${ok} OK, ${fail} failed`);
  await browser.close();
})().catch(e => w('FATAL: '+e.message));

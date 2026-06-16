// Upload pin-2 and pin-3 for car seats
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const PINS = [
  { file: 'static/images/pins/best-infant-car-seats-2026-pin-2.png', title: 'Best Infant Car Seats 2026 — Installation Guide' },
  { file: 'static/images/pins/best-infant-car-seats-2026-pin-3.png', title: 'Best Infant Car Seats 2026 — Comparison' },
];
const LINK = 'https://mombabypicks.com/posts/best-infant-car-seats-2026/';
const LOG = '/tmp/carseat-pins2.txt';
const log = m => require('fs').appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve(JSON.parse(d).webSocketDebuggerUrl)}catch(e){reject(e)}});
    }).on('error', reject);
  });
}

(async () => {
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];
  
  for (const pin of PINS) {
    try {
      await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(4000);
      
      const fi = page.locator('input[type="file"]');
      await fi.setInputFiles(path.join(process.env.HOME, 'GIT/PP/mombabypicks', pin.file));
      await sleep(5000);
      
      await page.evaluate(({t, u}) => {
        const ce = document.querySelector('[contenteditable="true"]');
        if(ce) ce.textContent = t;
        const ta = document.querySelector('textarea');
        if(ta){ta.value=t+' — Full guide at MomBabyPicks.com';ta.dispatchEvent(new Event('input',{bubbles:true}));}
        const li = document.querySelector('input[type="url"]');
        if(li){li.value=u;li.dispatchEvent(new Event('input',{bubbles:true}));}
      }, {t: pin.title, u: LINK});
      await sleep(2000);
      
      const pub = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        for(const el of all) {
          if(el.textContent?.trim()==='Publish' && !el.children.length) {
            el.click(); return true;
          }
        }
        return false;
      });
      
      if(pub) { log(`✅ ${pin.file}`); process.stdout.write(`✅ ${pin.file}\n`); }
      else { log(`❌ ${pin.file}`); process.stdout.write(`❌ ${pin.file}\n`); }
      await sleep(5000);
      
    } catch(e) {
      log(`ERR ${pin.file}: ${e.message}`);
      process.stdout.write(`❌ ${pin.file}\n`);
    }
  }
  
  await browser.close();
})().catch(e => log('FATAL: '+e.message));

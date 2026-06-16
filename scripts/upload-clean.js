// Pin upload only — simple & reliable
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PINS = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE = 'https://mombabypicks.com/posts/';
const LOG = '/tmp/pin-up.txt';
const log = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

const ARTICLES = [
  'best-baby-bottles-for-newborns-2026','best-baby-bouncers-for-2026','best-baby-carriers-for-2026',
  'best-baby-monitors-long-battery-life','best-baby-sleep-sacks-for-2026','best-bottle-warmers',
  'best-breast-pumps','best-diapers-for-newborns-2026','best-hands-free-wearable-breast-pumps',
  'best-high-chairs-for-babies-2026','bottle-refusal-breastfed-babies','bottle-warmer-safety-guide',
  'breast-pump-cleaning-guide','breastfeeding-essentials','eco-friendly-baby-gear-guide',
  'how-to-choose-breast-pump','momcozy-m5-review','newborn-essentials-checklist',
  'newborn-feeding-essentials','newborn-feeding-station','pace-bottle-feeding-guide',
  'silicone-baby-feeding-products','what-not-to-buy-newborn',
];

const TITLES = {
  'best-baby-bottles-for-newborns-2026':'Best Baby Bottles for Newborns 2026',
  'best-baby-bouncers-for-2026':'Best Baby Bouncers for 2026',
  'best-baby-carriers-for-2026':'Best Baby Carriers for 2026',
  'best-baby-monitors-long-battery-life':'Best Baby Monitors with Long Battery Life',
  'best-baby-sleep-sacks-for-2026':'Best Baby Sleep Sacks for 2026',
  'best-bottle-warmers':'5 Best Bottle Warmers for Newborns',
  'best-breast-pumps':'5 Best Breast Pumps of 2026',
  'best-diapers-for-newborns-2026':'Best Diapers for Newborns 2026',
  'best-hands-free-wearable-breast-pumps':'Best Hands-Free Wearable Breast Pumps 2026',
  'best-high-chairs-for-babies-2026':'Best High Chairs for Babies 2026',
  'bottle-refusal-breastfed-babies':'Bottle Refusal in Breastfed Babies',
  'bottle-warmer-safety-guide':'Bottle Warmer Safety Guide',
  'breast-pump-cleaning-guide':'Breast Pump Cleaning Guide',
  'breastfeeding-essentials':'Breastfeeding Essentials Guide',
  'eco-friendly-baby-gear-guide':'Eco-Friendly Baby Gear Guide',
  'how-to-choose-breast-pump':'How to Choose a Breast Pump',
  'momcozy-m5-review':'Momcozy M5 Review 2026',
  'newborn-essentials-checklist':'Newborn Essentials Checklist',
  'newborn-feeding-essentials':'Newborn Feeding Essentials',
  'newborn-feeding-station':'Newborn Feeding Station Setup',
  'pace-bottle-feeding-guide':'Pace Bottle Feeding Guide',
  'silicone-baby-feeding-products':'Silicone Baby Feeding Products',
  'what-not-to-buy-newborn':'What Not to Buy for a Newborn',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve(JSON.parse(d).webSocketDebuggerUrl)}catch(e){reject(e)}});
    }).on('error', reject);
  });
}

(async () => {
  log('START');
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];
  
  let ok = 0, fail = 0;
  
  for (const slug of ARTICLES) {
    for (let n = 1; n <= 3; n++) {
      const file = `${slug}-pin-${n}.png`;
      const fp = path.join(PINS, file);
      if (!fs.existsSync(fp)) continue;
      
      try {
        await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2500);
        
        const fi = page.locator('input[type="file"]');
        if (!await fi.isVisible({timeout:8000}).catch(()=>false)) { fail++; log(`FAIL ${file} no input`); continue; }
        await fi.setInputFiles(fp);
        await sleep(4000);
        
        await page.evaluate(({t,u})=>{
          const ce = document.querySelector('[contenteditable="true"]');
          if(ce) ce.textContent = t;
          const ta = document.querySelector('textarea');
          if(ta){ta.value=t+' — Full guide at MomBabyPicks.com';ta.dispatchEvent(new Event('input',{bubbles:true}));}
          const li = document.querySelector('input[type="url"]');
          if(li){li.value=u;li.dispatchEvent(new Event('input',{bubbles:true}));}
        }, {t: TITLES[slug], u: BASE + slug + '/'});
        await sleep(1500);
        
        const pub = await page.evaluate(() => {
          const all = document.querySelectorAll('*');
          for(const el of all) {
            if(el.textContent?.trim()==='Publish' && !el.children.length) {
              el.click(); return true;
            }
          }
          return false;
        });
        await sleep(6000);
        
        if(pub) { process.stdout.write('✅'); ok++; }
        else { process.stdout.write('❌'); fail++; }
        
      } catch(e) {
        process.stdout.write('❌'); fail++;
      }
    }
  }
  
  log(`DONE ok=${ok} fail=${fail}`);
  await browser.close();
})().catch(e => log('FATAL: '+e.message));

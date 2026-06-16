// Upload 1 pin for car seats article
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const IMG_URL = 'https://v3b.fal.media/files/b/0a9e8c2c/w4VJqP4AVJ8L2cydpkW0v_xzYEdtmn.png';
const TITLE = 'Best Infant Car Seats 2026';
const LINK = 'https://mombabypicks.com/posts/best-infant-car-seats-2026/';
const LOG = '/tmp/carseat-pin.txt';
const log = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

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
  
  // Download image
  const tmp = '/tmp/carseat-pin.png';
  const resp = await fetch(IMG_URL);
  const buf = await resp.arrayBuffer();
  fs.writeFileSync(tmp, Buffer.from(buf));
  log('Downloaded image');
  
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];
  
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  
  const fi = page.locator('input[type="file"]');
  await fi.setInputFiles(tmp);
  await sleep(5000);
  
  await page.evaluate(({t, u}) => {
    const ce = document.querySelector('[contenteditable="true"]');
    if(ce) ce.textContent = t;
    const ta = document.querySelector('textarea');
    if(ta){ta.value=t+' — Full guide at MomBabyPicks.com';ta.dispatchEvent(new Event('input',{bubbles:true}));}
    const li = document.querySelector('input[type="url"]');
    if(li){li.value=u;li.dispatchEvent(new Event('input',{bubbles:true}));}
  }, {t: TITLE, u: LINK});
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
  
  if(pub) { log('✅ Published!'); process.stdout.write('✅ Published!\n'); }
  else { log('❌ No publish btn'); process.stdout.write('❌ No publish\n'); }
  
  await sleep(5000);
  await browser.close();
})().catch(e => log('FATAL: '+e.message));

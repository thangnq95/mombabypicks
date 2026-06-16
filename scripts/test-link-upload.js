// Quick test: upload 1 pin with correct link
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getWS() {
  return new Promise((resolve) => {
    http.get('http://localhost:9222/json/version', (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d).webSocketDebuggerUrl)); });
  });
}

(async () => {
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];
  
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  
  const fp = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins/best-infant-car-seats-2026-pin-1.png');
  await page.locator('input[type="file"]').setInputFiles(fp);
  await sleep(5000);
  
  // Title
  await page.locator('textarea[placeholder*="Add your title"]').fill('Best Infant Car Seats 2026');
  
  // Link — THIS IS THE FIX
  await page.locator('textarea[placeholder*="destination link"]').fill('https://mombabypicks.com/posts/best-infant-car-seats-2026/');
  
  // Description
  await page.evaluate(() => {
    const ce = document.querySelector('[contenteditable="true"]');
    if(ce) ce.textContent = 'Best Infant Car Seats 2026 — Full guide at MomBabyPicks.com';
  });
  
  await sleep(2000);
  
  // Publish
  const pub = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for(const el of all) {
      if(el.textContent?.trim()==='Publish' && !el.children.length) {
        el.click(); return true;
      }
    }
    return false;
  });
  
  await sleep(8000);
  console.log(pub ? '✅ Published WITH LINK!' : '❌ Failed');
  
  await browser.close();
})().catch(e => console.error(e.message));

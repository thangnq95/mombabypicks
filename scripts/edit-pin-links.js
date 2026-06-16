// Edit existing pins to add destination links
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

const LOG = '/tmp/pin-edit.txt';
const log = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

const BASE = 'https://mombabypicks.com/posts/';

const PIN_LINKS = {
  '848647123576681131': 'best-baby-bottles-for-newborns-2026',
  '848647123576681140': 'best-baby-bouncers-for-2026',
  '848647123576681155': 'best-baby-carriers-for-2026',
  '848647123576685900': 'best-baby-monitors-long-battery-life',
  // More pins...
};

// Try to find pins by searching Pinterest for mombabypicks.com pins without links
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getWS() {
  return new Promise((resolve) => {
    http.get('http://localhost:9222/json/version', (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>resolve(JSON.parse(d).webSocketDebuggerUrl)); });
  });
}

(async () => {
  log('START');
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const page = (browser.contexts()[0]?.pages() || [await browser.newPage()])[0];
  
  // Go to board to get all pin IDs
  await page.goto('https://www.pinterest.com/mombabypicks/baby-gear-new-mom-essentials/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(5000);
  
  // Scroll to load more pins
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(3000);
  
  // Extract pin IDs and their current link (or lack thereof)
  const pins = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/pin/"]');
    const seen = new Set();
    return Array.from(links).filter(a => {
      const m = a.href.match(/\/pin\/(\d+)/);
      if (m && !seen.has(m[1])) { seen.add(m[1]); return true; }
      return false;
    }).map(a => ({ id: a.href.match(/\/pin\/(\d+)/)[1], text: a.textContent?.substring(0,50) || '' }));
  });
  
  log(`Found ${pins.length} pins on board`);
  
  // For each pin, check if it has a link and add one if missing
  let edited = 0;
  for (const pin of pins) {
    try {
      await page.goto(`https://www.pinterest.com/pin/${pin.id}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(3000);
      
      // Check current link
      const hasLink = await page.evaluate(() => {
        const a = document.querySelector('a[href*="mombabypicks.com/posts"]');
        return a ? a.href : null;
      });
      
      if (hasLink) {
        log(`SKIP ${pin.id} — already has link: ${hasLink}`);
        continue;
      }
      
      // Click edit button
      const editClicked = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, [role="button"]');
        for (const b of btns) {
          if (b.textContent?.trim().toLowerCase() === 'edit') {
            b.click(); return true;
          }
        }
        return false;
      });
      
      if (!editClicked) { log(`SKIP ${pin.id} — no edit btn`); continue; }
      await sleep(3000);
      
      // Find link field in edit modal and fill it
      const linkFilled = await page.evaluate(() => {
        const textareas = document.querySelectorAll('textarea');
        for (const ta of textareas) {
          if (ta.placeholder?.toLowerCase().includes('destination link') || ta.placeholder?.toLowerCase().includes('link')) {
            ta.value = 'https://mombabypicks.com/';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
        return false;
      });
      
      if (!linkFilled) { log(`SKIP ${pin.id} — no link field`); continue; }
      await sleep(2000);
      
      // Click Save
      const saved = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          if (el.textContent?.trim() === 'Save' && el.tagName === 'BUTTON') {
            el.click(); return true;
          }
        }
        return false;
      });
      
      if (saved) { process.stdout.write('✏️'); edited++; log(`EDITED ${pin.id}`); }
      else { log(`SKIP ${pin.id} — no save btn`); }
      
      await sleep(3000);
      
    } catch(e) {
      log(`ERR ${pin.id}: ${e.message.substring(0,60)}`);
    }
  }
  
  log(`DONE: ${edited} pins edited`);
  await browser.close();
})().catch(e => log('FATAL: '+e.message));

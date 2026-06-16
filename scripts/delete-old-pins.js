// Delete old pins via Pinterest API
const { chromium } = require('playwright');
const http = require('http');

const LOG = '/tmp/pin-delete.txt';
const log = m => require('fs').appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

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
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || await ctx.newPage();
  
  // Go to board to get pin IDs
  await page.goto('https://www.pinterest.com/mombabypicks/baby-gear-new-mom-essentials/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  // Scroll to load all pins
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await new Promise(r => setTimeout(r, 3000));
  
  // Get ALL pin IDs from the page
  const allPinIds = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    const ids = new Set();
    scripts.forEach(s => {
      // Match pattern like "id":"123456789" 
      const matches = s.textContent?.match(/"id":"(\d{10,})"/g) || [];
      matches.forEach(m => {
        const id = m.match(/"id":"(\d{10,})"/)?.[1];
        if (id) ids.add(id);
      });
    });
    return Array.from(ids);
  });
  
  log(`Found ${allPinIds.length} total pin IDs`);
  
  // Navigate to each pin and click delete
  let deleted = 0;
  for (const pinId of allPinIds) {
    try {
      await page.goto(`https://www.pinterest.com/pin/${pinId}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 3000));
      
      // Click the "..." more button
      const clicked = await page.evaluate(() => {
        // Try various selectors for the more options button
        const selectors = [
          'div[data-test-id="pin-more-button"]',
          'button[aria-label="More"]',
          'div[aria-label="More"][role="button"]',
          'div[data-test-id="pin-action-bar"] button:last-child',
          '[aria-label*="more" i][role="button"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.offsetParent !== null) { el.click(); return true; }
        }
        return false;
      });
      
      if (!clicked) {
        // Try clicking the share/menu icon via coordinates
        const result = await page.evaluate(() => {
          // Find the "..." SVG or icon
          const svgs = document.querySelectorAll('svg');
          for (const svg of svgs) {
            if (svg.closest('[role="button"], button, div[role="button"]')) continue;
            if (svg.outerHTML.includes('M5') || svg.outerHTML.includes('ellipsis') || svg.outerHTML.includes('more')) {
              const parent = svg.closest('[role="button"], button, div') || svg.parentElement;
              if (parent && parent.offsetParent !== null) {
                parent.click();
                return true;
              }
            }
          }
          return false;
        });
        if (!result) { log(`SKIP ${pinId} - no more btn`); continue; }
      }
      
      await new Promise(r => setTimeout(r, 1500));
      
      // Find and click "Delete pin" in the menu
      const deleted = await page.evaluate(() => {
        const items = document.querySelectorAll('[role="menuitem"], li, div[role="button"]');
        for (const item of items) {
          const text = item.textContent?.trim().toLowerCase();
          if (text?.includes('delete')) {
            item.click();
            return true;
          }
        }
        return false;
      });
      
      if (!deleted) { log(`SKIP ${pinId} - no delete in menu`); continue; }
      await new Promise(r => setTimeout(r, 1500));
      
      // Confirm delete
      const confirmed = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, div[role="button"]');
        for (const b of btns) {
          if (b.textContent?.trim().toLowerCase() === 'delete') {
            b.click();
            return true;
          }
        }
        return false;
      });
      
      if (confirmed) {
        process.stdout.write('🗑️');
        deleted++;
      }
      await new Promise(r => setTimeout(r, 2000));
      
    } catch(e) {
      process.stdout.write('❌');
    }
  }
  
  log(`Deleted ${deleted}/${allPinIds.length}`);
  await browser.close();
})().catch(e => log('FATAL: '+e.message));

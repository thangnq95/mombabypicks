// Delete old pins — use Playwright connectOverCDP, navigate to board, delete via UI
const http = require('http');
const { chromium } = require('playwright');

const LOG = '/tmp/pin-del3.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const w = m => require('fs').appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

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
  
  // Navigate to created pins page (should have session)
  await page.goto('https://www.pinterest.com/mombabypicks/created/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(8000);
  
  // Take screenshot to debug
  await page.screenshot({path: '/tmp/pin-board.png'});
  
  // Try to extract pin links from visible page content
  const pinData = await page.evaluate(() => {
    // Look for any links containing pin IDs
    const allLinks = Array.from(document.querySelectorAll('a')).map(a => a.href);
    const pinLinks = allLinks.filter(h => h.includes('/pin/') && !h.includes('created'));
    const unique = [...new Set(pinLinks)].map(h => h.match(/\/pin\/(\d+)/)?.[1]).filter(Boolean);
    return unique.slice(0, 20); // Limit to 20 for now
  });
  
  w(`Found ${pinData.length} pins on page`);
  console.log(`${pinData.length} pins visible`);
  
  if (pinData.length === 0) {
    // Try API call with full URL
    const apiResult = await page.evaluate(async () => {
      try {
        const r = await fetch('https://www.pinterest.com/resource/BoardFeedResource/get/?source_url=/mombabypicks/baby-gear-new-mom-essentials/&data=' + encodeURIComponent(JSON.stringify({options:{page_size:100,username:'mombabypicks',slug:'baby-gear-new-mom-essentials'},context:{}})));
        const j = await r.json();
        return j.resource_response?.data?.map?.(p => p.id) || [];
      } catch(e) {
        return 'API_ERROR: ' + e.message;
      }
    });
    
    if (typeof apiResult === 'string') {
      w(apiResult);
      console.log(apiResult);
      await browser.close();
      return;
    }
    
    pinData.push(...apiResult);
  }
  
  console.log(`Total: ${pinData.length} pins`);
  
  // For each pin, navigate and delete
  let deleted = 0;
  for (const pinId of pinData) {
    try {
      await page.goto(`https://www.pinterest.com/pin/${pinId}/`, {waitUntil:'domcontentloaded', timeout:20000});
      await sleep(3000);
      
      // Check if pin has a link
      const hasLink = await page.evaluate(() => {
        return document.querySelector('a[href*="mombabypicks.com/posts"]') ? true : false;
      });
      
      if (hasLink) { w(`SKIP ${pinId} (has link)`); continue; }
      
      // Try sending keyboard shortcut: just press '?' then look for delete
      // Actually, press '/' for quick actions search, type 'delete'
      await page.keyboard.press('Delete');
      await sleep(1000);
      
      // Check if any delete dialog appeared
      const dialogBtn = await page.evaluate(() => {
        const btns = document.querySelectorAll('button, [role="button"]');
        for (const b of btns) {
          if (b.textContent?.trim().toLowerCase() === 'delete' || 
              b.textContent?.trim().toLowerCase() === 'delete pin') { 
            b.click(); return 'clicked'; 
          }
        }
        return 'not found';
      });
      
      if (dialogBtn === 'clicked') {
        await sleep(1500);
        // Confirm if needed
        const confirmed = await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.textContent?.trim().toLowerCase() === 'delete') { b.click(); return true; }
          }
          return false;
        });
        process.stdout.write('🗑️');
        deleted++;
        w(`DEL ${pinId}`);
        await sleep(2000);
      } else {
        // Try the '...' menu approach
        await page.keyboard.press('Escape');
        await sleep(500);
        await page.keyboard.press('Tab');
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(2000);
        
        const menuDel = await page.evaluate(() => {
          const items = document.querySelectorAll('[role="menuitem"]');
          for (const item of items) {
            const txt = item.textContent?.trim().toLowerCase() || '';
            if (txt.includes('delete')) { item.click(); return true; }
          }
          return false;
        });
        
        if (menuDel) {
          await sleep(1000);
          document.querySelectorAll('button').forEach(b => {
            if (b.textContent?.trim().toLowerCase() === 'delete') b.click();
          });
          process.stdout.write('🗑️');
          deleted++;
          w(`DEL ${pinId} (menu)`);
          await sleep(2000);
        } else {
          w(`SKIP ${pinId} — cannot find delete`);
        }
      }
    } catch(e) {
      w(`ERR ${pinId}`);
    }
  }
  
  w(`DONE: ${deleted} deleted`);
  console.log(`\n🗑️ ${deleted} old pins deleted`);
  await browser.close();
})().catch(e => w('FATAL: '+e.message));

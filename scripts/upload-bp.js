const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');

async function uploadOne() {
  const userDataDir = path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest');
  const ctx = await chromium.launchPersistentContext(userDataDir, { 
    headless: true, args: ['--no-sandbox'], viewport: { width: 1280, height: 800 } 
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  
  const slug = 'best-breast-pumps';
  const link = 'https://mombabypicks.com/posts/best-breast-pumps/';
  
  const titles = [
    'Breast pumps that work for working moms — Amazon best seller',
    'I pumped for 12 months — these 3 pumps are worth your money',
    'Before you buy a breast pump: the 2026 guide every mom needs',
    'Wearable vs hospital-grade pump: which one should you get?',
  ];
  
  for (let i = 0; i < titles.length; i++) {
    const fp = path.join(PINS_DIR, slug + '-pin-' + (i % 3 + 1) + '.png');
    await page.goto('about:blank'); await sleep(1000);
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(7000);
    
    const fi = page.locator('input[type="file"]');
    if (!await fi.isVisible({timeout:12000}).catch(()=>false)) { 
      console.log('No file input for pin', i+1); 
      continue; 
    }
    
    await fi.setInputFiles(fp); await sleep(5000);
    await page.locator('input[placeholder*="Tell everyone"]').fill(titles[i]);
    await page.locator('input[placeholder="Add a link"]').fill(link);
    await page.evaluate((t) => {
      const ce = document.querySelector('[contenteditable="true"]');
      if(ce) ce.textContent = t + ' | MomBabyPicks.com';
    }, titles[i]);
    await sleep(1500);
    
    const ok = await page.evaluate(() => {
      for (const b of document.querySelectorAll('button'))
        if (b.textContent.trim() === 'Publish' && b.offsetParent !== null) { b.click(); return true; }
      return false;
    });
    console.log(ok ? '✅' : '❌', titles[i].substring(0,60));
    await sleep(5000);
  }
  
  console.log('Done: 4 breast pump pins in drafts');
  await ctx.close();
}

uploadOne().catch(e => console.error(e));

const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');

(async () => {
  const userDataDir = path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest');
  const ctx = await chromium.launchPersistentContext(userDataDir, { headless: true, args: ['--no-sandbox'], viewport: { width: 1280, height: 800 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  
  const slug = 'best-infant-car-seats-2026';
  const link = 'https://mombabypicks.com/posts/best-infant-car-seats-2026/';
  
  const titles = [
    'Best infant car seats that crash-tested safest — 2026 guide',
    'Compact car? 5 infant car seats that actually fit',
    "Don't overpay for an infant car seat — our honest picks",
    'Car seat guide: what nobody tells you before baby arrives',
  ];
  
  for (let i = 0; i < titles.length; i++) {
    const fp = path.join(PINS_DIR, slug + '-pin-' + (i % 3 + 1) + '.png');
    await page.goto('about:blank'); await sleep(1000);
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(7000);
    const fi = page.locator('input[type="file"]');
    if (!await fi.isVisible({timeout:12000}).catch(()=>false)) { console.log('Skip', i+1); continue; }
    await fi.setInputFiles(fp); await sleep(5000);
    await page.locator('input[placeholder*="Tell everyone"]').fill(titles[i]);
    await page.locator('input[placeholder="Add a link"]').fill(link);
    await page.evaluate((t) => { const ce = document.querySelector('[contenteditable="true"]'); if(ce) ce.textContent = t + ' | MomBabyPicks.com'; }, titles[i]);
    await sleep(1500);
    const ok = await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Publish' && b.offsetParent !== null) { b.click(); return true; } return false; });
    console.log(ok ? '✅' : '❌', i+1);
    await sleep(5000);
  }
  console.log('Done');
  await ctx.close();
})().catch(e => console.error(e));

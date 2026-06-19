const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');

(async () => {
  const userDataDir = path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest');
  const ctx = await chromium.launchPersistentContext(userDataDir, { headless: false, args: ['--no-sandbox'], viewport: { width: 1280, height: 800 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  
  const slug = 'best-diapers-for-newborns-2026';
  const link = 'https://mombabypicks.com/posts/best-diapers-for-newborns-2026/';
  
  const titles = [
    "Newborn diapers that don't leak at 3am — moms swear by these",
    'Best diapers for sensitive newborn skin — Amazon top rated',
    'Huggies vs Pampers for newborns: which one fits better?',
    'How many newborn diapers do I need? Plus our top 5 picks',
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
  console.log('Done: 4 diaper pins');
  await ctx.close();
})().catch(e => console.error(e));

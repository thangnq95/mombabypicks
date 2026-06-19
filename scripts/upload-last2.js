const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE = 'https://mombabypicks.com/posts/';

(async () => {
  const ctx = await chromium.launchPersistentContext(
    path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest'),
    { headless: false, args: ['--no-sandbox'], viewport: { width: 1280, height: 800 } }
  );
  const page = ctx.pages()[0] || await ctx.newPage();
  
  const articles = [
    {
      slug: 'best-baby-bottles-for-newborns-2026',
      titles: [
        "Baby won't take a bottle? Try these 5 bottles moms swear by",
        'Best baby bottles for breastfed babies — no nipple confusion',
        'Anti-colic bottles that ACTUALLY work — tested and ranked',
      ]
    },
    {
      slug: 'best-baby-monitors-long-battery-life',
      titles: [
        'Baby monitors with longest battery — no more midnight deaths',
        'Non-WiFi baby monitors that wont get hacked — safe picks 2026',
        'Best baby monitors under $100 — budget picks that work great',
      ]
    }
  ];
  
  for (const article of articles) {
    console.log(article.slug + ':');
    for (let i = 0; i < article.titles.length; i++) {
      const fp = path.join(PINS_DIR, article.slug + '-pin-' + (i + 1) + '.png');
      await page.goto('about:blank'); await sleep(1000);
      await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(6000);
      const fi = page.locator('input[type="file"]');
      if (!await fi.isVisible({timeout:10000}).catch(()=>false)) { process.stdout.write('x'); continue; }
      await fi.setInputFiles(fp); await sleep(5000);
      await page.locator('input[placeholder*="Tell everyone"]').fill(article.titles[i]);
      await page.locator('input[placeholder="Add a link"]').fill(BASE + article.slug + '/');
      await page.evaluate((t) => {
        const ce = document.querySelector('[contenteditable="true"]');
        if(ce) ce.textContent = t + ' | MomBabyPicks.com';
      }, article.titles[i]);
      await sleep(1500);
      await page.evaluate(() => {
        for (const b of document.querySelectorAll('button'))
          if (b.textContent.trim() === 'Publish' && b.offsetParent !== null) { b.click(); return true; }
        return false;
      });
      process.stdout.write('✅');
      await sleep(4000);
    }
    console.log('');
  }
  console.log('Done');
  await ctx.close();
})().catch(e => console.error(e));

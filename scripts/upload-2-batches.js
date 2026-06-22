const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BOTTLES = [
  "Baby won't take a bottle? Try these 5 bottles moms swear by",
  'Best baby bottles for breastfed babies — no nipple confusion',
  'Anti-colic bottles that ACTUALLY work — tested & ranked',
  'Gas, colic, reflux: the right bottle changes everything',
];
const MONITORS = [
  'Baby monitors with longest battery — no more midnight deaths',
  "Non-WiFi baby monitors that won't get hacked — safe picks 2026",
  'Best baby monitors under $100 — budget picks that work',
  'Audio-only vs video monitor: which is right for your family?',
];
async function upload(slug, link, titles) {
  const ctx = await chromium.launchPersistentContext(path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest'), { headless: true, args: ['--no-sandbox'] });
  const page = ctx.pages()[0] || await ctx.newPage();
  for (let i = 0; i < titles.length; i++) {
    const fp = path.join(PINS_DIR, slug + '-pin-' + (i % 3 + 1) + '.png');
    await page.goto('about:blank'); await sleep(1000);
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(7000);
    const fi = page.locator('input[type="file"]');
    if (!await fi.isVisible({timeout:12000}).catch(()=>false)) continue;
    await fi.setInputFiles(fp); await sleep(5000);
    await page.locator('input[placeholder*="Tell everyone"]').fill(titles[i]);
    await page.locator('input[placeholder="Add a link"]').fill(link);
    await page.evaluate((t) => { const ce = document.querySelector('[contenteditable="true"]'); if(ce) ce.textContent = t + ' | MomBabyPicks.com'; }, titles[i]);
    await sleep(1500);
    await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'Publish' && b.offsetParent !== null) { b.click(); return true; } return false; });
    process.stdout.write('✅');
    await sleep(5000);
  }
  process.stdout.write('\n');
  await ctx.close();
}
(async () => {
  console.log('Baby Bottles:'); await upload('best-baby-bottles-for-newborns-2026', 'https://mombabypicks.com/posts/best-baby-bottles-for-newborns-2026/', BOTTLES);
  console.log('Monitors:'); await upload('best-baby-monitors-long-battery-life', 'https://mombabypicks.com/posts/best-baby-monitors-long-battery-life/', MONITORS);
  console.log('All done!');
})();

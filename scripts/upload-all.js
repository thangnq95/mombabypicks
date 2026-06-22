const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE = 'https://mombabypicks.com/posts/';

const ARTICLES = [
  {
    slug: 'best-breast-pumps',
    titles: [
      'Breast pumps that work for working moms — Amazon best seller',
      'I pumped for 12 months — these 3 pumps are worth your money',
      'Before you buy a breast pump: the 2026 guide every mom needs',
      'Wearable vs hospital-grade pump: which one should you get?',
    ]
  },
  {
    slug: 'best-diapers-for-newborns-2026',
    titles: [
      "Newborn diapers that don't leak at 3am — moms swear by these",
      'Best diapers for sensitive newborn skin — Amazon top rated',
      'Huggies vs Pampers for newborns: which one fits better?',
      'How many newborn diapers do I need? Plus our top 5 picks',
    ]
  },
  {
    slug: 'best-infant-car-seats-2026',
    titles: [
      'Best infant car seats that crash-tested safest — 2026 guide',
      'Compact car? 5 infant car seats that actually fit',
      "Don't overpay for an infant car seat — our honest picks",
      'Car seat guide: what nobody tells you before baby arrives',
    ]
  },
  {
    slug: 'best-baby-bottles-for-newborns-2026',
    titles: [
      "Baby won't take a bottle? Try these 5 bottles moms swear by",
      'Best baby bottles for breastfed babies — no nipple confusion',
      'Anti-colic bottles that ACTUALLY work — tested & ranked',
      'Gas, colic, reflux: the right bottle changes everything',
    ]
  },
  {
    slug: 'best-baby-monitors-long-battery-life',
    titles: [
      'Baby monitors with longest battery — no more midnight deaths',
      "Non-WiFi baby monitors that won't get hacked — safe picks 2026",
      'Best baby monitors under $100 — budget picks that work',
      'Audio-only vs video monitor: which is right for your family?',
    ]
  },
];

(async () => {
  const ctx = await chromium.launchPersistentContext(
    path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest'),
    { headless: true, args: ['--no-sandbox'], viewport: { width: 1280, height: 800 } }
  );
  const page = ctx.pages()[0] || await ctx.newPage();
  
  let total = 0;
  for (const article of ARTICLES) {
    console.log(article.slug + ':');
    for (let i = 0; i < article.titles.length; i++) {
      const fp = path.join(PINS_DIR, article.slug + '-pin-' + (i % 3 + 1) + '.png');
      await page.goto('about:blank'); await sleep(1000);
      await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(6000);
      
      const fi = page.locator('input[type="file"]');
      if (!await fi.isVisible({timeout:10000}).catch(()=>false)) { process.stdout.write('❌'); continue; }
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
      process.stdout.write('📌');
      total++;
      await sleep(4000);
    }
    console.log(' done');
  }
  console.log('\nTotal: ' + total + ' pins in drafts');
  await ctx.close();
})().catch(e => console.error(e));

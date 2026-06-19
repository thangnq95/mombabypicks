// Upload 20 buyer-intent Pinterest pins using Playwright Chromium
const { chromium } = require('playwright');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const BASE_URL = 'https://mombabypicks.com/posts/';

const PINS = [
  // Best breast pumps (4 pins)
  {slug:'best-breast-pumps', title:'Breast pumps that work for working moms — Amazon best seller'},
  {slug:'best-breast-pumps', title:'I pumped for 12 months — these 3 pumps are worth your money'},
  {slug:'best-breast-pumps', title:"Don't buy a breast pump until you read this — 2026 guide"},
  {slug:'best-breast-pumps', title:'Wearable vs hospital-grade: which pump do you ACTUALLY need?'},
  // Best diapers (4 pins)
  {slug:'best-diapers-for-newborns-2026', title:"Newborn diapers that don't leak at 3am — moms swear by these"},
  {slug:'best-diapers-for-newborns-2026', title:'Best diapers for sensitive newborn skin — Amazon top rated'},
  {slug:'best-diapers-for-newborns-2026', title:'Huggies vs Pampers for newborns: which fits better?'},
  {slug:'best-diapers-for-newborns-2026', title:'How many newborn diapers do I need? + our top 5 picks'},
  // Best car seats (4 pins)
  {slug:'best-infant-car-seats-2026', title:'Best infant car seats that crash-tested safest — 2026 guide'},
  {slug:'best-infant-car-seats-2026', title:'Compact car? 5 infant car seats that actually fit'},
  {slug:'best-infant-car-seats-2026', title:"Don't overpay for an infant car seat — our honest picks"},
  {slug:'best-infant-car-seats-2026', title:'Car seat guide: what nobody tells you before baby arrives'},
  // Best baby bottles (4 pins)
  {slug:'best-baby-bottles-for-newborns-2026', title:"Baby won't take a bottle? Try these 5 bottles moms swear by"},
  {slug:'best-baby-bottles-for-newborns-2026', title:'Best baby bottles for breastfed babies — no nipple confusion'},
  {slug:'best-baby-bottles-for-newborns-2026', title:'Anti-colic bottles that ACTUALLY work — tested & ranked'},
  {slug:'best-baby-bottles-for-newborns-2026', title:'Gas, colic, reflux: the right bottle changes everything'},
  // Best monitors (4 pins)
  {slug:'best-baby-monitors-long-battery-life', title:'Baby monitors with longest battery — no more midnight deaths'},
  {slug:'best-baby-monitors-long-battery-life', title:"Non-WiFi baby monitors that won't get hacked — safe picks 2026"},
  {slug:'best-baby-monitors-long-battery-life', title:'Best baby monitors under $100 — budget picks that work'},
  {slug:'best-baby-monitors-long-battery-life', title:'Audio-only vs video monitor: which is right for your family?'},
];

(async () => {
  const userDataDir = path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest');
  const ctx = await chromium.launchPersistentContext(userDataDir, { 
    headless: false, args: ['--no-sandbox'], viewport: { width: 1280, height: 800 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  
  let ok = 0;
  for (const pin of PINS) {
    const fp = path.join(PINS_DIR, pin.slug + '-pin-1.png');
    await page.goto('about:blank'); await sleep(1000);
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(7000);
    
    const fi = page.locator('input[type="file"]');
    if (!await fi.isVisible({timeout:12000}).catch(()=>false)) { process.stdout.write('❌'); continue; }
    
    await fi.setInputFiles(fp); await sleep(5000);
    await page.locator('input[placeholder*="Tell everyone"]').fill(pin.title);
    await page.locator('input[placeholder="Add a link"]').fill(BASE_URL + pin.slug + '/');
    await page.evaluate((t) => {
      const ce = document.querySelector('[contenteditable="true"]');
      if(ce) ce.textContent = t + ' — Full guide at MomBabyPicks.com';
    }, pin.title);
    await sleep(1500);
    
    const clicked = await page.evaluate(() => {
      for (const b of document.querySelectorAll('button'))
        if (b.textContent?.trim() === 'Publish' && b.offsetParent !== null) { b.click(); return true; }
      return false;
    });
    process.stdout.write(clicked ? '📌' : '❌');
    if (clicked) ok++;
    await sleep(5000);
  }
  
  console.log('\n' + ok + '/' + PINS.length + ' pins in drafts');
  await ctx.close();
})().catch(e => console.error(e));

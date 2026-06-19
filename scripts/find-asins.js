const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const ctx = await chromium.launchPersistentContext(
    path.join(process.env.HOME, '.hermes', 'playwright-session', 'amazon'),
    { headless: false, args: ['--no-sandbox'] }
  );
  const page = ctx.pages()[0] || await ctx.newPage();
  
  // Search for each diaper product and extract ASIN
  const products = [
    'Pampers Swaddlers newborn diaper',
    'Huggies Little Snugglers newborn diaper',
    'Seventh Generation Free Clear baby diaper',
    'The Honest Company diapers newborn',
    'Dyper Bamboo baby diaper'
  ];
  
  for (const q of products) {
    await page.goto('about:blank');
    await page.goto('https://www.amazon.com/s?k=' + encodeURIComponent(q), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));
    const asin = await page.evaluate(() => {
      const link = document.querySelector('a[href*="/dp/"]');
      if (!link) return null;
      const m = link.href.match(/\/dp\/([A-Z0-9]{10})/);
      return m ? m[1] : null;
    });
    console.log(asin || 'NOT FOUND', '-', q.substring(0,50));
  }
  
  console.log('\nDone');
  await ctx.close();
})().catch(e => console.error(e));

const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const ctx = await chromium.launchPersistentContext(
    path.join(process.env.HOME, '.hermes', 'playwright-session', 'pinterest'),
    { headless: true, args: ['--no-sandbox'] }
  );
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.pinterest.com/pin-creation-tool/?view=drafts', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));
  
  const body = await page.evaluate(() => document.body.innerText);
  const chunks = body.split('\n').filter(l => l.length > 15 && !l.includes('until expiration') && !l.includes('Skip to') && !l.includes('Create new') && !l.includes('Mom Baby Picks') && !l.includes('Pin drafts') && !l.includes('Pinterest'));
  
  // Group by keyword matching
  const groups = {};
  for (const line of chunks) {
    const lower = line.toLowerCase().replace("'", '');
    let key = 'OTHER';
    if (lower.includes('breast pump') || lower.includes('pump that') || lower.includes('pumped for')) key = 'BREAST PUMPS';
    else if (lower.includes('diaper') || lower.includes('pampers') || lower.includes('huggies')) key = 'DIAPERS';
    else if (lower.includes('car seat') || lower.includes('compact car') || lower.includes('overpay for')) key = 'CAR SEATS';
    else if (lower.includes('bottle') || lower.includes('nipple') || lower.includes('colic') || lower.includes('gas, colic')) key = 'BABY BOTTLES';
    else if (lower.includes('monitor') || lower.includes('wifi') || lower.includes('audio-only')) key = 'MONITORS';
    else if (lower.includes('baby bath') || lower.includes('bath tub')) key = 'BATH TUBS';
    else if (lower.includes('play mat')) key = 'PLAY MATS';
    else if (lower.includes('swing')) key = 'SWINGS';
    
    groups[key] = (groups[key] || 0) + 1;
  }
  
  console.log('Draft count per article:');
  for (const [k, v] of Object.entries(groups).sort((a,b) => b[1]-a[1])) {
    console.log(`${v > 3 ? '⚠️' : '✅'} ${k}: ${v} pins`);
  }
  
  await ctx.close();
})().catch(e => console.error(e));

/**
 * fix-4-pins-direct.mjs — Upload 4 FAIL pins using Playwright connectOverCDP (skip Browser.setDownloadBehavior)
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-4-direct.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11,19)+' '+m+'\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ARTICLES = [
  { slug: 'best-baby-bath-tubs-2026', title: 'Best Baby Bath Tubs 2026', post_url: 'https://mombabypicks.com/posts/best-baby-bath-tubs-2026/', pins: [
      { title: 'Best Baby Bath Tubs 2026: Safe & Easy Options for Newborns to Toddlers', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
      { title: 'Top Baby Bath Tubs 2026: Newborn to Toddler Picks', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
      { title: 'Best Baby Bath Tubs for Safe & Easy Bath Time', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
  ]},
  { slug: 'best-baby-play-mats-2026', title: 'Best Baby Play Mats 2026', post_url: 'https://mombabypicks.com/posts/best-baby-play-mats-2026/', pins: [
      { title: 'Best Baby Play Mats 2026: Safe & Soft Options for Tummy Time & Play', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
      { title: 'Top Baby Play Mats 2026: The Complete Guide', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
      { title: 'Best Play Mats for Tummy Time & Crawling 2026', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
  ]},
  { slug: 'best-baby-swings-2026', title: 'Best Baby Swings 2026', post_url: 'https://mombabypicks.com/posts/best-baby-swings-2026/', pins: [
      { title: 'Best Baby Swings 2026: Soothe Your Baby with the Right Swing', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
      { title: 'Top Baby Swings 2026: Our Picks for Every Budget', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
      { title: 'Which Baby Swing Is Best? 2026\'s Top 5 Reviewed', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
  ]},
  { slug: 'best-infant-car-seats-2026', title: 'Best Infant Car Seats 2026', post_url: 'https://mombabypicks.com/posts/best-infant-car-seats-2026/', pins: [
      { title: 'Best Infant Car Seats 2026: Safety Ratings, Installation & Budget Picks', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
      { title: 'Top Infant Car Seats 2026: Safety & Value Compared', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
      { title: 'Which Infant Car Seat is Safest? 2026 Guide', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
  ]},
];

async function main() {
  log('='.repeat(60));
  log('START fix-4-pins (CDP direct, no setDownloadBehavior)');
  log('='.repeat(60));

  // Get WebSocket URL from CDP
  const http = await import('http');
  const wsUrl = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d).webSocketDebuggerUrl); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
  log(`WS URL: ${wsUrl}`);
  const browser = await chromium.connectOverCDP(wsUrl);
  log('Connected to Chrome CDP');

  // Use existing first page (or create one)
  const context = browser.contexts()[0];
  let page;
  if (context) {
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  } else {
    // Create a new context
    const ctx = await browser.newContext();
    page = await ctx.newPage();
  }

  // Check Pinterest login
  log('Checking Pinterest login...');
  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(4000);
  
  const currentUrl = page.url();
  log(`Current URL: ${currentUrl}`);
  console.log(`Current URL: ${currentUrl}`);

  if (currentUrl.includes('login')) {
    log('❌ Not logged in');
    console.log('❌ Not logged into Pinterest');
    await browser.close();
    return false;
  }
  log('✅ Logged in!');
  console.log('✅ Pinterest logged in!');

  let totalOk = 0, totalFail = 0;
  const publishedUrls = {};

  for (const article of ARTICLES) {
    log(`--- ${article.slug} ---`);
    console.log(`\n📌 ${article.slug}`);
    
    const jsonPath = path.join(DATA_DIR, `${article.slug}.json`);
    if (!fs.existsSync(jsonPath)) { log('JSON not found'); continue; }
    publishedUrls[article.slug] = [];

    for (let pinIdx = 0; pinIdx < article.pins.length; pinIdx++) {
      const pin = article.pins[pinIdx];
      const pinNum = pinIdx + 1;
      const imagePath = path.join(PINS_DIR, `${article.slug}-pin-${pinNum}.png`);
      if (!fs.existsSync(imagePath)) { log(`Image not found`); totalFail++; continue; }

      console.log(`   📤 Pin ${pinNum}: ${pin.title.substring(0, 40)}...`);
      let success = false, publishedUrl = null;

      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await sleep(5000);

          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.isVisible({ timeout: 15000 }).catch(() => false)) {
            await fileInput.setInputFiles(imagePath);
            log(`Uploaded`);
            await sleep(5000);
          } else { log('File input not visible'); continue; }

          await sleep(3000);

          // Fill fields
          try {
            const tf = page.locator('input[placeholder*="Tell everyone"], input[placeholder*="Add your title"]');
            if (await tf.isVisible({ timeout: 3000 }).catch(() => false)) await tf.fill(pin.title);
          } catch(e) {}
          try {
            const lf = page.locator('input[placeholder*="Add a link"], input[placeholder*="destination link"]');
            if (await lf.isVisible({ timeout: 3000 }).catch(() => false)) await lf.fill(article.post_url);
          } catch(e) {}
          try {
            await page.evaluate((desc) => {
              const ce = document.querySelector('[contenteditable="true"]');
              if (ce) ce.textContent = desc;
            }, pin.desc);
          } catch(e) {}

          await sleep(2000);

          // Click Save
          await page.evaluate(() => {
            const all = document.querySelectorAll('button, div[role="button"]');
            for (const el of all) {
              const txt = el.textContent?.trim() || '';
              if (['Publish', 'Save', 'Save Pin'].includes(txt) && el.offsetParent !== null) {
                el.click(); return true;
              }
            }
            return false;
          });

          // Wait a bit and check the URL
          for (let w = 0; w < 12; w++) {
            await sleep(2000);
            const url = page.url();
            const m = url.match(/pinterest\.com\/pin\/(\d+)/);
            if (m) {
              publishedUrl = `https://www.pinterest.com/pin/${m[1]}/`;
              success = true;
              break;
            }
            // Check for success toast
            const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '').catch(() => '');
            if (bodyText.includes('Created') || bodyText.includes('saved')) {
              log(`Success detected via body text`);
            }
          }

          if (!success) {
            await page.screenshot({ path: `/tmp/pin-fail4-${article.slug}-${pinNum}.png` });
          }
        } catch(e) { log(`Error: ${e.message}`); }
      }

      if (success && publishedUrl) {
        publishedUrls[article.slug].push({ pinNum, url: publishedUrl });
        totalOk++;
        console.log(`   ✅ ${publishedUrl}`);
      } else { totalFail++; console.log(`   ❌ Failed`); }
    }

    // Update JSON
    try {
      const existingJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      for (const p of publishedUrls[article.slug] || []) {
        const idx = p.pinNum - 1;
        if (idx < existingJson.length) { existingJson[idx].status = 'published'; existingJson[idx].published_pin_url = p.url; }
      }
      fs.writeFileSync(jsonPath, JSON.stringify(existingJson, null, 2) + '\n');
      console.log(`   💾 JSON updated`);
    } catch(e) { log(`JSON error: ${e.message}`); }
  }

  log(`DONE: ${totalOk} pub, ${totalFail} fail`);
  console.log(`\n✅ ${totalOk} pins published`);
  console.log(`❌ ${totalFail} pins failed`);
  for (const [slug, pins] of Object.entries(publishedUrls)) {
    if (pins.length) { console.log(`  ${slug}:`); for (const p of pins) console.log(`    Pin ${p.pinNum}: ${p.url}`); }
  }
  await browser.close();
  return totalFail === 0;
}

main().then(ok => { if (!ok) { process.exit(1); } }).catch(e => { console.error('FATAL:', e.message); process.exit(1); });

/**
 * fix-4-pins-cookies.mjs — Upload 4 FAIL article pins using Playwright with injected cookies
 * Reads cookies from /tmp/pinterest-cookies.json (extracted via browser-cookie3).
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-4-cookies.txt';
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
  log('START - Fix 4 FAIL (Playwright + injected cookies)');
  log('='.repeat(60));

  // Read cookies extracted by Python
  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync('/tmp/pinterest-cookies.json', 'utf-8'));
    log(`Loaded ${cookies.length} cookies`);
  } catch (e) {
    log(`Failed to read cookies: ${e.message}`);
    console.log('❌ No cookies file found at /tmp/pinterest-cookies.json');
    return false;
  }

  // Check for Pinterest session cookie
  const sessCookie = cookies.find(c => c.name === '_pinterest_sess');
  if (sessCookie) {
    log(`_pinterest_sess found: ${sessCookie.value.substring(0, 30)}...`);
  } else {
    log('WARNING: No _pinterest_sess cookie');
    console.log('⚠️  No _pinterest_sess cookie found. Login may fail.');
  }

  // Launch fresh browser (no profile)
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  // Inject Pinterest cookies
  await context.addCookies(cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    secure: c.secure === true || c.secure === 1 || c.secure === 'true',
    httpOnly: c.httpOnly === true || c.httpOnly === 'true',
    sameSite: 'Lax',
  })));
  log('Cookies injected into browser context');

  const page = await context.newPage();

  // Test login by visiting Pinterest
  log('Checking Pinterest login...');
  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(4000);

  const currentUrl = page.url();
  log(`Current URL: ${currentUrl}`);

  let loggedIn = false;
  if (currentUrl.includes('login')) {
    log('❌ Redirected to login page');
    console.log('❌ Pinterest login failed (redirected to login page)');
  } else {
    log('✅ Appears logged in');
    loggedIn = true;
  }

  if (!loggedIn) {
    log('Trying to navigate directly to pin creation tool anyway...');
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await sleep(3000);
    const url2 = page.url();
    log(`Pin tool URL: ${url2}`);
    if (url2.includes('login')) {
      console.log('❌ Definitely not logged in. Cannot fix pins automatically.');
      await browser.close();
      return false;
    }
    loggedIn = true;
    log('✅ Actually logged in!');
  }

  let totalOk = 0;
  let totalFail = 0;
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
      if (!fs.existsSync(imagePath)) { log(`Image not found: ${imagePath}`); totalFail++; continue; }

      console.log(`   📤 Pin ${pinNum}: ${pin.title.substring(0, 40)}...`);
      let success = false;
      let publishedUrl = null;

      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await sleep(5000);

          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.isVisible({ timeout: 15000 }).catch(() => false)) {
            await fileInput.setInputFiles(imagePath);
            log(`Uploaded pin ${pinNum}`);
            await sleep(5000);
          } else {
            await page.screenshot({ path: `/tmp/pin-fail3-${article.slug}-${pinNum}.png` });
            log('File input not visible');
            continue;
          }

          await sleep(3000);

          // Fill title
          try {
            const tf = page.locator('input[placeholder*="Tell everyone"], input[placeholder*="Add your title"]');
            if (await tf.isVisible({ timeout: 3000 }).catch(() => false)) await tf.fill(pin.title);
          } catch(e) { log(`Title fill error: ${e.message}`); }

          // Fill link
          try {
            const lf = page.locator('input[placeholder*="Add a link"], input[placeholder*="destination link"]');
            if (await lf.isVisible({ timeout: 3000 }).catch(() => false)) await lf.fill(article.post_url);
          } catch(e) { log(`Link fill error: ${e.message}`); }

          // Fill description
          try {
            await page.evaluate((desc) => {
              const ce = document.querySelector('[contenteditable="true"]');
              if (ce) ce.textContent = desc + ' — Full guide at MomBabyPicks.com';
            }, pin.desc);
          } catch(e) { log(`Desc fill error: ${e.message}`); }

          await sleep(2000);

          // Click Publish
          try {
            await page.evaluate(() => {
              const btns = document.querySelectorAll('button, div[role="button"]');
              for (const el of btns) {
                const txt = el.textContent?.trim() || '';
                if (['Publish', 'Save', 'Save Pin'].includes(txt) && el.offsetParent !== null) { el.click(); return true; }
              }
              const btn = document.querySelector('[data-test-id="save-pin-button"], [data-test-id="board-save-button"]');
              if (btn) { btn.click(); return true; }
              return false;
            });
          } catch(e) { log(`Publish click error: ${e.message}`); }

          await sleep(10000);

          const afterUrl = page.url();
          log(`After publish: ${afterUrl}`);

          const pinMatch = afterUrl.match(/pinterest\.com\/pin\/(\d+)/);
          if (pinMatch) {
            publishedUrl = `https://www.pinterest.com/pin/${pinMatch[1]}/`;
            success = true;
          } else {
            // Try to check page content
            await page.screenshot({ path: `/tmp/pin-fail3-${article.slug}-${pinNum}-b.png` });
          }
        } catch(e) { log(`Error pin ${pinNum}: ${e.message}`); }
        if (!success) await sleep(3000);
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
      console.log(`   💾 JSON updated: ${article.slug}.json`);
    } catch(e) { log(`JSON update error: ${e.message}`); }
  }

  log(`DONE: ${totalOk} published, ${totalFail} failed`);
  console.log(`\n✅ ${totalOk} pins published successfully`);
  if (totalFail > 0) console.log(`❌ ${totalFail} pins failed`);
  for (const [slug, pins] of Object.entries(publishedUrls)) {
    if (pins.length > 0) {
      console.log(`  ${slug}:`);
      for (const p of pins) console.log(`    Pin ${p.pinNum}: ${p.url}`);
    }
  }

  await browser.close();
  return totalFail === 0;
}

main().then(ok => {
  if (!ok) { console.log('\n⚠️  Some pins failed. Check logs at ' + LOG_FILE); process.exit(1); }
}).catch(e => {
  log('FATAL: ' + e.message);
  console.error('FATAL:', e.message);
  process.exit(1);
});

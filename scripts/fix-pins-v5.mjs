#!/usr/bin/env node
// Fix 4 FAIL pins - v5: Get pin URL from profile page after publishing
// Strategy: track highest pin ID before/after publishing
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-v5.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11, 19) + ' ' + m + '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ARTICLES = [
  { slug: 'best-baby-bath-tubs-2026', post_url: 'https://mombabypicks.com/posts/best-baby-bath-tubs-2026/' },
  { slug: 'best-baby-play-mats-2026', post_url: 'https://mombabypicks.com/posts/best-baby-play-mats-2026/' },
  { slug: 'best-baby-swings-2026', post_url: 'https://mombabypicks.com/posts/best-baby-swings-2026/' },
  { slug: 'best-infant-car-seats-2026', post_url: 'https://mombabypicks.com/posts/best-infant-car-seats-2026/' },
];

const PROFILE_URL = 'https://www.pinterest.com/mombabypicks/_created/';

let browser;

async function getLatestPinId(page) {
  await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(4000);
  const pinIds = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/pin/"]');
    const ids = new Set();
    for (const a of links) {
      const href = a.getAttribute('href');
      if (href) {
        const match = href.match(/\/pin\/(\d+)/);
        if (match) ids.add(match[1]);
      }
    }
    return Array.from(ids).sort().reverse().slice(0, 3);
  });
  log(`Latest pin IDs on profile: ${JSON.stringify(pinIds)}`);
  return pinIds[0] || null;
}

log('='.repeat(60));
log('START fix-4-pins v5');

const cookies = JSON.parse(fs.readFileSync('/tmp/pinterest-cookies.json', 'utf-8'));
log(`Loaded ${cookies.length} cookies`);

browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});
await context.addCookies(cookies.map(c => ({
  name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
  secure: c.secure === true || c.secure === 1 || c.secure === 'true',
  httpOnly: c.httpOnly === true || c.httpOnly === 'true', sameSite: 'Lax',
})));
log('Cookies injected');

const page = await context.newPage();

// Verify login
await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(3000);
if (page.url().includes('login')) {
  log('❌ Login failed');
  console.log('❌ Pinterest login failed');
  await browser.close();
  process.exit(1);
}
log('✅ Logged in');

let totalOk = 0;
let totalFail = 0;
const results = {};

for (const article of ARTICLES) {
  const { slug, post_url } = article;
  log(`--- ${slug} ---`);
  console.log(`\n📌 ${slug}`);

  const jsonPath = path.join(DATA_DIR, `${slug}.json`);
  const pins = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  results[slug] = [];

  for (let pinIdx = 0; pinIdx < pins.length; pinIdx++) {
    const pin = pins[pinIdx];
    const pinNum = pinIdx + 1;
    const imgPath = path.join(PINS_DIR, `${slug}-pin-${pinNum}.png`);

    if (!fs.existsSync(imgPath)) {
      console.log(`  ❌ Pin ${pinNum}: image not found`);
      totalFail++;
      continue;
    }

    console.log(`  📤 Pin ${pinNum}: ${pin.title.substring(0, 50)}...`);

    // Step 1: Get latest pin ID BEFORE publishing
    const beforePinId = await getLatestPinId(page);
    log(`Before publish, latest pin ID: ${beforePinId}`);

    // Step 2: Create and publish pin
    let published = false;
    let publishedUrl = null;

    for (let attempt = 0; attempt < 2 && !published; attempt++) {
      try {
        log(`Attempt ${attempt + 1}`);
        await page.goto('https://www.pinterest.com/pin-creation-tool/', {
          waitUntil: 'domcontentloaded', timeout: 30000
        }).catch(() => {});
        await sleep(5000);

        // Upload
        const fileInput = page.locator('[data-test-id="storyboard-upload-input"]');
        if (await fileInput.isVisible({ timeout: 10000 }).catch(() => false)) {
          await fileInput.setInputFiles(imgPath);
          log('✅ Image uploaded');
          await sleep(8000);
        } else { continue; }

        // Title
        try {
          const ti = page.locator('input[placeholder*="Tell everyone"]');
          if (await ti.isVisible({ timeout: 5000 }).catch(() => false)) {
            await ti.fill('');
            await ti.fill(pin.title);
          }
        } catch (e) {}

        // Link
        try {
          const li = page.locator('input[placeholder*="Add a link"]');
          if (await li.isVisible({ timeout: 3000 }).catch(() => false)) {
            await li.fill(post_url);
          }
        } catch (e) {}

        // Description
        try {
          await page.evaluate((desc) => {
            const eds = document.querySelectorAll('[contenteditable="true"]');
            for (const el of eds) {
              if (!(el.textContent || '').trim() || (el.textContent || '').includes('Tell everyone')) {
                el.textContent = desc;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                return;
              }
            }
            if (eds.length > 0) {
              eds[0].textContent = desc;
              eds[0].dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, pin.description);
        } catch (e) {}

        await sleep(2000);

        // Click Publish
        const clicked = await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.offsetParent && b.textContent?.trim() === 'Publish') {
              b.click();
              return true;
            }
          }
          return false;
        });
        log(`Publish clicked: ${clicked}`);
        await sleep(5000);

        // Step 3: Get latest pin ID AFTER publishing
        const afterPinId = await getLatestPinId(page);
        log(`After publish, latest pin ID: ${afterPinId}`);

        if (afterPinId && afterPinId !== beforePinId) {
          publishedUrl = `https://www.pinterest.com/pin/${afterPinId}/`;
          published = true;
          log(`✅ New pin detected: ${publishedUrl}`);
        } else if (afterPinId) {
          // Same ID - maybe not published yet, wait and retry
          log('⚠️ Same pin ID. Waiting longer...');
          await sleep(5000);
          const retryId = await getLatestPinId(page);
          if (retryId !== beforePinId) {
            publishedUrl = `https://www.pinterest.com/pin/${retryId}/`;
            published = true;
            log(`✅ New pin detected on retry: ${publishedUrl}`);
          } else {
            log('❌ Pin ID unchanged after publish');
          }
        }
      } catch (e) {
        log(`Error: ${e.message}`);
      }
    }

    if (published && publishedUrl) {
      results[slug].push({ index: pinIdx, url: publishedUrl });
      totalOk++;
      console.log(`  ✅ ${publishedUrl}`);
    } else {
      totalFail++;
      console.log(`  ❌ Failed`);
    }
  }

  // Update JSON
  if (results[slug].length > 0) {
    try {
      const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      for (const p of results[slug]) {
        if (p.index < currentData.length) {
          currentData[p.index].status = 'published';
          currentData[p.index].published_pin_url = p.url;
        }
      }
      fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2) + '\n');
      console.log(`  💾 Updated ${slug}.json`);
    } catch (e) {
      log(`JSON update error: ${e.message}`);
    }
  }
}

log(`DONE: ${totalOk} published, ${totalFail} failed`);
console.log(`\n📊 Results: ${totalOk} published ✅ / ${totalFail} failed ❌`);
for (const [slug, pins] of Object.entries(results)) {
  if (pins.length > 0) {
    console.log(`  ${slug}:`);
    for (const p of pins) console.log(`    Pin ${p.index + 1}: ${p.url}`);
  }
}

await browser.close();

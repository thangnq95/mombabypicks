#!/usr/bin/env node
// Fix 4 FAIL pins - v4: After clicking Publish, navigate to profile to get pin URL
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-v4.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11, 19) + ' ' + m + '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ARTICLES = [
  { slug: 'best-baby-bath-tubs-2026', post_url: 'https://mombabypicks.com/posts/best-baby-bath-tubs-2026/' },
  { slug: 'best-baby-play-mats-2026', post_url: 'https://mombabypicks.com/posts/best-baby-play-mats-2026/' },
  { slug: 'best-baby-swings-2026', post_url: 'https://mombabypicks.com/posts/best-baby-swings-2026/' },
  { slug: 'best-infant-car-seats-2026', post_url: 'https://mombabypicks.com/posts/best-infant-car-seats-2026/' },
];

log('='.repeat(60));
log('START fix-4-pins v4');

const cookies = JSON.parse(fs.readFileSync('/tmp/pinterest-cookies.json', 'utf-8'));
log(`Loaded ${cookies.length} cookies`);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
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

async function getLatestPinUrl() {
  // Navigate to profile pins page and get most recent pin URL
  await page.goto('https://www.pinterest.com/mombabypicks/_created/', {
    waitUntil: 'domcontentloaded', timeout: 30000
  }).catch(() => {});
  await sleep(4000);
  
  const pinUrl = await page.evaluate(() => {
    // Look for pin links - the first/newest pin appears first
    const links = document.querySelectorAll('a[href*="/pin/"]');
    for (const a of links) {
      const href = a.getAttribute('href');
      if (href && href.startsWith('/pin/') && !href.includes('pin-creation')) {
        return 'https://www.pinterest.com' + href;
      }
      if (href && href.includes('/pin/') && !href.includes('pin-creation')) {
        return href;
      }
    }
    // Try harder - look for pin cards specifically
    const cards = document.querySelectorAll('[data-test-id*="pin"], [data-test-id*="Pin"]');
    for (const c of cards) {
      const a = c.querySelector('a');
      if (a) {
        const href = a.getAttribute('href');
        if (href && href.includes('/pin/') && !href.includes('pin-creation')) {
          return href.startsWith('http') ? href : 'https://www.pinterest.com' + href;
        }
      }
    }
    return null;
  });
  return pinUrl;
}

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
      log(`Image ${pinNum} not found`);
      console.log(`  ❌ Pin ${pinNum}: image not found`);
      totalFail++;
      continue;
    }

    console.log(`  📤 Pin ${pinNum}: ${pin.title.substring(0, 50)}...`);
    let published = false;
    let publishedUrl = null;

    for (let attempt = 0; attempt < 2 && !published; attempt++) {
      try {
        log(`Attempt ${attempt + 1} for pin ${pinNum}`);
        await page.goto('https://www.pinterest.com/pin-creation-tool/', {
          waitUntil: 'domcontentloaded', timeout: 30000
        }).catch(() => {});
        await sleep(5000);

        // Upload file
        const fileInput = page.locator('[data-test-id="storyboard-upload-input"]');
        if (await fileInput.isVisible({ timeout: 10000 }).catch(() => false)) {
          await fileInput.setInputFiles(imgPath);
          log('✅ Image uploaded');
          await sleep(8000);
        } else {
          log('❌ File input not visible');
          continue;
        }

        // Fill title
        try {
          const titleInput = page.locator('input[placeholder*="Tell everyone"]');
          if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await titleInput.fill('');
            await titleInput.fill(pin.title);
          }
        } catch (e) { log(`Title error: ${e.message}`); }

        // Fill link
        try {
          const linkInput = page.locator('input[placeholder*="Add a link"]');
          if (await linkInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await linkInput.fill(post_url);
          }
        } catch (e) { log(`Link error: ${e.message}`); }

        // Fill description
        try {
          await page.evaluate((desc) => {
            const editors = document.querySelectorAll('[contenteditable="true"]');
            for (const el of editors) {
              const t = (el.textContent || '').trim();
              if (!t || t.includes('Tell everyone')) {
                el.textContent = desc;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                return;
              }
            }
            if (editors.length > 0) {
              editors[0].textContent = desc;
              editors[0].dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, pin.description);
        } catch (e) { log(`Desc error: ${e.message}`); }

        await sleep(2000);

        // Click Publish
        const clickResult = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.offsetParent === null) continue;
            const text = (btn.textContent || '').trim();
            if (text === 'Publish' || text === 'Save') {
              btn.click();
              return text;
            }
          }
          return 'not-found';
        });
        log(`Publish click: ${clickResult}`);
        
        if (clickResult === 'not-found') {
          log('❌ Publish button not found');
          continue;
        }

        await sleep(3000);

        // Navigate to profile to get the latest pin URL
        publishedUrl = await getLatestPinUrl();
        if (publishedUrl && publishedUrl.includes('/pin/')) {
          published = true;
          log(`✅ Got pin URL: ${publishedUrl}`);
        } else {
          log('❌ Could not get pin URL from profile');
          await page.screenshot({ path: `/tmp/pin-v4-${slug}-${pinNum}.png` });
        }
      } catch (e) {
        log(`Error: ${e.message}`);
      }
      if (!published) await sleep(3000);
    }

    if (published && publishedUrl) {
      results[slug].push({ index: pinIdx, url: publishedUrl });
      totalOk++;
      console.log(`  ✅ ${publishedUrl}`);
    } else {
      totalFail++;
      console.log(`  ❌ Failed after 2 attempts`);
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

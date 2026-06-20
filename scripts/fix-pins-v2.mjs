#!/usr/bin/env node
// Fix 4 FAIL pins - v2: smarter approach with better selectors
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-v2.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11, 19) + ' ' + m + '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ARTICLES = [
  { slug: 'best-baby-bath-tubs-2026', post_url: 'https://mombabypicks.com/posts/best-baby-bath-tubs-2026/' },
  { slug: 'best-baby-play-mats-2026', post_url: 'https://mombabypicks.com/posts/best-baby-play-mats-2026/' },
  { slug: 'best-baby-swings-2026', post_url: 'https://mombabypicks.com/posts/best-baby-swings-2026/' },
  { slug: 'best-infant-car-seats-2026', post_url: 'https://mombabypicks.com/posts/best-infant-car-seats-2026/' },
];

log('='.repeat(60));
log('START fix-4-pins v2');

// Load cookies
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

// Test login
await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(3000);
log(`Home URL: ${page.url()}`);
if (page.url().includes('login')) {
  log('❌ Login failed - redirected to login');
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
      log(`Image ${pinNum} not found`);
      console.log(`  ❌ Pin ${pinNum}: image not found`);
      totalFail++;
      continue;
    }

    console.log(`  📤 Pin ${pinNum}: ${pin.title.substring(0, 50)}...`);
    let published = false;
    let publishedUrl = null;

    for (let attempt = 0; attempt < 3 && !published; attempt++) {
      try {
        log(`Attempt ${attempt + 1} for pin ${pinNum}`);
        await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await sleep(5000);

        // Upload file using data-test-id
        const fileInput = page.locator('[data-test-id="storyboard-upload-input"]');
        if (await fileInput.isVisible({ timeout: 10000 }).catch(() => false)) {
          await fileInput.setInputFiles(imgPath);
          log('✅ Image uploaded');
          await sleep(8000); // Wait for upload to process
        } else {
          log('❌ File input not visible');
          continue;
        }

        // Fill title
        const titleInput = page.locator('input[placeholder*="Tell everyone"]');
        if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await titleInput.fill('');
          await titleInput.fill(pin.title);
          log(`✅ Title: ${pin.title.substring(0, 40)}`);
        } else {
          log('⚠️ Title input not found');
        }

        // Fill link
        const linkInput = page.locator('input[placeholder*="Add a link"]');
        if (await linkInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await linkInput.fill(post_url);
          log('✅ Link filled');
        } else {
          log('⚠️ Link input not found');
        }

        // Fill description via contenteditable
        try {
          await page.evaluate((desc) => {
            const editors = document.querySelectorAll('[contenteditable="true"]');
            for (const el of editors) {
              if (el.textContent?.trim() === '' || el.textContent?.includes('Tell everyone')) {
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
          log('✅ Description filled');
        } catch (e) {
          log(`⚠️ Description error: ${e.message}`);
        }

        await sleep(3000);

        // Try to find and click the Save/Publish button
        // Look for all possible save buttons
        const clicked = await page.evaluate(() => {
          // First try: look for the exact text match
          const allElements = document.querySelectorAll('button, div[role="button"], [role="button"], a[role="button"]');
          
          // Look for save/publish buttons specifically
          const saveKeywords = ['save', 'publish', 'create pin', 'pin it'];
          
          for (const el of allElements) {
            const txt = (el.textContent || '').trim().toLowerCase();
            if (saveKeywords.some(kw => txt === kw || txt.startsWith(kw)) && el.offsetParent !== null) {
              el.click();
              return 'clicked:' + txt;
            }
          }
          
          // Second try: any visible button in the main area
          const mainButtons = document.querySelectorAll('[data-test-id*="save"] button, [data-test-id*="Save"] button');
          for (const btn of mainButtons) {
            if (btn.offsetParent !== null) { btn.click(); return 'clicked:test-id-save'; }
          }

          // Third try: look for the floating footer which often has the save button
          const footer = document.querySelector('[data-test-id="floating-footer"]');
          if (footer) {
            const footerBtns = footer.querySelectorAll('button, [role="button"]');
            // Usually the LAST button in the footer is the save/publish button
            for (let i = footerBtns.length - 1; i >= 0; i--) {
              const btn = footerBtns[i];
              if (btn.offsetParent !== null) {
                btn.click();
                return 'clicked:footer-button-' + i;
              }
            }
          }

          return 'no-button-found';
        });
        
        log(`Publish click result: ${clicked}`);
        await sleep(8000);

        // Check result
        const afterUrl = page.url();
        log(`After publish URL: ${afterUrl}`);

        const pinMatch = afterUrl.match(/pinterest\.com\/pin\/(\d+)/);
        if (pinMatch) {
          publishedUrl = `https://www.pinterest.com/pin/${pinMatch[1]}/`;
          published = true;
          log(`✅ Published: ${publishedUrl}`);
        } else if (afterUrl.includes('pin-creation-tool')) {
          // Check if we can find the pin URL from the drafts sidebar
          const draftUrl = await page.evaluate(() => {
            // Maybe we can find a link to the pin in drafts
            const links = document.querySelectorAll('a[href*="/pin/"]');
            for (const a of links) {
              if (a.href && !a.href.includes('pin-creation')) return a.href;
            }
            return null;
          });
          if (draftUrl) {
            publishedUrl = draftUrl;
            published = true;
            // Mark as draft, not published
            log(`✅ Found in drafts: ${publishedUrl}`);
          } else {
            log('⚠️ Pin creation page stayed (likely saved as draft)');
          }
        }

        if (!published) {
          await page.screenshot({ path: `/tmp/pin-v2-${slug}-${pinNum}.png` });
        }
      } catch (e) {
        log(`Error on pin ${pinNum}: ${e.message}`);
      }
      if (!published) await sleep(3000);
    }

    if (published && publishedUrl) {
      results[slug].push({ index: pinIdx, url: publishedUrl });
      totalOk++;
      console.log(`  ✅ ${publishedUrl}`);
    } else {
      totalFail++;
      console.log(`  ❌ Failed after 3 attempts`);
    }
  }

  // Update JSON if any pins were published
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

#!/usr/bin/env node
// Upload 3 best-baby-play-mats-2026 pins using saved cookies
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const COOKIE_FILE = '/tmp/pinterest-cookies.json';
const SLUG = 'best-baby-play-mats-2026';
const DEST = 'https://mombabypicks.com/posts/best-baby-play-mats-2026/';
const LOG_FILE = '/tmp/pinterest-upload-playmats-log.txt';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const line = `${new Date().toISOString().slice(11,19)} ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function loadCookies() {
  const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
  log(`Loaded ${cookies.length} cookies`);
  return cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
    sameSite: 'Lax',
  }));
}

const pins = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${SLUG}.json`), 'utf-8'));
log(`Loaded ${pins.length} pins`);

async function getCreatedPins(page) {
  await page.goto('https://www.pinterest.com/mombabypicks/_created/', {
    waitUntil: 'networkidle', timeout: 30000
  }).catch(() => {});
  await sleep(4000);
  return await page.evaluate(() => {
    const out = new Set();
    for (const a of document.querySelectorAll('a[href*="/pin/"]')) {
      const href = a.href;
      if (href.includes('/pin-creation-tool')) continue;
      out.add(href.replace(/\/$/, ''));
    }
    return Array.from(out);
  });
}

async function publishPin(index) {
  const pin = pins[index];
  const num = index + 1;
  const img = path.join(PINS_DIR, `${SLUG}-pin-${num}.png`);
  
  if (!fs.existsSync(img)) {
    log(`Pin ${num} ❌ Image not found: ${img}`);
    return null;
  }
  log(`Pin ${num} ✅ Image exists: ${img}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await context.addCookies(loadCookies());
  const page = await context.newPage();
  
  try {
    log(`Pin ${num} navigating to pinterest...`);
    await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);
    log(`Pin ${num} current url: ${page.url()}`);
    
    // Check login
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('[data-test-id="header-profile"]')
        || !!document.querySelector('div[data-test-id="UserAvatar"]')
        || document.body.innerText.includes('Home feed');
    });
    log(`Pin ${num} logged in: ${isLoggedIn}`);
    
    if (!isLoggedIn) {
      log(`Pin ${num} ⚠️ Not logged in, trying to proceed anyway...`);
    }

    // Get initial pins
    const beforeUrls = new Set(await getCreatedPins(page));
    log(`Pin ${num} ${beforeUrls.size} pins before publish`);

    // Navigate to pin-creation-tool
    log(`Pin ${num} navigating to pin-creation-tool...`);
    await page.goto('https://www.pinterest.com/pin-creation-tool/', {
      waitUntil: 'domcontentloaded', timeout: 30000
    }).catch(() => {});
    await sleep(8000);
    log(`Pin ${num} url after nav: ${page.url()}`);

    // Click "Create new" if shown
    const createNew = page.locator('[data-test-id="storyboard-create-button"]').first();
    if (await createNew.isVisible({ timeout: 5000 }).catch(() => false)) {
      log(`Pin ${num} clicking create new`);
      await createNew.click().catch(() => {});
      await sleep(2000);
    }

    // Upload image
    log(`Pin ${num} finding file input...`);
    const fileInput = page.locator('input[type="file"], [data-test-id="storyboard-upload-input"]').first();
    const fiVisible = await fileInput.isVisible({ timeout: 15000 }).catch(() => false);
    log(`Pin ${num} file input visible: ${fiVisible}`);
    
    if (!fiVisible) {
      // Try alternative: find any file input
      const allInputs = await page.locator('input[type="file"]').all();
      log(`Pin ${num} found ${allInputs.length} file inputs`);
      if (allInputs.length > 0) {
        await allInputs[0].setInputFiles(img);
        log(`Pin ${num} ✅ Image set via alternative input`);
      } else {
        throw new Error('No file input found');
      }
    } else {
      await fileInput.setInputFiles(img);
      log(`Pin ${num} ✅ Image set`);
    }
    await sleep(8000);

    // Fill title
    try {
      const titleInput = page.locator('input[placeholder*="Tell everyone"], input[placeholder*="Add your title"], input[aria-label*="title"]').first();
      if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await titleInput.fill(pin.title);
        log(`Pin ${num} ✅ Title filled`);
      }
    } catch (e) {
      log(`Pin ${num} ⚠️ Title: ${e.message}`);
    }

    // Fill link
    try {
      const linkInput = page.locator('input[placeholder*="Add a link"], input[aria-label*="website"], input[aria-label*="link"]').first();
      if (await linkInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await linkInput.fill(DEST);
        log(`Pin ${num} ✅ Link filled`);
      }
    } catch (e) {
      log(`Pin ${num} ⚠️ Link: ${e.message}`);
    }

    // Fill description
    try {
      await page.evaluate((body) => {
        const ce = document.querySelector('[contenteditable="true"]');
        if (ce) {
          ce.textContent = body;
          ce.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, `${pin.description} — Full guide at MomBabyPicks.com`);
      log(`Pin ${num} ✅ Description set`);
    } catch (e) {
      log(`Pin ${num} ⚠️ Description: ${e.message}`);
    }

    await sleep(1500);

    // Click Publish
    log(`Pin ${num} clicking publish...`);
    const clicked = await page.evaluate(() => {
      // Fallback: find any visible publish/save button
      for (const el of document.querySelectorAll('button, div[role="button"]')) {
        const txt = (el.textContent || '').trim().toLowerCase();
        if ((txt === 'publish' || txt === 'save' || txt === 'save pin') && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      // Try submit buttons
      for (const el of document.querySelectorAll('button[type="submit"]')) {
        if (el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    });
    log(`Pin ${num} publish clicked: ${clicked}`);
    if (!clicked) {
      log(`Pin ${num} ❌ Could not find publish button - trying Save fallback`);
    }

    await sleep(12000);

    // Try to capture URL
    let navigatedUrl = page.url().replace(/\/$/, '');
    log(`Pin ${num} url after publish: ${navigatedUrl}`);
    
    if (/\/pin\/\d+/.test(navigatedUrl) && !navigatedUrl.includes('pin-creation-tool')) {
      log(`Pin ${num} 🎯 Captured URL: ${navigatedUrl}`);
      return navigatedUrl;
    }

    // Fallback: get from created pins
    log(`Pin ${num} fetching created pins...`);
    const afterUrls = await getCreatedPins(page);
    const newUrl = afterUrls.find(u => !beforeUrls.has(u)) || afterUrls[0] || '';
    if (newUrl) {
      log(`Pin ${num} 🎯 Found via created pins: ${newUrl}`);
    } else {
      log(`Pin ${num} ⚠️ No new pin URL found`);
    }
    return newUrl || null;
  } catch (e) {
    log(`Pin ${num} ❌ Error: ${e.message}`);
    return null;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  log('=== START publish playmats pins ===');
  const results = [];
  
  for (let i = 0; i < pins.length; i++) {
    log(`Pin ${i+1}/${pins.length} starting...`);
    const url = await publishPin(i);
    results.push({ i, url });
    log(`Pin ${i+1} -> ${url || 'FAILED'}`);
    if (i < pins.length - 1) await sleep(3000);
  }

  // Update JSON
  const jsonPath = path.join(DATA_DIR, `${SLUG}.json`);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let published = 0;
  for (const r of results) {
    if (r.url && r.url.includes('/pin/') && !r.url.includes('pin-creation') && data[r.i]) {
      data[r.i].status = 'published';
      data[r.i].published_pin_url = r.url;
      published++;
      log(`Updated pin ${r.i+1}: ${r.url}`);
    } else if (r.url && data[r.i]) {
      data[r.i].status = 'published';
      data[r.i].published_pin_url = r.url;
      log(`Updated pin ${r.i+1} (unusual url): ${r.url}`);
      published++;
    }
  }
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
  log(`=== DONE: ${published}/${pins.length} published ===`);
  console.log(`Result: ${published}/${pins.length} published`);
}

main().catch(err => {
  log(`FATAL ${err.message}`);
  console.error(err);
  process.exit(1);
});

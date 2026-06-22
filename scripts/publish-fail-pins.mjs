#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const COOKIE_FILE = '/tmp/pinterest-cookies.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOG_FILE = '/tmp/pinterest-publish-fail-pins.txt';
const PROFILE_URL = 'https://www.pinterest.com/mombabypicks/_created/';
const TARGET = {
  slug: 'best-bottle-warmers',
  postUrl: 'https://mombabypicks.com/posts/best-bottle-warmers/',
  pins: [
    {
      title: '5 Best Bottle Warmers for Newborns (Fast & Safe)',
      desc: 'The best bottle warmers for newborns in 2026. We compare speed, safety, and compatibility to help you find the right one for your baby.',
    },
    {
      title: 'Top Bottle Warmers 2026: Fast, Safe Picks for Newborns',
      desc: 'The best bottle warmers for newborns in 2026. We compare speed, safety, and compatibility to help you find the right one for your baby.',
    },
    {
      title: 'Which Bottle Warmer Is Best? 2026 Shortlist',
      desc: 'The best bottle warmers for newborns in 2026. We compare speed, safety, and compatibility to help you find the right one for your baby.',
    },
  ],
};

function log(msg) {
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString().slice(11,19)} ${msg}\n`);
}

function loadCookies() {
  const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
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

async function launch() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await context.addCookies(loadCookies());
  return { browser, context };
}

async function getCreatedPins(page) {
  await page.goto(PROFILE_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
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

async function publishPin(index, title, desc) {
  const img = path.join(PINS_DIR, `${TARGET.slug}-pin-${index + 1}.png`);
  if (!fs.existsSync(img)) throw new Error(`missing image ${img}`);

  const { browser, context } = await launch();
  const page = await context.newPage();
  try {
    log(`pin ${index + 1} begin publish`);
    await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);
    log(`pin ${index + 1} login url=${page.url()}`);
    const beforeUrls = new Set(await getCreatedPins(page));

    log(`pin ${index + 1} goto create tool`);
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await sleep(8000);
    log(`pin ${index + 1} after create tool url=${page.url()}`);

    const createNew = page.locator('[data-test-id="storyboard-create-button"]').first();
    if (await createNew.isVisible({ timeout: 5000 }).catch(() => false)) {
      log(`pin ${index + 1} click create new`);
      await createNew.click().catch(() => {});
      await sleep(2000);
    }

    const fileInput = page.locator('input[type="file"], [data-test-id="storyboard-upload-input"]').first();
    log(`pin ${index + 1} setInputFiles start`);
    await fileInput.setInputFiles(img);
    log(`pin ${index + 1} setInputFiles done`);
    await sleep(8000);

    const titleInput = page.locator('input[placeholder*="Tell everyone"], input[placeholder*="Add your title"], input[aria-label*="title"]').first();
    log(`pin ${index + 1} fill title`);
    await titleInput.fill(title);

    const linkInput = page.locator('input[placeholder*="Add a link"], input[aria-label*="website"], input[aria-label*="link"]').first();
    log(`pin ${index + 1} fill link`);
    await linkInput.fill(TARGET.postUrl);

    await page.evaluate((body) => {
      const ce = document.querySelector('[contenteditable="true"]');
      if (ce) ce.textContent = body;
    }, `${desc} — Full guide at MomBabyPicks.com`);
    log(`pin ${index + 1} description set`);

    await sleep(1500);

    log(`pin ${index + 1} click publish`);
    const clicked = await page.evaluate(() => {
      for (const el of document.querySelectorAll('button, div[role="button"]')) {
        const txt = (el.textContent || '').trim();
        if ((txt === 'Publish' || txt === 'Save' || txt === 'Save Pin') && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('publish button not found');

    await sleep(12000);
    const navigatedUrl = page.url().replace(/\/$/, '');
    if (/\/pin\/\d+/.test(navigatedUrl) && !navigatedUrl.includes('pin-creation-tool')) {
      log(`pin ${index + 1} navigated url=${navigatedUrl}`);
      return navigatedUrl;
    }

    log(`pin ${index + 1} fetch created pins`);
    const afterUrls = await getCreatedPins(page);
    const newUrl = afterUrls.find(u => !beforeUrls.has(u)) || afterUrls[0] || '';
    if (!newUrl) throw new Error('no pin url found after publish');
    log(`pin ${index + 1} new url=${newUrl}`);
    return newUrl;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function main() {
  if (!fs.existsSync(COOKIE_FILE)) throw new Error(`missing cookie file: ${COOKIE_FILE}`);
  log(`START publish-fail-pins ${TARGET.slug}`);

  const results = [];
  for (let i = 0; i < TARGET.pins.length; i++) {
    log(`${TARGET.slug} pin ${i + 1} start`);
    try {
      const url = await publishPin(i, TARGET.pins[i].title, TARGET.pins[i].desc);
      results.push({ i, url });
      log(`${TARGET.slug} pin ${i + 1} url=${url}`);
    } catch (e) {
      results.push({ i, error: e.message });
      log(`${TARGET.slug} pin ${i + 1} error=${e.message}`);
    }
    await sleep(2500);
  }

  const jsonPath = path.join(DATA_DIR, `${TARGET.slug}.json`);
  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    for (const r of results) {
      if (r.url && data[r.i]) {
        data[r.i].status = 'published';
        data[r.i].published_pin_url = r.url;
      }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
    log(`${TARGET.slug} json updated`);
  }

  console.log('Done. Log:', LOG_FILE);
}

main().catch(err => {
  log(`FATAL ${err.message}`);
  console.error(err);
  process.exit(1);
});

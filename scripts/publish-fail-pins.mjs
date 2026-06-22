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
const PROFILE_URL = 'https://www.pinterest.com/mombabypicks/_created/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const logFile = '/tmp/pinterest-publish-fail-pins.txt';
const log = msg => fs.appendFileSync(logFile, `${new Date().toISOString().slice(11,19)} ${msg}\n`);

const ARTICLES = [
  {
    slug: 'best-baby-bath-tubs-2026',
    postUrl: 'https://mombabypicks.com/posts/best-baby-bath-tubs-2026/',
    pins: [
      'Best Baby Bath Tubs 2026: Safe & Easy Options for Newborns to Toddlers',
      'Top Baby Bath Tubs 2026: Newborn to Toddler Picks',
      'Best Baby Bath Tubs for Safe & Easy Bath Time',
    ],
  },
  {
    slug: 'best-baby-play-mats-2026',
    postUrl: 'https://mombabypicks.com/posts/best-baby-play-mats-2026/',
    pins: [
      'Best Baby Play Mats 2026: Safe & Soft Options for Tummy Time & Play',
      'Top Baby Play Mats 2026: The Complete Guide',
      'Best Play Mats for Tummy Time & Crawling 2026',
    ],
  },
  {
    slug: 'best-baby-swings-2026',
    postUrl: 'https://mombabypicks.com/posts/best-baby-swings-2026/',
    pins: [
      'Best Baby Swings 2026: Soothe Your Baby with the Right Swing',
      'Top Baby Swings 2026: Our Picks for Every Budget',
      "Which Baby Swing Is Best? 2026's Top 5 Reviewed",
    ],
  },
  {
    slug: 'best-infant-car-seats-2026',
    postUrl: 'https://mombabypicks.com/posts/best-infant-car-seats-2026/',
    pins: [
      'Best Infant Car Seats 2026: Safety Ratings, Installation & Budget Picks',
      'Top Infant Car Seats 2026: Safety & Value Compared',
      'Which Infant Car Seat is Safest? 2026 Guide',
    ],
  },
];

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

async function waitForEnabled(page, selector, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = page.locator(selector).first();
    const ok = await el.isVisible({ timeout: 2000 }).catch(() => false)
      && await el.isEnabled({ timeout: 2000 }).catch(() => false);
    if (ok) return el;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for enabled ${selector}`);
}

async function getCreatedPinUrls(page) {
  await page.goto(PROFILE_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(5000);
  return await page.evaluate(() => {
    const out = new Set();
    for (const a of document.querySelectorAll('a[href*="/pin/"]')) {
      const href = a.getAttribute('href');
      if (!href || href.includes('pin-creation')) continue;
      out.add(href.startsWith('http') ? href : `https://www.pinterest.com${href}`);
    }
    return Array.from(out);
  });
}

async function publishOne(page, slug, title, idx, beforeUrls) {
  const img = path.join(PINS_DIR, `${slug}-pin-${idx + 1}.png`);
  if (!fs.existsSync(img)) throw new Error(`missing image ${img}`);

  await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(8000);

  const createNew = page.locator('[data-test-id="storyboard-create-button"]').first();
  if (await createNew.isVisible({ timeout: 8000 }).catch(() => false)) {
    await createNew.click().catch(() => {});
    await sleep(3000);
  }

  const fileInput = page.locator('[data-test-id="storyboard-upload-input"], input[type="file"]').first();
  if (await page.locator('[data-test-id="storyboard-upload-input"], input[type="file"]').count().catch(() => 0) === 0) {
    throw new Error('file input not found');
  }
  await fileInput.setInputFiles(img);
  await sleep(8000);

  const titleField = await waitForEnabled(page, 'input[placeholder*="Tell everyone"], input[placeholder*="Add your title"]');
  await titleField.fill(title);

  const linkField = await waitForEnabled(page, 'input[placeholder="Add a link"], input[placeholder*="Add a link"], input[aria-label*="link"], input[aria-label*="website"]');
  await linkField.fill(ARTICLES.find(a => a.slug === slug).postUrl);

  await page.evaluate((t) => {
    const ce = document.querySelector('[contenteditable="true"]');
    if (ce) ce.textContent = `${t} — Full guide at MomBabyPicks.com`;
  }, title);

  await sleep(2000);

  const clicked = await page.evaluate(() => {
    for (const b of document.querySelectorAll('button, div[role="button"]')) {
      const txt = (b.textContent || '').trim();
      if ((txt === 'Publish' || txt === 'Save' || txt === 'Save Pin') && b.offsetParent !== null) {
        b.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) throw new Error('publish button not found');

  await sleep(15000);
  const afterUrls = await getCreatedPinUrls(page);
  const newUrl = afterUrls.find(u => !beforeUrls.includes(u)) || afterUrls[afterUrls.length - 1] || '';
  return newUrl.replace(/\/$/, '');
}

async function main() {
  if (!fs.existsSync(COOKIE_FILE)) throw new Error(`missing cookie file: ${COOKIE_FILE}`);
  log('START publish-fail-pins');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  await context.addCookies(loadCookies());
  const page = await context.newPage();

  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(4000);
  log(`login url=${page.url()}`);

  const results = [];
  for (const article of ARTICLES) {
    for (let i = 0; i < article.pins.length; i++) {
      const title = article.pins[i];
      log(`${article.slug} pin ${i + 1} start`);
      const page = await context.newPage();
      try {
        const beforeUrls = await getCreatedPinUrls(page);
        const url = await publishOne(page, article.slug, title, i, beforeUrls);
        results.push({ slug: article.slug, index: i, url });
        log(`${article.slug} pin ${i + 1} url=${url || 'EMPTY'}`);
      } catch (e) {
        results.push({ slug: article.slug, index: i, error: e.message });
        log(`${article.slug} pin ${i + 1} error=${e.message}`);
      } finally {
        await page.close().catch(() => {});
      }
      await sleep(3000);
    }

    const jsonPath = path.join(DATA_DIR, `${article.slug}.json`);
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      for (const r of results.filter(x => x.slug === article.slug && x.url)) {
        if (data[r.index]) {
          data[r.index].status = 'published';
          data[r.index].published_pin_url = r.url;
        }
      }
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
      log(`${article.slug} json updated`);
    }
  }

  await browser.close();
  log('DONE');
  console.log('Done. Log:', logFile);
}

main().catch(err => {
  log(`FATAL ${err.message}`);
  console.error(err);
  process.exit(1);
});

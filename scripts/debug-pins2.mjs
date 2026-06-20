#!/usr/bin/env node
// Debug v2: find the actual Save/Publish button on pin-creation-tool
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const LOG_FILE = '/tmp/pin-debug2.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11,19)+' '+m+'\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cookies = JSON.parse(fs.readFileSync('/tmp/pinterest-cookies.json', 'utf-8'));

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});
await context.addCookies(cookies.map(c => ({
  name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
  secure: c.secure === true || c.secure === 1 || c.secure === 'true',
  httpOnly: c.httpOnly === true || c.httpOnly === 'true', sameSite: 'Lax',
})));

const page = await context.newPage();
await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(5000);

log(`URL: ${page.url()}`);

// Step 1: Upload an image first so the UI changes
const fileInput = page.locator('[data-test-id="storyboard-upload-input"]');
await fileInput.setInputFiles(path.join(PINS_DIR, 'best-baby-bath-tubs-2026-pin-1.png'));
await sleep(8000);
log('Image uploaded');

// Now examine all clickable elements
const clickable = await page.evaluate(() => {
  const all = document.querySelectorAll('button, a[role="button"], div[role="button"], [onclick], [data-test-id*="save"], [data-test-id*="Save"], [data-test-id*="create"], [data-test-id*="publish"], [data-test-id*="Publish"]');
  const results = [];
  for (const el of all) {
    if (el.offsetParent === null) continue;
    const rect = el.getBoundingClientRect();
    results.push({
      tag: el.tagName,
      text: (el.textContent || '').trim().substring(0, 60),
      type: el.getAttribute('type'),
      testId: el.getAttribute('data-test-id') || '',
      id: el.id || '',
      class: (el.className || '').substring(0, 60),
      ariaLabel: el.getAttribute('aria-label') || '',
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      inner: el.innerHTML.substring(0, 80),
    });
  }
  return results.sort((a, b) => a.rect.y - b.rect.y);
});

log(`Found ${clickable.length} visible clickable elements`);
for (const el of clickable) {
  log(`  [${el.tag}] y=${Math.round(el.rect.y)} t="${el.text.substring(0, 50)}" id="${el.id}" test-id="${el.testId}" label="${el.ariaLabel.substring(0, 30)}"`);
}

// Also look at the floating footer specifically
const footerHTML = await page.evaluate(() => {
  const footer = document.querySelector('[data-test-id="floating-footer"]');
  return footer ? footer.innerHTML.substring(0, 2000) : 'no footer';
});
log(`Footer HTML: ${footerHTML}`);

// Get page HTML around typical button areas
const topBarHTML = await page.evaluate(() => {
  const header = document.querySelector('[data-test-id="header"]');
  return header ? header.innerHTML.substring(0, 2000) : 'no header';
});
log(`Header HTML: ${topBarHTML}`);

await browser.close();
log('DONE');
console.log('Debug complete. Check /tmp/pin-debug2.txt');

#!/usr/bin/env node
// Debug v4: Capture network response after clicking Publish to get pin ID
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const LOG_FILE = '/tmp/pin-debug4.txt';
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

// Capture API responses
const apiResponses = [];
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('pin-creation') || url.includes('create') || url.includes('/v3/') || url.includes('/v5/')) {
    try {
      const body = await response.text().catch(() => '');
      if (body.length < 5000) {
        apiResponses.push({ url: url.substring(0, 200), status: response.status(), body: body.substring(0, 2000) });
      }
    } catch (e) {}
  }
});

// Capture all requests
page.on('request', (request) => {
  const url = request.url();
  if (url.includes('/v3/pins/') || url.includes('/v5/pins/') || url.includes('storyboards') || url.includes('pin/create')) {
    log(`REQ: ${url.substring(0, 200)}`);
    log(`  POST data: ${request.postData()?.substring(0, 500) || 'none'}`);
  }
});

// Login
await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(3000);
log(`URL: ${page.url()}`);

// Go to pin creation
await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await sleep(5000);

// Upload image
const fi = page.locator('[data-test-id="storyboard-upload-input"]');
await fi.setInputFiles(path.join(PINS_DIR, 'best-baby-bath-tubs-2026-pin-1.png'));
await sleep(8000);
log('Uploaded');

// Fill title
const ti = page.locator('input[placeholder*="Tell everyone"]');
await ti.fill('Debug Test Pin 4 - Check URL'); 

// Fill link
const li = page.locator('input[placeholder*="Add a link"]');
await li.fill('https://mombabypicks.com/');

// Fill desc
await page.evaluate(() => {
  const ed = document.querySelector('[contenteditable="true"]');
  if (ed) { ed.textContent = 'Debug test pin for URL checking'; }
});

await sleep(2000);

// Click Publish
await page.evaluate(() => {
  const btns = document.querySelectorAll('button');
  for (const b of btns) {
    if (b.offsetParent && b.textContent?.trim() === 'Publish') { b.click(); return; }
  }
});
log('Clicked Publish');

await sleep(15000); // Wait for network

log(`After publish URL: ${page.url()}`);

// Check URL via location
const loc = await page.evaluate(() => window.location.href);
log(`Location: ${loc}`);

// Check for any hidden inputs or state
const pinState = await page.evaluate(() => {
  // Look for any element with a pin ID
  const all = document.querySelectorAll('[id*="pin"], [data-test-id*="pinDraft"], [href*="/pin/"], a[href*="/pin/"]');
  return Array.from(all).slice(0, 20).map(el => ({
    id: el.id,
    testId: el.getAttribute('data-test-id'),
    href: el.getAttribute('href') || el.href || '',
    text: el.textContent?.trim().substring(0, 50),
  }));
});
log(`Pin state elements: ${pinState.length}`);
for (const ps of pinState) log(`  PS: ${ps.id || '-'} test-id=${ps.testId || '-'} href=${ps.href.substring(0, 80)}`);

// Check URL from draft sidebar
const draftUrls = await page.evaluate(() => {
  const drafts = document.querySelectorAll('[data-test-id*="pinDraft"], [data-test-id*="draft"]');
  const urls = [];
  for (const d of drafts) {
    const id = d.getAttribute('data-test-id');
    if (id && id.startsWith('pinDraft-')) {
      urls.push(id.replace('pinDraft-', ''));
    }
  }
  return urls;
});
log(`Draft IDs: ${JSON.stringify(draftUrls.slice(0, 5))}`);

// Log API responses
log(`\nAPI Responses (${apiResponses.length}):`);
for (const r of apiResponses) {
  log(`  ${r.status} ${r.url.substring(0, 150)}`);
  if (r.body) log(`  Body: ${r.body.substring(0, 500)}`);
}

await browser.close();
log('DONE');
console.log('Debug complete. Check /tmp/pin-debug4.txt');

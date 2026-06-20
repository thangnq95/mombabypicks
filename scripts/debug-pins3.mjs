#!/usr/bin/env node
// Debug v3: Understand what happens AFTER clicking Publish
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-debug3.txt';
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

// Go to pin creation
await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(5000);
log(`Initial URL: ${page.url()}`);

// Upload image
const fileInput = page.locator('[data-test-id="storyboard-upload-input"]');
await fileInput.setInputFiles(path.join(PINS_DIR, 'best-baby-bath-tubs-2026-pin-1.png'));
await sleep(8000);
log('Image uploaded');

// Fill fields
const titleInput = page.locator('input[placeholder*="Tell everyone"]');
await titleInput.fill('Test Pin - Please Ignore');
const linkInput = page.locator('input[placeholder*="Add a link"]');
await linkInput.fill('https://mombabypicks.com/');
await sleep(2000);

// Click Publish
await page.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.offsetParent === null) continue;
    if ((btn.textContent || '').trim() === 'Publish') {
      btn.click();
      return;
    }
  }
});
log('Clicked Publish');
await sleep(3000);

// After click, check what's on the page
const afterUrl = page.url();
log(`After publish URL: ${afterUrl}`);

// Check for any dialog/modals
const dialog = await page.evaluate(() => {
  const modals = document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, [aria-modal="true"]');
  return Array.from(modals).map(m => ({
    text: m.textContent?.trim().substring(0, 200),
    visible: m.offsetParent !== null,
  }));
});
log(`Dialogs found: ${dialog.length}`);
for (const d of dialog) log(`Dialog: ${d.text.substring(0, 100)}`);

// Check for toast/notification messages
const toast = await page.evaluate(() => {
  const toasts = document.querySelectorAll('[role="status"], [role="alert"], .toast, [data-test-id*="toast"], [data-test-id*="notification"]');
  return Array.from(toasts).map(t => t.textContent?.trim().substring(0, 200));
});
log(`Toasts found: ${toast.length}`);
for (const t of toast) log(`Toast: ${t}`);

// Check drafts section for the new pin
const drafts = await page.evaluate(() => {
  const draftEls = document.querySelectorAll('[data-test-id*="pinDraft"], [data-test-id*="pin-draft"], [data-test-id*="draft"]');
  return Array.from(draftEls).slice(0, 10).map(d => ({
    testId: d.getAttribute('data-test-id'),
    text: d.textContent?.trim().substring(0, 100),
    href: d.getAttribute('href') || d.querySelector('a')?.getAttribute('href') || '',
  }));
});
log(`Drafts found: ${drafts.length}`);
for (const d of drafts) log(`Draft: ${d.testId} text="${d.text.substring(0, 60)}" href="${d.href}"`);

// Check all links on page for pin URLs
const pinLinks = await page.evaluate(() => {
  const links = document.querySelectorAll('a[href*="/pin/"]');
  return Array.from(links).map(a => a.href).filter(h => !h.includes('pin-creation'));
});
log(`Pin links on page: ${pinLinks.length}`);
for (const l of pinLinks) log(`Pin link: ${l}`);

// Check URL hash or query
const pageState = await page.evaluate(() => ({
  hash: window.location.hash,
  search: window.location.search,
  href: window.location.href,
}));
log(`Page state: ${JSON.stringify(pageState)}`);

// Try navigating to business hub to see if pins appear
await page.goto('https://www.pinterest.com/business/hub/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(3000);
log(`Hub URL: ${page.url()}`);

// Check profile/pins page
await page.goto('https://www.pinterest.com/mombabypicks/_created/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(3000);
log(`Pins page URL: ${page.url()}`);

// Look for pin cards
const pinsOnPage = await page.evaluate(() => {
  const cards = document.querySelectorAll('[data-test-id*="pin"], [data-test-id*="Pin"], article, [data-test-id*="pinrep"]');
  return Array.from(cards).slice(0, 10).map(c => ({
    testId: c.getAttribute('data-test-id'),
    text: c.textContent?.trim().substring(0, 80),
    href: c.querySelector('a')?.getAttribute('href') || '',
    img: c.querySelector('img')?.getAttribute('src')?.substring(0, 50) || '',
  }));
});
log(`Pin cards on profile: ${pinsOnPage.length}`);
for (const p of pinsOnPage) log(`Pin card: ${p.href} img="${p.img}"`);

await page.screenshot({ path: '/tmp/pin-debug3-page.png' });

await browser.close();
log('DONE');
console.log('Debug complete. Check /tmp/pin-debug3.txt');

#!/usr/bin/env node
// Debug v5: Capture API response body to get pin ID
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const LOG_FILE = '/tmp/pin-debug5.txt';
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

// Capture full response body of important API calls
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('ApiCResource/create') || url.includes('ApiSResource/create')) {
    try {
      const body = await response.text().catch(() => '');
      log(`API ${url.split('/').slice(-2).join('/')}: ${body.substring(0, 3000)}`);
    } catch (e) {}
  }
});

// Login
await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(3000);

// Go to pin-creation-tool
await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await sleep(5000);

// Upload image
const fi = page.locator('[data-test-id="storyboard-upload-input"]');
await fi.setInputFiles(path.join(PINS_DIR, 'best-baby-bath-tubs-2026-pin-1.png'));
await sleep(8000);

// Fill fields
const ti = page.locator('input[placeholder*="Tell everyone"]');
await ti.fill('Debug Test Pin 5 - API Check');
const li = page.locator('input[placeholder*="Add a link"]');
await li.fill('https://mombabypicks.com/');
await page.evaluate(() => {
  const ed = document.querySelector('[contenteditable="true"]');
  if (ed) ed.textContent = 'Debug test pin 5';
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

await sleep(15000);

// Now check drafts - get the NEWEST draft IDs
const draftIds = await page.evaluate(() => {
  const drafts = document.querySelectorAll('[data-test-id*="pinDraft"]');
  return Array.from(drafts).map(d => d.getAttribute('data-test-id').replace('pinDraft-', ''));
});
log(`All draft IDs (${draftIds.length}): ${JSON.stringify(draftIds.slice(-5))}`);

// Also check if any draft has a link
const draftLinks = await page.evaluate(() => {
  const draftSections = document.querySelectorAll('[data-test-id*="pin-draft-content-container"]');
  const links = [];
  for (const d of draftSections) {
    const a = d.querySelector('a');
    if (a && a.href) links.push(a.href);
  }
  return links;
});
log(`Draft links: ${JSON.stringify(draftLinks)}`);

// Try navigating with a draft ID as pin URL
// First, go to the profile created page to see what's there
await page.goto('https://www.pinterest.com/mombabypicks/_created/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
await sleep(5000);

// Get ALL pin URLs on the profile page
const allPinUrls = await page.evaluate(() => {
  const links = document.querySelectorAll('a[href*="/pin/"]');
  const urls = new Set();
  for (const a of links) {
    const href = a.getAttribute('href');
    if (href && href.includes('/pin/') && !href.includes('pin-creation')) {
      urls.add(href.startsWith('http') ? href : 'https://www.pinterest.com' + href);
    }
  }
  return Array.from(urls);
});
log(`All pin URLs on profile: ${JSON.stringify(allPinUrls)}`);

// Check a specific draft URL
const firstDraftId = draftIds[draftIds.length - 1]; // newest
log(`Trying draft URL: https://www.pinterest.com/pin/${firstDraftId}/`);
await page.goto(`https://www.pinterest.com/pin/${firstDraftId}/`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
await sleep(3000);
log(`Draft page URL: ${page.url()}`);
const draftPageTitle = await page.title();
log(`Draft page title: ${draftPageTitle}`);

// Also try navigating to pin and see if it redirects
await page.goto(`https://www.pinterest.com/pin/${firstDraftId}/`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await sleep(3000);
// Check if redirect happened
const finalUrl = await page.evaluate(() => window.location.href);
log(`Final URL after pin/${firstDraftId}: ${finalUrl}`);

await browser.close();
log('DONE');
console.log('Debug complete. Check /tmp/pin-debug5.txt');

#!/usr/bin/env node
// Debug script: inspect Pinterest pin-creation-tool page
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const LOG_FILE = '/tmp/pin-debug.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11,19)+' '+m+'\n');

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
await new Promise(r => setTimeout(r, 5000));

// Screenshot
await page.screenshot({ path: '/tmp/pin-debug-page.png', fullPage: true });

// Get page title and URL
log(`URL: ${page.url()}`);
log(`Title: ${await page.title()}`);

// Dump all buttons
const buttons = await page.evaluate(() => {
  const btns = document.querySelectorAll('button, div[role="button"]');
  return Array.from(btns).slice(0, 40).map(b => ({
    tag: b.tagName,
    role: b.getAttribute('role'),
    text: b.textContent?.trim().substring(0, 50),
    visible: b.offsetParent !== null,
    id: b.id,
    class: b.className?.substring(0, 80),
    type: b.getAttribute('type'),
    'data-test-id': b.getAttribute('data-test-id'),
  }));
});
for (const b of buttons) log(`BTN: visible=${b.visible} text="${b.text}" id="${b.id}" test-id="${b['data-test-id']}"`);

// Dump ALL input elements
const inputs = await page.evaluate(() => {
  const els = document.querySelectorAll('input, textarea, [contenteditable]');
  return Array.from(els).slice(0, 30).map(el => ({
    tag: el.tagName,
    type: el.getAttribute('type'),
    placeholder: el.getAttribute('placeholder')?.substring(0, 40),
    'aria-label': el.getAttribute('aria-label')?.substring(0, 40),
    visible: el.offsetParent !== null,
    id: el.id,
    name: el.getAttribute('name'),
    'data-test-id': el.getAttribute('data-test-id'),
  }));
});
for (const inp of inputs) log(`INPUT: visible=${inp.visible} placeholder="${inp.placeholder}" label="${inp['aria-label']}" test-id="${inp['data-test-id']}"`);

// Try to find the file input
const fileInput = await page.evaluate(() => {
  const fi = document.querySelector('input[type="file"]');
  return fi ? { visible: fi.offsetParent !== null, id: fi.id, name: fi.getAttribute('name') } : null;
});
log(`File input: ${JSON.stringify(fileInput)}`);

// Check for any data-test-id attributes on the page
const allTestIds = await page.evaluate(() => {
  const els = document.querySelectorAll('[data-test-id]');
  return Array.from(els).slice(0, 30).map(el => ({
    tag: el.tagName,
    testId: el.getAttribute('data-test-id'),
    text: el.textContent?.trim().substring(0, 40),
  }));
});
for (const tid of allTestIds) log(`TEST-ID: ${tid.tag} [${tid.testId}] "${tid.text}"`);

await browser.close();
log('DONE');
console.log('Debug complete. Check /tmp/pin-debug.txt and /tmp/pin-debug-page.png');

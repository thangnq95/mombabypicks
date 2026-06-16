// Upload pin — uses JS evaluation to fill correct fields
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PROFILE = path.join(process.env.HOME, '.hermes', 'chrome-debug');
const PIN_IMAGE = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins/best-breast-pumps-pin-1.png');

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d).webSocketDebuggerUrl) } catch(e) { reject(e) } });
    }).on('error', reject);
  });
}

(async () => {
  // Connect to existing CDP Chrome
  const ws = await getWS();
  const browser = await chromium.connectOverCDP(ws);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || await ctx.newPage();

  // Go to pin builder
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check page state
  console.log(`📍 URL: ${page.url()}`);
  
  // Upload via file input
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await fileInput.setInputFiles(PIN_IMAGE);
    console.log('✅ Image uploaded');
  } else {
    console.log('❌ No file input');
    await page.screenshot({ path: '/tmp/pin-state.png' });
    await browser.close();
    return;
  }
  
  await page.waitForTimeout(4000);
  
  // Use JavaScript to fill the fields correctly
  await page.evaluate(() => {
    // Pinterest pin builder fields
    const titleField = document.querySelector('[aria-label*="title" i], [data-test-id*="title" i], [placeholder*="title" i]');
    const descField = document.querySelector('textarea, [aria-label*="description" i], [data-test-id*="description" i]');
    const linkField = document.querySelector('input[type="url"]');
    
    console.log('Title field:', titleField?.tagName);
    console.log('Desc field:', descField?.tagName);
    console.log('Link field:', linkField?.tagName);
    
    // If the regular selectors don't work, try the contenteditable approach
    const editableDivs = document.querySelectorAll('[contenteditable="true"]');
    console.log('Editable divs:', editableDivs.length);
    
    // List all interactive elements
    const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]');
    console.log('All input-like elements:');
    inputs.forEach((el, i) => {
      console.log(`  ${i}: ${el.tagName} type=${el.type} placeholder="${el.placeholder}" class="${el.className?.substring(0,50)}"`);
    });
  });
  
  // Fill fields via JS
  await page.evaluate(({title, desc, url}) => {
    const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]');
    // Usually first contenteditable = title, last textarea/input = description
    inputs.forEach((el, i) => {
      if (el.getAttribute('contenteditable') === 'true') {
        el.textContent = title;
        console.log(`✅ Filled title at index ${i}`);
      } else if (el.tagName === 'TEXTAREA') {
        el.value = desc;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`✅ Filled description at index ${i}`);
      } else if (el.type === 'url') {
        el.value = url;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`✅ Filled URL at index ${i}`);
      }
    });
  }, {
    title: 'Best Breast Pumps of 2026: Top 5 Hands-Free & Electric Models Compared',
    desc: 'Looking for the best breast pump? We compared 5 top-rated pumps from Momcozy, Spectra, Elvie, Lansinoh & Medela. Read our full guide for suction strength, comfort, and real mom reviews.',
    url: 'https://mombabypicks.com/posts/best-breast-pumps/'
  });
  
  await page.waitForTimeout(2000);
  
  // Find and click Publish
  const result = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, [role="button"], a');
    for (const btn of btns) {
      if (btn.textContent?.trim().toLowerCase() === 'publish') {
        btn.click();
        return 'Clicked: ' + btn.textContent?.trim();
      }
    }
    return 'No Publish button found';
  });
  console.log(`🔘 ${result}`);
  
  await page.waitForTimeout(5000);
  console.log(`📍 URL after publish: ${page.url()}`);
  await page.screenshot({ path: '/tmp/pin-state.png' });
  
  await browser.close();
})().catch(e => console.error('❌', e.message));

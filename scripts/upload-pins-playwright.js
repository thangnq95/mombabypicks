// Upload pins using Playwright's own Chromium (NOT user's Chrome)
// First run: login to Pinterest manually
// Subsequent runs: uses saved session

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PINS_DIR = path.join(process.env.HOME, 'GIT/PP/mombabypicks/static/images/pins');
const SESSION_DIR = path.join(process.env.HOME, '.hermes', 'playwright-session');
const BASE_URL = 'https://mombabypicks.com/posts/';

// Pin configs
const PINS = [
  {
    slug: 'best-breast-pumps',
    title: 'Breast pumps that working moms actually use — Amazon best seller',
    link: BASE_URL + 'best-breast-pumps/',
    file: path.join(PINS_DIR, 'best-breast-pumps-pin-1.png'),
  },
  // Add more pins here
];

async function uploadPins() {
  // Use persistent context - saves cookies between runs
  const userDataDir = path.join(SESSION_DIR, 'pinterest-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--no-sandbox'],
    viewport: { width: 1280, height: 800 },
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Navigate to Pinterest - if not logged in, wait for manual login
  await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  
  const isLoggedIn = await page.evaluate(() => {
    return !!document.querySelector('[data-test-id="header-profile"]') || 
           document.title !== 'Pinterest' || 
           document.body.innerText.includes('Home');
  });
  
  console.log('Logged in:', isLoggedIn);
  
  if (!isLoggedIn) {
    console.log('Please login manually in the browser window...');
    console.log('Waiting up to 60 seconds...');
    // Wait for login
    await page.waitForFunction(() => {
      return document.querySelector('[data-test-id="header-profile"]') || 
             document.querySelector('a[href*="/_created/"]') ||
             document.querySelector('button[aria-label="Your profile"]');
    }, { timeout: 60000 });
    console.log('Login detected! Continuing...');
    await sleep(2000);
  }

  // Now upload pins
  for (const pin of PINS) {
    console.log(`Uploading: ${pin.title}`);
    await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(8000);
    
    const fileInput = page.locator('input[type="file"]');
    if (!await fileInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      console.log(`  ❌ File input not visible`);
      continue;
    }
    
    await fileInput.setInputFiles(pin.file);
    await sleep(6000);
    
    await page.locator('input[placeholder*="Tell everyone"]').fill(pin.title);
    await page.locator('input[placeholder="Add a link"]').fill(pin.link);
    await page.evaluate((t) => {
      const ce = document.querySelector('[contenteditable="true"]');
      if (ce) ce.textContent = t + ' — Full guide at MomBabyPicks.com';
    }, pin.title);
    await sleep(2000);
    
    const clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent?.trim() === 'Publish' && b.offsetParent !== null) {
          b.click();
          return true;
        }
      }
      return false;
    });
    console.log(`  ${clicked ? '✅' : '❌'} Published to drafts`);
    await sleep(5000);
  }
  
  console.log('Done! Pins are in drafts.');
  await context.close();
}

uploadPins().catch(e => console.error(e));

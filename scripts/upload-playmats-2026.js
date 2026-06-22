// Upload 3 best-baby-play-mats-2026 pins to Pinterest and capture real URLs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HOME = process.env.HOME;
const REPO = path.join(HOME, 'GIT/PP/mombabypicks');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const SESSION_DIR = path.join(HOME, '.hermes', 'playwright-session', 'pinterest');
const JSON_PATH = path.join(REPO, 'data/pinterest/best-baby-play-mats-2026.json');
const SLUG = 'best-baby-play-mats-2026';
const DEST = 'https://mombabypicks.com/posts/best-baby-play-mats-2026/';

// Read existing pins JSON
const pins = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
console.log(`Loaded ${pins.length} pins from JSON`);

async function uploadPins() {
  // Use persistent context to save login session
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: true,
    args: ['--no-sandbox'],
    viewport: { width: 1280, height: 900 },
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Navigate to Pinterest
  console.log('Navigating to Pinterest...');
  await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4000);

  // Check if logged in
  const isLoggedIn = await page.evaluate(() => {
    // Multiple signals we're logged in
    const profileBtn = document.querySelector('[data-test-id="header-profile"]');
    const homeLink = document.querySelector('a[href="/"]');
    const createBtn = document.querySelector('button[aria-label*="Create"]');
    const navList = document.querySelectorAll('[data-test-id*="nav"]');
    return !!(profileBtn || createBtn || (homeLink && document.body.innerText.includes('Today')));
  });

  if (!isLoggedIn) {
    console.log('⚠️ Not logged into Pinterest. Please log in manually in the browser window.');
    console.log('Waiting up to 120 seconds for login...');
    try {
      await page.waitForFunction(() => {
        return !!document.querySelector('[data-test-id="header-profile"]') ||
               !!document.querySelector('a[href*="/_created/"]') ||
               !!document.querySelector('div[data-test-id="UserAvatar"]') ||
               document.body.innerText.includes('Home feed');
      }, { timeout: 120000 });
      console.log('✅ Login detected!');
      await sleep(3000);
    } catch (e) {
      console.log('❌ Login timeout. Trying to proceed anyway...');
    }
  } else {
    console.log('✅ Already logged in!');
  }

  const publishedUrls = [];

  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    const num = i + 1;
    const imgFile = path.join(PINS_DIR, `${SLUG}-pin-${num}.png`);

    console.log(`\n=== Pin ${num}: ${pin.title.substring(0, 60)} ===`);
    console.log(`Image: ${imgFile}`);

    if (!fs.existsSync(imgFile)) {
      console.log(`❌ Image not found: ${imgFile}`);
      continue;
    }

    // Navigate to pin creation tool
    console.log('  Navigating to pin-creation-tool...');
    await page.goto('https://www.pinterest.com/pin-creation-tool/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await sleep(8000);

    // Upload image via file input
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.isVisible({ timeout: 20000 }).catch(() => false))) {
      console.log('  ❌ File input not visible');
      continue;
    }
    await fileInput.setInputFiles(imgFile);
    console.log('  ✅ Image file set');
    await sleep(8000);

    // Fill title
    try {
      const titleInput = page.locator('input[placeholder*="Tell everyone"], input[aria-label*="Title"]').first();
      await titleInput.fill(pin.title, { timeout: 10000 });
      console.log('  ✅ Title filled');
    } catch (e) {
      console.log(`  ⚠️ Title input not found: ${e.message}`);
    }
    await sleep(1000);

    // Fill destination link
    try {
      const linkInput = page.locator('input[placeholder="Add a link"], input[aria-label*="Link"]').first();
      await linkInput.fill(pin.destination_url, { timeout: 10000 });
      console.log('  ✅ Link filled');
    } catch (e) {
      console.log(`  ⚠️ Link input not found: ${e.message}`);
    }
    await sleep(1000);

    // Fill description in contenteditable div
    try {
      const desc = page.locator('div[contenteditable="true"], div[role="textbox"]').first();
      if (await desc.isVisible({ timeout: 5000 }).catch(() => false)) {
        await desc.fill(pin.description);
        console.log('  ✅ Description filled');
      }
    } catch (e) {
      console.log(`  ⚠️ Description field not found: ${e.message}`);
    }
    await sleep(2000);

    // Click Publish button
    const published = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        const t = b.textContent?.trim().toLowerCase();
        if ((t === 'publish' || t === 'save') && b.offsetParent !== null) {
          b.click();
          return true;
        }
      }
      return false;
    });
    console.log(`  ${published ? '✅' : '❌'} Publish button clicked`);

    // Wait for navigation/redirect to the pin page
    await sleep(8000);

    // Capture the current URL after publish
    let currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl}`);

    // If it still looks like pin-creation-tool, wait longer
    if (currentUrl.includes('pin-creation-tool') || currentUrl.includes('pin/create')) {
      console.log('  Still on creation tool — waiting more...');
      await sleep(10000);
      currentUrl = page.url();
      console.log(`  URL after wait: ${currentUrl}`);
    }

    // If we got a real pin URL, save it
    if (currentUrl.includes('/pin/') && !currentUrl.includes('pin-creation') && !currentUrl.includes('pin/create')) {
      publishedUrls.push(currentUrl);
      console.log(`  🎯 REAL PIN URL: ${currentUrl}`);
    } else {
      console.log(`  ⚠️ Could not capture pin URL (current: ${currentUrl})`);
      publishedUrls.push(currentUrl);
    }
  }

  await context.close();

  // Update JSON with real URLs
  console.log('\n=== Updating JSON ===');
  for (let i = 0; i < pins.length; i++) {
    if (i < publishedUrls.length) {
      const url = publishedUrls[i];
      if (url.includes('/pin/') && !url.includes('pin-creation') && !url.includes('pin/create')) {
        pins[i].status = 'published';
        pins[i].published_pin_url = url;
        console.log(`Pin ${i+1}: ✅ ${url}`);
      } else {
        pins[i].status = 'draft';
        pins[i].published_pin_url = url;
        console.log(`Pin ${i+1}: ⚠️ Set as draft — URL: ${url}`);
      }
    }
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(pins, null, 2), 'utf-8');
  console.log(`\n✅ JSON updated: ${JSON_PATH}`);
  console.log(`Result: ${publishedUrls.filter(u => u.includes('/pin/') && !u.includes('pin-creation') && !u.includes('pin/create')).length}/${pins.length} published with real URLs`);
}

uploadPins().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});

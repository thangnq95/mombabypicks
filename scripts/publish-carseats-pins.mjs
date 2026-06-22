#!/usr/bin/env node
/**
 * Publish Pinterest pins for best-infant-car-seats-2026
 * Uses persistent Playwright session to avoid re-login.
 * After publishing each pin, captures the real pin URL.
 * Then updates data/pinterest/best-infant-car-seats-2026.json.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const REPO = process.env.HOME + '/GIT/PP/mombabypicks';
const PINS_DIR = REPO + '/static/images/pins';
const SESSION_DIR = process.env.HOME + '/.hermes/playwright-session/pinterest';
const JSON_PATH = REPO + '/data/pinterest/best-infant-car-seats-2026.json';
const SLEEP = ms => new Promise(r => setTimeout(r, ms));

// Pin data from JSON
const SLUG = 'best-infant-car-seats-2026';
const DEST_URL = 'https://mombabypicks.com/posts/best-infant-car-seats-2026/';

const PINS = [
  {
    image: 'best-infant-car-seats-2026-pin-1.png',
    title: 'Best Infant Car Seats 2026: Safety Ratings, Installation & Budget Picks',
    description: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value. We cover Chicco, Graco, Maxi-Cosi, UPPAbaby, and Evenflo.',
    hashtags: '#MomBabyPicks #BabyGear #NewParents #PinterestFinds',
  },
  {
    image: 'best-infant-car-seats-2026-pin-2.png',
    title: 'Top Infant Car Seats 2026: Safety & Value Compared',
    description: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value. We cover Chicco, Graco, Maxi-Cosi, UPPAbaby, and Evenflo.',
    hashtags: '#MomBabyPicks #BabyGear #NewParents #PinterestFinds',
  },
  {
    image: 'best-infant-car-seats-2026-pin-3.png',
    title: 'Which Infant Car Seat is Safest? 2026 Guide',
    description: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value. We cover Chicco, Graco, Maxi-Cosi, UPPAbaby, and Evenflo.',
    hashtags: '#MomBabyPicks #BabyGear #NewParents #PinterestFinds',
  },
];

function log(m) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${m}`);
}

async function getCurrentUrl(page) {
  try {
    return page.url();
  } catch { return ''; }
}

async function publishPin(page, pinData, index) {
  const fp = path.join(PINS_DIR, pinData.image);
  if (!fs.existsSync(fp)) {
    log(`❌ Image not found: ${fp}`);
    return null;
  }
  log(`📤 Uploading pin ${index + 1}: ${pinData.title}`);

  // Navigate to pin creation tool
  await page.goto('https://www.pinterest.com/pin-creation-tool/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  }).catch(() => {});
  await SLEEP(8000);

  // Check if we're on the pin creation page
  const currentUrl = await getCurrentUrl(page);
  log(`  URL after navigation: ${currentUrl}`);

  // If redirected to login, we're not logged in
  if (currentUrl.includes('login')) {
    log(`  ❌ Redirected to login page - session expired`);
    return { error: 'login_required' };
  }

  // Upload the image
  const fileInput = page.locator('input[type="file"]');
  const fiVisible = await fileInput.isVisible({ timeout: 12000 }).catch(() => false);
  if (!fiVisible) {
    log(`  ❌ File input not visible on pin creation page`);
    return null;
  }
  await fileInput.setInputFiles(fp);
  log(`  ✅ Image uploaded`);
  await SLEEP(6000);

  // Fill title
  const titleInput = page.locator('input[placeholder*="Tell everyone"], textarea[placeholder*="Add your title"], input[aria-label*="title"]').first();
  if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await titleInput.fill(pinData.title);
    log(`  ✅ Title filled`);
  } else {
    log(`  ⚠️ Title input not found, trying contenteditable`);
  }

  // Fill destination URL
  const linkInput = page.locator('input[placeholder*="Add a link"], input[aria-label*="link"], input[aria-label*="website"]').first();
  if (await linkInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await linkInput.fill(DEST_URL);
    log(`  ✅ Link filled`);
  }
  await SLEEP(1000);

  // Fill description via contenteditable
  await page.evaluate((desc) => {
    const ce = document.querySelector('[contenteditable="true"]');
    if (ce) {
      ce.textContent = desc + ' — Full guide at MomBabyPicks.com';
    }
  }, pinData.description);
  log(`  ✅ Description filled`);
  await SLEEP(2000);

  // Click Publish button
  const published = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent?.trim() === 'Publish' && b.offsetParent !== null) {
        b.click();
        return true;
      }
    }
    return false;
  });
  
  if (!published) {
    log(`  ❌ Could not find Publish button`);
    // Try finding by data-test-id or other selectors
    const pub2 = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.textContent?.trim() === 'Publish' && !el.children.length && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!pub2) {
      log(`  ❌ Publish button not found at all`);
      return null;
    }
  }
  log(`  ✅ Published!`);
  
  // Wait for navigation to the pin page
  await SLEEP(8000);
  
  // Try to capture the pin URL
  // After publishing, Pinterest may redirect to the pin, board, or show a confirmation
  let pinUrl = '';
  
  // Method 1: Check current URL
  const urlAfter = await getCurrentUrl(page);
  log(`  URL after publish: ${urlAfter}`);
  
  if (urlAfter.includes('/pin/') && !urlAfter.includes('pin-creation')) {
    pinUrl = urlAfter;
  }
  
  // Method 2: Wait a bit and check URL again (redirects can take time)
  if (!pinUrl) {
    await SLEEP(5000);
    const urlAfter2 = await getCurrentUrl(page);
    log(`  URL after 5s delay: ${urlAfter2}`);
    if (urlAfter2.includes('/pin/') && !urlAfter2.includes('pin-creation')) {
      pinUrl = urlAfter2;
    }
  }
  
  // Method 3: Look for the pin link on the page
  if (!pinUrl) {
    pinUrl = await page.evaluate(() => {
      // Look for a link to the pin we just created
      const links = document.querySelectorAll('a[href*="/pin/"]');
      for (const a of links) {
        const href = a.getAttribute('href');
        if (href && href.includes('/pin/') && !href.includes('pin-creation')) {
          // Make it absolute
          if (href.startsWith('/')) return 'https://www.pinterest.com' + href;
          return href;
        }
      }
      // Check if there's a "View" or "See it" link
      const allLinks = document.querySelectorAll('a');
      for (const a of allLinks) {
        const text = a.textContent?.trim().toLowerCase() || '';
        if ((text.includes('view') || text.includes('see')) && a.href && a.href.includes('/pin/')) {
          return a.href;
        }
      }
      return '';
    });
  }

  // Method 4: Check page source for pin ID patterns
  if (!pinUrl) {
    pinUrl = await page.evaluate(() => {
      // Look for pin ID in meta tags or JSON data
      const html = document.documentElement.innerHTML;
      const match = html.match(/"id":"(\d+)"|"pin_id":(\d+)|"id":(\d+),"description"/);
      if (match) {
        const pinId = match[1] || match[2] || match[3];
        if (pinId && pinId.length > 5) {
          return `https://www.pinterest.com/pin/${pinId}/`;
        }
      }
      return '';
    });
  }
  
  if (pinUrl) {
    // Normalize - remove trailing slash for consistency
    pinUrl = pinUrl.replace(/\/$/, '');
    log(`  ✅ Pin URL: ${pinUrl}`);
  } else {
    log(`  ⚠️ Could not capture pin URL`);
  }
  
  return { url: pinUrl };
}

async function main() {
  log('='.repeat(60));
  log('Starting Pinterest pin publishing for best-infant-car-seats-2026');
  log('='.repeat(60));

  // Launch persistent context (preserves login session)
  log('Launching browser with persistent session...');
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: true,
    args: ['--no-sandbox'],
    viewport: { width: 1280, height: 900 },
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  try {
    // Check login state
    log('Checking Pinterest login state...');
    await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await SLEEP(3000);

    const isLoggedIn = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-test-id="header-profile"]') ||
        document.querySelector('a[href*="/_created/"]') ||
        document.querySelector('button[aria-label="Your profile"]') ||
        document.body.innerText.includes('Home') ||
        document.querySelector('[data-test-id="homefeed"]')
      );
    });

    if (!isLoggedIn) {
      log('⚠️ Not logged into Pinterest. Opening browser for manual login...');
      log('Please log in as mombabypicks in the browser window...');
      log('Waiting up to 120 seconds for login...');
      
      try {
        await page.waitForFunction(() => {
          return document.querySelector('[data-test-id="header-profile"]') ||
                 document.querySelector('a[href*="/_created/"]') ||
                 document.querySelector('button[aria-label="Your profile"]');
        }, { timeout: 120000 });
        log('✅ Login detected!');
      } catch {
        log('❌ Login timeout. Exiting.');
        await context.close();
        return;
      }
      await SLEEP(2000);
    } else {
      log('✅ Already logged into Pinterest');
    }

    // Publish each pin
    const results = [];
    for (let i = 0; i < PINS.length; i++) {
      const result = await publishPin(page, PINS[i], i);
      results.push(result);
      
      if (result?.error === 'login_required') {
        log('❌ Session lost during upload. Aborting.');
        break;
      }
      
      // Small delay between pins
      await SLEEP(3000);
    }

    // Update JSON
    log('\n' + '='.repeat(60));
    log('Updating JSON record...');
    
    const jsonData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    
    for (let i = 0; i < jsonData.length; i++) {
      const result = results[i];
      if (result && result.url) {
        jsonData[i].status = 'published';
        jsonData[i].published_pin_url = result.url;
        log(`  ✅ Pin ${i + 1}: ${result.url}`);
      } else if (result && result.error) {
        jsonData[i].status = 'ERROR';
        log(`  ❌ Pin ${i + 1}: Error - ${result.error}`);
      } else {
        jsonData[i].status = 'ERROR';
        log(`  ⚠️ Pin ${i + 1}: Could not capture URL, marked ERROR`);
      }
    }
    
    // Also mark any we didn't process as ERROR
    for (let i = results.length; i < jsonData.length; i++) {
      jsonData[i].status = 'ERROR';
    }
    
    fs.writeFileSync(JSON_PATH, JSON.stringify(jsonData, null, 2) + '\n');
    log(`✅ JSON updated at ${JSON_PATH}`);

    log('\n' + '='.repeat(60));
    log('Summary:');
    for (let i = 0; i < jsonData.length; i++) {
      log(`  Pin ${i + 1}: ${jsonData[i].status} — ${jsonData[i].published_pin_url}`);
    }
    log('='.repeat(60));

  } catch (err) {
    log(`❌ Fatal error: ${err.message}`);
    console.error(err);
  } finally {
    await SLEEP(2000);
    await context.close();
    log('Browser closed.');
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const USER_DATA_DIR = path.join(process.env.HOME, '.hermes/chrome-debug');
const LOG = '/tmp/pin-debug-check.txt';
const log = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

(async () => {
  log('START debug check');
  
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  
  let page = context.pages()[0] || await context.newPage();
  
  // Check Pinterest login status first
  await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const currentUrl = page.url();
  log(`Pinterest home URL: ${currentUrl}`);
  console.log(`Pinterest home URL: ${currentUrl}`);
  
  // Check if we see login or feed
  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);
  log(`Page title: ${pageTitle}`);
  
  // Check for login elements
  const hasLoginForm = await page.locator('input[type="email"], input[name="id"], button:has-text("Log in")').first().isVisible({timeout: 3000}).catch(() => false);
  console.log(`Has login form: ${hasLoginForm}`);
  log(`Has login form: ${hasLoginForm}`);
  
  // Check if there's a profile avatar (logged in indicator)
  const hasAvatar = await page.locator('[data-test-id="user-avatar"], [data-test-id="profile-link"]').first().isVisible({timeout: 3000}).catch(() => false);
  console.log(`Has avatar (logged in): ${hasAvatar}`);
  log(`Has avatar: ${hasAvatar}`);
  
  // Take screenshot
  await page.screenshot({path: '/tmp/pinterest-home.png'});
  console.log('Screenshot saved to /tmp/pinterest-home.png');
  
  // Now navigate to pin-builder
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const pbUrl = page.url();
  console.log(`Pin builder URL: ${pbUrl}`);
  log(`Pin builder URL: ${pbUrl}`);
  
  // Check what's on the pin-builder page
  const html = await page.content();
  // Save HTML to file for inspection  
  fs.writeFileSync('/tmp/pin-builder.html', html.substring(0, 100000));
  console.log('HTML saved to /tmp/pin-builder.html');
  log(`HTML length: ${html.length}`);
  
  // Check for specific elements
  const hasFileInput = await page.locator('input[type="file"]').count();
  console.log(`File inputs: ${hasFileInput}`);
  log(`File inputs: ${hasFileInput}`);
  
  const hasCreateButton = await page.locator('button:has-text("Create"), div:has-text("Create pin")').first().isVisible({timeout: 3000}).catch(() => false);
  console.log(`Has Create button: ${hasCreateButton}`);
  log(`Has Create button: ${hasCreateButton}`);
  
  await page.screenshot({path: '/tmp/pin-builder-screen.png'});
  console.log('Pin builder screenshot saved');
  
  log('DONE debug check');
  await context.close();
})().catch(e => {
  console.error('FATAL:', e.message);
  log('FATAL: ' + e.message);
  process.exit(1);
});

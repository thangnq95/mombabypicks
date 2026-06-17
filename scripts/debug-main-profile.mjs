import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const USER_DATA_DIR = path.join(process.env.HOME, 'Library/Application Support/Google/Chrome');
const LOG = '/tmp/pin-debug-main-profile.txt';
const log = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');

(async () => {
  log('START - checking main Chrome profile');
  
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  
  let page = context.pages()[0] || await context.newPage();
  
  // Check Pinterest login status
  await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const currentUrl = page.url();
  console.log(`Pinterest home URL: ${currentUrl}`);
  log(`Pinterest home URL: ${currentUrl}`);
  
  // Check login status
  const hasLoginForm = await page.locator('input[type="email"], input[name="id"], button:has-text("Log in")').first().isVisible({timeout: 3000}).catch(() => false);
  console.log(`Has login form: ${hasLoginForm}`);
  log(`Has login form: ${hasLoginForm}`);
  
  const hasAvatar = await page.locator('[data-test-id="user-avatar"], [data-test-id="profile-link"]').first().isVisible({timeout: 3000}).catch(() => false);
  console.log(`Has avatar (logged in): ${hasAvatar}`);
  log(`Has avatar: ${hasAvatar}`);
  
  // If logged in, check username
  if (hasAvatar) {
    const profileLink = await page.locator('[data-test-id="user-avatar"] a, [data-test-id="profile-link"] a').getAttribute('href').catch(() => null);
    console.log(`Profile link: ${profileLink}`);
    log(`Profile link: ${profileLink}`);
  }
  
  await page.screenshot({path: '/tmp/pinterest-main-profile.png'});
  console.log('Screenshot saved');
  
  log('DONE');
  await context.close();
})().catch(e => {
  console.error('FATAL:', e.message);
  log('FATAL: ' + e.message);
  process.exit(1);
});

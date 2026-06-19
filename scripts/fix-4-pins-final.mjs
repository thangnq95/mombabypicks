/**
 * fix-4-pins-final.mjs — Upload pins using Playwright with a fresh Chromium + copied profile
 * This avoids CDP issues and Keychain problems by using a fully separate Chromium instance
 * with the user's profile cookies.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-4-final.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11,19)+' '+m+'\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ARTICLES = [
  { slug: 'best-baby-bath-tubs-2026', title: 'Best Baby Bath Tubs 2026', post_url: 'https://mombabypicks.com/posts/best-baby-bath-tubs-2026/', pins: [
      { title: 'Best Baby Bath Tubs 2026: Safe & Easy Options for Newborns to Toddlers', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
      { title: 'Top Baby Bath Tubs 2026: Newborn to Toddler Picks', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
      { title: 'Best Baby Bath Tubs for Safe & Easy Bath Time', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
  ]},
  { slug: 'best-baby-play-mats-2026', title: 'Best Baby Play Mats 2026', post_url: 'https://mombabypicks.com/posts/best-baby-play-mats-2026/', pins: [
      { title: 'Best Baby Play Mats 2026: Safe & Soft Options for Tummy Time & Play', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
      { title: 'Top Baby Play Mats 2026: The Complete Guide', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
      { title: 'Best Play Mats for Tummy Time & Crawling 2026', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
  ]},
  { slug: 'best-baby-swings-2026', title: 'Best Baby Swings 2026', post_url: 'https://mombabypicks.com/posts/best-baby-swings-2026/', pins: [
      { title: 'Best Baby Swings 2026: Soothe Your Baby with the Right Swing', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
      { title: 'Top Baby Swings 2026: Our Picks for Every Budget', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
      { title: 'Which Baby Swing Is Best? 2026\'s Top 5 Reviewed', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
  ]},
  { slug: 'best-infant-car-seats-2026', title: 'Best Infant Car Seats 2026', post_url: 'https://mombabypicks.com/posts/best-infant-car-seats-2026/', pins: [
      { title: 'Best Infant Car Seats 2026: Safety Ratings, Installation & Budget Picks', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
      { title: 'Top Infant Car Seats 2026: Safety & Value Compared', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
      { title: 'Which Infant Car Seat is Safest? 2026 Guide', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
  ]},
];

async function main() {
  log('='.repeat(60));
  log('START fix-4-pins (final attempt - copied profile)');
  log('='.repeat(60));

  // Kill any Chrome for Testing instances that might interfere
  try { process.execSync('pkill -f "Google Chrome for Testing" 2>/dev/null'); } catch(e) {}
  await sleep(2000);

  // Create a fresh temp dir for this run (copied from user's Chrome profile)
  const tmpProfile = '/tmp/chrome-pinterest-profile-' + Date.now();
  fs.mkdirSync(tmpProfile, { recursive: true });
  
  // Copy the Default profile data
  try {
    fs.cpSync('/Users/thangnguyen/Library/Application Support/Google/Chrome/Default', 
              path.join(tmpProfile, 'Default'), { recursive: true });
  } catch(e) {
    log(`Copy error (non-fatal): ${e.message}`);
  }
  
  // Copy Local State
  try {
    fs.copyFileSync('/Users/thangnguyen/Library/Application Support/Google/Chrome/Local State',
                    path.join(tmpProfile, 'Local State'));
  } catch(e) {}

  log(`Temp profile: ${tmpProfile}`);

  // Launch Playwright Chromium with copied profile
  const browser = await chromium.launchPersistentContext(tmpProfile, {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=ChromeWhatsNewUI',
    ],
  });

  const page = await browser.newPage();

  // Check Pinterest login
  log('Checking Pinterest...');
  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(5000);

  const currentUrl = page.url();
  log(`URL: ${currentUrl}`);
  console.log(`URL: ${currentUrl}`);

  if (currentUrl.includes('login')) {
    log('❌ Not logged in');
    console.log('❌ Not logged into Pinterest with copied profile');
    await browser.close();
    return false;
  }
  console.log('✅ Pinterest logged in!');

  let totalOk = 0, totalFail = 0;
  const publishedUrls = {};

  for (const article of ARTICLES) {
    log(`--- ${article.slug} ---`);
    console.log(`\n📌 ${article.slug}`);
    publishedUrls[article.slug] = [];
    const jsonPath = path.join(DATA_DIR, `${article.slug}.json`);

    for (let pinIdx = 0; pinIdx < article.pins.length; pinIdx++) {
      const pin = article.pins[pinIdx];
      const pinNum = pinIdx + 1;
      const imagePath = path.join(PINS_DIR, `${article.slug}-pin-${pinNum}.png`);
      if (!fs.existsSync(imagePath)) { log(`Image not found`); totalFail++; continue; }

      console.log(`   📤 Pin ${pinNum}: ${pin.title.substring(0, 40)}...`);
      let success = false, publishedUrl = null;

      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          await page.goto('https://www.pinterest.com/pin-creation-tool/', {
            waitUntil: 'domcontentloaded', timeout: 30000
          }).catch(() => {});
          await sleep(6000);

          // Upload image
          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.isVisible({ timeout: 15000 }).catch(() => false)) {
            await fileInput.setInputFiles(imagePath);
            log(`Uploaded`);
            await sleep(5000);
          } else {
            log('File input not visible');
            await page.screenshot({ path: `/tmp/pin-fail5-${article.slug}-${pinNum}.png` });
            continue;
          }

          await sleep(3000);

          // Fill title
          try {
            const tf = page.locator('input[placeholder*="Tell everyone"], input[placeholder*="Add your title"]');
            if (await tf.isVisible({ timeout: 3000 }).catch(() => false)) await tf.fill(pin.title);
          } catch(e) {}

          // Fill link
          try {
            const lf = page.locator('input[placeholder*="Add a link"], input[placeholder*="destination link"]');
            if (await lf.isVisible({ timeout: 3000 }).catch(() => false)) await lf.fill(article.post_url);
          } catch(e) {}

          // Fill description
          try {
            await page.evaluate((desc) => {
              const ce = document.querySelector('[contenteditable="true"]');
              if (ce) ce.textContent = desc + ' — Full guide at MomBabyPicks.com';
            }, pin.desc);
          } catch(e) {}

          await sleep(2000);

          // Click Save/Publish
          try {
            await page.evaluate(() => {
              const labels = ['Publish', 'Save', 'Save Pin'];
              for (const el of document.querySelectorAll('button, div[role="button"]')) {
                if (labels.includes(el.textContent?.trim()) && el.offsetParent !== null) {
                  el.click(); return true;
                }
              }
              const btn = document.querySelector('[data-test-id="save-pin-button"], [data-test-id="board-save-button"]');
              if (btn) { btn.click(); return true; }
              return false;
            });
          } catch(e) {}

          // Wait and check URL
          for (let w = 0; w < 15; w++) {
            await sleep(2000);
            const url = page.url();
            const m = url.match(/pinterest\.com\/pin\/(\d+)/);
            if (m) {
              publishedUrl = `https://www.pinterest.com/pin/${m[1]}/`;
              success = true;
              break;
            }
          }

          if (!success) {
            await page.screenshot({ path: `/tmp/pin-fail5-${article.slug}-${pinNum}-b.png` });
          }
        } catch(e) { log(`Error: ${e.message}`); }
      }

      if (success && publishedUrl) {
        publishedUrls[article.slug].push({ pinNum, url: publishedUrl });
        totalOk++;
        console.log(`   ✅ ${publishedUrl}`);
      } else { totalFail++; console.log(`   ❌ Failed`); }
    }

    // Update JSON
    try {
      const existingJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      for (const p of publishedUrls[article.slug] || []) {
        const idx = p.pinNum - 1;
        if (idx < existingJson.length) { existingJson[idx].status = 'published'; existingJson[idx].published_pin_url = p.url; }
      }
      fs.writeFileSync(jsonPath, JSON.stringify(existingJson, null, 2) + '\n');
      console.log(`   💾 JSON updated`);
    } catch(e) { log(`JSON error: ${e.message}`); }
  }

  log(`DONE: ${totalOk} pub, ${totalFail} fail`);
  console.log(`\n✅ ${totalOk} pins published`);
  if (totalFail > 0) console.log(`❌ ${totalFail} pins failed`);
  for (const [slug, pins] of Object.entries(publishedUrls)) {
    if (pins.length) { console.log(`  ${slug}:`); for (const p of pins) console.log(`    Pin ${p.pinNum}: ${p.url}`); }
  }
  await browser.close();

  // Clean up temp profile
  try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch(e) {}

  return totalFail === 0;
}

main().then(ok => process.exit(ok ? 0 : 1)).catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

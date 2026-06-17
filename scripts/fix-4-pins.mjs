/**
 * fix-4-pins.mjs — Upload pins for the 4 FAIL articles, capture published URLs, update JSON
 * 
 * Connects to running Chrome at localhost:9222 (CDP).
 * For each of the 4 articles, uploads 3 pins to Pinterest,
 * captures the published pin URL, and updates the JSON status file.
 */

import { chromium } from 'playwright';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-4-log.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11,19)+' '+m+'\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ARTICLES = [
  {
    slug: 'best-baby-bath-tubs-2026',
    title: 'Best Baby Bath Tubs 2026',
    post_url: 'https://mombabypicks.com/posts/best-baby-bath-tubs-2026/',
    pins: [
      { title: 'Best Baby Bath Tubs 2026: Safe & Easy Options for Newborns to Toddlers', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
      { title: 'Top Baby Bath Tubs 2026: Newborn to Toddler Picks', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
      { title: 'Best Baby Bath Tubs for Safe & Easy Bath Time', desc: 'The best baby bath tubs of 2026 tested for safety, ease of cleaning, and longevity.' },
    ],
  },
  {
    slug: 'best-baby-play-mats-2026',
    title: 'Best Baby Play Mats 2026',
    post_url: 'https://mombabypicks.com/posts/best-baby-play-mats-2026/',
    pins: [
      { title: 'Best Baby Play Mats 2026: Safe & Soft Options for Tummy Time & Play', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
      { title: 'Top Baby Play Mats 2026: The Complete Guide', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
      { title: 'Best Play Mats for Tummy Time & Crawling 2026', desc: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play.' },
    ],
  },
  {
    slug: 'best-baby-swings-2026',
    title: 'Best Baby Swings 2026',
    post_url: 'https://mombabypicks.com/posts/best-baby-swings-2026/',
    pins: [
      { title: 'Best Baby Swings 2026: Soothe Your Baby with the Right Swing', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
      { title: 'Top Baby Swings 2026: Our Picks for Every Budget', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
      { title: 'Which Baby Swing Is Best? 2026\'s Top 5 Reviewed', desc: 'The best baby swings of 2026 compared for motion, safety, and value.' },
    ],
  },
  {
    slug: 'best-infant-car-seats-2026',
    title: 'Best Infant Car Seats 2026',
    post_url: 'https://mombabypicks.com/posts/best-infant-car-seats-2026/',
    pins: [
      { title: 'Best Infant Car Seats 2026: Safety Ratings, Installation & Budget Picks', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
      { title: 'Top Infant Car Seats 2026: Safety & Value Compared', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
      { title: 'Which Infant Car Seat is Safest? 2026 Guide', desc: 'The best infant car seats of 2026 compared for safety ratings, ease of installation, and value.' },
    ],
  },
];

function getWS() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d).webSocketDebuggerUrl); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  log('='.repeat(60));
  log('START - Fix 4 Pinterest FAIL articles');
  log('='.repeat(60));

  // Connect to running Chrome via CDP
  const ws = await getWS();
  log(`CDP connected: ${ws.substring(0, 60)}...`);
  const browser = await chromium.connectOverCDP(ws);
  
  // Use existing page or create new one
  const contexts = browser.contexts();
  let page;
  if (contexts.length > 0) {
    const pages = contexts[0].pages();
    page = pages.length > 0 ? pages[0] : await contexts[0].newPage();
  } else {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
  }

  // First navigate to Pinterest to check if logged in
  log('Checking Pinterest login status...');
  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(3000);
  
  const currentUrl = page.url();
  log(`Current URL: ${currentUrl}`);
  
  // Check if we're logged in (Pinterest redirects to login if not)
  if (currentUrl.includes('login') || currentUrl.includes('www.pinterest.com')) {
    // If we're on www.pinterest.com (homepage) we're probably logged in
    // If redirected to login, we have a problem
    if (currentUrl.includes('login')) {
      log('FATAL: Not logged into Pinterest!');
      console.log('❌ Not logged into Pinterest. Need to log in first.');
      await browser.close();
      process.exit(1);
    }
    log('✅ Pinterest appears to be logged in');
  }

  let totalOk = 0;
  let totalFail = 0;
  const publishedUrls = {};

  for (const article of ARTICLES) {
    log(`--- Processing ${article.slug} ---`);
    console.log(`\n📌 ${article.slug}`);
    
    const jsonPath = path.join(DATA_DIR, `${article.slug}.json`);
    if (!fs.existsSync(jsonPath)) {
      log(`JSON not found: ${jsonPath}`);
      console.log(`   ❌ JSON not found`);
      continue;
    }
    
    publishedUrls[article.slug] = [];
    
    for (let pinIdx = 0; pinIdx < article.pins.length; pinIdx++) {
      const pin = article.pins[pinIdx];
      const pinNum = pinIdx + 1;
      const imageFile = `${article.slug}-pin-${pinNum}.png`;
      const imagePath = path.join(PINS_DIR, imageFile);
      
      if (!fs.existsSync(imagePath)) {
        log(`Image not found: ${imagePath}`);
        console.log(`   ⏭️ Pin ${pinNum} - image not found, skipping`);
        totalFail++;
        continue;
      }
      
      console.log(`   📤 Pin ${pinNum}: ${pin.title.substring(0, 40)}...`);
      
      let success = false;
      let publishedUrl = null;
      
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          // Navigate to pin creation tool
          await page.goto('https://www.pinterest.com/pin-creation-tool/', { 
            waitUntil: 'domcontentloaded', timeout: 30000 
          }).catch(() => {});
          await sleep(4000);
          
          // Find and upload the image file
          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.isVisible({ timeout: 10000 }).catch(() => false)) {
            await fileInput.setInputFiles(imagePath);
            log(`Uploaded ${imageFile}`);
            await sleep(5000);
          } else {
            log(`File input not visible for ${imageFile}`);
            await page.screenshot({ path: `/tmp/pin-fail-${article.slug}-${pinNum}-a.png` });
            continue;
          }
          
          // Wait for Pinterest to process the image
          await sleep(3000);
          
          // Fill title
          const titleField = page.locator('input[placeholder*="Tell everyone"], input[placeholder*="Add your title"]');
          if (await titleField.isVisible({ timeout: 5000 }).catch(() => false)) {
            await titleField.fill(pin.title);
            log(`Filled title`);
          }
          
          // Fill destination link
          const linkField = page.locator('input[placeholder*="Add a link"], input[placeholder*="destination link"]');
          if (await linkField.isVisible({ timeout: 5000 }).catch(() => false)) {
            await linkField.fill(article.post_url);
            log(`Filled link`);
          }
          
          // Fill description if possible
          await page.evaluate((desc) => {
            const ce = document.querySelector('[contenteditable="true"]');
            if (ce) {
              ce.textContent = desc + ' — Full guide at MomBabyPicks.com';
            }
          }, pin.desc);
          
          await sleep(2000);
          
          // Take screenshot before clicking publish
          // await page.screenshot({ path: `/tmp/pin-before-${article.slug}-${pinNum}.png` });
          
          // Click Publish
          const clickResult = await page.evaluate(() => {
            const all = document.querySelectorAll('button, div[role="button"], a');
            for (const el of all) {
              const txt = el.textContent?.trim() || '';
              if ((txt === 'Publish' || txt === 'Save' || txt === 'Save Pin') && el.offsetParent !== null) {
                el.click();
                return 'clicked: ' + txt;
              }
            }
            // Try data-test-id selectors
            const pubBtn = document.querySelector('[data-test-id="save-pin-button"], [data-test-id="board-save-button"]');
            if (pubBtn) { pubBtn.click(); return 'clicked: data-test-id'; }
            return 'not found';
          });
          
          log(`Publish click: ${clickResult}`);
          
          // Wait for navigation/redirect after publishing
          await sleep(8000);
          
          // Check the current URL to capture the published pin URL
          const afterUrl = page.url();
          log(`After publish URL: ${afterUrl}`);
          
          // Pinterest typically navigates to the pin page after creation
          // URL format: https://www.pinterest.com/pin/123456789012345678/
          const pinMatch = afterUrl.match(/pinterest\.com\/pin\/(\d+)/);
          if (pinMatch) {
            publishedUrl = `https://www.pinterest.com/pin/${pinMatch[1]}/`;
            log(`✅ Published: ${publishedUrl}`);
            success = true;
          } else if (afterUrl.includes('pin-creation-tool')) {
            // Still on creation tool - maybe the pin was created but we're back here
            // Try checking the page for a success message or the pin URL
            log('Still on pin-creation-tool after publish');
            await sleep(3000);
            
            // Check again
            const url2 = page.url();
            const pinMatch2 = url2.match(/pinterest\.com\/pin\/(\d+)/);
            if (pinMatch2) {
              publishedUrl = `https://www.pinterest.com/pin/${pinMatch2[1]}/`;
              log(`✅ Published (retry): ${publishedUrl}`);
              success = true;
            }
          } else if (afterUrl.includes('pinterest.com')) {
            // Check URL for pin ID in any format
            const anyPinMatch = afterUrl.match(/pin\/(\d+)/);
            if (anyPinMatch) {
              publishedUrl = `https://www.pinterest.com/pin/${anyPinMatch[1]}/`;
              log(`✅ Published (from any): ${publishedUrl}`);
              success = true;
            }
          }
          
          if (!success) {
            log(`Pin ${pinNum} attempt ${attempt + 1} failed, URL: ${afterUrl}`);
            await page.screenshot({ path: `/tmp/pin-fail-${article.slug}-${pinNum}.png` });
          }
          
        } catch (e) {
          log(`Error on pin ${pinNum} attempt ${attempt + 1}: ${e.message}`);
        }
        
        if (!success) {
          await sleep(3000);
        }
      }
      
      if (success && publishedUrl) {
        publishedUrls[article.slug].push({
          pinNum,
          url: publishedUrl,
          title: pin.title,
        });
        totalOk++;
        console.log(`   ✅ Published: ${publishedUrl}`);
      } else {
        totalFail++;
        console.log(`   ❌ Failed after 3 attempts`);
      }
    }
    
    // Update JSON file with published URLs
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const updatedPins = publishedUrls[article.slug];
    
    for (const p of updatedPins) {
      const idx = p.pinNum - 1;
      if (idx < existingJson.length) {
        existingJson[idx].status = 'published';
        existingJson[idx].published_pin_url = p.url;
        log(`Updated JSON pin ${p.pinNum}: status=published, url=${p.url}`);
      }
    }
    
    fs.writeFileSync(jsonPath, JSON.stringify(existingJson, null, 2) + '\n');
    log(`JSON saved: ${jsonPath}`);
    console.log(`   💾 JSON updated: ${article.slug}.json`);
  }
  
  log('='.repeat(60));
  log(`DONE: ${totalOk} published, ${totalFail} failed`);
  log('='.repeat(60));
  
  console.log(`\n✅ ${totalOk} pins published successfully`);
  if (totalFail > 0) console.log(`❌ ${totalFail} pins failed`);
  console.log('\n📋 Published URLs:');
  for (const [slug, pins] of Object.entries(publishedUrls)) {
    console.log(`  ${slug}:`);
    for (const p of pins) {
      console.log(`    Pin ${p.pinNum}: ${p.url}`);
    }
  }
  
  await browser.close();
  log('Browser closed');
  
})().catch(e => {
  log('FATAL: ' + e.message);
  console.error('FATAL:', e.message);
  process.exit(1);
});

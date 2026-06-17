import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';

const PROFILE_DIR = path.join(os.homedir(), '.hermes/browser-profile');
const PINS_DIR = path.join(os.homedir(), 'GIT/PP/mombabypicks/static/images/pins');
const SLUG = 'best-baby-play-mats-2026';
const POST_URL = 'https://mombabypicks.com/posts/best-baby-play-mats-2026/';
const LOG = '/tmp/pin-upload-v3.txt';
const log = m => fs.appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+m+'\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

fs.writeFileSync(LOG, '');

const PINS = [
  {
    image: `${SLUG}-pin-1.png`,
    title: 'Best Baby Play Mats 2026: Safe & Soft Options for Tummy Time & Play',
    description: 'The best baby play mats of 2026 for tummy time, crawling, and sensory play. We tested Lovevery, Fisher-Price, MioTetto, Infantino, and Nuby.',
  },
  {
    image: `${SLUG}-pin-2.png`,
    title: 'Top Baby Play Mats for 2026: Tummy Time, Crawling & Sensory Play',
    description: 'Looking for the best baby play mat? Our 2026 guide reviews Lovevery, Fisher-Price, MioTetto, and more — find the perfect mat for your baby.',
  },
  {
    image: `${SLUG}-pin-3.png`,
    title: 'Best Baby Play Mats 2026: Tested Picks for Tummy Time & Play',
    description: 'We tested the top baby play mats of 2026. From Lovevery to Nuby, find safe, soft, and engaging play mats for your little one.',
  },
];

async function getPinterestCookies() {
  // Extract cookies from the main Chrome profile using sqlite3
  const cookiesPath = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Cookies');
  
  // Use sqlite3 to query Pinterest cookies
  const query = `
    SELECT name, encrypted_value, host_key, path, is_secure, is_httponly, has_expires, expires_utc 
    FROM cookies 
    WHERE host_key LIKE '%pinterest%' OR host_key LIKE '%pinimg%'
  `;
  
  // We can't easily decrypt Chrome cookies because they're encrypted with Chrome's internal key
  // But we can copy the cookies database and use it with a Playwright session
  log('Cookies database found, but cannot decrypt Chrome encrypted cookies via SQLite directly');
  return null;
}

async function copyChromeCookies() {
  // Strategy: Launch Playwright with the main Chrome profile's user data dir
  // This won't work if Chrome is already running (profile locked)
  
  // Alternative: use the Chrome debug instance's profile which we killed earlier
  // But that profile didn't have Pinterest cookies
  
  // Let's try to start Chrome in a new temp profile and copy cookies?
  
  log('Attempting alternative approach...');
  return false;
}

(async () => {
  log('START - v3 cookie approach');
  console.log('='.repeat(60));
  console.log('PIN UPLOAD - best-baby-play-mats-2026');
  console.log('='.repeat(60));
  
  // Approach: copy the Chrome Default profile cookies DB to a temp location
  // and launch Playwright with a profile that reads from it
  // This won't work directly because cookies are encrypted with Chrome's master key
  
  // Instead, let's use a different strategy:
  // Try to launch with the main Chrome profile directory directly
  // but Chrome might be running
  
  // Check if Chrome is running
  const chromeRunning = execSync('pgrep -x "Google Chrome" || true').toString().trim();
  
  if (chromeRunning) {
    console.log('Chrome is running. Attempting to extract cookies via AppleScript...');
    
    // Use osascript to ask Chrome to navigate to Pinterest and get cookies?
    // Actually, let's use a different approach - use the CDP to connect to the running Chrome
    // Restart Chrome with remote debugging
    
    console.log('Please close Chrome manually, or I can try to restart it with remote debugging...');
    
    // Let's try to use AppleScript to get the cookies from Chrome
    // This requires the user to grant permissions
    
    log('Chrome is running - need to restart with remote debugging');
    console.log('\n⚠️  Chrome is currently running without remote debugging.');
    console.log('   I need to restart it with CDP enabled to access Pinterest cookies.');
    console.log('\n   Option 1: You can close Chrome manually, then I will restart it.');
    console.log('   Option 2: I can provide credentials if you tell me them.\n');
    
    log('Cannot proceed - needs user action');
    process.exit(0);
  }
  
  // Chrome not running, proceed with launch
  log('Proceeding...');
  
})().catch(e => {
  console.error('FATAL:', e.message);
  log('FATAL: ' + e.message);
  process.exit(1);
});

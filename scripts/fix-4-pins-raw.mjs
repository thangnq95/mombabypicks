/**
 * fix-4-pins-raw.mjs — Upload 4 FAIL pins using raw Chrome DevTools Protocol
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PINS_DIR = path.join(REPO, 'static/images/pins');
const DATA_DIR = path.join(REPO, 'data/pinterest');
const LOG_FILE = '/tmp/pin-fix-4-raw.txt';
const log = m => fs.appendFileSync(LOG_FILE, new Date().toISOString().slice(11,19)+' '+m+'\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let msgId = 0;

function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    const handler = (event) => {
      const raw = typeof event === 'string' ? event : (event.data || event);
      try {
        const resp = JSON.parse(raw.toString());
        if (resp.id === id) {
          ws.removeEventListener('message', handler);
          if (resp.error) reject(new Error(resp.error.message));
          else resolve(resp);
        }
      } catch(e) { /* ignore non-JSON messages */ }
    };
    ws.addEventListener('message', handler);
    setTimeout(() => { ws.removeEventListener('message', handler); reject(new Error('Timeout')); }, 30000);
  });
}

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
  log('START fix-4-pins (raw CDP v2)');
  log('='.repeat(60));

  // Get WS URL from CDP
  const wsUrl = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d).webSocketDebuggerUrl); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
  log(`WS: ${wsUrl}`);

  // Connect to CDP WebSocket
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('WS error')));
    setTimeout(() => reject(new Error('WS timeout')), 10000);
  });
  log('CDP connected');

  // Create a new page target (don't attach — we'll use it via its targetId)
  const createResult = await send(ws, 'Target.createTarget', {
    url: 'about:blank',
    newWindow: true,
    background: false
  });
  const targetId = createResult.result.targetId;
  log(`Target: ${targetId}`);

  // Helper: send to target directly (flat protocol — messages go directly with sessionId)
  async function sendTarget(method, params = {}) {
    return send(ws, method, params);
  }

  // Enable necessary domains on the target
  await sendTarget('Target.attachToTarget', { targetId, flatten: true });
  // After attachToTarget with flatten=true, we need to send messages with sessionId
  // Actually, with flatten=true, all messages for this target should include sessionId at top level
  // But we're sending to the browser-level WebSocket. For target messages we use Target.sendMessageToTarget
  
  // Actually, let me detach and re-attach without flatten
  await sendTarget('Target.detachFromTarget', { targetId });
  
  // Re-attach without flatten
  const attachResult = await sendTarget('Target.attachToTarget', { targetId });
  const sessionId = attachResult.result.sessionId;
  log(`Session: ${sessionId}`);

  // Send message to the target session
  async function sessionCall(method, params = {}) {
    const id = ++msgId;
    ws.send(JSON.stringify({
      id,
      method: 'Target.sendMessageToTarget',
      params: {
        sessionId,
        message: JSON.stringify({ id, method, params })
      }
    }));
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        const raw = typeof event === 'string' ? event : (event.data || event);
        try {
          const resp = JSON.parse(raw.toString());
          // Responses for sendMessageToTarget have the inner message in .message
          if (resp.id === id) {
            ws.removeEventListener('message', handler);
            if (resp.error) reject(new Error(resp.error.message));
            else {
              try {
                const inner = JSON.parse(resp.result.message);
                resolve(inner);
              } catch(e) {
                resolve(resp.result);
              }
            }
          }
        } catch(e) {}
      };
      ws.addEventListener('message', handler);
      setTimeout(() => { ws.removeEventListener('message', handler); reject(new Error('Timeout')); }, 30000);
    });
  }

  // Navigate to Pinterest
  await sessionCall('Page.enable');
  await sessionCall('Page.navigate', { url: 'https://www.pinterest.com/' });
  await sleep(5000);

  const urlResult = await sessionCall('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true
  });
  const currentUrl = urlResult.result?.value || '';
  log(`URL: ${currentUrl}`);
  console.log(`URL: ${currentUrl}`);

  if (currentUrl.includes('login')) {
    log('❌ Not logged in');
    console.log('❌ Pinterest login required');
    ws.close();
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

      console.log(`   📤 Pin ${pinNum}...`);
      let success = false, publishedUrl = null;

      for (let attempt = 0; attempt < 2 && !success; attempt++) {
        try {
          // Navigate to pin creation
          await sessionCall('Page.navigate', { url: 'https://www.pinterest.com/pin-creation-tool/' });
          await sleep(6000);

          // Find file input and upload
          const fiCheck = await sessionCall('Runtime.evaluate', {
            expression: `(() => {
              const fi = document.querySelector('input[type="file"]');
              if (fi && fi.offsetParent !== null) return 'visible';
              if (fi) return 'hidden';
              return 'notfound';
            })()`,
            returnByValue: true
          });
          log(`File input: ${fiCheck.result?.value}`);

          if (fiCheck.result?.value === 'notfound') {
            // Maybe need to click Create button first
            await sessionCall('Runtime.evaluate', {
              expression: `document.querySelector('[data-test-id="create-pin-button"], button:has(svg), .uploadBtn')?.click()`
            });
            await sleep(3000);
          }

          // Get file input node
          const nodeResult = await sessionCall('DOM.getDocument', { depth: 0 });
          const rootNodeId = nodeResult.result.root.nodeId;

          // Find file input via query
          const queryResult = await sessionCall('DOM.querySelector', {
            nodeId: rootNodeId,
            selector: 'input[type="file"]'
          });

          if (queryResult.result.nodeId) {
            await sessionCall('DOM.setFileInputFiles', {
              nodeId: queryResult.result.nodeId,
              files: [imagePath]
            });
            log('File uploaded');
            await sleep(5000);
          } else {
            log('File input node not found');
            continue;
          }

          await sleep(3000);

          // Fill title
          const titleResult = await sessionCall('DOM.querySelector', {
            nodeId: rootNodeId,
            selector: 'input[placeholder*="Tell everyone"], input[placeholder*="Add your title"]'
          });
          if (titleResult.result.nodeId) {
            await sessionCall('DOM.setAttributeValue', {
              nodeId: titleResult.result.nodeId,
              name: 'value',
              value: pin.title
            });
          } else {
            // Try Input.insertText
            await sessionCall('Runtime.evaluate', {
              expression: `document.querySelector('input[placeholder*="Tell everyone"], input[placeholder*="Add your title"]')?.focus()`
            });
            await sleep(300);
            await sessionCall('Input.insertText', { text: pin.title.substring(0, 100) });
          }

          // Fill link
          const linkResult = await sessionCall('DOM.querySelector', {
            nodeId: rootNodeId,
            selector: 'input[placeholder*="Add a link"], input[placeholder*="destination link"]'
          });
          if (linkResult.result.nodeId) {
            await sessionCall('DOM.setAttributeValue', {
              nodeId: linkResult.result.nodeId,
              name: 'value',
              value: article.post_url
            });
          } else {
            await sessionCall('Runtime.evaluate', {
              expression: `document.querySelector('input[placeholder*="Add a link"], input[placeholder*="destination link"]')?.focus()`
            });
            await sleep(300);
            await sessionCall('Input.insertText', { text: article.post_url });
          }

          // Fill description
          await sessionCall('Runtime.evaluate', {
            expression: `document.querySelector('[contenteditable="true"]')?.focus()`
          });
          await sleep(300);
          await sessionCall('Input.insertText', { text: pin.desc + ' — Full guide at MomBabyPicks.com' });

          await sleep(2000);

          // Click Save/Publish button
          await sessionCall('Runtime.evaluate', {
            expression: `(() => {
              const labels = ['Publish', 'Save', 'Save Pin'];
              for (const el of document.querySelectorAll('button, div[role="button"]')) {
                if (labels.includes(el.textContent?.trim()) && el.offsetParent !== null) {
                  el.click(); return true;
                }
              }
              const btn = document.querySelector('[data-test-id="save-pin-button"], [data-test-id="board-save-button"]');
              if (btn) { btn.click(); return true; }
              return false;
            })()`
          });

          // Wait and check for pin URL
          for (let w = 0; w < 15; w++) {
            await sleep(2000);
            const urlCheck = await sessionCall('Runtime.evaluate', {
              expression: 'window.location.href',
              returnByValue: true
            });
            const url = urlCheck.result?.value || '';
            const m = url.match(/pinterest\.com\/pin\/(\d+)/);
            if (m) {
              publishedUrl = `https://www.pinterest.com/pin/${m[1]}/`;
              success = true;
              log(`Published! ${publishedUrl}`);
              break;
            }
          }

          if (!success) {
            log(`Pin ${pinNum} failed`);
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
  ws.close();
  return totalFail === 0;
}

main().then(ok => process.exit(ok ? 0 : 1)).catch(e => { console.error('FATAL:', e.message); process.exit(1); });

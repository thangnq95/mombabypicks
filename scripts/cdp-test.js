// CDP Test — Launch Chrome with debug port and verify
const { chromium } = require('playwright');
const http = require('http');

function checkPort() {
  return new Promise((resolve) => {
    http.get('http://localhost:9222/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

(async () => {
  console.log('🚀 Launching Chrome with CDP...');
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--remote-debugging-port=9222', '--no-first-run'],
  });

  // Wait for port
  let info = null;
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    info = await checkPort();
    if (info) break;
  }

  if (info) {
    console.log('✅ CDP Connected!');
    console.log(`   Browser: ${info.Browser}`);
    console.log(`   WS URL: ${info.webSocketDebuggerUrl?.substring(0, 60)}...`);

    // Set Hermes config
    const { execSync } = require('child_process');
    execSync('hermes config set browser.cdp_url http://localhost:9222', { stdio: 'inherit' });
    console.log('✅ CDP config set in Hermes');
  } else {
    console.log('❌ CDP port not available');
  }

  console.log('\n⏳ Browser stays open. Press Ctrl+C when done.');
  await new Promise(r => setTimeout(r, 600000));
  await browser.close();
})().catch(e => console.error('❌', e.message));

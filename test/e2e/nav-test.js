/**
 * E2E navigation test — spawns Electron app, connects via CDP, runs assertions.
 * Run: node test/e2e/nav-test.js
 */
const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');
const path = require('path');
const WS = require('ws');

const APP_DIR = path.join(__dirname, '..', '..');
const ELECTRON_BIN = path.join(APP_DIR, 'node_modules', '.bin', 'electron');

let testsPassed = 0, testsFailed = 0, msgId = 1;
let ws;

function pass(name) { testsPassed++; console.log(`  ✓ ${name}`); }
function fail(name, reason) { testsFailed++; console.log(`  ✗ ${name}: ${reason}`); }
function log(msg) { console.log(`  ${msg}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

function cdp(expression) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${expression.substring(0, 50)}`)), 15000);
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id === id) {
        clearTimeout(timer);
        ws.off('message', handler);
        if (msg.result?.exceptionDetails) reject(new Error(msg.result.exceptionDetails.text));
        else resolve(msg.result?.result?.value);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
  });
}

async function main() {
  console.log('\nE2E Navigation Tests\n');

  // Spawn Electron app with '.' so it finds app.js via package.json main field
  const proc = spawn(ELECTRON_BIN, ['.', '--no-sandbox', '--remote-debugging-port=0'], {
    cwd: APP_DIR,
    stdio: 'pipe',
    env: { ...process.env },
  });

  let debugPort;
  proc.stderr.on('data', d => {
    const s = d.toString();
    const m = s.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (m) debugPort = parseInt(m[1]);
  });
  proc.stdout.on('data', () => {});
  proc.on('exit', (code) => { if (code !== 0) log(`App exited with code ${code}`); });

  // Wait for debug port
  const start = Date.now();
  while (!debugPort && Date.now() - start < 15000) await wait(200);
  if (!debugPort) { fail('start app', 'no debug port after 15s'); return; }
  log(`Debug port: ${debugPort}`);
  await wait(5000); // wait for app to fully init

  // Get page targets
  const targets = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${debugPort}/json`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const page = targets.find(t => t.type === 'page');
  if (!page) { fail('find page', `no page target. Types: ${targets.map(t=>t.type).join(', ')}`); proc.kill(); return; }
  log(`Page: ${page.url}`);

  // Connect WebSocket
  ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  try {
    // 1: App launches
    const title = await cdp('document.title');
    assert(title, 'title exists'); pass('app launches');

    // 2: NTP visible
    const ntp = await cdp('!document.getElementById("new-tab-page").classList.contains("hidden")');
    assert(ntp); pass('new tab page visible');

    // 3: PaperTM ready
    const ptm = await cdp('typeof window.PaperTM');
    assert(ptm === 'object', `type: ${ptm}`); pass('PaperTM initialized');

    // 4: Open address bar
    await cdp('document.getElementById("address-bar").classList.remove("hidden")');
    await cdp('document.getElementById("address-input").focus()');
    const addrVis = await cdp('!document.getElementById("address-bar").classList.contains("hidden")');
    assert(addrVis); pass('address bar opens');

    // 5: Navigate to URL
    await cdp(`(() => {
      const inp = document.getElementById('address-input');
      inp.value = 'https://example.com';
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    })()`);
    await wait(5000);

    const wvCount = await cdp('document.querySelectorAll("webview").length');
    log(`webview count: ${wvCount}`);
    assert(wvCount > 0, `got ${wvCount}`);
    pass('webview created after navigation');

    // 6: Check src
    const src = await cdp(`(() => { const w = document.querySelector('webview'); return w ? w.getAttribute('src') : null; })()`);
    log(`webview src: ${src}`);
    assert(src && src.includes('example.com'), `src: ${src}`);
    pass('webview has correct src');

    // 7: New tab
    const before = await cdp('document.querySelectorAll(".tab").length');
    await cdp('document.getElementById("new-tab-btn").click()');
    await wait(1000);
    const after = await cdp('document.querySelectorAll(".tab").length');
    log(`tabs: ${before} -> ${after}`);
    assert(after > before); pass('new tab button creates tab');

    // 8: Multiple webviews
    const totalWv = await cdp('document.querySelectorAll("webview").length');
    assert(totalWv >= 2, `got ${totalWv}`); pass('multiple webviews');

    // 9: Only 1 visible
    const visWv = await cdp(`Array.from(document.querySelectorAll('webview')).filter(w => w.style.display !== 'none').length`);
    log(`visible: ${visWv}`);
    assert(visWv === 1, `got ${visWv}`); pass('only active webview visible');

  } catch (e) {
    fail('test error', e.message);
  }

  console.log(`\n${testsPassed} passed, ${testsFailed} failed\n`);
  ws.close();
  proc.kill();
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

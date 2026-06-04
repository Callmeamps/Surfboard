# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test/e2e/navigation.test.js >> app launches and shows new tab page
- Location: test/e2e/navigation.test.js:25:1

# Error details

```
Error: electron.launch: Target page, context or browser has been closed
Browser logs:

<launching> /home/callmeamps/Projects/surfboard/riced-chromium/node_modules/electron/dist/electron -r /home/callmeamps/Projects/surfboard/riced-chromium/node_modules/playwright-core/lib/server/electron/loader.js --inspect=0 --remote-debugging-port=0 /home/callmeamps/Projects/surfboard/riced-chromium --no-sandbox
<launched> pid=60591
[pid=60591][err] Debugger listening on ws://127.0.0.1:37841/ea3c5e54-a05d-4001-8a93-1aae24296160
[pid=60591][err] For help, see: https://nodejs.org/en/docs/inspector
[pid=60591][err] Debugger attached.
[pid=60591][err] 
[pid=60591][err] DevTools listening on ws://127.0.0.1:37787/devtools/browser/8467c96d-40ee-4582-842a-8388bcbfe11e
[pid=60591][err] MESA-INTEL: warning: Ivy Bridge Vulkan support is incomplete
[pid=60591][err] Waiting for the debugger to disconnect...
Call log:
  - <launching> /home/callmeamps/Projects/surfboard/riced-chromium/node_modules/electron/dist/electron -r /home/callmeamps/Projects/surfboard/riced-chromium/node_modules/playwright-core/lib/server/electron/loader.js --inspect=0 --remote-debugging-port=0 /home/callmeamps/Projects/surfboard/riced-chromium --no-sandbox
  - <launched> pid=60591
  - [pid=60591][err] Debugger listening on ws://127.0.0.1:37841/ea3c5e54-a05d-4001-8a93-1aae24296160
  - [pid=60591][err] For help, see: https://nodejs.org/en/docs/inspector
  - <ws connecting> ws://127.0.0.1:37841/ea3c5e54-a05d-4001-8a93-1aae24296160
  - <ws connected> ws://127.0.0.1:37841/ea3c5e54-a05d-4001-8a93-1aae24296160
  - [pid=60591][err] Debugger attached.
  - [pid=60591][err]
  - [pid=60591][err] DevTools listening on ws://127.0.0.1:37787/devtools/browser/8467c96d-40ee-4582-842a-8388bcbfe11e
  - <ws connecting> ws://127.0.0.1:37787/devtools/browser/8467c96d-40ee-4582-842a-8388bcbfe11e
  - [pid=60591][err] MESA-INTEL: warning: Ivy Bridge Vulkan support is incomplete
  - <ws connected> ws://127.0.0.1:37787/devtools/browser/8467c96d-40ee-4582-842a-8388bcbfe11e
  - [pid=60591][err] Waiting for the debugger to disconnect...
  - <ws disconnecting> ws://127.0.0.1:37841/ea3c5e54-a05d-4001-8a93-1aae24296160
  - <ws disconnected> ws://127.0.0.1:37841/ea3c5e54-a05d-4001-8a93-1aae24296160 code=1005 reason=
  - <ws disconnected> ws://127.0.0.1:37787/devtools/browser/8467c96d-40ee-4582-842a-8388bcbfe11e code=1006 reason=
  - [pid=60591] <kill>
  - [pid=60591] <will force kill>
  - [pid=60591] <process did exit: exitCode=0, signal=null>
  - [pid=60591] starting temporary directories cleanup
  - [pid=60591] finished temporary directories cleanup

```

# Test source

```ts
  1  | const { _electron: electron } = require('playwright');
  2  | const { test, expect } = require('@playwright/test');
  3  | const path = require('path');
  4  | const APP_PATH = path.join(__dirname, '..', '..');
  5  | 
  6  | let app;
  7  | let page;
  8  | 
  9  | test.beforeAll(async () => {
> 10 |   app = await electron.launch({
     |         ^ Error: electron.launch: Target page, context or browser has been closed
  11 |     args: [APP_PATH, '--no-sandbox'],
  12 |     env: { ...process.env, NODE_ENV: 'test' },
  13 |   });
  14 | 
  15 |   // Wait for the first window with a longer timeout
  16 |   page = await app.firstWindow({ timeout: 30000 });
  17 |   await page.waitForLoadState('networkidle');
  18 |   await page.waitForTimeout(1000);
  19 | });
  20 | 
  21 | test.afterAll(async () => {
  22 |   if (app) await app.close();
  23 | });
  24 | 
  25 | test('app launches and shows new tab page', async () => {
  26 |   const ntp = page.locator('#new-tab-page');
  27 |   await expect(ntp).toBeVisible({ timeout: 10000 });
  28 | });
  29 | 
  30 | test('address bar opens on Ctrl+L', async () => {
  31 |   await page.keyboard.press('Control+l');
  32 |   const addrBar = page.locator('#address-bar');
  33 |   await expect(addrBar).not.toHaveClass(/hidden/);
  34 | });
  35 | 
  36 | test('can type URL in address bar and navigate', async () => {
  37 |   const addrInput = page.locator('#address-input');
  38 |   await addrInput.fill('https://example.com');
  39 |   await page.keyboard.press('Enter');
  40 |   await page.waitForTimeout(5000);
  41 | 
  42 |   // Check webview exists
  43 |   const webview = page.locator('webview').first();
  44 |   const count = await webview.count();
  45 |   expect(count).toBeGreaterThan(0);
  46 | });
  47 | 
  48 | test('webview has the correct src', async () => {
  49 |   const webview = page.locator('webview').first();
  50 |   const src = await webview.getAttribute('src');
  51 |   console.log('webview src:', src);
  52 |   expect(src).toContain('example.com');
  53 | });
  54 | 
  55 | test('new tab button creates a tab', async () => {
  56 |   const newTabBtn = page.locator('#new-tab-btn');
  57 |   await newTabBtn.click();
  58 |   await page.waitForTimeout(500);
  59 | 
  60 |   const tabs = page.locator('.tab');
  61 |   const count = await tabs.count();
  62 |   expect(count).toBeGreaterThanOrEqual(1);
  63 | });
  64 | 
```
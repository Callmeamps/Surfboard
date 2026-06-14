/**
 * UX Quality Audit — bead riced-chromium-7cc
 *
 * Covers: UI consistency, responsive layout, empty/loading/error states,
 * keyboard accessibility, animation smoothness.
 *
 * Run: npx jest test/e2e/ux-audit.test.js --forceExit --no-cache
 * Headless: xvfb-run npx jest test/e2e/ux-audit.test.js --forceExit --no-cache
 */

const { _electron: electron } = require('playwright');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LAUNCH_TIMEOUT = 60000;

/** @type {import('playwright').ElectronApplication} */
let electronApp;
/** @type {import('playwright').Page} */
let mainWindow;

async function launch() {
  electronApp = await electron.launch({
    args: ['.', '--no-sandbox'],
    cwd: PROJECT_ROOT,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  });
  mainWindow = await electronApp.firstWindow({ timeout: LAUNCH_TIMEOUT });

  // Skip extension background pages
  let title = await mainWindow.title();
  if (title.includes('Extension') || title.includes('Background')) {
    await new Promise(r => setTimeout(r, 3000));
    for (const w of electronApp.windows()) {
      const t = await w.title();
      if (!t.includes('Extension') && !t.includes('Background')) {
        mainWindow = w;
        break;
      }
    }
  }

  await mainWindow.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));
  await mainWindow.setViewportSize({ width: 1400, height: 900 });
}

async function screenshot(name) {
  await mainWindow.screenshot({ path: `/tmp/ux-audit-${name}.png` });
}

/** @param {boolean} condition */
function assert(condition, msg) {
  if (!condition) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

// ═══════════════════════════════════════════════════════════
// 1. UI CONSISTENCY
// ═══════════════════════════════════════════════════════════

test('UI consistency — sidebar elements', async () => {
  for (const sel of [
    '#sidebar', '#sidebar-toggle', '#new-tab-btn',
    '#window-minimize', '#window-maximize', '#window-close',
    '#sidebar-history-btn', '#sidebar-settings-btn', '#sidebar-profile-btn',
  ]) {
    assert(await mainWindow.$(sel) !== null, `${sel} exists`);
  }
});

test('UI consistency — right sidebar buttons', async () => {
  const ids = [
    '#rsidebar-ai', '#rsidebar-shell', '#rsidebar-edit', '#rsidebar-inspect',
    '#rsidebar-actions', '#rsidebar-data', '#rsidebar-workflows', '#rsidebar-miniapps',
    '#rsidebar-omnibar', '#rsidebar-extensions', '#rsidebar-bookmark',
  ];
  let found = 0;
  for (const id of ids) {
    if (await mainWindow.$(id)) found++;
  }
  assert(found >= 9, `right sidebar buttons: ${found}/11`);
});

test('UI consistency — address bar + tab list + content area', async () => {
  assert(await mainWindow.$('#address-bar') !== null, '#address-bar exists');
  assert(await mainWindow.$('#address-input') !== null, '#address-input exists');
  assert(await mainWindow.$('#tab-list') !== null, '#tab-list exists');
  assert(await mainWindow.$('#content-area') !== null, '#content-area exists');
  assert(await mainWindow.$('#webview-container') !== null, '#webview-container exists');
});

test('UI consistency — new tab page elements', async () => {
  assert(await mainWindow.$('#new-tab-page') !== null, '#new-tab-page exists');
  assert(await mainWindow.$('#new-tab-logo') !== null, '#new-tab-logo exists');
  assert(await mainWindow.$('#new-tab-input') !== null, '#new-tab-input exists');
  assert(await mainWindow.$('#new-tab-quicklinks') !== null, '#new-tab-quicklinks exists');
});

test('UI consistency — sidecar and canvas host exist', async () => {
  assert(await mainWindow.$('#sidecar') !== null, '#sidecar exists');
  assert(await mainWindow.$('#canvas-host') !== null, '#canvas-host exists');
});

// ═══════════════════════════════════════════════════════════
// 2. RESPONSIVE LAYOUT
// ═══════════════════════════════════════════════════════════

test('responsive — narrow viewport 800x600', async () => {
  await mainWindow.setViewportSize({ width: 800, height: 600 });
  await new Promise(r => setTimeout(r, 300));

  // Content area and webview must still be present
  assert(await mainWindow.$('#content-area') !== null, '#content-area at 800px');
  assert(await mainWindow.$('#webview-container') !== null, '#webview-container at 800px');
  assert(await mainWindow.$('#new-tab-page') !== null, '#new-tab-page at 800px');

  await screenshot('narrow-800');
  await mainWindow.setViewportSize({ width: 1400, height: 900 });
});

test('responsive — wide viewport 1920x1080', async () => {
  await mainWindow.setViewportSize({ width: 1920, height: 1080 });
  await new Promise(r => setTimeout(r, 300));

  assert(await mainWindow.$('#sidebar') !== null, '#sidebar at 1920px');
  assert(await mainWindow.$('#content-area') !== null, '#content-area at 1920px');
  assert(await mainWindow.$('#right-sidebar') !== null, '#right-sidebar at 1920px');

  await screenshot('wide-1920');
  await mainWindow.setViewportSize({ width: 1400, height: 900 });
});

test('responsive — sidebar toggle collapse/expand', async () => {
  const toggle = await mainWindow.$('#sidebar-toggle');
  assert(toggle !== null, '#sidebar-toggle exists');

  // Collapse
  await mainWindow.evaluate(el => el.click(), toggle);
  await new Promise(r => setTimeout(r, 400));

  const sidebar = await mainWindow.$('#sidebar');
  const collapsed = sidebar
    ? await sidebar.evaluate(el => el.classList.contains('collapsed'))
    : false;
  assert(collapsed, 'sidebar collapsed after toggle');

  // Expand
  await mainWindow.evaluate(el => el.click(), toggle);
  await new Promise(r => setTimeout(r, 400));

  const expanded = sidebar
    ? !await sidebar.evaluate(el => el.classList.contains('collapsed'))
    : false;
  assert(expanded, 'sidebar expanded after second toggle');

  await screenshot('sidebar-toggle');
});

// ═══════════════════════════════════════════════════════════
// 3. EMPTY STATE (new tab page)
// ═══════════════════════════════════════════════════════════

test('empty state — new tab page visible on blank tab', async () => {
  const ntp = await mainWindow.$('#new-tab-page');
  assert(ntp !== null, '#new-tab-page exists');

  const hidden = await ntp.evaluate(el => el.classList.contains('hidden'));
  assert(!hidden, '#new-tab-page not hidden');

  // Should show quicklinks
  const ql = await mainWindow.$('#new-tab-quicklinks');
  const qlHidden = ql ? await ql.evaluate(el => el.classList.contains('hidden')) : true;
  assert(!qlHidden, '#new-tab-quicklinks visible');

  await screenshot('new-tab-page');
});

test('empty state — quicklinks have valid data-url', async () => {
  const links = await mainWindow.evaluate(() => {
    return Array.from(document.querySelectorAll('.new-tab-link'))
      .map(a => a.dataset.url);
  });
  assert(links.length >= 5, `≥5 quicklinks found (${links.length})`);
  for (const url of links) {
    assert(url && url.startsWith('http'), `quicklink URL valid: ${url}`);
  }
});

// ═══════════════════════════════════════════════════════════
// 4. ERROR STATES (invalid URL navigation)
// ═══════════════════════════════════════════════════════════

test('error state — invalid URL does not crash app', async () => {
  // Navigate via new-tab input since address bar may be hidden
  const ntpInput = await mainWindow.$('#new-tab-input');
  if (ntpInput) {
    // Type invalid URL and submit
    await mainWindow.evaluate(el => { el.value = 'http://localhost:1'; }, ntpInput);
    await mainWindow.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 4000));

    // App should still be alive — main selectors present
    assert(await mainWindow.$('#sidebar') !== null, 'app alive after bad URL');
    assert(await mainWindow.$('#content-area') !== null, 'content-area after bad URL');

    await screenshot('error-invalid-url');
  }

  // Navigate back to blank
  await mainWindow.evaluate(() => {
    window.electronAPI?.tabs?.create('about:blank');
  });
  await new Promise(r => setTimeout(r, 1000));
});

// ═══════════════════════════════════════════════════════════
// 5. KEYBOARD ACCESSIBILITY
// ═══════════════════════════════════════════════════════════

test('keyboard — Ctrl+T creates new tab', async () => {
  const before = await mainWindow.evaluate(
    () => document.querySelectorAll('#tab-list .tab').length
  );
  await mainWindow.keyboard.press('Control+t');
  await new Promise(r => setTimeout(r, 500));
  const after = await mainWindow.evaluate(
    () => document.querySelectorAll('#tab-list .tab').length
  );
  assert(after === before + 1, `Ctrl+T new tab: ${before} → ${after}`);
  await screenshot('keyboard-new-tab');
});

test('keyboard — Ctrl+W closes tab', async () => {
  const before = await mainWindow.evaluate(
    () => document.querySelectorAll('#tab-list .tab').length
  );
  await mainWindow.keyboard.press('Control+w');
  await new Promise(r => setTimeout(r, 500));
  const after = await mainWindow.evaluate(
    () => document.querySelectorAll('#tab-list .tab').length
  );
  assert(after === before - 1, `Ctrl+W close tab: ${before} → ${after}`);
});

test('keyboard — Ctrl+L focuses address input', async () => {
  await mainWindow.keyboard.press('Control+l');
  await new Promise(r => setTimeout(r, 300));
  const focused = await mainWindow.evaluate(
    () => document.activeElement?.id
  );
  assert(focused === 'address-input', `Ctrl+L focuses address-input (got: ${focused})`);
});

// ═══════════════════════════════════════════════════════════
// 6. SIDECAR ANIMATIONS
// ═══════════════════════════════════════════════════════════

test('animation — AI sidecar opens', async () => {
  const aiBtn = await mainWindow.$('#rsidebar-ai');
  assert(aiBtn !== null, '#rsidebar-ai exists');

  // Close first if open
  const sidecar = await mainWindow.$('#sidecar');
  if (sidecar) {
    const wasHidden = await sidecar.evaluate(
      el => el.classList.contains('sidecar-hidden')
    );
    if (!wasHidden) {
      await mainWindow.evaluate(el => el.click(), aiBtn);
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // Open
  await mainWindow.evaluate(el => el.click(), aiBtn);
  await new Promise(r => setTimeout(r, 500));

  const sc = await mainWindow.$('#sidecar');
  const hidden = sc
    ? await sc.evaluate(el => el.classList.contains('sidecar-hidden'))
    : true;
  assert(!hidden, 'sidecar visible after AI click');
  await screenshot('sidecar-open');
});

test('animation — sidecar panel switch to shell', async () => {
  const shellBtn = await mainWindow.$('#rsidebar-shell');
  assert(shellBtn !== null, '#rsidebar-shell exists');

  await mainWindow.evaluate(el => el.click(), shellBtn);
  await new Promise(r => setTimeout(r, 400));

  const shellPanel = await mainWindow.$('#sidecar-shell-panel');
  if (shellPanel) {
    const panelHidden = await shellPanel.evaluate(
      el => el.classList.contains('hidden')
    );
    assert(!panelHidden, 'shell panel visible');
  }

  const runBtn = await mainWindow.$('#shell-run');
  assert(runBtn !== null, '#shell-run button visible');
  await screenshot('sidecar-shell');
});

// ═══════════════════════════════════════════════════════════
// 7. CANVAS PAGES
// ═══════════════════════════════════════════════════════════

test('canvas — Ctrl+Shift+H opens history canvas', async () => {
  const host = await mainWindow.$('#canvas-host');
  assert(host !== null, '#canvas-host exists');

  // Close first if open
  const wasHidden = await host.evaluate(el => el.classList.contains('hidden'));
  if (!wasHidden) {
    const closeBtn = await mainWindow.$('#canvas-host-close');
    if (closeBtn) await mainWindow.evaluate(el => el.click(), closeBtn);
    await new Promise(r => setTimeout(r, 300));
  }

  await mainWindow.keyboard.press('Control+Shift+h');
  await new Promise(r => setTimeout(r, 500));

  const visible = !(await host.evaluate(el => el.classList.contains('hidden')));
  assert(visible, 'canvas visible after Ctrl+Shift+H');
  await screenshot('canvas-history');

  // Close
  const closeBtn = await mainWindow.$('#canvas-host-close');
  if (closeBtn) await mainWindow.evaluate(el => el.click(), closeBtn);
  await new Promise(r => setTimeout(r, 300));
});

// ═══════════════════════════════════════════════════════════
// Lifecycle
// ═══════════════════════════════════════════════════════════

beforeAll(async () => {
  await launch();
}, LAUNCH_TIMEOUT + 10000);

afterAll(async () => {
  if (electronApp) await electronApp.close();
});

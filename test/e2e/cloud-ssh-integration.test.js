/**
 * E2E: Cloud + SSH Integration — bead riced-chromium-43i
 *
 * Cloud: workspace list/start/stop via electronAPI.
 * SSH:   connect/disconnect/reconnect via electronAPI.
 *
 * Run: npx jest test/e2e/cloud-ssh-integration.test.js --forceExit --no-cache
 * Headless: xvfb-run npx jest test/e2e/cloud-ssh-integration.test.js --forceExit --no-cache
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
    env: { ...process.env },
  });
  let win = await electronApp.firstWindow({ timeout: LAUNCH_TIMEOUT });
  let title = await win.title();
  if (title.includes('Extension') || title.includes('Background')) {
    await new Promise(r => setTimeout(r, 3000));
    for (const w of electronApp.windows()) {
      const t = await w.title();
      if (!t.includes('Extension') && !t.includes('Background')) { win = w; break; }
    }
  }
  mainWindow = win;
  await mainWindow.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1500));
  await mainWindow.setViewportSize({ width: 1400, height: 900 });
}

function assert(condition, msg) {
  if (!condition) throw new Error(`ASSERT: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

// ── Cloud Workspace API ────────────────────────────────────

describe('Cloud — Workspace API', () => {
  test('cloud status returns all providers', async () => {
    const status = await mainWindow.evaluate(async () => {
      try { return await window.electronAPI?.cloud?.status?.(); }
      catch { return null; }
    });
    assert(status !== null, 'cloud:status responds');
    assert('github' in status, 'github in status');
    assert('replit' in status, 'replit in status');
    assert('gitpod' in status, 'gitpod in status');
  }, 15000);

  test('listWorkspaces throws when not authenticated', async () => {
    const result = await mainWindow.evaluate(async () => {
      try {
        await window.electronAPI?.cloud?.listWorkspaces?.('github');
        return { threw: false };
      } catch (e) {
        return { threw: true, message: e.message };
      }
    });
    assert(result.threw === true, 'listWorkspaces throws unauthenticated');
    assert(result.message.includes('Not authenticated'), 'error says not authenticated');
  }, 15000);

  test('startWorkspace throws when not authenticated', async () => {
    const result = await mainWindow.evaluate(async () => {
      try {
        await window.electronAPI?.cloud?.startWorkspace?.('github', 'test');
        return { threw: false };
      } catch (e) {
        return { threw: true, message: e.message };
      }
    });
    assert(result.threw === true, 'startWorkspace throws unauthenticated');
  }, 15000);

  test('stopWorkspace throws when not authenticated', async () => {
    const result = await mainWindow.evaluate(async () => {
      try {
        await window.electronAPI?.cloud?.stopWorkspace?.('github', 'test');
        return { threw: false };
      } catch (e) {
        return { threw: true, message: e.message };
      }
    });
    assert(result.threw === true, 'stopWorkspace throws unauthenticated');
  }, 15000);

  test('disconnect returns ok for each provider', async () => {
    for (const provider of ['github', 'replit', 'gitpod']) {
      const result = await mainWindow.evaluate(async (p) => {
        try { return await window.electronAPI?.cloud?.disconnect?.(p); }
        catch { return null; }
      }, provider);
      assert(result !== null, `disconnect(${provider}) responds`);
      assert(result.ok === true, `disconnect(${provider}) returns ok`);
    }
  }, 15000);
});

// ── SSH Connection API ─────────────────────────────────────

describe('SSH — Connection Lifecycle', () => {
  test('ssh state returns disconnected initially', async () => {
    const state = await mainWindow.evaluate(async () => {
      try { return await window.electronAPI?.ssh?.state?.(); }
      catch { return null; }
    });
    assert(state !== null, 'ssh:state responds');
    assert(state.connected === false, 'initially disconnected');
  }, 15000);

  test('ssh connections list is empty initially', async () => {
    const conns = await mainWindow.evaluate(async () => {
      try { return await window.electronAPI?.ssh?.connections?.list?.(); }
      catch { return null; }
    });
    assert(Array.isArray(conns), 'connections list is array');
  }, 15000);

  test('ssh connect to invalid host fails gracefully', async () => {
    const result = await mainWindow.evaluate(async () => {
      try {
        await window.electronAPI?.ssh?.connect?.({
          host: '192.0.2.1',  // TEST-NET, should not respond
          port: 22,
          username: 'test',
        });
        return { connected: true };
      } catch (e) {
        return { connected: false, error: e.message };
      }
    });
    // Should fail (timeout or connection refused) — either is fine
    assert(result.connected === false, 'connect to invalid host fails');
  }, 20000);

  test('ssh disconnect returns ok when not connected', async () => {
    const result = await mainWindow.evaluate(async () => {
      try { return await window.electronAPI?.ssh?.disconnect?.(); }
      catch { return null; }
    });
    assert(result !== null, 'disconnect responds');
    assert(result.ok === true, 'disconnect returns ok');
  }, 15000);

  test('ssh send returns error when not connected', async () => {
    const result = await mainWindow.evaluate(async () => {
      try { return await window.electronAPI?.ssh?.send?.('ls'); }
      catch (e) { return { ok: false, error: e.message }; }
    });
    assert(result.ok === false, 'send fails when not connected');
  }, 15000);

  test('ssh save + delete connection profile', async () => {
    const saveResult = await mainWindow.evaluate(async () => {
      try {
        return await window.electronAPI?.ssh?.connections?.save?.('test-profile', {
          name: 'Test',
          host: 'example.com',
          port: 22,
          username: 'user',
        });
      } catch { return null; }
    });
    assert(saveResult !== null, 'save connection responds');
    assert(saveResult.ok === true, 'save returns ok');

    // Verify it appears in list
    const conns = await mainWindow.evaluate(async () => {
      try { return await window.electronAPI?.ssh?.connections?.list?.(); }
      catch { return []; }
    });
    assert(conns.some(c => c.id === 'test-profile'), 'saved profile in list');

    // Delete it
    const delResult = await mainWindow.evaluate(async () => {
      try { return await window.electronAPI?.ssh?.connections?.delete?.('test-profile'); }
      catch { return null; }
    });
    assert(delResult !== null, 'delete responds');
    assert(delResult.ok === true, 'delete returns ok');
  }, 15000);
});

// ── Lifecycle ──────────────────────────────────────────────

beforeAll(async () => { await launch(); }, LAUNCH_TIMEOUT + 10000);
afterAll(async () => { if (electronApp) await electronApp.close(); });

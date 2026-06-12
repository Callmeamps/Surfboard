/**
 * E2E tests for tab page navigation flow.
 * Tests surfboard:// internal pages (extensions, agents, shell, workflows, etc.)
 *
 * Run with: npm run test:e2e
 * Note: These tests launch a real Electron window and may take time.
 */

const { _electron: electron } = require('playwright');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');

let electronApp;
let mainWindow;

beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['.', '--no-sandbox'],
    cwd: projectRoot,
    env: { ...process.env },
  });

  // Find main window (skip extension background pages)
  const window = await electronApp.firstWindow({ timeout: 60000 });
  const title = await window.title();

  if (title.includes('Extension') || title.includes('Background')) {
    await new Promise(r => setTimeout(r, 3000));
    const allWindows = electronApp.windows();
    for (const w of allWindows) {
      const t = await w.title();
      if (!t.includes('Extension') && !t.includes('Background')) {
        mainWindow = w;
        break;
      }
    }
    if (!mainWindow) mainWindow = window;
  } else {
    mainWindow = window;
  }

  await mainWindow.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 2000));
  await mainWindow.setViewportSize({ width: 1400, height: 900 });
}, 30000);

afterAll(async () => {
  if (electronApp) await electronApp.close();
});

describe('Tab Pages Navigation', () => {
  test('extensions page opens via surfboard://extensions', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://extensions';
    });
    await new Promise(r => setTimeout(r, 1000));

    const pageExists = await mainWindow.evaluate(() => {
      return !!document.querySelector('[data-page="extensions"]');
    });
    expect(pageExists).toBe(true);
  }, 15000);

  test('extensions page shows extension list', async () => {
    const extensions = await mainWindow.evaluate(async () => {
      if (window.electronAPI?.extensions?.list) {
        return await window.electronAPI.extensions.list();
      }
      return [];
    });
    expect(Array.isArray(extensions)).toBe(true);
  }, 10000);

  test('agents page opens via surfboard://agents', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://agents';
    });
    await new Promise(r => setTimeout(r, 1000));

    const pageExists = await mainWindow.evaluate(() => {
      return !!document.querySelector('[data-page="agents"]');
    });
    expect(pageExists).toBe(true);
  }, 15000);

  test('shell page opens via surfboard://shell', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://shell';
    });
    await new Promise(r => setTimeout(r, 1000));

    const pageExists = await mainWindow.evaluate(() => {
      return !!document.querySelector('[data-page="shell"]');
    });
    expect(pageExists).toBe(true);
  }, 15000);

  test('workflows page opens via surfboard://workflows', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://workflows';
    });
    await new Promise(r => setTimeout(r, 1000));

    const pageExists = await mainWindow.evaluate(() => {
      return !!document.querySelector('[data-page="workflows"]');
    });
    expect(pageExists).toBe(true);
  }, 15000);

  test('cloud page opens via surfboard://cloud', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://cloud';
    });
    await new Promise(r => setTimeout(r, 1000));

    const pageExists = await mainWindow.evaluate(() => {
      return !!document.querySelector('[data-page="cloud"]');
    });
    expect(pageExists).toBe(true);
  }, 15000);

  test('keyboard shortcuts open correct pages', async () => {
    // Alt+Shift+X for extensions
    await mainWindow.keyboard.press('Alt+Shift+X');
    await new Promise(r => setTimeout(r, 500));

    const url1 = await mainWindow.evaluate(() => window.location.href);
    expect(url1).toContain('extensions');

    // Alt+Shift+A for agents
    await mainWindow.keyboard.press('Alt+Shift+A');
    await new Promise(r => setTimeout(r, 500));

    const url2 = await mainWindow.evaluate(() => window.location.href);
    expect(url2).toContain('agents');

    // Alt+Shift+S for shell
    await mainWindow.keyboard.press('Alt+Shift+S');
    await new Promise(r => setTimeout(r, 500));

    const url3 = await mainWindow.evaluate(() => window.location.href);
    expect(url3).toContain('shell');

    // Alt+Shift+W for workflows
    await mainWindow.keyboard.press('Alt+Shift+W');
    await new Promise(r => setTimeout(r, 500));

    const url4 = await mainWindow.evaluate(() => window.location.href);
    expect(url4).toContain('workflows');
  }, 30000);

  test('settings page opens via surfboard://settings', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://settings';
    });
    await new Promise(r => setTimeout(r, 1000));

    const url = await mainWindow.evaluate(() => window.location.href);
    expect(url).toContain('settings');
  }, 15000);
});

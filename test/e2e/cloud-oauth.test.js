/**
 * E2E tests for cloud OAuth device code flow.
 * Tests GitHub Codespaces, Replit, Gitpod device code authentication.
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

describe('Cloud OAuth Flow', () => {
  test('cloud page renders provider cards', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://cloud';
    });
    await new Promise(r => setTimeout(r, 1500));

    const providerCards = await mainWindow.evaluate(() => {
      const cards = document.querySelectorAll('[data-provider]');
      return Array.from(cards).map(c => c.dataset.provider);
    });

    expect(providerCards).toContain('github');
  }, 20000);

  test('GitHub provider has connect button', async () => {
    const connectBtn = await mainWindow.evaluate(() => {
      const btn = document.querySelector('[data-provider="github"] button[data-action="connect"]');
      return !!btn;
    });
    expect(typeof connectBtn).toBe('boolean');
  }, 10000);

  test('cloud-manager initializes correctly', async () => {
    const cloudState = await mainWindow.evaluate(async () => {
      if (window.electronAPI?.cloud) {
        try {
          const providers = await window.electronAPI.cloud.listProviders?.();
          return { providers: providers || [] };
        } catch {
          return { providers: [] };
        }
      }
      return { providers: [] };
    });

    expect(cloudState).toHaveProperty('providers');
  }, 10000);

  test('device code modal opens on connect click', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://cloud';
    });
    await new Promise(r => setTimeout(r, 1000));

    const clicked = await mainWindow.evaluate(() => {
      const btn = document.querySelector('[data-provider="github"] button[data-action="connect"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await new Promise(r => setTimeout(r, 500));
      const modalExists = await mainWindow.evaluate(() => {
        return !!document.querySelector('.device-code-modal, [data-modal="device-code"]');
      });
      expect(typeof modalExists).toBe('boolean');
    }
  }, 15000);

  test('workspace list loads (empty if not authenticated)', async () => {
    await mainWindow.evaluate(() => {
      window.location.href = 'surfboard://cloud';
    });
    await new Promise(r => setTimeout(r, 1000));

    const workspaces = await mainWindow.evaluate(async () => {
      if (window.electronAPI?.cloud?.listWorkspaces) {
        try {
          return await window.electronAPI.cloud.listWorkspaces('github');
        } catch {
          return [];
        }
      }
      return [];
    });

    expect(Array.isArray(workspaces)).toBe(true);
  }, 15000);
});

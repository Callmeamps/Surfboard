/**
 * Integration tests for sidecar modes + sidebar toggle.
 * Tests mode switching (AI/Shell/Edit/Inspect), sidebar expand/collapse.
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

describe('Sidebar Toggle', () => {
  test('sidebar exists', async () => {
    const sidebar = await mainWindow.$('#sidebar');
    expect(sidebar).not.toBeNull();
  }, 10000);

  test('toggle sidebar expand/collapse', async () => {
    const toggle = await mainWindow.$('#sidebar-toggle');
    expect(toggle).not.toBeNull();

    // Get initial state
    const before = await mainWindow.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      return sidebar?.classList.contains('collapsed') || false;
    });

    // Click toggle
    await mainWindow.evaluate(el => el.click(), toggle);
    await new Promise(r => setTimeout(r, 300));

    // Verify state changed
    const after = await mainWindow.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      return sidebar?.classList.contains('collapsed') || false;
    });

    expect(after).toBe(!before);
  }, 10000);

  test('sidebar toggle via keyboard', async () => {
    // Ctrl+Shift+T toggles sidebar (check shortcuts config)
    const before = await mainWindow.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      return sidebar?.classList.contains('collapsed') || false;
    });

    await mainWindow.keyboard.press('Control+Shift+T');
    await new Promise(r => setTimeout(r, 300));

    const after = await mainWindow.evaluate(() => {
      const sidebar = document.getElementById('sidebar');
      return sidebar?.classList.contains('collapsed') || false;
    });

    // State should have toggled
    expect(after).toBe(!before);
  }, 10000);
});

describe('Right Sidebar Buttons', () => {
  const buttons = [
    { id: '#rsidebar-ai', name: 'AI' },
    { id: '#rsidebar-shell', name: 'Shell' },
    { id: '#rsidebar-edit', name: 'Edit' },
    { id: '#rsidebar-inspect', name: 'Inspect' },
    { id: '#rsidebar-actions', name: 'Actions' },
    { id: '#rsidebar-data', name: 'Data' },
    { id: '#rsidebar-workflows', name: 'Workflows' },
    { id: '#rsidebar-miniapps', name: 'Miniapps' },
  ];

  test('all mode buttons exist', async () => {
    for (const btn of buttons) {
      const el = await mainWindow.$(btn.id);
      expect(el).not.toBeNull();
    }
  }, 10000);
});

describe('Sidecar Modes', () => {
  test('click AI opens sidecar', async () => {
    const aiBtn = await mainWindow.$('#rsidebar-ai');
    expect(aiBtn).not.toBeNull();

    await mainWindow.evaluate(el => el.click(), aiBtn);
    await new Promise(r => setTimeout(r, 500));

    const sidecarVisible = await mainWindow.evaluate(() => {
      const sidecar = document.getElementById('sidecar');
      if (!sidecar) return false;
      return !sidecar.classList.contains('sidecar-hidden');
    });

    expect(sidecarVisible).toBe(true);
  }, 10000);

  test('AI button highlights when active', async () => {
    const active = await mainWindow.evaluate(() => {
      const btn = document.getElementById('rsidebar-ai');
      return btn?.classList.contains('active') || false;
    });

    expect(active).toBe(true);
  }, 10000);

  test('switch to Shell mode', async () => {
    const shellBtn = await mainWindow.$('#rsidebar-shell');
    await mainWindow.evaluate(el => el.click(), shellBtn);
    await new Promise(r => setTimeout(r, 300));

    const shellActive = await mainWindow.evaluate(() => {
      return window.ModeManager?.getCurrentMode?.() || 'unknown';
    });

    // Shell mode should be active
    expect(shellActive).toBe('shell');

    // Shell panel should be visible
    const shellPanel = await mainWindow.evaluate(() => {
      const panel = document.getElementById('sidecar-shell-panel');
      return panel && !panel.classList.contains('hidden');
    });
    expect(shellPanel).toBe(true);
  }, 10000);

  test('switch to Edit mode', async () => {
    const editBtn = await mainWindow.$('#rsidebar-edit');
    await mainWindow.evaluate(el => el.click(), editBtn);
    await new Promise(r => setTimeout(r, 300));

    const editActive = await mainWindow.evaluate(() => {
      return window.ModeManager?.getCurrentMode?.() || 'unknown';
    });

    expect(editActive).toBe('edit');
  }, 10000);

  test('switch to Inspect mode', async () => {
    const inspectBtn = await mainWindow.$('#rsidebar-inspect');
    await mainWindow.evaluate(el => el.click(), inspectBtn);
    await new Promise(r => setTimeout(r, 300));

    const inspectActive = await mainWindow.evaluate(() => {
      return window.ModeManager?.getCurrentMode?.() || 'unknown';
    });

    expect(inspectActive).toBe('inspect');
  }, 10000);

  test('close sidecar', async () => {
    // Click active mode button to toggle off
    const editBtn = await mainWindow.$('#rsidebar-edit');
    await mainWindow.evaluate(el => el.click(), editBtn);
    await new Promise(r => setTimeout(r, 300));

    const sidecarHidden = await mainWindow.evaluate(() => {
      const sidecar = document.getElementById('sidecar');
      return sidecar?.classList.contains('sidecar-hidden') || false;
    });

    expect(sidecarHidden).toBe(true);
  }, 10000);

  test('mode buttons dehighlight when sidecar closed', async () => {
    const anyActive = await mainWindow.evaluate(() => {
      const buttons = document.querySelectorAll('.rsidebar-btn');
      for (const btn of buttons) {
        if (btn.classList.contains('active')) return true;
      }
      return false;
    });

    expect(anyActive).toBe(false);
  }, 10000);
});

describe('Sidecar Keyboard Shortcuts', () => {
  test('Ctrl+Shift+A opens AI sidecar', async () => {
    await mainWindow.keyboard.press('Control+Shift+A');
    await new Promise(r => setTimeout(r, 500));

    const sidecarVisible = await mainWindow.evaluate(() => {
      const sidecar = document.getElementById('sidecar');
      return sidecar && !sidecar.classList.contains('sidecar-hidden');
    });

    expect(sidecarVisible).toBe(true);
  }, 10000);

  test('Ctrl+Shift+S opens Shell', async () => {
    await mainWindow.keyboard.press('Control+Shift+S');
    await new Promise(r => setTimeout(r, 300));

    const mode = await mainWindow.evaluate(() => {
      return window.ModeManager?.getCurrentMode?.() || 'unknown';
    });

    expect(mode).toBe('shell');
  }, 10000);

  test('Escape closes sidecar', async () => {
    await mainWindow.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));

    const sidecarHidden = await mainWindow.evaluate(() => {
      const sidecar = document.getElementById('sidecar');
      return sidecar?.classList.contains('sidecar-hidden') || false;
    });

    expect(sidecarHidden).toBe(true);
  }, 10000);
});

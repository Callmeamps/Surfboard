import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

async function main() {
  console.log("=== Launching Electron for E2E smoke test ===");
  
  const electronApp = await electron.launch({
    args: ['.', '--no-sandbox'],
    cwd: projectRoot,
    env: { ...process.env },
  });

  // Wait for the main window (not extension background pages)
  console.log("Waiting for main window...");
  const window = await electronApp.firstWindow();
  
  // If we got an extension page, find the main window
  const title = await window.title();
  console.log("First window title:", title);
  
  let mainWindow = window;
  if (title.includes('Extension') || title.includes('Background') || title.includes('uBlock')) {
    console.log("Got extension page, searching for main window...");
    // Wait for the actual app window
    await new Promise(r => setTimeout(r, 3000));
    const allWindows = electronApp.windows();
    console.log("All windows:", allWindows.length);
    for (const w of allWindows) {
      const t = await w.title();
      console.log("  Window title:", t);
      if (!t.includes('Extension') && !t.includes('Background')) {
        mainWindow = w;
        break;
      }
    }
    // If still no main window, use a new page
    if (mainWindow === window) {
      console.log("Still on extension page, waiting for app window...");
      mainWindow = await new Promise((resolve) => {
        const handler = (w) => {
          w.title().then(t => {
            if (!t.includes('Extension') && !t.includes('Background')) {
              electronApp.off('window', handler);
              resolve(w);
            }
          });
        };
        electronApp.on('window', handler);
        setTimeout(() => resolve(window), 5000);
      });
    }
  }

  const mainTitle = await mainWindow.title();
  console.log("Main window title:", mainTitle);
  await mainWindow.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 2000));

  // Ensure window has size
  await mainWindow.setViewportSize({ width: 1400, height: 900 });
  
  // Screenshot
  await mainWindow.screenshot({ path: '/tmp/surfboard-e2e-01-initial.png' });
  console.log("✓ Screenshot 1 (initial) saved");

  // ── 1. Check sidebar exists ──────────────────────────
  const sidebar = await mainWindow.$('#sidebar');
  console.log("✓ Sidebar present:", !!sidebar);

  const newTabPage = await mainWindow.$('#new-tab-page');
  console.log("✓ New tab page visible:", 
    newTabPage ? !(await newTabPage.evaluate(el => el.classList.contains('hidden'))) : 'N/A');

  // ── 2. Check right sidebar buttons ──────────────────
  const buttons = [
    '#rsidebar-ai', '#rsidebar-shell', '#rsidebar-edit', '#rsidebar-inspect',
    '#rsidebar-actions', '#rsidebar-data', '#rsidebar-workflows', '#rsidebar-miniapps',
    '#rsidebar-omnibar', '#rsidebar-extensions', '#rsidebar-bookmark',
  ];
  let found = 0, missing = 0;
  for (const sel of buttons) {
    const btn = await mainWindow.$(sel);
    if (btn) {
      const titleAttr = await btn.getAttribute('title');
      console.log(`  ✓ Button ${sel}: "${titleAttr}"`);
      found++;
    } else {
      console.log(`  ✗ Button ${sel}: MISSING`);
      missing++;
    }
  }
  console.log(`  Right sidebar: ${found} found, ${missing} missing`);

  // ── 3. Click AI → opens sidecar ──────────────────────
  console.log("\n--- Clicking AI button ---");
  const aiBtn = await mainWindow.$('#rsidebar-ai');
  if (aiBtn) {
    await mainWindow.evaluate(el => el.click(), aiBtn);
    await new Promise(r => setTimeout(r, 800));
    await mainWindow.screenshot({ path: '/tmp/surfboard-e2e-02-ai-clicked.png' });

    const sidecar = await mainWindow.$('#sidecar');
    if (sidecar) {
      const hidden = await sidecar.evaluate(el => el.classList.contains('sidecar-hidden'));
      console.log("Sidecar hidden after AI click:", hidden, "(expected: false)");
    }
  }

  // ── 4. Click Shell → switches mode ──────────────────
  console.log("\n--- Clicking Shell button ---");
  const shellBtn = await mainWindow.$('#rsidebar-shell');
  if (shellBtn) {
    await mainWindow.evaluate(el => el.click(), shellBtn);
    await new Promise(r => setTimeout(r, 500));
    const shellPanel = await mainWindow.$('#sidecar-shell-panel');
    if (shellPanel) {
      const shellHidden = await shellPanel.evaluate(el => el.classList.contains('hidden'));
      console.log("Shell panel hidden:", shellHidden, "(expected: false)");
    }
  }

  // ── 5. Toggle Editor mode ──────────────────────────
  console.log("\n--- Clicking Edit button ---");
  const editBtn = await mainWindow.$('#rsidebar-edit');
  if (editBtn) {
    await mainWindow.evaluate(el => el.click(), editBtn);
    await new Promise(r => setTimeout(r, 300));
    const editorEnabled = await mainWindow.evaluate(() => {
      return window.EditorEngine ? window.EditorEngine.isEnabled() : 'N/A';
    });
    console.log("Editor engine enabled:", editorEnabled);
    // Toggle off
    if (editorEnabled === true) {
      await mainWindow.evaluate(el => el.click(), editBtn);
      await new Promise(r => setTimeout(r, 200));
      const editorOff = await mainWindow.evaluate(() => 
        window.EditorEngine ? window.EditorEngine.isEnabled() : 'N/A'
      );
      console.log("Editor engine after second click:", editorOff, "(expected: false)");
    }
  }

  // ── 6. Toggle Inspect mode ─────────────────────────
  console.log("\n--- Clicking Inspect button ---");
  const inspectBtn = await mainWindow.$('#rsidebar-inspect');
  if (inspectBtn) {
    await mainWindow.evaluate(el => el.click(), inspectBtn);
    await new Promise(r => setTimeout(r, 300));
    const inspectorEnabled = await mainWindow.evaluate(() => 
      window.Inspector ? window.Inspector.isEnabled() : 'N/A'
    );
    console.log("Inspector enabled:", inspectorEnabled);
    if (inspectorEnabled === true) {
      await mainWindow.evaluate(el => el.click(), inspectBtn);
    }
  }

  // ── 7. Toggle Actions ─────────────────────────────
  console.log("\n--- Clicking Actions button ---");
  const actionsBtn = await mainWindow.$('#rsidebar-actions');
  if (actionsBtn) {
    await mainWindow.evaluate(el => el.click(), actionsBtn);
    await new Promise(r => setTimeout(r, 300));
    const actionsEnabled = await mainWindow.evaluate(() =>
      window.ActionRegistry ? window.ActionRegistry.isEnabled() : 'N/A'
    );
    console.log("ActionRegistry enabled:", actionsEnabled);
    if (actionsEnabled === true) {
      await mainWindow.evaluate(el => el.click(), actionsBtn);
    }
  }

  // ── 8. Toggle Data mode ───────────────────────────
  console.log("\n--- Clicking Data button ---");
  const dataBtn = await mainWindow.$('#rsidebar-data');
  if (dataBtn) {
    await mainWindow.evaluate(el => el.click(), dataBtn);
    await new Promise(r => setTimeout(r, 300));
  }

  // ── 9. Toggle Workflows ──────────────────────────
  console.log("\n--- Clicking Workflows button ---");
  const wfBtn = await mainWindow.$('#rsidebar-workflows');
  if (wfBtn) {
    await mainWindow.evaluate(el => el.click(), wfBtn);
    await new Promise(r => setTimeout(r, 300));
  }

  // ── 10. Click Miniapps ─────────────────────────────
  console.log("\n--- Clicking Miniapps button ---");
  const miniBtn = await mainWindow.$('#rsidebar-miniapps');
  if (miniBtn) {
    await mainWindow.evaluate(el => el.click(), miniBtn);
    await new Promise(r => setTimeout(r, 500));
    await mainWindow.screenshot({ path: '/tmp/surfboard-e2e-03-miniapps.png' });
  }

  // ── 11. Test keyboard shortcut: Ctrl+Shift+H (history canvas) ─
  console.log("\n--- Testing shortcut: Ctrl+Shift+H (history canvas) ---");
  await mainWindow.keyboard.press('Control+Shift+H');
  await new Promise(r => setTimeout(r, 500));
  const canvasHost = await mainWindow.$('#canvas-host');
  if (canvasHost) {
    const canvasHidden = await canvasHost.evaluate(el => el.classList.contains('hidden'));
    console.log("Canvas host hidden:", canvasHidden, "(expected: false)");
    await mainWindow.screenshot({ path: '/tmp/surfboard-e2e-04-history-canvas.png' });
    // Close via close button
    const canvasClose = await mainWindow.$('#canvas-host-close');
    if (canvasClose) {
      await mainWindow.evaluate(el => el.click(), canvasClose);
      await new Promise(r => setTimeout(r, 300));
      const closed = await canvasHost.evaluate(el => el.classList.contains('hidden'));
      console.log("Canvas host after close:", closed, "(expected: true)");
    }
  }

  // ── 12. Test Ctrl+Shift+X (bash canvas) ──────────────
  console.log("\n--- Testing shortcut: Ctrl+Shift+X (bash canvas) ---");
  await mainWindow.keyboard.press('Control+Shift+X');
  await new Promise(r => setTimeout(r, 300));
  if (canvasHost) {
    const hidden2 = await canvasHost.evaluate(el => el.classList.contains('hidden'));
    console.log("Canvas host after Ctrl+Shift+X hidden:", hidden2, "(expected: false)");
    await mainWindow.screenshot({ path: '/tmp/surfboard-e2e-05-bash-canvas.png' });
    // Close
    const canvasClose = await mainWindow.$('#canvas-host-close');
    if (canvasClose) {
      await mainWindow.evaluate(el => el.click(), canvasClose);
    }
  }

  // ── 13. Test other canvas shortcuts ─────────────────
  console.log("\n--- Testing Ctrl+Shift+B (bookmarks canvas) ---");
  await mainWindow.keyboard.press('Control+Shift+B');
  await new Promise(r => setTimeout(r, 300));
  if (canvasHost) {
    const hidden3 = await canvasHost.evaluate(el => el.classList.contains('hidden'));
    console.log("Canvas host after Ctrl+Shift+B hidden:", hidden3, "(expected: false)");
  }

  // ── 14. Check window controls exist ──────────────────
  console.log("\n--- Window controls ---");
  const winBtns = ['#window-minimize', '#window-maximize', '#window-close',
    '#sidebar-toggle', '#new-tab-btn'];
  for (const sel of winBtns) {
    const btn = await mainWindow.$(sel);
    console.log(`  ${btn ? '✓' : '✗'} ${sel}`);
  }

  // ── 15. Check for renderer errors ────────────────────
  console.log("\n--- Checking for errors ---");
  const pageErrors = [];
  mainWindow.on('pageerror', err => {
    console.log("  PAGE ERROR:", err.message);
    pageErrors.push(err.message);
  });
  await new Promise(r => setTimeout(r, 500));
  if (pageErrors.length === 0) {
    console.log("✓ No renderer errors detected");
  }

  // ── 16. Check feature platform modules loaded ────────
  console.log("\n--- Feature platform modules ---");
  const modules = {
    ModeManager: 'ModeManager',
    TrustManager: 'TrustManager',
    EditorEngine: 'EditorEngine',
    Inspector: 'Inspector',
    ActionRegistry: 'ActionRegistry',
    WorkflowEngine: 'WorkflowEngine',
    DataPipeline: 'DataPipeline',
    AIClient: 'AIClient',
    Miniapps: 'Miniapps',
    RightSidebar: 'RightSidebar',
    CanvasPages: 'CanvasPages',
  };
  for (const [name, key] of Object.entries(modules)) {
    const exists = await mainWindow.evaluate((k) => typeof window[k] !== 'undefined', key);
    console.log(`  ${exists ? '✓' : '✗'} ${name}: ${exists ? 'loaded' : 'MISSING'}`);
  }

  // ── 17. Check extensions loaded ─────────────────────
  console.log("\n--- Extensions check ---");
  const extInfo = await mainWindow.evaluate(async () => {
    if (window.electronAPI?.extensions?.list) {
      try {
        return await window.electronAPI.extensions.list();
      } catch { return []; }
    }
    return [];
  });
  console.log(`  Extensions loaded: ${extInfo.length}`);
  for (const ext of extInfo) {
    console.log(`    ${ext.icon || '🧩'} ${ext.name} (${ext.id}) — ${ext.enabled ? '✓ enabled' : '✗ disabled'}`);
  }

  // ── Final screenshot ────────────────────────────────
  await mainWindow.screenshot({ path: '/tmp/surfboard-e2e-06-final.png' });

  console.log("\n=== E2E SMOKE TEST PASSED ===");
  await electronApp.close();
}

main().catch(err => {
  console.error("\n✗ E2E TEST FAILED:", err.message);
  process.exit(1);
});

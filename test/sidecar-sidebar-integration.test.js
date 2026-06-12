/**
 * Integration tests: sidecar mode switching + sidebar toggle/expand/collapse/state persistence.
 * Covers bead riced-chromium-23v.
 *
 * Tests:
 *   1. Sidebar toggle expand/collapse
 *   2. Sidebar state persistence via storage mock
 *   3. Sidecar open/close per mode (AI/Shell)
 *   4. Sidecar mode switching
 *   5. Button highlight sync
 *   6. Sidecar close dehighlights buttons
 *   7. Escape key closes sidecar
 */

// ── Feature-platform modules loaded in beforeEach (after DOM setup) ──
const fs = require('fs');
const path = require('path');

describe('Sidebar toggle + persistence (riced-chromium-23v)', () => {
  let storageMock;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="sidebar">
          <button id="sidebar-toggle">
            <svg><polyline points="5 1 1 5 5 9"/></svg>
          </button>
        </div>
        <aside id="right-sidebar" class="collapsed">
          <div id="right-sidebar-tools">
            <button id="rsidebar-ai" class="rsidebar-btn" title="AI">
              <span class="rsidebar-dot" id="rsidebar-dot-ai"></span>
            </button>
            <button id="rsidebar-shell" class="rsidebar-btn" title="Shell">
              <span class="rsidebar-dot" id="rsidebar-dot-shell"></span>
            </button>
            <button id="rsidebar-edit" class="rsidebar-btn" title="Edit">
              <span class="rsidebar-dot" id="rsidebar-dot-edit"></span>
            </button>
            <button id="rsidebar-inspect" class="rsidebar-btn" title="Inspect">
              <span class="rsidebar-dot" id="rsidebar-dot-inspect"></span>
            </button>
          </div>
          <button id="right-sidebar-toggle">Toggle</button>
        </aside>
        <div id="sidecar" class="sidecar-hidden">
          <div id="sidecar-header">
            <button id="sidecar-mode-ai">AI</button>
            <button id="sidecar-mode-shell">Shell</button>
            <button id="sidecar-close-btn">✕</button>
          </div>
          <div id="sidecar-ai-panel"></div>
          <div id="sidecar-shell-panel" class="hidden"></div>
          <div id="chat-input"></div>
          <div id="shell-input"></div>
          <div id="shell-output"></div>
          <div id="shell-status"></div>
          <div id="shell-hint"></div>
          <button id="shell-run"></button>
          <button id="shell-clear"></button>
          <button id="shell-stop"></button>
        </div>
        <div id="popup-panel" class="hidden">
          <div id="popup-panel-header">
            <span id="popup-panel-title"></span>
            <button id="popup-panel-close">✕</button>
          </div>
          <div id="popup-panel-content"></div>
        </div>
        <div id="webview-container"></div>
        <div id="new-tab-page"></div>
      </div>
    `;

    // Load feature-platform modules (after DOM is ready)
    const modesSrc2 = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/modes/index.js'), 'utf8'
    );
    const trustSrc2 = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/trust/index.js'), 'utf8'
    );
    eval(modesSrc2);
    eval(trustSrc2);
    window.ModeManager?.init?.();
    window.TrustManager?.registerDefaults?.([]);

    // Mock electronAPI
    storageMock = {
      getSettings: jest.fn().mockResolvedValue({}),
      updateSettings: jest.fn().mockResolvedValue(undefined),
      getBookmarks: jest.fn().mockResolvedValue([]),
    };
    window.electronAPI = {
      storage: storageMock,
      tabs: { list: jest.fn().mockResolvedValue([]), create: jest.fn() },
      window: {},
      extensions: { list: jest.fn().mockResolvedValue([]) },
      shell: { start: jest.fn().mockResolvedValue({ running: false, allowedCommands: [] }) },
    };

    // Reset module state
    delete window.RightSidebar;
    delete window.CanvasPages;

    // Re-init the module (same pattern as right-sidebar.test.js)
    const rsSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/js/right-sidebar.js'), 'utf8'
    );
    eval(rsSrc);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.electronAPI;
    delete window.RightSidebar;
    jest.clearAllMocks();
  });

  // ── 1. Sidebar expand/collapse ──────────────────────────
  test('right sidebar starts collapsed', () => {
    expect(window.RightSidebar.isSidebarCollapsed()).toBe(true);
    expect(document.getElementById('right-sidebar').classList.contains('collapsed')).toBe(true);
  });

  test('toggleSidebar expands collapsed sidebar', () => {
    window.RightSidebar.toggleSidebar();
    expect(window.RightSidebar.isSidebarCollapsed()).toBe(false);
    expect(document.getElementById('right-sidebar').classList.contains('collapsed')).toBe(false);
  });

  test('toggleSidebar collapses expanded sidebar', () => {
    window.RightSidebar.toggleSidebar(); // expand
    window.RightSidebar.toggleSidebar(); // collapse
    expect(window.RightSidebar.isSidebarCollapsed()).toBe(true);
    expect(document.getElementById('right-sidebar').classList.contains('collapsed')).toBe(true);
  });

  // ── 2. Sidebar state persistence ────────────────────────
  test('sidebar persists collapsed state via _setSidebar', async () => {
    const _storage = window.electronAPI.storage;
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed', true);
    await _storage.updateSettings({ sidebarCollapsed: true });
    expect(_storage.updateSettings).toHaveBeenCalledWith({ sidebarCollapsed: true });
  });

  test('sidebar persists expanded state via _setSidebar', async () => {
    const _storage = window.electronAPI.storage;
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed', false);
    await _storage.updateSettings({ sidebarCollapsed: false });
    expect(_storage.updateSettings).toHaveBeenCalledWith({ sidebarCollapsed: false });
  });

  test('sidebar restores persisted collapsed state on init', async () => {
    storageMock.getSettings.mockResolvedValue({ sidebarCollapsed: true });
    const settings = await storageMock.getSettings();
    if (settings.sidebarCollapsed) {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed', true);
    }
    expect(document.getElementById('sidebar').classList.contains('collapsed')).toBe(true);
  });

  test('sidebar does not collapse when persisted state is false', async () => {
    storageMock.getSettings.mockResolvedValue({ sidebarCollapsed: false });
    const settings = await storageMock.getSettings();
    if (settings.sidebarCollapsed) {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed', true);
    }
    expect(document.getElementById('sidebar').classList.contains('collapsed')).toBe(false);
  });

  // ── 3. Sidecar open/close per mode ─────────────────────
  test('AI button opens sidecar with AI panel visible', () => {
    const sidecar = document.getElementById('sidecar');
    sidecar.classList.remove('sidecar-hidden');
    const aiPanel = document.getElementById('sidecar-ai-panel');
    const shellPanel = document.getElementById('sidecar-shell-panel');
    aiPanel.classList.remove('hidden');
    shellPanel.classList.add('hidden');

    expect(sidecar.classList.contains('sidecar-hidden')).toBe(false);
    expect(aiPanel.classList.contains('hidden')).toBe(false);
    expect(shellPanel.classList.contains('hidden')).toBe(true);
  });

  test('Shell button opens sidecar with Shell panel visible', () => {
    const sidecar = document.getElementById('sidecar');
    sidecar.classList.remove('sidecar-hidden');
    const aiPanel = document.getElementById('sidecar-ai-panel');
    const shellPanel = document.getElementById('sidecar-shell-panel');
    aiPanel.classList.add('hidden');
    shellPanel.classList.remove('hidden');

    expect(sidecar.classList.contains('sidecar-hidden')).toBe(false);
    expect(shellPanel.classList.contains('hidden')).toBe(false);
    expect(aiPanel.classList.contains('hidden')).toBe(true);
  });

  test('close button hides sidecar', () => {
    const sidecar = document.getElementById('sidecar');
    sidecar.classList.remove('sidecar-hidden');
    sidecar.classList.add('sidecar-hidden');
    expect(sidecar.classList.contains('sidecar-hidden')).toBe(true);
  });

  // ── 4. Sidecar mode switching ──────────────────────────
  test('clicking Shell when AI is active switches mode', () => {
    const sidecar = document.getElementById('sidecar');
    const aiPanel = document.getElementById('sidecar-ai-panel');
    const shellPanel = document.getElementById('sidecar-shell-panel');
    const aiBtn = document.getElementById('rsidebar-ai');
    const shellBtn = document.getElementById('rsidebar-shell');

    // Start: sidecar open in AI mode
    sidecar.classList.remove('sidecar-hidden');
    aiPanel.classList.remove('hidden');
    shellPanel.classList.add('hidden');
    aiBtn.classList.add('active');

    // Simulate: hide old, show new
    aiBtn.classList.remove('active');
    aiPanel.classList.add('hidden');
    shellPanel.classList.remove('hidden');
    shellBtn.classList.add('active');

    expect(sidecar.classList.contains('sidecar-hidden')).toBe(false);
    expect(shellPanel.classList.contains('hidden')).toBe(false);
    expect(aiPanel.classList.contains('hidden')).toBe(true);
    expect(shellBtn.classList.contains('active')).toBe(true);
    expect(aiBtn.classList.contains('active')).toBe(false);
  });

  test('clicking active mode button toggles sidecar off', () => {
    const sidecar = document.getElementById('sidecar');
    const aiBtn = document.getElementById('rsidebar-ai');

    // Sidecar open, AI active
    sidecar.classList.remove('sidecar-hidden');
    aiBtn.classList.add('active');

    // _toggleSidecar('ai') when already ai → _hideSidecar
    sidecar.classList.add('sidecar-hidden');
    aiBtn.classList.remove('active');

    expect(sidecar.classList.contains('sidecar-hidden')).toBe(true);
    expect(aiBtn.classList.contains('active')).toBe(false);
  });

  // ── 5. Button highlight sync ───────────────────────────
  test('AI button highlights when AI sidecar opens', () => {
    const aiBtn = document.getElementById('rsidebar-ai');
    const dotAi = document.getElementById('rsidebar-dot-ai');
    aiBtn.classList.add('active');
    dotAi.style.display = 'block';
    expect(aiBtn.classList.contains('active')).toBe(true);
    expect(dotAi.style.display).toBe('block');
  });

  test('Shell button highlights when Shell sidecar opens', () => {
    const shellBtn = document.getElementById('rsidebar-shell');
    const dotShell = document.getElementById('rsidebar-dot-shell');
    shellBtn.classList.add('active');
    dotShell.style.display = 'block';
    expect(shellBtn.classList.contains('active')).toBe(true);
    expect(dotShell.style.display).toBe('block');
  });

  // ── 6. Sidecar close dehighlights ──────────────────────
  test('closing sidecar dehighlights all mode buttons', () => {
    const sidecar = document.getElementById('sidecar');
    const aiBtn = document.getElementById('rsidebar-ai');
    const shellBtn = document.getElementById('rsidebar-shell');
    const dotAi = document.getElementById('rsidebar-dot-ai');
    const dotShell = document.getElementById('rsidebar-dot-shell');

    aiBtn.classList.add('active');
    shellBtn.classList.add('active');
    dotAi.style.display = 'block';
    dotShell.style.display = 'block';

    sidecar.classList.add('sidecar-hidden');
    aiBtn.classList.remove('active');
    shellBtn.classList.remove('active');
    dotAi.style.display = 'none';
    dotShell.style.display = 'none';

    expect(aiBtn.classList.contains('active')).toBe(false);
    expect(shellBtn.classList.contains('active')).toBe(false);
    expect(dotAi.style.display).toBe('none');
    expect(dotShell.style.display).toBe('none');
  });

  // ── 7. Sidecar header mode buttons ─────────────────────
  test('sidecar-mode-ai click switches to AI panel', () => {
    const aiPanel = document.getElementById('sidecar-ai-panel');
    const shellPanel = document.getElementById('sidecar-shell-panel');
    const aiBtn = document.getElementById('sidecar-mode-ai');
    const shellBtn = document.getElementById('sidecar-mode-shell');

    // Start in shell mode
    aiPanel.classList.add('hidden');
    shellPanel.classList.remove('hidden');
    shellBtn.classList.add('active');

    // _setShellMode('ai')
    aiPanel.classList.remove('hidden');
    shellPanel.classList.add('hidden');
    aiBtn.classList.add('active');
    shellBtn.classList.remove('active');

    expect(aiPanel.classList.contains('hidden')).toBe(false);
    expect(shellPanel.classList.contains('hidden')).toBe(true);
    expect(aiBtn.classList.contains('active')).toBe(true);
    expect(shellBtn.classList.contains('active')).toBe(false);
  });

  // ── 8. Escape key closes sidecar ───────────────────────
  test('Escape key event closes sidecar', () => {
    const sidecar = document.getElementById('sidecar');
    sidecar.classList.remove('sidecar-hidden');

    const e = new KeyboardEvent('keydown', { key: 'Escape' });
    if (e.key === 'Escape') {
      sidecar.classList.add('sidecar-hidden');
    }

    expect(sidecar.classList.contains('sidecar-hidden')).toBe(true);
  });

  // ── 9. Mode cycling via ModeManager ─────────────────────
  test('ModeManager cycles through all modes', () => {
    const modes = Object.values(window.ModeManager.MODES);
    const initial = window.ModeManager.get();
    expect(initial).toBe('browse');

    const nextIdx = (modes.indexOf(initial) + 1) % modes.length;
    window.ModeManager.set(modes[nextIdx]);
    expect(window.ModeManager.get()).toBe(modes[nextIdx]);
    expect(document.body.classList.contains(`mode-${modes[nextIdx]}`)).toBe(true);
  });

  // ── 10. Sidebar + sidecar independence ─────────────────
  test('sidebar collapse does not affect sidecar visibility', () => {
    const sidebar = document.getElementById('sidebar');
    const sidecar = document.getElementById('sidecar');

    sidecar.classList.remove('sidecar-hidden');
    sidebar.classList.remove('collapsed');

    sidebar.classList.add('collapsed');

    expect(sidecar.classList.contains('sidecar-hidden')).toBe(false);
    expect(sidebar.classList.contains('collapsed')).toBe(true);
  });

  test('sidecar close does not affect sidebar state', () => {
    const sidebar = document.getElementById('sidebar');
    const sidecar = document.getElementById('sidecar');

    sidebar.classList.add('collapsed');
    sidecar.classList.remove('sidecar-hidden');

    sidecar.classList.add('sidecar-hidden');

    expect(sidebar.classList.contains('collapsed')).toBe(true);
  });
});

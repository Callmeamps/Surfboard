/**
 * Canvas Pages module tests
 * Tests IPC-backed data loading, native mode detection, and public API.
 */
describe('CanvasPages', () => {
  let mockStorage;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <aside id="right-sidebar" class="collapsed">
          <div id="right-sidebar-tools"></div>
          <button id="right-sidebar-toggle"></button>
        </aside>
        <div id="popup-panel" class="hidden">
          <div id="popup-panel-header">
            <span id="popup-panel-title">Panel</span>
            <div id="popup-panel-actions">
              <button id="popup-panel-pin" class="popup-panel-btn">Pin</button>
              <button id="popup-panel-close" class="popup-panel-btn">Close</button>
            </div>
          </div>
          <div id="popup-panel-content"></div>
        </div>
        <div id="canvas-host" class="hidden">
          <div id="canvas-host-header">
            <span id="canvas-host-title">Canvas</span>
            <button id="canvas-host-close" class="popup-panel-btn">Close</button>
          </div>
          <div id="canvas-host-content"></div>
        </div>
      </div>
    `;

    // Mock electronAPI.storage
    mockStorage = {
      getHistory: jest.fn().mockResolvedValue([]),
      getBookmarks: jest.fn().mockResolvedValue([]),
    };
    window.electronAPI = { storage: mockStorage };

    // Reset modules
    delete window.RightSidebar;
    delete window.CanvasPages;

    const rsSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/renderer/js/right-sidebar.js'), 'utf8'
    );
    const cpSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/renderer/js/canvas-pages.js'), 'utf8'
    );
    eval(rsSrc);
    eval(cpSrc);
    window.CanvasPages.init();
  });

  afterEach(() => {
    delete window.electronAPI;
  });

  // ── Public API surface ──────────────────────────────────

  test('CanvasPages exposes all public methods', () => {
    expect(window.CanvasPages).toBeDefined();
    expect(typeof window.CanvasPages.init).toBe('function');
    expect(typeof window.CanvasPages.open).toBe('function');
    expect(typeof window.CanvasPages.close).toBe('function');
    expect(typeof window.CanvasPages.isOpen).toBe('function');
    expect(typeof window.CanvasPages.getCurrent).toBe('function');
    expect(typeof window.CanvasPages.isNativeMode).toBe('function');
    expect(typeof window.CanvasPages.onChange).toBe('function');
    expect(typeof window.CanvasPages.reset).toBe('function');
  });

  test('isOpen returns false initially', () => {
    expect(window.CanvasPages.isOpen()).toBe(false);
  });

  test('getCurrent returns null initially', () => {
    expect(window.CanvasPages.getCurrent()).toBeNull();
  });

  test('isNativeMode returns a boolean', () => {
    expect(typeof window.CanvasPages.isNativeMode()).toBe('boolean');
  });

  // ── History page ─────────────────────────────────────────

  test('open history page with empty data shows placeholder', async () => {
    mockStorage.getHistory.mockResolvedValue([]);
    await window.CanvasPages.open('history');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('No history yet');
    expect(mockStorage.getHistory).toHaveBeenCalledWith(100);
  });

  test('open history page with data shows grouped entries', async () => {
    const now = Date.now();
    mockStorage.getHistory.mockResolvedValue([
      { url: 'https://example.com', title: 'Example', time: now - 60000 },
      { url: 'https://test.com', title: 'Test', time: now - 7200000 },
    ]);
    await window.CanvasPages.open('history');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('Today');
    expect(content).toContain('Example');
    expect(content).toContain('Test');
  });

  test('history page shows error on IPC failure', async () => {
    mockStorage.getHistory.mockRejectedValue(new Error('IPC broken'));
    await window.CanvasPages.open('history');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('Failed to load history');
  });

  test('history page shows error when electronAPI unavailable', async () => {
    delete window.electronAPI;
    delete window.CanvasPages;
    const cpSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/renderer/js/canvas-pages.js'), 'utf8'
    );
    eval(cpSrc);
    window.CanvasPages.init();
    await window.CanvasPages.open('history');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('IPC unavailable');
  });

  // ── Bookmarks page ───────────────────────────────────────

  test('open bookmarks page with empty data shows placeholder', async () => {
    mockStorage.getBookmarks.mockResolvedValue([]);
    await window.CanvasPages.open('bookmarks');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('No bookmarks yet');
    expect(mockStorage.getBookmarks).toHaveBeenCalled();
  });

  test('open bookmarks page with data shows items', async () => {
    mockStorage.getBookmarks.mockResolvedValue([
      { url: 'https://example.com', label: 'Example', icon: '🔖' },
      { url: 'https://test.com', label: 'Test Site' },
    ]);
    await window.CanvasPages.open('bookmarks');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('Example');
    expect(content).toContain('Test Site');
  });

  test('bookmarks page shows error on IPC failure', async () => {
    mockStorage.getBookmarks.mockRejectedValue(new Error('IPC broken'));
    await window.CanvasPages.open('bookmarks');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('Failed to load bookmarks');
  });

  // ── Placeholder pages ────────────────────────────────────

  test('open activity page shows coming soon', async () => {
    await window.CanvasPages.open('activity');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('coming soon');
  });

  test('open agents page shows coming soon', async () => {
    await window.CanvasPages.open('agents');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('coming soon');
  });

  test('open bash page shows coming soon', async () => {
    await window.CanvasPages.open('bash');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('coming soon');
  });

  // ── Canvas host state ────────────────────────────────────

  test('canvas host is visible after opening a page', async () => {
    await window.CanvasPages.open('activity');
    expect(document.getElementById('canvas-host').classList.contains('hidden')).toBe(false);
  });

  test('canvas title is set correctly', async () => {
    await window.CanvasPages.open('history');
    expect(document.getElementById('canvas-host-title').textContent).toBe('Browsing History');
  });

  test('opening unknown page id does nothing', async () => {
    const before = document.getElementById('canvas-host').className;
    await window.CanvasPages.open('nonexistent');
    expect(document.getElementById('canvas-host').className).toBe(before);
  });

  // ── isOpen / getCurrent after open ───────────────────────

  test('isOpen and getCurrent update after opening', async () => {
    await window.CanvasPages.open('bookmarks');
    expect(window.CanvasPages.isOpen()).toBe(true);
    expect(window.CanvasPages.getCurrent()).toBe('bookmarks');
  });

  test('isOpen and getCurrent reset after close', async () => {
    await window.CanvasPages.open('history');
    window.CanvasPages.close();
    expect(window.CanvasPages.isOpen()).toBe(false);
    expect(window.CanvasPages.getCurrent()).toBeNull();
  });

  // ── onChange subscriber ───────────────────────────────────

  test('onChange fires when page opens', async () => {
    const spy = jest.fn();
    window.CanvasPages.onChange(spy);
    await window.CanvasPages.open('activity');
    expect(spy).toHaveBeenCalledWith('activity');
  });

  test('onChange fires with null on close', async () => {
    const spy = jest.fn();
    await window.CanvasPages.open('history');
    window.CanvasPages.onChange(spy);
    window.CanvasPages.close();
    expect(spy).toHaveBeenCalledWith(null);
  });

  // ── reset ────────────────────────────────────────────────

  test('reset clears state and subscribers', async () => {
    await window.CanvasPages.open('bookmarks');
    const spy = jest.fn();
    window.CanvasPages.onChange(spy);
    window.CanvasPages.reset();
    expect(window.CanvasPages.isOpen()).toBe(false);
    expect(window.CanvasPages.getCurrent()).toBeNull();
    // Subscriber list cleared — next open shouldn't notify old spy
    await window.CanvasPages.open('history');
    expect(spy).not.toHaveBeenCalled();
  });

  // ── Native mode canvas element ───────────────────────────

  test('native mode creates canvas element in host', () => {
    if (window.CanvasPages.isNativeMode()) {
      const canvas = document.getElementById('canvas-pages-native');
      expect(canvas).not.toBeNull();
      expect(canvas.tagName).toBe('CANVAS');
    } else {
      // Fallback mode — no canvas element
      expect(document.getElementById('canvas-pages-native')).toBeNull();
    }
  });
});

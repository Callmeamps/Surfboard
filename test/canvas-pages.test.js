/**
 * Canvas Pages module tests
 */
describe('CanvasPages', () => {
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

  test('CanvasPages is exposed on window', () => {
    expect(window.CanvasPages).toBeDefined();
    expect(typeof window.CanvasPages.init).toBe('function');
    expect(typeof window.CanvasPages.open).toBe('function');
  });

  test('open history page with empty data shows placeholder', () => {
    window._phase7History = [];
    window.CanvasPages.open('history');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('No history yet');
  });

  test('open history page with data shows grouped entries', () => {
    const now = Date.now();
    window._phase7History = [
      { url: 'https://example.com', title: 'Example', time: now - 60000 },
      { url: 'https://test.com', title: 'Test', time: now - 7200000 },
    ];
    window.CanvasPages.open('history');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('Today');
    expect(content).toContain('Example');
    expect(content).toContain('Test');
  });

  test('open bookmarks page with empty data shows placeholder', () => {
    window._phase7Bookmarks = [];
    window.CanvasPages.open('bookmarks');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('No bookmarks yet');
  });

  test('open bookmarks page with data shows items', () => {
    window._phase7Bookmarks = [
      { url: 'https://example.com', label: 'Example', icon: '🔖' },
      { url: 'https://test.com', label: 'Test Site' },
    ];
    window.CanvasPages.open('bookmarks');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('Example');
    expect(content).toContain('Test Site');
  });

  test('open activity page shows coming soon', () => {
    window.CanvasPages.open('activity');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('coming soon');
  });

  test('open agents page shows coming soon', () => {
    window.CanvasPages.open('agents');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('coming soon');
  });

  test('open bash page shows coming soon', () => {
    window.CanvasPages.open('bash');
    const content = document.getElementById('canvas-host-content').innerHTML;
    expect(content).toContain('coming soon');
  });

  test('canvas host is visible after opening a page', () => {
    window.CanvasPages.open('activity');
    expect(document.getElementById('canvas-host').classList.contains('hidden')).toBe(false);
  });

  test('canvas title is set correctly', () => {
    window.CanvasPages.open('history');
    expect(document.getElementById('canvas-host-title').textContent).toBe('Browsing History');
  });

  test('opening unknown page id does nothing', () => {
    const before = document.getElementById('canvas-host').className;
    window.CanvasPages.open('nonexistent');
    expect(document.getElementById('canvas-host').className).toBe(before);
  });
});

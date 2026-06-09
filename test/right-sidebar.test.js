/**
 * Right Sidebar module tests
 */
describe('RightSidebar', () => {
  beforeEach(() => {
    // Reset the DOM state
    document.body.innerHTML = `
      <div id="app">
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
            <button id="rsidebar-actions" class="rsidebar-btn" title="Actions">
              <span class="rsidebar-dot" id="rsidebar-dot-actions"></span>
            </button>
            <button id="rsidebar-data" class="rsidebar-btn" title="Data">
              <span class="rsidebar-dot" id="rsidebar-dot-data"></span>
            </button>
            <button id="rsidebar-workflows" class="rsidebar-btn" title="Workflows">
              <span class="rsidebar-dot" id="rsidebar-dot-workflows"></span>
            </button>
            <button id="rsidebar-miniapps" class="rsidebar-btn" title="Miniapps">
              <span class="rsidebar-dot" id="rsidebar-dot-miniapps"></span>
            </button>
          </div>
          <button id="right-sidebar-toggle">Toggle</button>
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

    // Reset window.RightSidebar
    delete window.RightSidebar;
    delete window.CanvasPages;

    // Re-init the module
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/renderer/js/right-sidebar.js'), 'utf8'
    );
    eval(src);
  });

  test('RightSidebar is exposed on window', () => {
    expect(window.RightSidebar).toBeDefined();
    expect(typeof window.RightSidebar.openPanel).toBe('function');
    expect(typeof window.RightSidebar.closePanel).toBe('function');
  });

  test('sidebar starts collapsed', () => {
    expect(window.RightSidebar.isSidebarCollapsed()).toBe(true);
    expect(document.getElementById('right-sidebar').classList.contains('collapsed')).toBe(true);
  });

  test('toggleSidebar expands and collapses', () => {
    window.RightSidebar.toggleSidebar();
    expect(window.RightSidebar.isSidebarCollapsed()).toBe(false);
    window.RightSidebar.toggleSidebar();
    expect(window.RightSidebar.isSidebarCollapsed()).toBe(true);
  });

  test('openPanel makes popup visible and sets title', () => {
    window.RightSidebar.openPanel('ai', 'AI Panel');
    expect(document.getElementById('popup-panel').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('popup-panel-title').textContent).toBe('AI Panel');
  });

  test('openPanel toggles off when same panel clicked', () => {
    window.RightSidebar.openPanel('ai', 'AI Panel');
    expect(document.getElementById('popup-panel').classList.contains('hidden')).toBe(false);
    window.RightSidebar.openPanel('ai', 'AI Panel');
    expect(document.getElementById('popup-panel').classList.contains('hidden')).toBe(true);
  });

  test('closePanel hides popup and clears state', () => {
    window.RightSidebar.openPanel('ai', 'AI');
    window.RightSidebar.closePanel();
    expect(document.getElementById('popup-panel').classList.contains('hidden')).toBe(true);
  });

  test('pinPanel prevents close', () => {
    window.RightSidebar.openPanel('ai', 'AI');
    window.RightSidebar.pinPanel();
    window.RightSidebar.closePanel();
    expect(document.getElementById('popup-panel').classList.contains('hidden')).toBe(false);
  });

  test('opening different panel switches content', () => {
    window.RightSidebar.openPanel('ai', 'AI Panel');
    expect(document.getElementById('popup-panel-title').textContent).toBe('AI Panel');
    window.RightSidebar.openPanel('shell', 'Shell Panel');
    expect(document.getElementById('popup-panel-title').textContent).toBe('Shell Panel');
  });

  test('dot indicators show on active panel button', () => {
    window.RightSidebar.openPanel('ai', 'AI');
    expect(document.getElementById('rsidebar-dot-ai').style.display).toBe('block');
    expect(document.getElementById('rsidebar-ai').classList.contains('active')).toBe(true);
    // Other dots hidden
    expect(document.getElementById('rsidebar-dot-shell').style.display).toBe('none');
  });

  test('dot indicators clear when panel closed', () => {
    window.RightSidebar.openPanel('ai', 'AI');
    window.RightSidebar.closePanel();
    expect(document.getElementById('rsidebar-dot-ai').style.display).toBe('none');
    expect(document.getElementById('rsidebar-ai').classList.contains('active')).toBe(false);
  });

  test('isPanelOpen returns correct state', () => {
    expect(window.RightSidebar.isPanelOpen('ai')).toBe(false);
    window.RightSidebar.openPanel('ai', 'AI');
    expect(window.RightSidebar.isPanelOpen('ai')).toBe(true);
    expect(window.RightSidebar.isPanelOpen('shell')).toBe(false);
  });

  test('openCanvas shows canvas host', () => {
    window.RightSidebar.openCanvas('Test Canvas', '<p>Content</p>');
    expect(window.RightSidebar.isCanvasOpen()).toBe(true);
    expect(document.getElementById('canvas-host').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('canvas-host-title').textContent).toBe('Test Canvas');
    expect(document.getElementById('canvas-host-content').innerHTML).toBe('<p>Content</p>');
  });

  test('closeCanvas hides canvas host', () => {
    window.RightSidebar.openCanvas('Test', '<p>x</p>');
    window.RightSidebar.closeCanvas();
    expect(window.RightSidebar.isCanvasOpen()).toBe(false);
    expect(document.getElementById('canvas-host').classList.contains('hidden')).toBe(true);
  });

  test('close button hides popup panel', () => {
    window.RightSidebar.openPanel('ai', 'AI');
    document.getElementById('popup-panel-close').click();
    expect(document.getElementById('popup-panel').classList.contains('hidden')).toBe(true);
  });

  test('canvas close button hides canvas host', () => {
    window.RightSidebar.openCanvas('Test', '<p>x</p>');
    document.getElementById('canvas-host-close').click();
    expect(window.RightSidebar.isCanvasOpen()).toBe(false);
  });
});

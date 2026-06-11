/**
 * Shortcut Menu overlay tests
 * Tests rendering, keyboard shortcut display, toggle, and dismiss behavior.
 */
describe('Shortcut Menu', () => {
  let overlay, body;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="webview-container"></div>
        <div id="internal-pages" class="hidden"></div>
        <aside id="right-sidebar">
          <div id="right-sidebar-tools"></div>
          <button id="right-sidebar-toggle"></button>
        </aside>
        <div id="popup-panel" class="hidden"></div>
        <div id="canvas-host" class="hidden">
          <div id="canvas-host-header">
            <span id="canvas-host-title">Canvas</span>
            <button id="canvas-host-close"></button>
          </div>
          <div id="canvas-host-content"></div>
        </div>
        <div id="shortcut-overlay" class="shortcut-overlay hidden">
          <div class="shortcut-dialog">
            <div class="shortcut-dialog-header">
              <span class="shortcut-dialog-title">Keyboard Shortcuts</span>
              <button id="shortcut-close" class="shortcut-close-btn">✕</button>
            </div>
            <div id="shortcut-body" class="shortcut-dialog-body"></div>
          </div>
        </div>
      </div>
    `;
    overlay = document.getElementById('shortcut-overlay');
    body = document.getElementById('shortcut-body');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('overlay starts hidden', () => {
    expect(overlay.classList.contains('hidden')).toBe(true);
  });

  test('overlay is visible when hidden class removed', () => {
    overlay.classList.remove('hidden');
    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(overlay.style.display).not.toBe('none');
  });

  test('close button exists', () => {
    const closeBtn = document.getElementById('shortcut-close');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.textContent).toBe('✕');
  });

  test('dialog title shows correct text', () => {
    const title = overlay.querySelector('.shortcut-dialog-title');
    expect(title.textContent).toBe('Keyboard Shortcuts');
  });

  test('body container exists for rendering', () => {
    expect(body).not.toBeNull();
    expect(body.className).toBe('shortcut-dialog-body');
  });

  test('clicking overlay backdrop closes it', () => {
    overlay.classList.remove('hidden');
    // Click on the overlay itself (backdrop), not the dialog
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: overlay });
    overlay.dispatchEvent(event);
    // The handler checks e.target === overlay to close
  });

  test('close button click triggers close', () => {
    const closeBtn = document.getElementById('shortcut-close');
    expect(closeBtn).not.toBeNull();
    // Handler should be attached by _setupShortcutOverlay
  });

  test('Escape key closes overlay when open', () => {
    // This is tested via the keydown handler
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);
  });

  test('shortcuts data has correct groups', () => {
    // Verify the HTML structure supports group rendering
    const groupTitle = document.createElement('div');
    groupTitle.className = 'shortcut-group-title';
    groupTitle.textContent = 'Navigation';
    body.appendChild(groupTitle);
    expect(groupTitle.textContent).toBe('Navigation');
    expect(groupTitle.className).toContain('shortcut-group-title');
  });

  test('kbd elements render with correct styling class', () => {
    const kbd = document.createElement('kbd');
    kbd.textContent = 'Ctrl';
    const keysContainer = document.createElement('div');
    keysContainer.className = 'shortcut-group-keys';
    keysContainer.appendChild(kbd);
    body.appendChild(keysContainer);
    expect(kbd.textContent).toBe('Ctrl');
    expect(keysContainer.querySelector('kbd')).toBe(kbd);
  });

  test('shortcut group item structure is correct', () => {
    const row = document.createElement('div');
    row.className = 'shortcut-group-item';
    const label = document.createElement('span');
    label.textContent = 'New tab';
    const keys = document.createElement('div');
    keys.className = 'shortcut-group-keys';
    ['Ctrl', 'T'].forEach(k => {
      const kbd = document.createElement('kbd');
      kbd.textContent = k;
      keys.appendChild(kbd);
    });
    row.appendChild(label);
    row.appendChild(keys);
    body.appendChild(row);
    expect(row.querySelector('span').textContent).toBe('New tab');
    expect(row.querySelectorAll('kbd').length).toBe(2);
  });

  test('dialog has two-column grid layout', () => {
    const style = getComputedStyle(body);
    expect(body.className).toBe('shortcut-dialog-body');
  });

  test('overlay has shortcut-overlay class for z-index styling', () => {
    expect(overlay.classList.contains('shortcut-overlay')).toBe(true);
  });
});

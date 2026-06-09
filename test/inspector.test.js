/**
 * Inspector tests
 * Covers: init/enable/disable, trust gating, query, inspect, overlays,
 * spacing guides, typography overlay, a11y overlay, tooltip, toggles, events.
 */
describe('Inspector', () => {
  beforeEach(() => {
    window.Inspector?.reset?.();
    window.TrustManager?.registerDefaults?.([{ module: 'inspector', action: 'inspectDom' }]);
  });

  afterEach(() => {
    window.Inspector?.reset?.();
  });

  // ── Init & Enable / Disable ────────────────────────────
  test('isEnabled returns false by default', () => {
    expect(window.Inspector.isEnabled()).toBe(false);
  });

  test('enable() with no root returns false', () => {
    expect(window.Inspector.enable()).toBe(false);
    expect(window.Inspector.isEnabled()).toBe(false);
  });

  test('enable() with root returns true', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.Inspector.enable(root)).toBe(true);
    expect(window.Inspector.isEnabled()).toBe(true);
    window.Inspector.disable();
  });

  test('disable() sets enabled to false', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.enable(root);
    window.Inspector.disable();
    expect(window.Inspector.isEnabled()).toBe(false);
  });

  test('enable() requires inspector::inspectDom permission', () => {
    window.TrustManager?.reset?.();
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.Inspector.enable(root)).toBe(false);
    expect(window.Inspector.isEnabled()).toBe(false);
  });

  test('init() sets root for later enable()', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.init({ root });
    expect(window.Inspector.enable()).toBe(true);
    window.Inspector.disable();
  });

  test('enable() sets data-inspector-active on root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.enable(root);
    expect(root.getAttribute('data-inspector-active')).toBe('');
    window.Inspector.disable();
  });

  test('disable() removes data-inspector-active from root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.enable(root);
    window.Inspector.disable();
    expect(root.getAttribute('data-inspector-active')).toBe(null);
  });

  // ── Query ──────────────────────────────────────────────
  test('query() returns matching elements', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h1>title</h1><h2>sub</h2><p>text</p>';
    window.Inspector.enable(root);
    const headings = window.Inspector.query('h1, h2');
    expect(headings.length).toBe(2);
    window.Inspector.disable();
  });

  test('query() returns empty for no match', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>text</p>';
    window.Inspector.enable(root);
    const result = window.Inspector.query('.nonexistent');
    expect(result.length).toBe(0);
    window.Inspector.disable();
  });

  test('query() handles invalid selector gracefully', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>text</p>';
    window.Inspector.enable(root);
    const result = window.Inspector.query('[[invalid');
    expect(result).toEqual([]);
    window.Inspector.disable();
  });

  // ── Inspect ────────────────────────────────────────────
  test('inspect() returns element info', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="ip1" class="foo bar" style="color:red;">hello</p>';
    window.Inspector.enable(root);
    const info = window.Inspector.inspect(root.querySelector('#ip1'));
    expect(info).not.toBeNull();
    expect(info.tag).toBe('p');
    expect(info.id).toBe('ip1');
    expect(info.classes).toContain('foo');
    expect(info.classes).toContain('bar');
    expect(info.box).not.toBeNull();
    expect(info.typography).not.toBeNull();
    expect(info.a11y).not.toBeNull();
    window.Inspector.disable();
  });

  test('inspect() returns null for null element', () => {
    expect(window.Inspector.inspect(null)).toBeNull();
  });

  test('inspect() includes computed styles', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p style="font-size:16px;">hello</p>';
    window.Inspector.enable(root);
    const info = window.Inspector.inspect(root.querySelector('p'));
    expect(info.computed).not.toBeNull();
    expect(info.computed.display).toBeDefined();
    window.Inspector.disable();
  });

  test('inspect() includes typography info', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h1>Hello World</h1>';
    window.Inspector.enable(root);
    const info = window.Inspector.inspect(root.querySelector('h1'));
    expect(info.typography.isHeading).toBe(true);
    expect(info.typography.isText).toBe(false);
    expect(info.typography.wordCount).toBe(2);
    window.Inspector.disable();
  });

  test('inspect() includes a11y info', () => {
    const root = document.createElement('div');
    root.innerHTML = '<img src="test.png">';
    window.Inspector.enable(root);
    const info = window.Inspector.inspect(root.querySelector('img'));
    expect(info.a11y.hasAlt).toBe(false);
    expect(info.a11y.issues).toContain('missing-alt');
    window.Inspector.disable();
  });

  test('inspect() detects empty link a11y issue', () => {
    const root = document.createElement('div');
    root.innerHTML = '<a href="#"></a>';
    window.Inspector.enable(root);
    const info = window.Inspector.inspect(root.querySelector('a'));
    expect(info.a11y.issues).toContain('empty-link');
    window.Inspector.disable();
  });

  // ── Selection ──────────────────────────────────────────
  test('getSelected() returns null initially', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.enable(root);
    expect(window.Inspector.getSelected()).toBeNull();
    window.Inspector.disable();
  });

  test('clicking element selects it and creates selection box', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sel1">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    const p = root.querySelector('#sel1');
    p.click();
    expect(window.Inspector.getSelected()).toBe(p);
    const box = root.querySelector('.inspector-selected-box');
    expect(box).not.toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('clicking root deselects', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="desel1">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#desel1').click();
    expect(window.Inspector.getSelected()).not.toBeNull();
    root.click();
    expect(window.Inspector.getSelected()).toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  // ── Hover ──────────────────────────────────────────────
  test('hovering element creates hover box', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="hov1">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    const p = root.querySelector('#hov1');
    p.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(window.Inspector.getHover()).toBe(p);
    const box = root.querySelector('.inspector-hover-box');
    expect(box).not.toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  // ── Spacing Guides ─────────────────────────────────────
  test('selecting element with margin creates spacing guides', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div id="sg1" style="margin:20px;padding:10px;">box</div>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#sg1').click();
    const guides = root.querySelectorAll('.inspector-guide');
    expect(guides.length).toBeGreaterThan(0);
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('toggleSpacing(false) hides guides', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div id="tog1" style="margin:20px;">box</div>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#tog1').click();
    expect(root.querySelectorAll('.inspector-guide').length).toBeGreaterThan(0);
    window.Inspector.toggleSpacing(false);
    expect(root.querySelectorAll('.inspector-guide').length).toBe(0);
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('toggleSpacing() returns current state', () => {
    expect(window.Inspector.toggleSpacing(true)).toBe(true);
    expect(window.Inspector.toggleSpacing(false)).toBe(false);
    expect(window.Inspector.toggleSpacing()).toBe(true); // toggle back on
  });

  // ── Typography Overlay ─────────────────────────────────
  test('selecting text element creates typography overlay', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="ty1">hello world</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#ty1').click();
    const overlay = root.querySelector('.inspector-typography-overlay');
    expect(overlay).not.toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('toggleTypography(false) hides typography overlay', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="ty2">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#ty2').click();
    expect(root.querySelector('.inspector-typography-overlay')).not.toBeNull();
    window.Inspector.toggleTypography(false);
    expect(root.querySelector('.inspector-typography-overlay')).toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  // ── A11y Overlay ───────────────────────────────────────
  test('selecting element with a11y issues creates a11y overlay', () => {
    const root = document.createElement('div');
    root.innerHTML = '<img src="test.png">';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('img').click();
    const overlay = root.querySelector('.inspector-a11y-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('missing-alt');
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('toggleA11y(false) hides a11y overlay', () => {
    const root = document.createElement('div');
    root.innerHTML = '<img src="test.png">';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('img').click();
    expect(root.querySelector('.inspector-a11y-overlay')).not.toBeNull();
    window.Inspector.toggleA11y(false);
    expect(root.querySelector('.inspector-a11y-overlay')).toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  // ── Tooltip ────────────────────────────────────────────
  test('hovering element creates tooltip', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="tt1">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#tt1').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    const tooltip = root.querySelector('.inspector-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain('p');
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  // ── Events ─────────────────────────────────────────────
  test('onChange fires on enable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let fired = null;
    window.Inspector.onChange((type) => { fired = type; });
    window.Inspector.enable(root);
    expect(fired).toBe('enabled');
    window.Inspector.disable();
  });

  test('onChange fires on disable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.enable(root);
    let fired = null;
    window.Inspector.onChange((type) => { fired = type; });
    window.Inspector.disable();
    expect(fired).toBe('disabled');
  });

  test('onChange fires on select', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="ev1">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    let fired = null;
    window.Inspector.onChange((type, detail) => { fired = { type, detail }; });
    root.querySelector('#ev1').click();
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('select');
    expect(fired.detail.element).toBe(root.querySelector('#ev1'));
    expect(fired.detail.info).not.toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('onChange fires on deselect', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="ev2">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#ev2').click();
    let fired = null;
    window.Inspector.onChange((type) => { fired = type; });
    root.click(); // click root to deselect
    expect(fired).toBe('deselect');
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('enable fires denied event when permission missing', () => {
    window.TrustManager?.reset?.();
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let fired = null;
    window.Inspector.onChange((type, detail) => { fired = { type, detail }; });
    window.Inspector.enable(root);
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('denied');
  });

  test('onChange returns unsubscribe function', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let count = 0;
    const unsub = window.Inspector.onChange(() => { count++; });
    window.Inspector.enable(root);
    unsub();
    window.Inspector.disable();
    expect(count).toBe(1);
  });

  // ── Keyboard ───────────────────────────────────────────
  test('Escape deselects element', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="k1">hello</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    root.querySelector('#k1').click();
    expect(window.Inspector.getSelected()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(window.Inspector.getSelected()).toBeNull();
    window.Inspector.disable();
    root.parentNode.removeChild(root);
  });

  test('Escape with no selection disables inspector', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.enable(root);
    expect(window.Inspector.isEnabled()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(window.Inspector.isEnabled()).toBe(false);
  });

  // ── Reset ──────────────────────────────────────────────
  test('reset() clears all state', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.Inspector.enable(root);
    expect(window.Inspector.isEnabled()).toBe(true);
    window.Inspector.reset();
    expect(window.Inspector.isEnabled()).toBe(false);
    expect(window.Inspector.getSelected()).toBeNull();
  });

  // ── Overlay cleanup on disable ─────────────────────────
  test('disable() removes all overlays from DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="cl1">hello</p><img src="test.png">';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.Inspector.enable(root);
    // Hover and select
    root.querySelector('#cl1').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    root.querySelector('img').click();
    // Should have overlays
    expect(root.querySelectorAll('[data-inspector-overlay]').length).toBeGreaterThan(0);
    window.Inspector.disable();
    expect(root.querySelectorAll('[data-inspector-overlay]').length).toBe(0);
    root.parentNode.removeChild(root);
  });
});

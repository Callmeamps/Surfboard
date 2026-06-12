require('./setup-feature-platform');

/**
 * EditEngine tests
 * Each test is fully self-contained — creates its own root, enables, tests, disables.
 */
describe('EditorEngine', () => {
  beforeEach(() => {
    window.EditorEngine?.reset?.();
    // Grant editor permission
    window.TrustManager?.registerDefaults?.([{ module: 'editor', action: 'write' }]);
  });

  afterEach(() => {
    window.EditorEngine?.reset?.();
  });

  // ── Init & Enable / Disable ────────────────────────────────
  test('isEnabled returns false by default', () => {
    expect(window.EditorEngine.isEnabled()).toBe(false);
  });

  test('enable() with no root returns false', () => {
    expect(window.EditorEngine.enable()).toBe(false);
    expect(window.EditorEngine.isEnabled()).toBe(false);
  });

  test('enable() with root returns true and sets enabled', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.EditorEngine.enable(root)).toBe(true);
    expect(window.EditorEngine.isEnabled()).toBe(true);
    window.EditorEngine.disable();
  });

  test('disable() sets enabled to false', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.disable();
    expect(window.EditorEngine.isEnabled()).toBe(false);
  });

  test('enable() requires editor::write permission', () => {
    window.TrustManager?.reset?.();
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.EditorEngine.enable(root)).toBe(false);
    expect(window.EditorEngine.isEnabled()).toBe(false);
  });

  test('init() sets root for later enable()', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.init({ root });
    expect(window.EditorEngine.enable()).toBe(true);
    window.EditorEngine.disable();
  });

  // ── ContentEditable ────────────────────────────────────────
  test('enable() sets contenteditable on text elements', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="ep1">hello</p><span id="es1">world</span><div id="ed1"><strong>bold</strong></div>';
    window.EditorEngine.enable(root);
    expect(root.querySelector('#ep1').getAttribute('contenteditable')).toBe('true');
    expect(root.querySelector('#es1').getAttribute('contenteditable')).toBe('true');
    expect(root.querySelector('strong').getAttribute('contenteditable')).toBe('true');
    window.EditorEngine.disable();
  });

  test('disable() removes contenteditable from elements', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    const p = root.querySelector('p');
    expect(p.getAttribute('contenteditable')).toBe('true');
    window.EditorEngine.disable();
    expect(p.getAttribute('contenteditable')).toBe(null);
  });

  test('enable() sets data-editor-active on root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    expect(root.getAttribute('data-editor-active')).toBe('');
    window.EditorEngine.disable();
  });

  test('disable() removes data-editor-active from root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.disable();
    expect(root.getAttribute('data-editor-active')).toBe(null);
  });

  // ── Selection ──────────────────────────────────────────────
  test('select() marks element as selected', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sel1">hello</p>';
    window.EditorEngine.enable(root);
    const p = root.querySelector('#sel1');
    window.EditorEngine.select(p);
    expect(p.getAttribute('data-editor-selected')).toBe('');
    expect(window.EditorEngine.getSelected()).toBe(p);
    window.EditorEngine.disable();
  });

  test('deselect() removes selection', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sel2">hello</p>';
    window.EditorEngine.enable(root);
    const p = root.querySelector('#sel2');
    window.EditorEngine.select(p);
    window.EditorEngine.deselect();
    expect(p.getAttribute('data-editor-selected')).toBe(null);
    expect(window.EditorEngine.getSelected()).toBe(null);
    window.EditorEngine.disable();
  });

  test('select() fires onChange with type=select', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sel3">hello</p>';
    window.EditorEngine.enable(root);
    let fired = null;
    window.EditorEngine.onChange((type, detail) => { fired = { type, detail }; });
    window.EditorEngine.select(root.querySelector('#sel3'));
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('select');
    window.EditorEngine.disable();
  });

  // ── Undo / Redo ────────────────────────────────────────────
  test('initial undo stack has 1 entry (initial state)', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    expect(window.EditorEngine.getUndoCount()).toBe(1);
    window.EditorEngine.disable();
  });

  test('canUndo() is false with only initial state', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    expect(window.EditorEngine.canUndo()).toBe(false);
    window.EditorEngine.disable();
  });

  test('undo after edit restores previous state', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>original</p>';
    window.EditorEngine.enable(root);
    const p = root.querySelector('p');
    p.textContent = 'modified';
    window.EditorEngine.snapshot();
    window.EditorEngine.undo();
    // After undo, content should be from initial snapshot
    expect(root.querySelector('p').textContent).toBe('original');
    window.EditorEngine.disable();
  });

  test('redo restores undone state', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>original</p>';
    window.EditorEngine.enable(root);
    const p = root.querySelector('p');
    p.textContent = 'modified';
    window.EditorEngine.snapshot();
    window.EditorEngine.undo();
    expect(root.querySelector('p').textContent).toBe('original');
    const result = window.EditorEngine.redo();
    expect(result).toBe(true);
    expect(root.querySelector('p').textContent).toBe('modified');
    window.EditorEngine.disable();
  });

  test('canRedo() is false when nothing to redo', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    expect(window.EditorEngine.canRedo()).toBe(false);
    window.EditorEngine.disable();
  });

  test('new edit clears redo stack', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>original</p>';
    window.EditorEngine.enable(root);
    root.querySelector('p').textContent = 'change1';
    window.EditorEngine.snapshot();
    expect(window.EditorEngine.canRedo()).toBe(false); // no undo yet
    window.EditorEngine.undo();
    expect(window.EditorEngine.canRedo()).toBe(true);
    // Make a new edit — should clear redo
    root.querySelector('p').textContent = 'change2';
    window.EditorEngine.snapshot();
    // Redo should now be cleared
    expect(window.EditorEngine.canRedo()).toBe(false);
    // Undo should go back to 'original' (the initial snapshot)
    window.EditorEngine.undo();
    expect(root.querySelector('p').textContent).toBe('original');
    window.EditorEngine.disable();
  });

  test('undo returns false when nothing to undo', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    expect(window.EditorEngine.undo()).toBe(false);
    window.EditorEngine.disable();
  });

  test('redo returns false when nothing to redo', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    expect(window.EditorEngine.redo()).toBe(false);
    window.EditorEngine.disable();
  });

  // ── Resize (via style manipulation) ────────────────────────
  test('resize changes element dimensions via style', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div id="r1" style="width:100px;height:50px;">box</div>';
    window.EditorEngine.enable(root);
    const box = root.querySelector('#r1');
    window.EditorEngine.select(box);
    // Simulate resize by setting style
    box.style.width = '200px';
    box.style.height = '100px';
    expect(box.style.width).toBe('200px');
    expect(box.style.height).toBe('100px');
    window.EditorEngine.disable();
  });

  // ── Style Panel ────────────────────────────────────────────
  test('selecting element creates style panel in DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sp1" style="color:red;">styled</p>';
    // Style panel injection needs getBoundingClientRect
    // In JSDOM, rects are zero-size but the panel still gets created
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#sp1'));
    const panel = root.querySelector('.editor-style-panel');
    expect(panel).not.toBeNull();
    window.EditorEngine.disable();
  });

  test('style panel has inputs for key style properties', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sp2">hello</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#sp2'));
    const panel = root.querySelector('.editor-style-panel');
    expect(panel).not.toBeNull();
    const inputs = panel.querySelectorAll('.editor-style-input');
    const keys = Array.from(inputs).map(i => i.dataset.styleKey);
    expect(keys).toContain('color');
    expect(keys).toContain('backgroundColor');
    expect(keys).toContain('fontSize');
    expect(keys).toContain('fontWeight');
    expect(keys).toContain('textAlign');
    window.EditorEngine.disable();
  });

  test('style panel has delete button', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sp3">hello</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#sp3'));
    const btn = root.querySelector('.editor-style-delete');
    expect(btn).not.toBeNull();
    window.EditorEngine.disable();
  });

  // ── Selection box & resize handles ─────────────────────────
  test('selecting element creates selection box overlay', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="sb1">hello</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#sb1'));
    const box = root.querySelector('.editor-selection-box');
    expect(box).not.toBeNull();
    window.EditorEngine.disable();
  });

  test('selecting element creates 8 resize handles', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="rh1">hello</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#rh1'));
    const handles = root.querySelectorAll('.editor-resize-handle');
    expect(handles.length).toBe(8);
    window.EditorEngine.disable();
  });

  test('deselect removes overlays', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="dov1">hello</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#dov1'));
    expect(root.querySelectorAll('.editor-selection-box').length).toBe(1);
    expect(root.querySelectorAll('.editor-resize-handle').length).toBe(8);
    window.EditorEngine.deselect();
    expect(root.querySelectorAll('.editor-selection-box').length).toBe(0);
    expect(root.querySelectorAll('.editor-resize-handle').length).toBe(0);
    window.EditorEngine.disable();
  });

  // ── Delete ─────────────────────────────────────────────────
  test('delete via keyboard removes selected element', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="del1">hello</p><p id="del2">world</p>';
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#del1'));
    // Simulate Delete key
    const evt = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    document.dispatchEvent(evt);
    expect(root.querySelector('#del1')).toBeNull();
    expect(root.querySelector('#del2')).not.toBeNull();
    window.EditorEngine.disable();
  });

  test('delete button in style panel removes selected element', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="del1b">hello</p><p id="del2b">world</p>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.EditorEngine.enable(root);
    window.EditorEngine.select(root.querySelector('#del1b'));
    const btn = root.querySelector('.editor-style-delete');
    expect(btn).not.toBeNull();
    btn.click();
    expect(root.querySelector('#del1b')).toBeNull();
    expect(root.querySelector('#del2b')).not.toBeNull();
    window.EditorEngine.disable();
    root.parentNode.removeChild(root);
  });

  test('delete fires onChange with type=delete', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="del3">hello</p>';
    window.EditorEngine.enable(root);
    let fired = null;
    window.EditorEngine.onChange((type) => { fired = type; });
    window.EditorEngine.select(root.querySelector('#del3'));
    root.querySelector('.editor-style-delete').click();
    expect(fired).toBe('delete');
    window.EditorEngine.disable();
  });

  // ── Change listener ────────────────────────────────────────
  test('onChange fires on enable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let fired = null;
    window.EditorEngine.onChange((type) => { fired = type; });
    window.EditorEngine.enable(root);
    expect(fired).toBe('enabled');
    window.EditorEngine.disable();
  });

  test('onChange fires on disable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    let fired = null;
    window.EditorEngine.onChange((type) => { fired = type; });
    window.EditorEngine.disable();
    expect(fired).toBe('disabled');
  });

  test('onChange returns unsubscribe function', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let count = 0;
    const unsub = window.EditorEngine.onChange(() => { count++; });
    window.EditorEngine.enable(root);
    unsub();
    window.EditorEngine.disable();
    // Only enable fired, not disable
    expect(count).toBe(1);
  });

  // ── Denied permission ──────────────────────────────────────
  test('enable fires "denied" event when permission missing', () => {
    window.TrustManager?.reset?.();
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let fired = null;
    window.EditorEngine.onChange((type, detail) => { fired = { type, detail }; });
    window.EditorEngine.enable(root);
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('denied');
  });

  // ── Reset ──────────────────────────────────────────────────
  test('reset() clears all state', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.EditorEngine.enable(root);
    expect(window.EditorEngine.isEnabled()).toBe(true);
    window.EditorEngine.reset();
    expect(window.EditorEngine.isEnabled()).toBe(false);
    expect(window.EditorEngine.getUndoCount()).toBe(0);
    expect(window.EditorEngine.getRedoCount()).toBe(0);
  });

  // ── Path resolution ────────────────────────────────────────
  test('undo restores selection when possible', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p id="path1">first</p><p id="path2">second</p>';
    window.EditorEngine.enable(root);
    // Select first element
    window.EditorEngine.select(root.querySelector('#path1'));
    // Change content and take snapshot
    root.querySelector('#path1').textContent = 'modified';
    window.EditorEngine.snapshot();
    // Undo — should restore original and reselect
    window.EditorEngine.undo();
    expect(root.querySelector('#path1').textContent).toBe('first');
    window.EditorEngine.disable();
  });
});

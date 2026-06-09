/**
 * ActionRegistry tests
 * Covers: init/enable/disable, trust gating, register/unregister, query,
 * context detection, execution, floating buttons, context menu, command bar,
 * hotkeys, history, events.
 */
describe('ActionRegistry', () => {
  beforeEach(() => {
    window.ActionRegistry?.reset?.();
    window.TrustManager?.registerDefaults?.([{ module: 'actions', action: 'execute' }]);
  });

  afterEach(() => {
    window.ActionRegistry?.reset?.();
  });

  // ── Init & Enable / Disable ────────────────────────────
  test('isEnabled returns false by default', () => {
    expect(window.ActionRegistry.isEnabled()).toBe(false);
  });

  test('enable() with no root returns false', () => {
    expect(window.ActionRegistry.enable()).toBe(false);
    expect(window.ActionRegistry.isEnabled()).toBe(false);
  });

  test('enable() with root returns true', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.ActionRegistry.enable(root)).toBe(true);
    expect(window.ActionRegistry.isEnabled()).toBe(true);
    window.ActionRegistry.disable();
  });

  test('disable() sets enabled to false', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    window.ActionRegistry.disable();
    expect(window.ActionRegistry.isEnabled()).toBe(false);
  });

  test('enable() requires actions::execute permission', () => {
    window.TrustManager?.reset?.();
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.ActionRegistry.enable(root)).toBe(false);
    expect(window.ActionRegistry.isEnabled()).toBe(false);
  });

  test('init() sets root for later enable()', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.init({ root });
    expect(window.ActionRegistry.enable()).toBe(true);
    window.ActionRegistry.disable();
  });

  test('enable() sets data-actions-active on root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    expect(root.getAttribute('data-actions-active')).toBe('');
    window.ActionRegistry.disable();
  });

  test('disable() removes data-actions-active from root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    window.ActionRegistry.disable();
    expect(root.getAttribute('data-actions-active')).toBe(null);
  });

  // ── Register / Unregister ──────────────────────────────
  test('register() adds action and returns true', () => {
    const result = window.ActionRegistry.register({
      id: 'test-action',
      label: 'Test',
      icon: '⚡',
      execute: () => true,
    });
    expect(result).toBe(true);
    expect(window.ActionRegistry.get('test-action')).not.toBeNull();
  });

  test('register() returns false for missing id', () => {
    expect(window.ActionRegistry.register({ label: 'No ID' })).toBe(false);
  });

  test('unregister() removes action and returns true', () => {
    window.ActionRegistry.register({ id: 'rem1', label: 'Remove', execute: () => true });
    expect(window.ActionRegistry.unregister('rem1')).toBe(true);
    expect(window.ActionRegistry.get('rem1')).toBeNull();
  });

  test('unregister() returns false for missing id', () => {
    expect(window.ActionRegistry.unregister('nonexistent')).toBe(false);
  });

  test('getAll() returns all registered actions', () => {
    window.ActionRegistry.register({ id: 'a1', label: 'A1', execute: () => true });
    window.ActionRegistry.register({ id: 'a2', label: 'A2', execute: () => true });
    expect(window.ActionRegistry.getAll().length).toBe(2);
  });

  test('getByCategory() filters by category', () => {
    window.ActionRegistry.register({ id: 'c1', label: 'C1', category: 'edit', execute: () => true });
    window.ActionRegistry.register({ id: 'c2', label: 'C2', category: 'clipboard', execute: () => true });
    expect(window.ActionRegistry.getByCategory('edit').length).toBe(1);
    expect(window.ActionRegistry.getByCategory('edit')[0].id).toBe('c1');
  });

  // ── Context ────────────────────────────────────────────
  test('registerContext() binds actions to context', () => {
    window.ActionRegistry.register({ id: 'ctx1', label: 'Ctx1', execute: () => true });
    window.ActionRegistry.registerContext('text', ['ctx1']);
    const actions = window.ActionRegistry.getContextActions('text');
    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('ctx1');
  });

  test('getContextActions() returns empty for unknown context', () => {
    expect(window.ActionRegistry.getContextActions('nonexistent')).toEqual([]);
  });

  test('detectContext() identifies link elements', () => {
    const el = document.createElement('a');
    el.href = 'https://example.com';
    const ctx = window.ActionRegistry.detectContext(el);
    expect(ctx).toContain('link');
    expect(ctx).toContain('element');
  });

  test('detectContext() identifies image elements', () => {
    const el = document.createElement('img');
    const ctx = window.ActionRegistry.detectContext(el);
    expect(ctx).toContain('image');
  });

  test('detectContext() identifies input elements', () => {
    const el = document.createElement('input');
    const ctx = window.ActionRegistry.detectContext(el);
    expect(ctx).toContain('input');
  });

  test('detectContext() identifies heading elements', () => {
    const el = document.createElement('h2');
    const ctx = window.ActionRegistry.detectContext(el);
    expect(ctx).toContain('heading');
  });

  test('detectContext() returns empty for null element', () => {
    expect(window.ActionRegistry.detectContext(null)).toEqual([]);
  });

  test('getActionsForElement() returns matching actions', () => {
    window.ActionRegistry.register({ id: 'link-action', label: 'Link Action', execute: () => true });
    window.ActionRegistry.registerContext('link', ['link-action']);
    const el = document.createElement('a');
    el.href = 'https://example.com';
    const actions = window.ActionRegistry.getActionsForElement(el);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.find(a => a.id === 'link-action')).not.toBeUndefined();
  });

  // ── Execution ──────────────────────────────────────────
  test('execute() runs action and returns result', () => {
    let called = false;
    window.ActionRegistry.register({
      id: 'exec1',
      label: 'Exec1',
      execute: () => { called = true; return true; },
    });
    const result = window.ActionRegistry.execute('exec1', {});
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  test('execute() returns false for missing action', () => {
    expect(window.ActionRegistry.execute('nonexistent', {})).toBe(false);
  });

  test('execute() checks enabled function', () => {
    window.ActionRegistry.register({
      id: 'dis1',
      label: 'Disabled',
      enabled: () => false,
      execute: () => true,
    });
    expect(window.ActionRegistry.execute('dis1', {})).toBe(false);
  });

  test('execute() checks permission', () => {
    window.TrustManager?.reset?.();
    window.TrustManager?.registerDefaults?.([{ module: 'actions', action: 'execute' }]);
    window.ActionRegistry.register({
      id: 'perm1',
      label: 'Perm1',
      permission: { module: 'special', action: 'do' },
      execute: () => true,
    });
    expect(window.ActionRegistry.execute('perm1', {})).toBe(false);
  });

  test('execute() catches errors and returns false', () => {
    window.ActionRegistry.register({
      id: 'err1',
      label: 'Err1',
      execute: () => { throw new Error('fail'); },
    });
    expect(window.ActionRegistry.execute('err1', {})).toBe(false);
  });

  test('getLastExecuted() returns most recent execution', () => {
    window.ActionRegistry.register({ id: 'h1', label: 'H1', execute: () => true });
    window.ActionRegistry.execute('h1', { test: true });
    const last = window.ActionRegistry.getLastExecuted();
    expect(last).not.toBeNull();
    expect(last.id).toBe('h1');
  });

  test('getLastExecuted() returns null when no history', () => {
    expect(window.ActionRegistry.getLastExecuted()).toBeNull();
  });

  test('getHistory() returns executions in order', () => {
    window.ActionRegistry.register({ id: 'gh1', label: 'GH1', execute: () => true });
    window.ActionRegistry.register({ id: 'gh2', label: 'GH2', execute: () => true });
    window.ActionRegistry.execute('gh1', {});
    window.ActionRegistry.execute('gh2', {});
    const hist = window.ActionRegistry.getHistory();
    expect(hist.length).toBe(2);
    expect(hist[0].id).toBe('gh1');
    expect(hist[1].id).toBe('gh2');
  });

  test('getHistory(limit) respects limit', () => {
    window.ActionRegistry.register({ id: 'lim1', label: 'Lim1', execute: () => true });
    window.ActionRegistry.execute('lim1', {});
    window.ActionRegistry.execute('lim1', {});
    window.ActionRegistry.execute('lim1', {});
    expect(window.ActionRegistry.getHistory(2).length).toBe(2);
  });

  // ── Default Actions (registered on enable) ─────────────
  test('enable() registers default actions', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    const all = window.ActionRegistry.getAll();
    expect(all.length).toBeGreaterThan(0);
    const ids = all.map(a => a.id);
    expect(ids).toContain('copy-text');
    expect(ids).toContain('open-link');
    expect(ids).toContain('inspect-element');
    expect(ids).toContain('edit-element');
    window.ActionRegistry.disable();
  });

  // ── Floating Buttons ───────────────────────────────────
  test('hovering element with context shows floating buttons', () => {
    const root = document.createElement('div');
    root.innerHTML = '<a href="https://example.com" id="fb1">link</a>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.ActionRegistry.enable(root);
    const link = root.querySelector('#fb1');
    link.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    const menu = root.querySelector('.actions-floating-menu');
    expect(menu).not.toBeNull();
    const btns = menu.querySelectorAll('.actions-floating-btn');
    expect(btns.length).toBeGreaterThan(0);
    window.ActionRegistry.disable();
    root.parentNode.removeChild(root);
  });

  // ── Context Menu ───────────────────────────────────────
  test('right-clicking element shows context menu', () => {
    const root = document.createElement('div');
    root.innerHTML = '<a href="https://example.com" id="cm1">link</a>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.ActionRegistry.enable(root);
    const link = root.querySelector('#cm1');
    const rect = link.getBoundingClientRect();
    link.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      clientX: rect.left + 10,
      clientY: rect.top + 10,
    }));
    const menu = root.querySelector('.actions-context-menu');
    expect(menu).not.toBeNull();
    const items = menu.querySelectorAll('.actions-context-item');
    expect(items.length).toBeGreaterThan(0);
    window.ActionRegistry.disable();
    root.parentNode.removeChild(root);
  });

  // ── Command Bar ────────────────────────────────────────
  test('openCommandBar() creates command bar in DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    window.ActionRegistry.openCommandBar();
    const bar = root.querySelector('.actions-command-bar');
    expect(bar).not.toBeNull();
    const input = bar.querySelector('.actions-command-input');
    expect(input).not.toBeNull();
    const list = bar.querySelector('.actions-command-list');
    expect(list).not.toBeNull();
    window.ActionRegistry.disable();
  });

  test('command bar shows all registered actions', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    window.ActionRegistry.openCommandBar();
    const items = root.querySelectorAll('.actions-command-item');
    // Should have at least the default actions
    expect(items.length).toBeGreaterThan(0);
    window.ActionRegistry.disable();
  });

  test('openCommandBar() toggles (closes when open)', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    window.ActionRegistry.openCommandBar();
    expect(root.querySelector('.actions-command-bar')).not.toBeNull();
    window.ActionRegistry.openCommandBar();
    expect(root.querySelector('.actions-command-bar')).toBeNull();
    window.ActionRegistry.disable();
  });

  // ── Events ─────────────────────────────────────────────
  test('onChange fires on enable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let fired = null;
    window.ActionRegistry.onChange((type) => { fired = type; });
    window.ActionRegistry.enable(root);
    expect(fired).toBe('enabled');
    window.ActionRegistry.disable();
  });

  test('onChange fires on disable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    let fired = null;
    window.ActionRegistry.onChange((type) => { fired = type; });
    window.ActionRegistry.disable();
    expect(fired).toBe('disabled');
  });

  test('onChange fires on register', () => {
    let fired = null;
    window.ActionRegistry.onChange((type, detail) => { fired = { type, detail }; });
    window.ActionRegistry.register({ id: 'ev-reg', label: 'EvReg', execute: () => true });
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('registered');
    expect(fired.detail.id).toBe('ev-reg');
  });

  test('onChange fires on execute', () => {
    window.ActionRegistry.register({ id: 'ev-ex', label: 'EvEx', execute: () => true });
    let fired = null;
    window.ActionRegistry.onChange((type, detail) => { fired = { type, detail }; });
    window.ActionRegistry.execute('ev-ex', {});
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('executed');
    expect(fired.detail.id).toBe('ev-ex');
  });

  test('onChange fires denied event on permission failure', () => {
    window.TrustManager?.reset?.();
    window.TrustManager?.registerDefaults?.([{ module: 'actions', action: 'execute' }]);
    window.ActionRegistry.register({
      id: 'ev-denied',
      label: 'Denied',
      permission: { module: 'other', action: 'nope' },
      execute: () => true,
    });
    let fired = null;
    window.ActionRegistry.onChange((type, detail) => { fired = { type, detail }; });
    window.ActionRegistry.execute('ev-denied', {});
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('denied');
  });

  test('onChange fires error event on execution error', () => {
    window.ActionRegistry.register({
      id: 'ev-err',
      label: 'Err',
      execute: () => { throw new Error('boom'); },
    });
    let fired = null;
    window.ActionRegistry.onChange((type, detail) => { fired = { type, detail }; });
    window.ActionRegistry.execute('ev-err', {});
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('error');
  });

  test('onChange returns unsubscribe function', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let count = 0;
    const unsub = window.ActionRegistry.onChange(() => { count++; });
    window.ActionRegistry.enable(root);
    const afterEnable = count;
    // Should have fired at least once (enabled + registered defaults)
    expect(afterEnable).toBeGreaterThan(0);
    unsub();
    window.ActionRegistry.disable();
    // No new events after unsub
    expect(count).toBe(afterEnable);
  });

  // ── Reset ──────────────────────────────────────────────
  test('reset() clears all state', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.ActionRegistry.enable(root);
    window.ActionRegistry.register({ id: 'r1', label: 'R1', execute: () => true });
    window.ActionRegistry.reset();
    expect(window.ActionRegistry.isEnabled()).toBe(false);
    expect(window.ActionRegistry.getAll().length).toBe(0);
  });

  // ── Overlay cleanup on disable ─────────────────────────
  test('disable() removes all overlays from DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<a href="https://example.com">link</a>';
    root.style.position = 'relative';
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    window.ActionRegistry.enable(root);
    // Trigger floating buttons
    root.querySelector('a').dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    // Open command bar
    window.ActionRegistry.openCommandBar();
    expect(root.querySelectorAll('[data-actions-overlay]').length).toBeGreaterThan(0);
    window.ActionRegistry.disable();
    expect(root.querySelectorAll('[data-actions-overlay]').length).toBe(0);
    root.parentNode.removeChild(root);
  });
});

/**
 * ModeManager tests
 * Each test is fully self-contained — explicitly sets starting mode.
 */
describe('ModeManager', () => {
  beforeEach(() => {
    // Ensure baseline state: BROWSE mode, clean body
    window.ModeManager?.set?.('browse');
    document.body.className = '';
  });

  afterEach(() => {
    document.body.className = '';
  });

  // ── Static fixtures ────────────────────────────────────────

  test('MODES enum has all six modes', () => {
    expect(window.ModeManager.MODES).toEqual({
      BROWSE:  'browse',
      INSPECT: 'inspect',
      EDIT:    'edit',
      ACTION:  'action',
      RUN:     'run',
      RESULT:  'result',
    });
  });

  test('getAll() returns all six mode values', () => {
    const all = window.ModeManager.getAll();
    expect(all).toHaveLength(6);
    expect(all).toContain('browse');
    expect(all).toContain('inspect');
    expect(all).toContain('edit');
    expect(all).toContain('action');
    expect(all).toContain('run');
    expect(all).toContain('result');
  });

  // ── get / default ────────────────────────────────────────────

  test('get() returns BROWSE by default', () => {
    expect(window.ModeManager.get()).toBe('browse');
  });

  test('init() is one-shot — subsequent calls are no-ops', () => {
    // init() was called once at setup; calling it again does nothing
    window.ModeManager.init('inspect');
    expect(window.ModeManager.get()).toBe('browse'); // init ignored
    window.ModeManager.init('not_a_mode');
    expect(window.ModeManager.get()).toBe('browse'); // invalid also ignored
  });

  // ── set ─────────────────────────────────────────────────────

  test('set() changes mode', () => {
    const result = window.ModeManager.set('inspect');
    expect(result).toBe(true);
    expect(window.ModeManager.get()).toBe('inspect');
  });

  test('set() returns false when same mode', () => {
    const result = window.ModeManager.set('browse');
    expect(result).toBe(false);
    expect(window.ModeManager.get()).toBe('browse'); // unchanged
  });

  test('set() returns false for invalid mode', () => {
    const result = window.ModeManager.set('unknown');
    expect(result).toBe(false);
    expect(window.ModeManager.get()).toBe('browse'); // unchanged
  });

  // ── is ─────────────────────────────────────────────────────

  test('is(mode) returns true for current mode', () => {
    window.ModeManager.set('edit');
    expect(window.ModeManager.is('edit')).toBe(true);
    expect(window.ModeManager.is('browse')).toBe(false);
  });

  // ── onChange ────────────────────────────────────────────────

  test('set() fires onChange listener with from/to/data', () => {
    const events = [];
    const unsub = window.ModeManager.onChange((d) => events.push(d));
    window.ModeManager.set('edit', { foo: 'bar' });
    unsub();
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe('browse');
    expect(events[0].to).toBe('edit');
    expect(events[0].data.foo).toBe('bar');
  });

  test('onChange returns working unsubscribe fn', () => {
    const events = [];
    const unsub = window.ModeManager.onChange((d) => events.push(d));
    window.ModeManager.set('action');
    unsub();
    window.ModeManager.set('result');
    expect(events).toHaveLength(1); // only first set was captured
  });

  // ── pushState / popState ─────────────────────────────────────

  test('pushState() saves current and sets new mode', () => {
    // Starting from browse
    window.ModeManager.pushState('inspect');
    expect(window.ModeManager.get()).toBe('inspect');
    const result = window.ModeManager.popState();
    expect(result).toBe('browse');
    expect(window.ModeManager.get()).toBe('browse');
  });

  test('pushState() returns false when mode does not change', () => {
    // pushState to same mode: set() returns false, nothing pushed to stack
    const result = window.ModeManager.pushState('browse');
    expect(result).toBe(false);
    expect(window.ModeManager.popState()).toBeNull(); // stack never grew
  });

  test('popState() returns null when stack empty', () => {
    const result = window.ModeManager.popState();
    expect(result).toBeNull();
    expect(window.ModeManager.get()).toBe('browse'); // mode unchanged
  });

  test('pushState/popState nest correctly', () => {
    window.ModeManager.pushState('inspect');
    window.ModeManager.pushState('edit');
    expect(window.ModeManager.get()).toBe('edit');
    window.ModeManager.popState();
    expect(window.ModeManager.get()).toBe('inspect');
    window.ModeManager.popState();
    expect(window.ModeManager.get()).toBe('browse');
  });

  // ── Body class ──────────────────────────────────────────────

  test('body gets mode-* class on set', () => {
    document.body.className = '';
    window.ModeManager.set('run');
    expect(document.body.classList.contains('mode-run')).toBe(true);
    expect(document.body.classList.contains('mode-browse')).toBe(false);

    window.ModeManager.set('result');
    expect(document.body.classList.contains('mode-run')).toBe(false);
    expect(document.body.classList.contains('mode-result')).toBe(true);
  });
});
/**
 * TrustManager tests
 * Each test is fully self-contained.
 */
describe('TrustManager', () => {
  beforeEach(() => {
    window.TrustManager?.reset?.();
  });

  // ── Permission check ─────────────────────────────────────────

  test('isAllowed returns false by default (deny-by-default)', () => {
    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(false);
    expect(window.TrustManager.isAllowed('inspector', 'readDom')).toBe(false);
    expect(window.TrustManager.isAllowed('editor', 'write')).toBe(false);
  });

  test('grant() enables permission', () => {
    window.TrustManager.grant('shell', 'execute');
    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(true);
  });

  test('grant() enables only that module::action', () => {
    window.TrustManager.grant('shell', 'execute');
    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(true);
    expect(window.TrustManager.isAllowed('shell', 'read')).toBe(false);
    expect(window.TrustManager.isAllowed('inspector', 'execute')).toBe(false);
  });

  test('revoke() disables permission', () => {
    window.TrustManager.grant('shell', 'execute');
    window.TrustManager.revoke('shell', 'execute');
    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(false);
  });

  test('revoke() is idempotent', () => {
    window.TrustManager.revoke('shell', 'execute'); // no-op when already denied
    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(false);
  });

  // ── require() ───────────────────────────────────────────────

  test('require() throws for denied permission', () => {
    expect(() => window.TrustManager.require('shell', 'execute'))
      .toThrow('TrustManager: permission denied for shell::execute');
  });

  test('require() succeeds for granted permission', () => {
    window.TrustManager.grant('shell', 'execute');
    expect(() => window.TrustManager.require('shell', 'execute')).not.toThrow();
  });

  // ── request() ───────────────────────────────────────────────

  test('request() resolves immediately when already granted', async () => {
    window.TrustManager.grant('shell', 'execute');
    const result = await window.TrustManager.request('shell', 'execute');
    expect(result).toBe(true);
  });

  test('request() fires onRequest listener when not granted', async () => {
    let fired = null;
    window.TrustManager.onRequest((type, detail) => { fired = { type, detail }; });

    window.TrustManager.request('inspector', 'readDom');

    expect(fired).not.toBeNull();
    expect(fired.type).toBe('request');
    expect(fired.detail.module).toBe('inspector');
    expect(fired.detail.action).toBe('readDom');
    expect(typeof fired.detail.resolve).toBe('function');
    expect(typeof fired.detail.reject).toBe('function');
  });

  test('onRequest returns unsubscribe fn', () => {
    let count = 0;
    const unsub = window.TrustManager.onRequest(() => { count++; });

    window.TrustManager.request('a', 'b');
    unsub();
    window.TrustManager.request('c', 'd');

    expect(count).toBe(1);
  });

  test('resolve() from listener satisfies pending request', async () => {
    let pendingDetail = null;
    window.TrustManager.onRequest((type, detail) => {
      pendingDetail = detail;
    });

    const promise = window.TrustManager.request('shell', 'execute');
    pendingDetail.resolve(true);

    const result = await promise;
    expect(result).toBe(true);
  });

  test('reject() from listener rejects pending request', async () => {
    let pendingDetail = null;
    window.TrustManager.onRequest((type, detail) => {
      pendingDetail = detail;
    });

    const promise = window.TrustManager.request('shell', 'execute');
    pendingDetail.reject(new Error('denied'));

    await expect(promise).rejects.toThrow('denied');
  });

  // ── Audit log ───────────────────────────────────────────────

  test('getAudit() returns event log', () => {
    const before = window.TrustManager.getAudit().length;
    window.TrustManager.grant('ai', 'suggest');
    const log = window.TrustManager.getAudit();
    expect(log.length).toBeGreaterThan(before);
    expect(log[log.length - 1].module).toBe('ai');
    expect(log[log.length - 1].action).toBe('suggest');
    expect(log[log.length - 1].result).toBe('granted');
  });

  test('getAudit() takes limit', () => {
    window.TrustManager.grant('a', 'x');
    window.TrustManager.grant('b', 'y');
    window.TrustManager.grant('c', 'z');
    const log = window.TrustManager.getAudit(2);
    expect(log.length).toBeLessThanOrEqual(2);
  });

  test('audit log entries have ISO timestamp', () => {
    window.TrustManager.grant('editor', 'write');
    const log = window.TrustManager.getAudit();
    const last = log[log.length - 1];
    expect(last.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date
  });

  // ── registerDefaults ─────────────────────────────────────────

  test('registerDefaults() grants multiple permissions', () => {
    window.TrustManager.registerDefaults([
      { module: 'inspector', action: 'readDom' },
      { module: 'editor',    action: 'write'   },
    ]);
    expect(window.TrustManager.isAllowed('inspector', 'readDom')).toBe(true);
    expect(window.TrustManager.isAllowed('editor', 'write')).toBe(true);
    // Other permissions untouched
    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(false);
  });

  // ── reset ───────────────────────────────────────────────────

  test('reset() clears permissions and audit log but keeps listeners', () => {
    let count = 0;
    window.TrustManager.onRequest((type) => { if (type === 'request') count++; });

    window.TrustManager.grant('shell', 'execute');
    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(true);

    window.TrustManager.reset();

    expect(window.TrustManager.isAllowed('shell', 'execute')).toBe(false);
    expect(window.TrustManager.getAudit()).toHaveLength(0);
    // Listener still registered
    window.TrustManager.request('x', 'y');
    expect(count).toBe(1);
  });

  // ── Concurrent requests ──────────────────────────────────────
  test('concurrent requests for same permission all resolve', async () => {
    let pendingDetail = null;
    window.TrustManager.onRequest((type, detail) => {
      pendingDetail = detail;
    });

    const p1 = window.TrustManager.request('shell', 'execute');
    const p2 = window.TrustManager.request('shell', 'execute');
    const p3 = window.TrustManager.request('shell', 'execute');

    // All three should be pending (no onRequest listener called again)
    expect(pendingDetail).not.toBeNull();

    pendingDetail.resolve(true);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
  });

  test('concurrent requests for same permission all reject', async () => {
    let pendingDetail = null;
    window.TrustManager.onRequest((type, detail) => {
      pendingDetail = detail;
    });

    const p1 = window.TrustManager.request('ai', 'complete');
    const p2 = window.TrustManager.request('ai', 'complete');

    pendingDetail.reject(new Error('denied'));

    await expect(p1).rejects.toThrow('denied');
    await expect(p2).rejects.toThrow('denied');
  });
});
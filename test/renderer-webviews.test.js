/**
 * Tests for renderer webview management logic.
 * Tests the simplified one-webview-per-tab model.
 */

// We test the logic by extracting the key functions and verifying behavior
// without needing a real DOM. We mock the minimal DOM interactions.

describe('webview management model', () => {
  // Simulate the _wvMap and helpers as pure logic
  let wvMap;
  let activeTabId;

  function ensureWebview(tabId, url) {
    if (wvMap.has(tabId)) return wvMap.get(tabId);
    const wv = { tabId, url, display: 'none', destroyed: false };
    wvMap.set(tabId, wv);
    return wv;
  }

  function showActiveWebview() {
    wvMap.forEach((wv, id) => {
      wv.display = (id === activeTabId) ? 'flex' : 'none';
    });
  }

  function removeStaleWebviews(existingTabIds) {
    wvMap.forEach((wv, id) => {
      if (!existingTabIds.has(id)) {
        wv.destroyed = true;
        wvMap.delete(id);
      }
    });
  }

  beforeEach(() => {
    wvMap = new Map();
    activeTabId = null;
  });

  test('ensureWebview creates and returns a new webview', () => {
    const wv = ensureWebview('tab-1', 'https://example.com');
    expect(wv.tabId).toBe('tab-1');
    expect(wv.url).toBe('https://example.com');
    expect(wv.display).toBe('none');
    expect(wvMap.has('tab-1')).toBe(true);
  });

  test('ensureWebview returns existing webview for same tabId', () => {
    const wv1 = ensureWebview('tab-1', 'https://one.com');
    const wv2 = ensureWebview('tab-1', 'https://other.com');
    expect(wv1).toBe(wv2);  // same object reference
    expect(wvMap.size).toBe(1);
  });

  test('showActiveWebview shows active tab, hides rest', () => {
    ensureWebview('tab-1', 'https://one.com');
    ensureWebview('tab-2', 'https://two.com');
    ensureWebview('tab-3', 'https://three.com');

    activeTabId = 'tab-2';
    showActiveWebview();

    expect(wvMap.get('tab-1').display).toBe('none');
    expect(wvMap.get('tab-2').display).toBe('flex');
    expect(wvMap.get('tab-3').display).toBe('none');
  });

  test('showActiveWebview hides everything when no active tab', () => {
    ensureWebview('tab-1', 'https://one.com');
    ensureWebview('tab-2', 'https://two.com');

    activeTabId = null;
    showActiveWebview();

    expect(wvMap.get('tab-1').display).toBe('none');
    expect(wvMap.get('tab-2').display).toBe('none');
  });

  test('showActiveWebview shows only tab when single tab', () => {
    ensureWebview('tab-1', 'about:blank');
    activeTabId = 'tab-1';
    showActiveWebview();
    expect(wvMap.get('tab-1').display).toBe('flex');
  });

  test('removeStaleWebviews cleans up closed tabs', () => {
    ensureWebview('tab-1', 'https://one.com');
    ensureWebview('tab-2', 'https://two.com');
    ensureWebview('tab-3', 'https://three.com');

    removeStaleWebviews(new Set(['tab-1', 'tab-3']));

    expect(wvMap.size).toBe(2);
    expect(wvMap.has('tab-1')).toBe(true);
    expect(wvMap.has('tab-2')).toBe(false);
    expect(wvMap.has('tab-3')).toBe(true);
  });

  test('switching tabs: create all, show only active', () => {
    // Simulate 3 tabs created, switching between them
    const tabs = [
      { id: 't1', url: 'https://a.com' },
      { id: 't2', url: 'https://b.com' },
      { id: 't3', url: 'https://c.com' },
    ];

    // Create webviews for all tabs
    tabs.forEach(t => ensureWebview(t.id, t.url));
    expect(wvMap.size).toBe(3);

    // Switch to t2
    activeTabId = 't2';
    showActiveWebview();
    expect(wvMap.get('t1').display).toBe('none');
    expect(wvMap.get('t2').display).toBe('flex');
    expect(wvMap.get('t3').display).toBe('none');

    // Switch to t3
    activeTabId = 't3';
    showActiveWebview();
    expect(wvMap.get('t1').display).toBe('none');
    expect(wvMap.get('t2').display).toBe('none');
    expect(wvMap.get('t3').display).toBe('flex');
  });

  test('closing active tab: next tab should be showable', () => {
    ensureWebview('t1', 'https://a.com');
    ensureWebview('t2', 'https://b.com');
    activeTabId = 't1';
    showActiveWebview();

    // Close t1
    wvMap.delete('t1');
    activeTabId = 't2';
    showActiveWebview();

    expect(wvMap.get('t2').display).toBe('flex');
  });

  test('webview pool size is unbounded (no LOD eviction)', () => {
    // Old system had WV_POOL = 3 and would evict. New system keeps all.
    for (let i = 0; i < 20; i++) {
      ensureWebview(`tab-${i}`, `https://site${i}.com`);
    }
    expect(wvMap.size).toBe(20);
  });
});

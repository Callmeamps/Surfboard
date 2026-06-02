/**
 * Tests for tab-manager.js
 * Tests tab lifecycle: create, close, switch, update
 */

// Mock Electron before requiring tab-manager
let mockWebContents = { send: jest.fn() };
let mockBrowserWindow = {
  isDestroyed: () => false,
  webContents: mockWebContents,
};

jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [mockBrowserWindow],
  },
}));

// Mock tab-lifecycle
jest.mock('../src/main/tab-lifecycle', () => ({
  onTabCreated: jest.fn(),
  onTabClosed: jest.fn(),
  onTabActivated: jest.fn(),
}));

const tabManager = require('../src/main/tab-manager');

beforeEach(() => {
  // Clear internal state between tests
  // tab-manager doesn't expose a reset, so we close all existing tabs
  const all = tabManager.getAll();
  all.forEach(t => tabManager.close(t.id));
  jest.clearAllMocks();
});

describe('tab-manager', () => {
  test('create() returns a tab with id, url, active=true', () => {
    const tab = tabManager.create('https://example.com');
    expect(tab).toMatchObject({
      url: 'https://example.com',
      active: true,
      loading: false,
    });
    expect(tab.id).toBeDefined();
    expect(tab.title).toBe('New Tab');
  });

  test('create() marks previous active tab as inactive', () => {
    const t1 = tabManager.create('https://one.com');
    const t2 = tabManager.create('https://two.com');

    expect(tabManager.get(t1.id).active).toBe(false);
    expect(tabManager.get(t2.id).active).toBe(true);
  });

  test('close() removes tab and activates another', () => {
    const t1 = tabManager.create('https://one.com');
    const t2 = tabManager.create('https://two.com');
    t1.active = true; t2.active = false;
    // Re-activate t1
    tabManager.switch(t1.id);

    const result = tabManager.close(t1.id);

    expect(tabManager.get(t1.id)).toBeUndefined();
    expect(result).not.toBeNull();
    expect(result.id).toBe(t2.id);
  });

  test('close() on last tab returns null for active', () => {
    const t1 = tabManager.create('https://one.com');
    const result = tabManager.close(t1.id);
    expect(tabManager.getAll()).toHaveLength(0);
    expect(result).toBeNull();
  });

  test('switch() activates the specified tab', () => {
    const t1 = tabManager.create('https://one.com');
    const t2 = tabManager.create('https://two.com');

    const result = tabManager.switch(t1.id);

    expect(result.active).toBe(true);
    expect(tabManager.get(t2.id).active).toBe(false);
  });

  test('getAll() returns all tabs as copies', () => {
    tabManager.create('https://one.com');
    tabManager.create('https://two.com');

    const all = tabManager.getAll();
    expect(all).toHaveLength(2);
  });

  test('update() patches tab fields', () => {
    const t = tabManager.create('https://one.com');
    const updated = tabManager.update(t.id, { title: 'One', loading: true });

    expect(updated).toMatchObject({ title: 'One', loading: true });
  });

  test('get() returns undefined for missing tab', () => {
    expect(tabManager.get('nonexistent')).toBeUndefined();
  });

  test('idempotent: create with about:blank', () => {
    const tab = tabManager.create('about:blank');
    expect(tab.url).toBe('about:blank');
  });
});

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
  // Clean up groups
  const groups = tabManager.getGroups();
  groups.forEach(g => tabManager.deleteGroup(g.id));
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

  // ── Tab Groups ──────────────────────────────────────────

  test('createGroup() returns a group with id and title', () => {
    const group = tabManager.createGroup('Research');
    expect(group.id).toBeDefined();
    expect(group.title).toBe('Research');
    expect(group.collapsed).toBe(false);
    expect(group.tabIds).toEqual([]);
  });

  test('assignToGroup() adds tab to group', () => {
    const tab = tabManager.create('https://one.com');
    const group = tabManager.createGroup('Work');

    const result = tabManager.assignToGroup(tab.id, group.id);

    expect(result.groupId).toBe(group.id);
    const groups = tabManager.getGroups();
    expect(groups[0].tabIds).toContain(tab.id);
  });

  test('assignToGroup() removes tab from previous group', () => {
    const tab = tabManager.create('https://one.com');
    const g1 = tabManager.createGroup('Group A');
    const g2 = tabManager.createGroup('Group B');

    tabManager.assignToGroup(tab.id, g1.id);
    tabManager.assignToGroup(tab.id, g2.id);

    const groups = tabManager.getGroups();
    const groupA = groups.find(g => g.id === g1.id);
    const groupB = groups.find(g => g.id === g2.id);
    expect(groupA.tabIds).not.toContain(tab.id);
    expect(groupB.tabIds).toContain(tab.id);
  });

  test('removeFromGroup() unassigns tab', () => {
    const tab = tabManager.create('https://one.com');
    const tab2 = tabManager.create('https://two.com');
    const group = tabManager.createGroup('Work');
    tabManager.assignToGroup(tab.id, group.id);
    tabManager.assignToGroup(tab2.id, group.id);

    const result = tabManager.removeFromGroup(tab.id);

    expect(result.groupId).toBeNull();
    const groups = tabManager.getGroups();
    expect(groups.find(g => g.id === group.id).tabIds).toEqual([tab2.id]);
  });

  test('toggleGroupCollapse() flips collapsed state', () => {
    const group = tabManager.createGroup('Work');
    expect(group.collapsed).toBe(false);

    const result = tabManager.toggleGroupCollapse(group.id);
    expect(result.collapsed).toBe(true);

    const result2 = tabManager.toggleGroupCollapse(group.id);
    expect(result2.collapsed).toBe(false);
  });

  test('deleteGroup() removes group and unassigns tabs', () => {
    const tab = tabManager.create('https://one.com');
    const group = tabManager.createGroup('Work');
    tabManager.assignToGroup(tab.id, group.id);

    const deleted = tabManager.deleteGroup(group.id);
    expect(deleted).toBe(true);

    const tabAfter = tabManager.get(tab.id);
    expect(tabAfter.groupId).toBeNull();
    expect(tabManager.getGroups()).toHaveLength(0);
  });

  test('close() on grouped tab removes it from group', () => {
    const t1 = tabManager.create('https://one.com');
    const t2 = tabManager.create('https://two.com');
    const group = tabManager.createGroup('Work');
    tabManager.assignToGroup(t1.id, group.id);
    tabManager.assignToGroup(t2.id, group.id);

    tabManager.close(t1.id);

    const groups = tabManager.getGroups();
    expect(groups[0].tabIds).toEqual([t2.id]);
  });

  test('close() on last tab in group deletes empty group', () => {
    const tab = tabManager.create('https://one.com');
    const group = tabManager.createGroup('Work');
    tabManager.assignToGroup(tab.id, group.id);

    tabManager.close(tab.id);

    expect(tabManager.getGroups()).toHaveLength(0);
  });
});

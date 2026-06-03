/**
 * Tests for tab groups feature in tab-manager.js
 * Tests group data model: create, assign, remove, collapse/expand
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
  // Clear all tabs (which also cleans up group memberships)
  const all = tabManager.getAll();
  all.forEach(t => tabManager.close(t.id));
  // Delete any remaining empty groups
  const groups = tabManager.getGroups();
  groups.forEach(g => tabManager.deleteGroup(g.id));
  jest.clearAllMocks();
});

describe('tab groups', () => {
  describe('createGroup', () => {
    test('creates a group with default title', () => {
      const group = tabManager.createGroup();
      expect(group).toMatchObject({
        title: 'Group',
        collapsed: false,
      });
      expect(group.id).toBeDefined();
      expect(group.tabIds).toEqual([]);
    });

    test('creates a group with custom title', () => {
      const group = tabManager.createGroup('Work');
      expect(group.title).toBe('Work');
    });

    test('getGroups returns all created groups', () => {
      tabManager.createGroup('Group A');
      tabManager.createGroup('Group B');
      const groups = tabManager.getGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].title).toBe('Group A');
      expect(groups[1].title).toBe('Group B');
    });
  });

  describe('assignToGroup', () => {
    test('assigns a tab to a group', () => {
      const tab = tabManager.create('https://example.com');
      const group = tabManager.createGroup('Work');

      const result = tabManager.assignToGroup(tab.id, group.id);
      expect(result.groupId).toBe(group.id);

      const groups = tabManager.getGroups();
      expect(groups[0].tabIds).toContain(tab.id);
    });

    test('returns null for invalid tabId', () => {
      const group = tabManager.createGroup('Work');
      const result = tabManager.assignToGroup('nonexistent', group.id);
      expect(result).toBeNull();
    });

    test('returns null for invalid groupId', () => {
      const tab = tabManager.create('https://example.com');
      const result = tabManager.assignToGroup(tab.id, 'nonexistent');
      expect(result).toBeNull();
    });

    test('moves tab from one group to another', () => {
      const tab = tabManager.create('https://example.com');
      const group1 = tabManager.createGroup('Work');
      const group2 = tabManager.createGroup('Personal');

      tabManager.assignToGroup(tab.id, group1.id);
      let groups = tabManager.getGroups();
      expect(groups.find(g => g.id === group1.id).tabIds).toContain(tab.id);

      tabManager.assignToGroup(tab.id, group2.id);
      groups = tabManager.getGroups();
      expect(groups.find(g => g.id === group1.id).tabIds).not.toContain(tab.id);
      expect(groups.find(g => g.id === group2.id).tabIds).toContain(tab.id);
    });

    test('multiple tabs can be in same group', () => {
      const tab1 = tabManager.create('https://one.com');
      const tab2 = tabManager.create('https://two.com');
      const group = tabManager.createGroup('Work');

      tabManager.assignToGroup(tab1.id, group.id);
      tabManager.assignToGroup(tab2.id, group.id);

      const groups = tabManager.getGroups();
      expect(groups[0].tabIds).toHaveLength(2);
      expect(groups[0].tabIds).toContain(tab1.id);
      expect(groups[0].tabIds).toContain(tab2.id);
    });
  });

  describe('removeFromGroup', () => {
    test('removes a tab from its group', () => {
      const tab1 = tabManager.create('https://example.com');
      const tab2 = tabManager.create('https://other.com');
      const group = tabManager.createGroup('Work');

      tabManager.assignToGroup(tab1.id, group.id);
      tabManager.assignToGroup(tab2.id, group.id);
      const result = tabManager.removeFromGroup(tab1.id);

      expect(result.groupId).toBeNull();
      const groups = tabManager.getGroups();
      expect(groups[0].tabIds).not.toContain(tab1.id);
      expect(groups[0].tabIds).toContain(tab2.id);
    });

    test('returns null for tab not in any group', () => {
      const tab = tabManager.create('https://example.com');
      const result = tabManager.removeFromGroup(tab.id);
      expect(result).toBeNull();
    });

    test('deletes empty group when last tab removed', () => {
      const tab = tabManager.create('https://example.com');
      const group = tabManager.createGroup('Work');

      tabManager.assignToGroup(tab.id, group.id);
      expect(tabManager.getGroups()).toHaveLength(1);

      tabManager.removeFromGroup(tab.id);
      expect(tabManager.getGroups()).toHaveLength(0);
    });

    test('does not delete group with remaining tabs', () => {
      const tab1 = tabManager.create('https://one.com');
      const tab2 = tabManager.create('https://two.com');
      const group = tabManager.createGroup('Work');

      tabManager.assignToGroup(tab1.id, group.id);
      tabManager.assignToGroup(tab2.id, group.id);
      tabManager.removeFromGroup(tab1.id);

      const groups = tabManager.getGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].tabIds).toContain(tab2.id);
    });
  });

  describe('toggleGroupCollapse', () => {
    test('toggles collapsed state', () => {
      const group = tabManager.createGroup('Work');
      expect(group.collapsed).toBe(false);

      const toggled = tabManager.toggleGroupCollapse(group.id);
      expect(toggled.collapsed).toBe(true);

      const toggledAgain = tabManager.toggleGroupCollapse(group.id);
      expect(toggledAgain.collapsed).toBe(false);
    });

    test('returns null for invalid groupId', () => {
      const result = tabManager.toggleGroupCollapse('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('tab.groupId field', () => {
    test('new tab has groupId null by default', () => {
      const tab = tabManager.create('https://example.com');
      expect(tab.groupId).toBeNull();
    });

    test('tab groupId is updated when assigned to group', () => {
      const tab = tabManager.create('https://example.com');
      const group = tabManager.createGroup('Work');

      tabManager.assignToGroup(tab.id, group.id);
      const updated = tabManager.get(tab.id);
      expect(updated.groupId).toBe(group.id);
    });
  });

  describe('integration: full group lifecycle', () => {
    test('create group → assign tabs → collapse → remove tab → delete group', () => {
      // Create tabs and group
      const tab1 = tabManager.create('https://work1.com');
      const tab2 = tabManager.create('https://work2.com');
      const group = tabManager.createGroup('Work');

      // Assign both tabs
      tabManager.assignToGroup(tab1.id, group.id);
      tabManager.assignToGroup(tab2.id, group.id);
      expect(tabManager.getGroups()[0].tabIds).toHaveLength(2);

      // Collapse group
      tabManager.toggleGroupCollapse(group.id);
      expect(tabManager.getGroups()[0].collapsed).toBe(true);

      // Remove one tab
      tabManager.removeFromGroup(tab1.id);
      expect(tabManager.getGroups()[0].tabIds).toHaveLength(1);

      // Remove last tab - group should be deleted
      tabManager.removeFromGroup(tab2.id);
      expect(tabManager.getGroups()).toHaveLength(0);
    });
  });
});

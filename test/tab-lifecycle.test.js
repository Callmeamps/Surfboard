/**
 * Tests for tab-lifecycle.js
 * Tab LOD management: create, activate, close, webview registration, suspend scheduling
 */

const mockWebContents = { send: jest.fn() };
const mockBrowserWindow = {
  isDestroyed: () => false,
  webContents: mockWebContents,
};

jest.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [mockBrowserWindow],
  },
}));

let tabLifecycle;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  tabLifecycle = require('../src/main/tab-lifecycle');
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('tab-lifecycle', () => {
  describe('getActiveTabId', () => {
    test('returns null initially', () => {
      expect(tabLifecycle.getActiveTabId()).toBeNull();
    });
  });

  describe('onTabCreated', () => {
    test('adds tab to front of tab order', () => {
      tabLifecycle.onTabCreated('tab-1');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-1']);
    });

    test('preserves LIFO order when creating multiple tabs', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabCreated('tab-3');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-3', 'tab-2', 'tab-1']);
    });

    test('does not duplicate an existing tab', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-1');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-1']);
    });
  });

  describe('onTabActivated', () => {
    test('sets the active tab id', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabActivated('tab-1');
      expect(tabLifecycle.getActiveTabId()).toBe('tab-1');
    });

    test('moves activated tab to front of tab order', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabCreated('tab-3');
      tabLifecycle.onTabActivated('tab-1');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-1', 'tab-3', 'tab-2']);
    });

    test('re-activating same tab is idempotent', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabActivated('tab-1');
      tabLifecycle.onTabActivated('tab-1');
      expect(tabLifecycle.getActiveTabId()).toBe('tab-1');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-1']);
    });

    test('updates active tab when switching to another tab', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabActivated('tab-1');
      tabLifecycle.onTabActivated('tab-2');
      expect(tabLifecycle.getActiveTabId()).toBe('tab-2');
    });
  });

  describe('onTabClosed', () => {
    test('removes tab from tab order', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabClosed('tab-1');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-2']);
    });

    test('unregisters webContents for closed tab', () => {
      const wc = { isDestroyed: () => false };
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.registerWebContents('tab-1', wc);
      tabLifecycle.onTabClosed('tab-1');
      expect(tabLifecycle.getWebContents('tab-1')).toBeNull();
    });

    test('handles closing a non-existent tab without throwing', () => {
      expect(() => tabLifecycle.onTabClosed('nonexistent')).not.toThrow();
    });

    test('removes only the specified tab', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabCreated('tab-3');
      tabLifecycle.onTabClosed('tab-2');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-3', 'tab-1']);
    });
  });

  describe('getTabOrder', () => {
    test('returns a copy, not the internal array', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      const order = tabLifecycle.getTabOrder();
      order.push('tab-3');
      expect(tabLifecycle.getTabOrder()).toHaveLength(2);
    });

    test('returns empty array when no tabs exist', () => {
      expect(tabLifecycle.getTabOrder()).toEqual([]);
    });
  });

  describe('registerWebContents / unregisterWebContents', () => {
    test('registerWebContents stores webContents by tabId', () => {
      const wc = { isDestroyed: () => false };
      tabLifecycle.registerWebContents('tab-1', wc);
      expect(tabLifecycle.getWebContents('tab-1')).toBe(wc);
    });

    test('unregisterWebContents removes the mapping', () => {
      const wc = { isDestroyed: () => false };
      tabLifecycle.registerWebContents('tab-1', wc);
      tabLifecycle.unregisterWebContents('tab-1');
      expect(tabLifecycle.getWebContents('tab-1')).toBeNull();
    });

    test('can register multiple tabs', () => {
      const wc1 = { isDestroyed: () => false };
      const wc2 = { isDestroyed: () => false };
      tabLifecycle.registerWebContents('tab-1', wc1);
      tabLifecycle.registerWebContents('tab-2', wc2);
      expect(tabLifecycle.getWebContents('tab-1')).toBe(wc1);
      expect(tabLifecycle.getWebContents('tab-2')).toBe(wc2);
    });

    test('unregistering mid-list does not affect other registrations', () => {
      const wc1 = { isDestroyed: () => false };
      const wc2 = { isDestroyed: () => false };
      tabLifecycle.registerWebContents('tab-1', wc1);
      tabLifecycle.registerWebContents('tab-2', wc2);
      tabLifecycle.unregisterWebContents('tab-1');
      expect(tabLifecycle.getWebContents('tab-2')).toBe(wc2);
    });
  });

  describe('getWebContents', () => {
    test('returns null for unregistered tab', () => {
      expect(tabLifecycle.getWebContents('tab-unknown')).toBeNull();
    });

    test('returns null when webContents is destroyed', () => {
      const wc = { isDestroyed: () => true };
      tabLifecycle.registerWebContents('tab-1', wc);
      expect(tabLifecycle.getWebContents('tab-1')).toBeNull();
    });
  });

  describe('getTabLod', () => {
    beforeEach(() => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabCreated('tab-3');
      tabLifecycle.onTabCreated('tab-4');
    });

    test('returns "active" for the active tab', () => {
      tabLifecycle.onTabActivated('tab-1');
      expect(tabLifecycle.getTabLod('tab-1')).toBe('active');
    });

    test('returns "adjacent" for tab one position from active', () => {
      tabLifecycle.onTabActivated('tab-1');
      // order after: ['tab-1', 'tab-4', 'tab-3', 'tab-2']
      expect(tabLifecycle.getTabLod('tab-4')).toBe('adjacent');
    });

    test('returns "distant" for tabs further than 1 from active', () => {
      tabLifecycle.onTabActivated('tab-1');
      expect(tabLifecycle.getTabLod('tab-3')).toBe('distant');
      expect(tabLifecycle.getTabLod('tab-2')).toBe('distant');
    });

    test('returns "distant" for unknown tab', () => {
      expect(tabLifecycle.getTabLod('unknown')).toBe('distant');
    });

    test('LOD updates correctly when active tab changes', () => {
      tabLifecycle.onTabActivated('tab-1');
      tabLifecycle.onTabActivated('tab-3');
      // order after: ['tab-3', 'tab-1', 'tab-4', 'tab-2']
      expect(tabLifecycle.getTabLod('tab-3')).toBe('active');
      expect(tabLifecycle.getTabLod('tab-1')).toBe('adjacent');
    });
  });

  describe('suspend scheduling (via onTabActivated)', () => {
    test('does not broadcast suspend when under MAX_LIVE_WEBVIEWS', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabCreated('tab-3');
      tabLifecycle.onTabActivated('tab-1');

      jest.runAllTimers();

      expect(mockWebContents.send).not.toHaveBeenCalled();
    });

    test('clears existing suspend timer for activated tab', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabCreated('tab-3');
      tabLifecycle.onTabActivated('tab-1');

      jest.runAllTimers();

      expect(mockWebContents.send).not.toHaveBeenCalled();
    });
  });

  describe('integration: full tab lifecycle', () => {
    test('create → activate → close sequence maintains correct state', () => {
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabActivated('tab-1');

      expect(tabLifecycle.getActiveTabId()).toBe('tab-1');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-1', 'tab-2']);

      tabLifecycle.onTabClosed('tab-1');
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-2']);
      expect(tabLifecycle.getWebContents('tab-1')).toBeNull();
    });

    test('webview registration survives tab order changes', () => {
      const wc = { isDestroyed: () => false };
      tabLifecycle.registerWebContents('tab-1', wc);
      tabLifecycle.onTabCreated('tab-1');
      tabLifecycle.onTabCreated('tab-2');
      tabLifecycle.onTabActivated('tab-2');

      expect(tabLifecycle.getWebContents('tab-1')).toBe(wc);
      expect(tabLifecycle.getTabOrder()).toEqual(['tab-2', 'tab-1']);
    });
  });
});

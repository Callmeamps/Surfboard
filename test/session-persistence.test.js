/**
 * session-persistence.test.js — Tests for session save/restore
 */

const path = require('path');
const fs = require('fs');

// ── Mocks ──────────────────────────────────────────────

let mockBounds = { x: 100, y: 200, width: 1400, height: 900 };
let mockWindows = [];

jest.mock('electron', () => ({
  app: { getPath: () => __dirname },
  BrowserWindow: {
    getAllWindows: () => mockWindows,
  },
  screen: {
    getAllDisplays: () => [{
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    }],
  },
}));

jest.mock('../src/main/profiles', () => {
  let _session = null;
  return {
    getCurrentProfileId: jest.fn(() => 'default'),
    saveProfileSession: jest.fn((session) => { _session = session; }),
    loadProfileSession: jest.fn(() => _session),
    clearProfileSession: jest.fn(() => { _session = null; }),
  };
});

const sessionPersistence = require('../src/main/session-persistence');
const profiles = require('../src/main/profiles');

// ── Helpers ────────────────────────────────────────────

function makeTabManager(tabs, activeId) {
  return {
    getAll: jest.fn(() => tabs),
    getActiveId: jest.fn(() => activeId),
    getGroups: jest.fn(() => []),
  };
}

// ── Tests ──────────────────────────────────────────────

describe('session-persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWindows = [];
    mockBounds = { x: 100, y: 200, width: 1400, height: 900 };
    sessionPersistence.cancelAutosave();
  });

  describe('save', () => {
    it('saves tab state to profile', () => {
      mockWindows = [{ isDestroyed: () => false, getBounds: () => mockBounds }];
      const tm = makeTabManager([
        { id: 'tab-1', url: 'https://example.com', title: 'Example', favicon: '🌐', active: true },
        { id: 'tab-2', url: 'https://github.com', title: 'GitHub', favicon: '🐙', active: false },
      ], 'tab-1');

      const result = sessionPersistence.save(tm);

      expect(result).toBe(true);
      expect(profiles.saveProfileSession).toHaveBeenCalledWith(expect.objectContaining({
        tabs: [
          { url: 'https://example.com', title: 'Example', favicon: '🌐', active: true, groupId: null },
          { url: 'https://github.com', title: 'GitHub', favicon: '🐙', active: false, groupId: null },
        ],
        groups: [],
        activeTabId: 'tab-1',
        windowBounds: { x: 100, y: 200, width: 1400, height: 900 },
        savedAt: expect.any(Number),
      }));
    });

    it('returns false for empty tab list', () => {
      const tm = makeTabManager([], null);
      const result = sessionPersistence.save(tm);
      expect(result).toBe(false);
      expect(profiles.saveProfileSession).not.toHaveBeenCalled();
    });

    it('handles missing window gracefully', () => {
      mockWindows = [];
      const tm = makeTabManager([
        { id: 'tab-1', url: 'https://example.com', title: 'Example', favicon: '', active: true },
      ], 'tab-1');

      const result = sessionPersistence.save(tm);
      expect(result).toBe(true);
      expect(profiles.saveProfileSession).toHaveBeenCalledWith(expect.objectContaining({
        windowBounds: null,
      }));
    });
  });

  describe('load', () => {
    it('loads saved session', () => {
      const mockSession = {
        tabs: [{ url: 'https://example.com', title: 'Example', favicon: '', active: true }],
        activeTabId: 'tab-1',
        windowBounds: { x: 50, y: 50, width: 1200, height: 800 },
        savedAt: Date.now(),
      };
      profiles.loadProfileSession.mockReturnValue(mockSession);

      const result = sessionPersistence.load();
      expect(result).toEqual(mockSession);
    });

    it('returns null when no session saved', () => {
      profiles.loadProfileSession.mockReturnValue(null);
      const result = sessionPersistence.load();
      expect(result).toBeNull();
    });
  });

  describe('applyWindowBounds', () => {
    it('applies bounds when window is visible on display', () => {
      const win = { isDestroyed: () => false, setBounds: jest.fn(), setSize: jest.fn() };
      const session = { windowBounds: { x: 100, y: 200, width: 1400, height: 900 } };

      sessionPersistence.applyWindowBounds(win, session);
      expect(win.setBounds).toHaveBeenCalledWith({ x: 100, y: 200, width: 1400, height: 900 });
    });

    it('falls back to setSize when window would be off-screen', () => {
      const win = { isDestroyed: () => false, setBounds: jest.fn(), setSize: jest.fn() };
      const session = { windowBounds: { x: 5000, y: 5000, width: 1400, height: 900 } };

      sessionPersistence.applyWindowBounds(win, session);
      expect(win.setBounds).not.toHaveBeenCalled();
      expect(win.setSize).toHaveBeenCalledWith(1400, 900);
    });

    it('does nothing with null session', () => {
      const win = { isDestroyed: () => false, setBounds: jest.fn(), setSize: jest.fn() };
      sessionPersistence.applyWindowBounds(win, null);
      expect(win.setBounds).not.toHaveBeenCalled();
      expect(win.setSize).not.toHaveBeenCalled();
    });

    it('does nothing with null window', () => {
      const session = { windowBounds: { x: 100, y: 200, width: 1400, height: 900 } };
      expect(() => sessionPersistence.applyWindowBounds(null, session)).not.toThrow();
    });
  });

  describe('scheduleSave', () => {
    it('debounces saves', (done) => {
      mockWindows = [{ isDestroyed: () => false, getBounds: () => mockBounds }];
      const tm = makeTabManager([
        { id: 'tab-1', url: 'https://example.com', title: 'Example', favicon: '', active: true },
      ], 'tab-1');

      sessionPersistence.scheduleSave(tm);
      sessionPersistence.scheduleSave(tm);
      sessionPersistence.scheduleSave(tm);

      // Should only save once after debounce
      setTimeout(() => {
        expect(profiles.saveProfileSession).toHaveBeenCalledTimes(1);
        done();
      }, 1500);
    }, 5000);
  });

  describe('cancelAutosave', () => {
    it('cancels pending autosave', () => {
      mockWindows = [{ isDestroyed: () => false, getBounds: () => mockBounds }];
      const tm = makeTabManager([
        { id: 'tab-1', url: 'https://example.com', title: 'Example', favicon: '', active: true },
      ], 'tab-1');

      sessionPersistence.scheduleSave(tm);
      sessionPersistence.cancelAutosave();

      setTimeout(() => {
        expect(profiles.saveProfileSession).not.toHaveBeenCalled();
      }, 1500);
    });
  });
});

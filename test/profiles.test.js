/**
 * profiles.test.js — Unit tests for the multi-profile manager
 */

const path = require('path');
const fs = require('fs');

jest.mock('electron', () => ({
  app: { getPath: () => __dirname },
}));

let profiles;

beforeEach(() => {
  jest.resetModules();
  jest.mock('electron', () => ({
    app: { getPath: () => __dirname },
  }));
  profiles = require('../src/main/profiles');

  // Clean up all profile and migration data for a fresh start
  try {
    const files = fs.readdirSync(__dirname);
    files.forEach(f => {
      if (f === 'profiles.json' || f === 'storage.json' ||
          (f.startsWith('profile-') && f.endsWith('.json'))) {
        try { fs.unlinkSync(path.join(__dirname, f)); } catch {}
      }
    });
  } catch {}
});

afterEach(() => {
  // Clean up ALL test artifacts
  try {
    const files = fs.readdirSync(__dirname);
    files.forEach(f => {
      if (f === 'profiles.json' ||
          (f.startsWith('profile-') && f.endsWith('.json'))) {
        try { fs.unlinkSync(path.join(__dirname, f)); } catch {}
      }
    });
  } catch {}
});

describe('profiles', () => {
  describe('init', () => {
    it('creates a default profile on first init', () => {
      const current = profiles.init();
      expect(current).toBeTruthy();
      expect(current.id).toBe('default');
      expect(current.name).toBe('Default');
      expect(current.sessionPartition).toBe('persist:default');
    });

    it('returns existing default on subsequent inits', () => {
      profiles.init();
      profiles.createProfile({ name: 'Work' });
      const current = profiles.init();
      expect(current.id).toBe('default');
    });
  });

  describe('CRUD', () => {
    it('lists profiles', () => {
      profiles.init();
      const list = profiles.listProfiles();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('default');
    });

    it('creates a new profile', () => {
      profiles.init();
      const p = profiles.createProfile({ name: 'Work', color: '#f43f5e', avatar: '💼' });
      expect(p.id).toMatch(/^profile-/);
      expect(p.name).toBe('Work');
      expect(p.color).toBe('#f43f5e');
      expect(p.avatar).toBe('💼');
      expect(p.sessionPartition).toMatch(/^persist:/);

      const list = profiles.listProfiles();
      expect(list.length).toBe(2);
    });

    it('creates profile with defaults when no args', () => {
      profiles.init();
      const p = profiles.createProfile();
      expect(p.name).toMatch(/^Profile \d+$/);
      expect(p.avatar).toBeTruthy();
      expect(p.color).toBeTruthy();
    });

    it('gets a profile by id', () => {
      profiles.init();
      const created = profiles.createProfile({ name: 'Dev' });
      const fetched = profiles.getProfile(created.id);
      expect(fetched.name).toBe('Dev');
    });

    it('returns null for non-existent profile', () => {
      profiles.init();
      expect(profiles.getProfile('nope')).toBeNull();
    });

    it('updates a profile', () => {
      profiles.init();
      const created = profiles.createProfile({ name: 'Old' });
      const updated = profiles.updateProfile(created.id, { name: 'New' });
      expect(updated.name).toBe('New');
      expect(updated.id).toBe(created.id);
    });

    it('does not allow changing id or sessionPartition', () => {
      profiles.init();
      const created = profiles.createProfile({ name: 'Test' });
      const updated = profiles.updateProfile(created.id, {
        id: 'hacked',
        sessionPartition: 'hacked',
        name: 'Still Works',
      });
      expect(updated.id).toBe(created.id);
      expect(updated.sessionPartition).toBe(created.sessionPartition);
      expect(updated.name).toBe('Still Works');
    });

    it('deletes a non-default profile', () => {
      profiles.init();
      const p = profiles.createProfile({ name: 'Temp' });
      const result = profiles.deleteProfile(p.id);
      expect(result).toBe(true);
      expect(profiles.getProfile(p.id)).toBeNull();
    });

    it('cannot delete the default profile', () => {
      profiles.init();
      expect(profiles.deleteProfile('default')).toBe(false);
    });

    it('switches to another profile', () => {
      profiles.init();
      const p = profiles.createProfile({ name: 'Alt' });
      const switched = profiles.switchProfile(p.id);
      expect(switched.id).toBe(p.id);
      expect(profiles.getCurrentProfileId()).toBe(p.id);
    });

    it('returns null when switching to non-existent profile', () => {
      profiles.init();
      expect(profiles.switchProfile('nope')).toBeNull();
    });

    it('getCurrentProfile returns active profile', () => {
      profiles.init();
      const p = profiles.createProfile({ name: 'Alt' });
      profiles.switchProfile(p.id);
      const current = profiles.getCurrentProfile();
      expect(current.id).toBe(p.id);
    });
  });

  describe('profile-scoped data', () => {
    beforeEach(() => {
      profiles.init();
    });

    it('adds and retrieves bookmarks for a profile', () => {
      const bm = profiles.addProfileBookmark({ label: 'GitHub', url: 'https://github.com' });
      expect(bm.id).toBeTruthy();
      expect(bm.label).toBe('GitHub');

      const bms = profiles.getProfileBookmarks();
      expect(bms.length).toBe(1);
      expect(bms[0].url).toBe('https://github.com');
    });

    it('removes a bookmark', () => {
      const bm = profiles.addProfileBookmark({ label: 'Test', url: 'https://test.com' });
      expect(profiles.removeProfileBookmark(bm.id)).toBe(true);
      expect(profiles.getProfileBookmarks().length).toBe(0);
    });

    it('updates a bookmark', () => {
      const bm = profiles.addProfileBookmark({ label: 'Old', url: 'https://old.com' });
      const updated = profiles.updateProfileBookmark(bm.id, { label: 'New' });
      expect(updated.label).toBe('New');
    });

    it('adds history entries', () => {
      profiles.addProfileHistoryEntry({ url: 'https://a.com', title: 'A' });
      profiles.addProfileHistoryEntry({ url: 'https://b.com', title: 'B' });

      const hist = profiles.getProfileHistory();
      expect(hist.length).toBe(2);
      expect(hist[0].url).toBe('https://b.com'); // most recent first
    });

    it('de-duplicates history by URL', () => {
      profiles.addProfileHistoryEntry({ url: 'https://a.com', title: 'A v1' });
      profiles.addProfileHistoryEntry({ url: 'https://a.com', title: 'A v2' });

      const hist = profiles.getProfileHistory();
      expect(hist.length).toBe(1);
      expect(hist[0].title).toBe('A v2');
    });

    it('clears history', () => {
      profiles.addProfileHistoryEntry({ url: 'https://a.com' });
      profiles.clearProfileHistory();
      expect(profiles.getProfileHistory().length).toBe(0);
    });

    it('gets and updates settings', () => {
      const s = profiles.getProfileSettings();
      expect(s.theme).toBe('dark');
      expect(Array.isArray(s.customThemes)).toBe(true);

      profiles.updateProfileSettings({ theme: 'nord' });
      expect(profiles.getProfileSettings().theme).toBe('nord');
    });

    it('saves and loads tab order', () => {
      expect(profiles.loadProfileTabOrder()).toBeNull();
      profiles.saveProfileTabOrder(['tab-1', 'tab-2']);
      expect(profiles.loadProfileTabOrder()).toEqual(['tab-1', 'tab-2']);
    });

    it('clears tab order', () => {
      profiles.saveProfileTabOrder(['tab-1']);
      profiles.clearProfileTabOrder();
      expect(profiles.loadProfileTabOrder()).toBeNull();
    });
  });

  describe('profile isolation', () => {
    it('each profile has separate bookmarks', () => {
      profiles.init();
      const p2 = profiles.createProfile({ name: 'Second' });

      profiles.addProfileBookmark({ label: 'Default BM', url: 'https://default.com' });
      profiles.switchProfile(p2.id);
      profiles.addProfileBookmark({ label: 'P2 BM', url: 'https://p2.com' });

      // Default profile
      profiles.switchProfile('default');
      const defBms = profiles.getProfileBookmarks();
      expect(defBms.length).toBe(1);
      expect(defBms[0].label).toBe('Default BM');

      // Second profile
      profiles.switchProfile(p2.id);
      const p2Bms = profiles.getProfileBookmarks();
      expect(p2Bms.length).toBe(1);
      expect(p2Bms[0].label).toBe('P2 BM');
    });

    it('each profile has separate history', () => {
      profiles.init();
      const p2 = profiles.createProfile({ name: 'Second' });

      profiles.addProfileHistoryEntry({ url: 'https://default.com' });
      profiles.switchProfile(p2.id);
      profiles.addProfileHistoryEntry({ url: 'https://p2.com' });

      profiles.switchProfile('default');
      expect(profiles.getProfileHistory().length).toBe(1);

      profiles.switchProfile(p2.id);
      expect(profiles.getProfileHistory().length).toBe(1);
    });

    it('each profile has separate settings', () => {
      profiles.init();
      const p2 = profiles.createProfile({ name: 'Second' });

      profiles.updateProfileSettings({ theme: 'nord' });
      profiles.switchProfile(p2.id);
      profiles.updateProfileSettings({ theme: 'drac' });

      profiles.switchProfile('default');
      expect(profiles.getProfileSettings().theme).toBe('nord');

      profiles.switchProfile(p2.id);
      expect(profiles.getProfileSettings().theme).toBe('drac');
    });
  });

  describe('session partition', () => {
    it('returns default partition for default profile', () => {
      profiles.init();
      expect(profiles.getSessionPartition()).toBe('persist:default');
    });

    it('returns unique partition for new profiles', () => {
      profiles.init();
      const p = profiles.createProfile({ name: 'Work' });
      const partition = profiles.getSessionPartition(p.id);
      expect(partition).toMatch(/^persist:profile-/);
      expect(partition).not.toBe('persist:default');
    });
  });

  describe('session persistence', () => {
    it('saves and loads session', () => {
      profiles.init();
      const session = {
        tabs: [
          { url: 'https://example.com', title: 'Example', favicon: '', active: true },
          { url: 'https://github.com', title: 'GitHub', favicon: '🐙', active: false },
        ],
        activeTabId: 'tab-1',
        windowBounds: { x: 100, y: 200, width: 1400, height: 900 },
        savedAt: Date.now(),
      };

      profiles.saveProfileSession(session);
      const loaded = profiles.loadProfileSession();

      expect(loaded.tabs).toHaveLength(2);
      expect(loaded.tabs[0].url).toBe('https://example.com');
      expect(loaded.activeTabId).toBe('tab-1');
      expect(loaded.windowBounds.width).toBe(1400);
    });

    it('returns null when no session saved', () => {
      profiles.init();
      expect(profiles.loadProfileSession()).toBeNull();
    });

    it('clears session', () => {
      profiles.init();
      profiles.saveProfileSession({ tabs: [{ url: 'x', title: '', favicon: '', active: true }], savedAt: Date.now() });
      profiles.clearProfileSession();
      expect(profiles.loadProfileSession()).toBeNull();
    });

    it('session is profile-scoped', () => {
      profiles.init();
      const p = profiles.createProfile({ name: 'Work' });

      profiles.saveProfileSession({ tabs: [{ url: 'https://work.com', title: 'Work', favicon: '', active: true }], savedAt: Date.now() }, 'default');
      profiles.saveProfileSession({ tabs: [{ url: 'https://personal.com', title: 'Personal', favicon: '', active: true }], savedAt: Date.now() }, p.id);

      const def = profiles.loadProfileSession('default');
      const work = profiles.loadProfileSession(p.id);

      expect(def.tabs[0].url).toBe('https://work.com');
      expect(work.tabs[0].url).toBe('https://personal.com');
    });
  });

  describe('default profile data migration', () => {
    it('migrates old storage.json to profile data', () => {
      // Write a fake old storage.json
      const oldData = {
        bookmarks: [{ id: 'old-bm', label: 'Old', url: 'https://old.com' }],
        history: [{ url: 'https://old.com', title: 'Old', time: Date.now() }],
        settings: { theme: 'nord' },
      };
      fs.writeFileSync(path.join(__dirname, 'storage.json'), JSON.stringify(oldData));

      profiles.init();
      const bms = profiles.getProfileBookmarks('default');
      expect(bms.length).toBe(1);
      expect(bms[0].label).toBe('Old');
    });
  });
});

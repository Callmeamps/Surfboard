/**
 * Tests for storage.js
 * Tests bookmark CRUD, history, settings persistence.
 */

const path = require('path');
const fs = require('fs');

jest.mock('electron', () => ({
  app: { getPath: () => __dirname },
}));

const storage = require('../src/main/storage');

beforeAll(() => {
  // Clean up any leftover data files from other test suites
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

// Since storage.js uses app.getPath('userData') and we mocked it to __dirname,
// the storage file will be at __dirname/storage.json — that's fine for testing.

describe('storage bookmarks', () => {
  test('getBookmarks returns empty array for fresh profile', () => {
    const bms = storage.getBookmarks();
    expect(Array.isArray(bms)).toBe(true);
    // Profiles start with empty bookmarks
    expect(bms.length).toBe(0);
  });

  test('addBookmark creates a new bookmark', () => {
    const before = storage.getBookmarks().length;
    const bm = storage.addBookmark({ label: 'Test', url: 'https://test.com', icon: '🧪' });
    expect(bm).toMatchObject({ label: 'Test', url: 'https://test.com', icon: '🧪' });
    expect(bm.id).toBeDefined();
    expect(storage.getBookmarks().length).toBe(before + 1);
  });

  test('removeBookmark removes by id', () => {
    const bm = storage.addBookmark({ label: 'ToRemove', url: 'https://rm.com' });
    const before = storage.getBookmarks().length;
    const result = storage.removeBookmark(bm.id);
    expect(result).toBe(true);
    expect(storage.getBookmarks().length).toBe(before - 1);
  });

  test('removeBookmark returns false for missing id', () => {
    expect(storage.removeBookmark('no-such-id')).toBe(false);
  });

  test('updateBookmark patches fields', () => {
    const bm = storage.addBookmark({ label: 'Old', url: 'https://old.com' });
    const updated = storage.updateBookmark(bm.id, { label: 'New', icon: '✅' });
    expect(updated).toMatchObject({ label: 'New', icon: '✅', url: 'https://old.com' });
  });

  test('updateBookmark returns null for missing id', () => {
    expect(storage.updateBookmark('nope', { label: 'x' })).toBeNull();
  });
});

describe('storage history', () => {
  test('addHistoryEntry prepends to history', () => {
    storage.addHistoryEntry({ url: 'https://hist1.com', title: 'Hist 1' });
    storage.addHistoryEntry({ url: 'https://hist2.com', title: 'Hist 2' });
    const hist = storage.getHistory(10);
    expect(hist[0].url).toBe('https://hist2.com');
  });

  test('addHistoryEntry deduplicates same URL', () => {
    storage.addHistoryEntry({ url: 'https://dedup.com', title: 'V1' });
    storage.addHistoryEntry({ url: 'https://dedup.com', title: 'V2' });
    const hist = storage.getHistory(50).filter(h => h.url === 'https://dedup.com');
    expect(hist.length).toBe(1);
    expect(hist[0].title).toBe('V2');
  });

  test('getHistory respects limit', () => {
    for (let i = 0; i < 5; i++) {
      storage.addHistoryEntry({ url: `https://lim${i}.com`, title: `Lim ${i}` });
    }
    expect(storage.getHistory(3).length).toBeLessThanOrEqual(3);
  });

  test('clearHistory empties the list', () => {
    storage.addHistoryEntry({ url: 'https://clear.com', title: 'Clear me' });
    storage.clearHistory();
    expect(storage.getHistory().length).toBe(0);
  });
});

describe('storage settings', () => {
  test('getSettings returns defaults', () => {
    const s = storage.getSettings();
    expect(s).toHaveProperty('searchEngine');
    expect(s).toHaveProperty('homepage');
    expect(s).toHaveProperty('theme');
    expect(Array.isArray(s.customThemes)).toBe(true);
  });

  test('updateSettings merges custom themes', () => {
    const theme = { id: 'solar', name: 'Solar', tokens: { bg: '#111111', surface: '#222222', accent: '#f59e0b', text: '#ffffff', border: '#333333' } };
    storage.updateSettings({ customThemes: [theme] });
    const s = storage.getSettings();
    expect(s.customThemes).toEqual([theme]);
  });

  test('updateSettings merges patch', () => {
    storage.updateSettings({ searchEngine: 'ddg', theme: 'nord' });
    const s = storage.getSettings();
    expect(s.searchEngine).toBe('ddg');
    expect(s.theme).toBe('nord');
  });

  test('getSettings returns a copy (not mutable reference)', () => {
    const s1 = storage.getSettings();
    s1.searchEngine = 'hacked';
    const s2 = storage.getSettings();
    expect(s2.searchEngine).not.toBe('hacked');
  });
});

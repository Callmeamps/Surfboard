const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// ── Data file path ──────────────────────────────────────────
// Stored in Electron's userData directory:
//   Linux:   ~/.config/riced-chromium/storage.json
//   macOS:   ~/Library/Application Support/riced-chromium/storage.json
//   Windows: %APPDATA%\riced-chromium\storage.json

let _cache = null; // in-memory cache

function _dataPath() {
  return path.join(app.getPath('userData'), 'storage.json');
}

function _defaultData() {
  return {
    bookmarks: [
      {
        id: 'bm-1',
        label: 'GitHub',
        url: 'https://github.com',
        icon: '🐙',
        folder: 'Bookmarks Bar',
      },
      {
        id: 'bm-2',
        label: 'MDN Web Docs',
        url: 'https://developer.mozilla.org',
        icon: '📚',
        folder: 'Bookmarks Bar',
      },
      {
        id: 'bm-3',
        label: 'Stack Overflow',
        url: 'https://stackoverflow.com',
        icon: '📋',
        folder: 'Bookmarks Bar',
      },
      {
        id: 'bm-4',
        label: 'Hacker News',
        url: 'https://news.ycombinator.com',
        icon: '🔶',
        folder: 'Tools',
      },
      {
        id: 'bm-5',
        label: 'Lobsters',
        url: 'https://lobste.rs',
        icon: '🦞',
        folder: 'Tools',
      },
    ],
    history: [],
    settings: {
      searchEngine: 'google',
      homepage: 'about:blank',
      theme: 'dark',
    },
  };
}

// ── File I/O ────────────────────────────────────────────────

function _ensureDir() {
  const dir = path.dirname(_dataPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function _read() {
  if (_cache) return _cache;
  try {
    _ensureDir();
    const raw = fs.readFileSync(_dataPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    // Validate shape — if corrupted, start fresh
    if (!parsed.bookmarks || !Array.isArray(parsed.bookmarks)) {
      parsed.bookmarks = _defaultData().bookmarks;
    }
    if (!parsed.history || !Array.isArray(parsed.history)) {
      parsed.history = [];
    }
    if (!parsed.settings || typeof parsed.settings !== 'object') {
      parsed.settings = _defaultData().settings;
    }
    _cache = parsed;
    return _cache;
  } catch {
    // File doesn't exist or is invalid — seed with defaults
    const fresh = _defaultData();
    _cache = fresh;
    _write(fresh);
    return fresh;
  }
}

function _write(data) {
  try {
    _ensureDir();
    fs.writeFileSync(_dataPath(), JSON.stringify(data, null, 2), 'utf-8');
    _cache = data;
  } catch (err) {
    console.error('[storage] write failed:', err.message);
  }
}

// ── Bookmarks ───────────────────────────────────────────────

function getBookmarks() {
  const data = _read();
  return [...data.bookmarks];
}

function addBookmark(bookmark) {
  const data = _read();
  const id = bookmark.id || `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newBm = {
    id,
    label: bookmark.label || bookmark.url || 'Untitled',
    url: bookmark.url || '',
    icon: bookmark.icon || '🔖',
    folder: bookmark.folder || 'Bookmarks Bar',
  };
  data.bookmarks.push(newBm);
  _write(data);
  return newBm;
}

function removeBookmark(id) {
  const data = _read();
  const idx = data.bookmarks.findIndex(b => b.id === id);
  if (idx !== -1) {
    data.bookmarks.splice(idx, 1);
    _write(data);
    return true;
  }
  return false;
}

function updateBookmark(id, patch) {
  const data = _read();
  const bm = data.bookmarks.find(b => b.id === id);
  if (!bm) return null;
  Object.assign(bm, patch);
  _write(data);
  return { ...bm };
}

// ── History ─────────────────────────────────────────────────

function getHistory(limit = 50) {
  const data = _read();
  return data.history.slice(0, limit);
}

function addHistoryEntry(entry) {
  const data = _read();
  // De-dup: remove existing entry for same URL
  data.history = data.history.filter(h => h.url !== entry.url);
  data.history.unshift({
    url: entry.url,
    title: entry.title || entry.url,
    favicon: entry.favicon || '🌐',
    time: entry.time || Date.now(),
  });
  // Cap at 500 entries
  data.history = data.history.slice(0, 500);
  _write(data);
  return true;
}

function clearHistory() {
  const data = _read();
  data.history = [];
  _write(data);
}

// ── Settings ────────────────────────────────────────────────

function getSettings() {
  const data = _read();
  return { ...data.settings };
}

function updateSettings(patch) {
  const data = _read();
  Object.assign(data.settings, patch);
  _write(data);
  return { ...data.settings };
}

// ── Tab Order ─────────────────────────────────────────────

function loadTabOrder() {
  const data = _read();
  return Promise.resolve(data.tabOrder ? [...data.tabOrder] : null);
}

function saveTabOrder(order) {
  const data = _read();
  data.tabOrder = [...order];
  _write(data);
}

function clearTabOrder() {
  const data = _read();
  delete data.tabOrder;
  _write(data);
}

// ── Module exports ──────────────────────────────────────────

module.exports = {
  // Bookmarks
  getBookmarks,
  addBookmark,
  removeBookmark,
  updateBookmark,
  // History
  getHistory,
  addHistoryEntry,
  clearHistory,
  // Settings
  getSettings,
  updateSettings,
  // Tab Order
  loadTabOrder,
  saveTabOrder,
  clearTabOrder,
};

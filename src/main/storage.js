const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const profiles = require('./profiles');

// ── Data file path ──────────────────────────────────────────
// Now delegates to profile-scoped storage.
// Legacy storage.json used for backward compat if profiles module not yet init.

let _cache = null; // in-memory cache

function _dataPath() {
  return path.join(app.getPath('userData'), 'storage.json');
}

// ── Changelog ──────────────────────────────────────────────

const CHANGELOG = [
  {
    version: '0.2.0',
    date: '2026-06-03',
    features: [
      'PaperTM Phase 3: drag-to-reorder tabs, scroll-to-switch, minimap overview',
      'Tab groups support for organizing related tabs',
      'Bookmark/history UI: dialog, search, import/export, date grouping',
      'Settings module extraction',
      'Address bar omnibox with fuzzy match + DDG/Brave API suggestions',
      'Extension loader IPC tests (21 new tests)',
      '87 tests → 124 tests across 10 suites',
    ],
    fixes: [
      'Extension-loader broadcast fix',
      'Tab-lifecycle ID mismatch fix',
      'Preload/IPC handler mismatch fix',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-30',
    features: [
      'Frameless window with Linux Wayland support',
      'Vertical tab bar (PaperTM scrollable strip)',
      'Collapsible sidebar',
      'AI sidecar (OpenAI/Anthropic/Ollama)',
      'Browser shell with allowlisted commands',
      'Chrome extension support (Manifest V3)',
      'Ad/tracker blocking',
    ],
    fixes: [],
  },
];

function getAppVersion() {
  // Read from package.json at runtime
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getChangelogData() {
  return {
    entries: CHANGELOG,
    currentVersion: getAppVersion(),
  };
}

function getStoredVersion() {
  const data = _read();
  return data.version || null;
}

function updateStoredVersion(version) {
  const data = _read();
  data.version = version;
  _write(data);
}

function shouldShowChangelog() {
  const stored = getStoredVersion();
  const current = getAppVersion();
  return stored !== current;
}

function dismissChangelog() {
  updateStoredVersion(getAppVersion());
  return { dismissed: true };
}

function _defaultData() {
  return {
    version: null,
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
      customThemes: [],
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
  return profiles.getProfileBookmarks();
}

function addBookmark(bookmark) {
  return profiles.addProfileBookmark(bookmark);
}

function removeBookmark(id) {
  return profiles.removeProfileBookmark(id);
}

function updateBookmark(id, patch) {
  return profiles.updateProfileBookmark(id, patch);
}

// ── History ─────────────────────────────────────────────────

function getHistory(limit = 50) {
  return profiles.getProfileHistory(limit);
}

function addHistoryEntry(entry) {
  return profiles.addProfileHistoryEntry(entry);
}

function clearHistory() {
  profiles.clearProfileHistory();
}

// ── Settings ────────────────────────────────────────────────

function getSettings() {
  return profiles.getProfileSettings();
}

function updateSettings(patch) {
  return profiles.updateProfileSettings(patch);
}

// ── Tab Order ─────────────────────────────────────────────

function loadTabOrder() {
  return Promise.resolve(profiles.loadProfileTabOrder());
}

function saveTabOrder(order) {
  profiles.saveProfileTabOrder(order);
}

function clearTabOrder() {
  profiles.clearProfileTabOrder();
}

// ── Workflows ─────────────────────────────────────────────

function getWorkflows() {
  return profiles.getProfileWorkflows();
}

function addWorkflow(workflow) {
  return profiles.addProfileWorkflow(workflow);
}

function updateWorkflow(id, patch) {
  return profiles.updateProfileWorkflow(id, patch);
}

function removeWorkflow(id) {
  return profiles.removeProfileWorkflow(id);
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
  // Workflows
  getWorkflows,
  addWorkflow,
  updateWorkflow,
  removeWorkflow,
  // Changelog
  getChangelogData,
  shouldShowChangelog,
  dismissChangelog,
};

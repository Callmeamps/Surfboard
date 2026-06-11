/**
 * profiles.js — Multi-profile manager for Surfboard
 *
 * Each profile isolates: bookmarks, history, settings, extensions, session partition.
 * Data lives in a single profiles.json file under userData.
 *
 * Profile schema:
 *   { id, name, color, avatar, createdAt, sessionPartition }
 *
 * Active profile tracked via currentProfileId.
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const PROFILES_FILE = 'profiles.json';

// ── In-memory state ────────────────────────────────────
let _cache = null;
let _currentProfileId = null;

// ── Path helpers ───────────────────────────────────────

function _dataDir() {
  return app.getPath('userData');
}

function _profilesPath() {
  return path.join(_dataDir(), PROFILES_FILE);
}

function _profileDataPath(profileId) {
  return path.join(_dataDir(), `profile-${profileId}.json`);
}

// ── Default profile ────────────────────────────────────

function _defaultProfile() {
  return {
    id: 'default',
    name: 'Default',
    color: '#6366f1',
    avatar: '🌐',
    createdAt: Date.now(),
    sessionPartition: 'persist:default',
  };
}

// ── File I/O ───────────────────────────────────────────

function _ensureDir() {
  const dir = _dataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function _readAll() {
  if (_cache) return _cache;
  try {
    _ensureDir();
    const raw = fs.readFileSync(_profilesPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.profiles || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      parsed.profiles = [_defaultProfile()];
      parsed.currentProfileId = 'default';
    }
    _cache = parsed;
    return _cache;
  } catch {
    const fresh = { profiles: [_defaultProfile()], currentProfileId: 'default' };
    _cache = fresh;
    _writeAll(fresh);
    return fresh;
  }
}

function _writeAll(data) {
  try {
    _ensureDir();
    fs.writeFileSync(_profilesPath(), JSON.stringify(data, null, 2), 'utf-8');
    _cache = data;
  } catch (err) {
    console.error('[profiles] write failed:', err.message);
  }
}

// ── Profile-scoped data I/O ────────────────────────────

function _readProfileData(profileId) {
  try {
    const raw = fs.readFileSync(_profileDataPath(profileId), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function _writeProfileData(profileId, data) {
  try {
    _ensureDir();
    fs.writeFileSync(_profileDataPath(profileId), JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[profiles] profile data write failed:', err.message);
  }
}

function _migrateDefaultProfileData() {
  // If the old storage.json exists and no profile-Default.json, migrate it
  const oldPath = path.join(_dataDir(), 'storage.json');
  const newDefaultPath = _profileDataPath('default');
  if (fs.existsSync(oldPath) && !fs.existsSync(newDefaultPath)) {
    try {
      const data = fs.readFileSync(oldPath, 'utf-8');
      fs.writeFileSync(newDefaultPath, data, 'utf-8');
      console.log('[profiles] migrated old storage.json to profile-Default.json');
    } catch (err) {
      console.warn('[profiles] migration failed:', err.message);
    }
  }
}

// ── CRUD ───────────────────────────────────────────────

function listProfiles() {
  const data = _readAll();
  return data.profiles.map(p => ({ ...p }));
}

function getProfile(id) {
  const data = _readAll();
  const p = data.profiles.find(p => p.id === id);
  return p ? { ...p } : null;
}

function getCurrentProfile() {
  const data = _readAll();
  const p = data.profiles.find(p => p.id === data.currentProfileId);
  return p ? { ...p } : data.profiles[0] ? { ...data.profiles[0] } : null;
}

function getCurrentProfileId() {
  const data = _readAll();
  return data.currentProfileId;
}

function createProfile({ name, color, avatar } = {}) {
  const data = _readAll();
  const id = `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const profile = {
    id,
    name: name || `Profile ${data.profiles.length + 1}`,
    color: color || '#6366f1',
    avatar: avatar || '👤',
    createdAt: Date.now(),
    sessionPartition: `persist:${id}`,
  };
  data.profiles.push(profile);
  _writeAll(data);

  // Initialize empty profile data
  _writeProfileData(id, {
    bookmarks: [],
    history: [],
    settings: {
      searchEngine: 'google',
      homepage: 'about:blank',
      theme: 'dark',
    },
    tabOrder: null,
  });

  return { ...profile };
}

function updateProfile(id, patch) {
  const data = _readAll();
  const idx = data.profiles.findIndex(p => p.id === id);
  if (idx === -1) return null;

  // Don't allow changing id or sessionPartition
  delete patch.id;
  delete patch.sessionPartition;
  delete patch.createdAt;

  Object.assign(data.profiles[idx], patch);
  _writeAll(data);
  return { ...data.profiles[idx] };
}

function deleteProfile(id) {
  if (id === 'default') return false; // Can't delete default

  const data = _readAll();
  const idx = data.profiles.findIndex(p => p.id === id);
  if (idx === -1) return false;

  data.profiles.splice(idx, 1);

  // If we deleted the current profile, switch to default
  if (data.currentProfileId === id) {
    data.currentProfileId = 'default';
  }

  _writeAll(data);

  // Remove profile data file
  try {
    const p = _profileDataPath(id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}

  return true;
}

function switchProfile(id) {
  const data = _readAll();
  const p = data.profiles.find(p => p.id === id);
  if (!p) return null;

  data.currentProfileId = id;
  _writeAll(data);
  _currentProfileId = id;
  return { ...p };
}

let _initialized = false;

function _ensureInit() {
  if (!_initialized) {
    init();
  }
}

// ── Profile-scoped data access ─────────────────────────

function getProfileBookmarks(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  return data?.bookmarks ? [...data.bookmarks] : [];
}

function addProfileBookmark(bookmark, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid) || { bookmarks: [], history: [], settings: {} };
  const id = bookmark.id || `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newBm = {
    id,
    label: bookmark.label || bookmark.url || 'Untitled',
    url: bookmark.url || '',
    icon: bookmark.icon || '🔖',
    folder: bookmark.folder || 'Bookmarks Bar',
  };
  data.bookmarks.push(newBm);
  _writeProfileData(pid, data);
  return newBm;
}

function removeProfileBookmark(id, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  if (!data) return false;
  const idx = data.bookmarks.findIndex(b => b.id === id);
  if (idx !== -1) {
    data.bookmarks.splice(idx, 1);
    _writeProfileData(pid, data);
    return true;
  }
  return false;
}

function updateProfileBookmark(id, patch, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  if (!data) return null;
  const bm = data.bookmarks.find(b => b.id === id);
  if (!bm) return null;
  Object.assign(bm, patch);
  _writeProfileData(pid, data);
  return { ...bm };
}

function getProfileHistory(limit = 50, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  return data?.history ? data.history.slice(0, limit) : [];
}

function addProfileHistoryEntry(entry, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid) || { bookmarks: [], history: [], settings: {} };
  data.history = data.history.filter(h => h.url !== entry.url);
  data.history.unshift({
    url: entry.url,
    title: entry.title || entry.url,
    favicon: entry.favicon || '🌐',
    time: entry.time || Date.now(),
  });
  data.history = data.history.slice(0, 500);
  _writeProfileData(pid, data);
  return true;
}

function clearProfileHistory(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  if (data) {
    data.history = [];
    _writeProfileData(pid, data);
  }
}

function getProfileSettings(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  return data?.settings ? { ...data.settings } : {};
}

function updateProfileSettings(patch, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid) || { bookmarks: [], history: [], settings: {} };
  if (!data.settings || typeof data.settings !== 'object') data.settings = {};
  Object.assign(data.settings, patch);
  _writeProfileData(pid, data);
  return { ...data.settings };
}

function loadProfileTabOrder(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  return data?.tabOrder ? [...data.tabOrder] : null;
}

function saveProfileTabOrder(order, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid) || { bookmarks: [], history: [], settings: {} };
  data.tabOrder = [...order];
  _writeProfileData(pid, data);
}

function clearProfileTabOrder(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  if (data) {
    delete data.tabOrder;
    _writeProfileData(pid, data);
  }
}

// ── Session persistence ───────────────────────────────

function saveProfileSession(session, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid) || { bookmarks: [], history: [], settings: {} };
  data.session = session;
  _writeProfileData(pid, data);
}

function loadProfileSession(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  return data?.session || null;
}

function clearProfileSession(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  if (data) {
    delete data.session;
    _writeProfileData(pid, data);
  }
}

// ── Dev Environments ───────────────────────────────────

function getProfileEnvironments(profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  return data?.environments ? [...data.environments] : [];
}

function addProfileEnvironment(env, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid) || { bookmarks: [], history: [], settings: {}, environments: [] };
  if (!Array.isArray(data.environments)) data.environments = [];
  const id = env.id || `env-${Date.now().toString(36)}`;
  const newEnv = { id, ...env, createdAt: Date.now() };
  data.environments.push(newEnv);
  _writeProfileData(pid, data);
  return newEnv;
}

function updateProfileEnvironment(id, patch, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  if (!data?.environments) return null;
  const idx = data.environments.findIndex(e => e.id === id);
  if (idx === -1) return null;
  Object.assign(data.environments[idx], patch);
  _writeProfileData(pid, data);
  return { ...data.environments[idx] };
}

function removeProfileEnvironment(id, profileId) {
  _ensureInit();
  const pid = profileId || getCurrentProfileId();
  const data = _readProfileData(pid);
  if (!data?.environments) return false;
  const idx = data.environments.findIndex(e => e.id === id);
  if (idx === -1) return false;
  data.environments.splice(idx, 1);
  _writeProfileData(pid, data);
  return true;
}

// ── Session partition ──────────────────────────────────

function getSessionPartition(profileId) {
  const pid = profileId || getCurrentProfileId();
  const data = _readAll();
  const p = data.profiles.find(p => p.id === pid);
  return p?.sessionPartition || 'persist:default';
}

// ── Init ───────────────────────────────────────────────

function init() {
  _cache = null; // Reset cache on init
  _migrateDefaultProfileData();
  const data = _readAll();
  _currentProfileId = data.currentProfileId;

  // Ensure default profile data file exists
  const defaultData = _readProfileData('default');
  if (!defaultData) {
    _writeProfileData('default', {
      bookmarks: [],
      history: [],
      settings: {
        searchEngine: 'google',
        homepage: 'about:blank',
        theme: 'dark',
      },
      tabOrder: null,
    });
  }

  _initialized = true;
  return getCurrentProfile();
}

// ── Module exports ─────────────────────────────────────

module.exports = {
  // CRUD
  listProfiles,
  getProfile,
  getCurrentProfile,
  getCurrentProfileId,
  createProfile,
  updateProfile,
  deleteProfile,
  switchProfile,

  // Profile-scoped data
  getProfileBookmarks,
  addProfileBookmark,
  removeProfileBookmark,
  updateProfileBookmark,
  getProfileHistory,
  addProfileHistoryEntry,
  clearProfileHistory,
  getProfileSettings,
  updateProfileSettings,
  loadProfileTabOrder,
  saveProfileTabOrder,
  clearProfileTabOrder,

  // Session persistence
  saveProfileSession,
  loadProfileSession,
  clearProfileSession,

  // Dev Environments
  getProfileEnvironments,
  addProfileEnvironment,
  updateProfileEnvironment,
  removeProfileEnvironment,

  // Session
  getSessionPartition,

  // Init
  init,

  // Expose for testing
  _readAll,
  _readProfileData,
};

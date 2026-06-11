/**
 * session-persistence.js — Save and restore tab sessions
 *
 * Persists: tab URLs, titles, favicons, active tab, window geometry.
 * Stored in profile-scoped data via profiles.js.
 *
 * Auto-saves on tab changes (debounced).
 * Saves on app quit.
 * Restores on app startup.
 */

const { app, BrowserWindow } = require('electron');
const profiles = require('./profiles');

const AUTOSAVE_DEBOUNCE_MS = 1000;
let _autosaveTimer = null;

// ── Session schema ─────────────────────────────────────

/**
 * @typedef {Object} SessionTab
 * @property {string} url
 * @property {string} title
 * @property {string} favicon
 * @property {boolean} active
 */

/**
 * @typedef {Object} Session
 * @property {SessionTab[]} tabs
 * @property {string|null} activeTabId
 * @property {{width:number,height:number,x:number,y:number}|null} windowBounds
 * @property {number} savedAt - timestamp
 */

// ── Save ───────────────────────────────────────────────

function _getWindowBounds() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return null;
  try {
    const bounds = win.getBounds();
    return {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
    };
  } catch {
    return null;
  }
}

/**
 * Save current session state.
 * @param {import('./tab-manager')} tabManager
 */
function save(tabManager) {
  const allTabs = tabManager.getAll();
  const activeId = tabManager.getActiveId();
  const groups = tabManager.getGroups();

  const tabs = allTabs.map(t => ({
    url: t.url || 'about:blank',
    title: t.title || '',
    favicon: t.favicon || '',
    active: t.id === activeId,
    groupId: t.groupId || null,
  }));

  // Don't save empty sessions — keep previous save
  if (tabs.length === 0) return false;

  const session = {
    tabs,
    groups,
    activeTabId: activeId,
    windowBounds: _getWindowBounds(),
    savedAt: Date.now(),
  };

  profiles.saveProfileSession(session);
  return true;
}

/**
 * Save session, debounced. Call this on every tab change.
 */
function scheduleSave(tabManager) {
  if (_autosaveTimer) clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => {
    save(tabManager);
    _autosaveTimer = null;
  }, AUTOSAVE_DEBOUNCE_MS);
}

// ── Load ───────────────────────────────────────────────

/**
 * Load saved session for current profile.
 * @returns {Session|null}
 */
function load() {
  return profiles.loadProfileSession();
}

// ── Restore window bounds ─────────────────────────────

/**
 * Apply saved window bounds to a BrowserWindow.
 * @param {BrowserWindow} win
 * @param {Session} session
 */
function applyWindowBounds(win, session) {
  if (!session?.windowBounds || !win || win.isDestroyed()) return;

  const { width, height, x, y } = session.windowBounds;

  // Ensure window is visible on at least one display
  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  const visible = displays.some(d => {
    const { x: dx, y: dy, width: dw, height: dh } = d.workArea;
    return x < dx + dw && x + width > dx && y < dy + dh && y + height > dy;
  });

  if (visible) {
    win.setBounds({ x, y, width, height });
  } else {
    // Window would be off-screen, just resize (centered by Electron)
    win.setSize(width, height);
  }
}

// ── Cleanup ────────────────────────────────────────────

function cancelAutosave() {
  if (_autosaveTimer) {
    clearTimeout(_autosaveTimer);
    _autosaveTimer = null;
  }
}

module.exports = {
  save,
  scheduleSave,
  load,
  applyWindowBounds,
  cancelAutosave,
};

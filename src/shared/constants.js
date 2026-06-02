/**
 * RicedChromium — Shared Constants
 * Used by both main process and renderer (via IPC).
 */

module.exports = {
  // ── Window defaults ────────────────────────────────────
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  MIN_WINDOW_WIDTH: 800,
  MIN_WINDOW_HEIGHT: 600,

  // ── Layout dimensions (CSS vars must match) ─────────────
  TAB_BAR_WIDTH: 200,       // px — vertical tab bar
  SIDEBAR_WIDTH: 250,       // px — sidebar collapsed-to
  TITLEBAR_HEIGHT: 36,      // px — custom titlebar
  SIDECAR_WIDTH: 380,       // px — AI sidecar panel

  // ── Paths ───────────────────────────────────────────────
  EXTENSIONS_DIR: require('path').join(
    process.env.HOME || process.env.USERPROFILE,
    '.config', 'riced-chromium', 'extensions'
  ),

  // ── App identity ────────────────────────────────────────
  APP_NAME: 'RicedChromium',
  APP_ID: 'com.zoo.riced-chromium',

  // ── Session ─────────────────────────────────────────────
  SESSION_PARTITION: 'persist:riced-chromium',

  // ── Keyboard shortcuts ──────────────────────────────────
  SHORTCUTS: {
    NEW_TAB: 'Ctrl+T',
    CLOSE_TAB: 'Ctrl+W',
    NEXT_TAB: 'Ctrl+Tab',
    PREV_TAB: 'Ctrl+Shift+Tab',
    TOGGLE_SIDECAR: 'Ctrl+Shift+A',
  },
};

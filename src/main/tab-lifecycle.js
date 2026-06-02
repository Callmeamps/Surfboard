/**
 * Tab Lifecycle Manager
 *
 * Game-dev inspired LOD (Level of Detail) for browser tabs:
 *
 *   Active tab    → full framerate, unthrottled, live webview
 *   Adjacent tab  → reduced framerate (15fps), throttled timers
 *   Distant tab   → suspended (webview destroyed, screenshot placeholder)
 *
 * This keeps RAM and CPU low on potato hardware.
 */

const { BrowserWindow } = require('electron');

// Configuration
const ADJACENT_FRAMERATE = 15;     // fps for tabs next to active
const DISTANT_SUSPEND_MS = 30000;  // suspend after 30s inactive
const MAX_LIVE_WEBVIEWS = 3;       // max concurrent live webviews

let _tabOrder = [];     // ordered list of tab IDs (most recent first)
let _activeTabId = null;
let _suspendTimers = new Map();   // tabId → timeoutId
let _webviewElements = new Map(); // tabId → webContents (for LOD throttling)

// ── Public API ─────────────────────────────────────────────

/**
 * Called when a tab becomes active.
 * Unthrottles it, schedules suspension for distant tabs.
 */
function onTabActivated(tabId) {
  _activeTabId = tabId;

  // Move to front of order
  _tabOrder = _tabOrder.filter(id => id !== tabId);
  _tabOrder.unshift(tabId);

  // Clear suspend timer for this tab
  clearSuspend(tabId);

  // Schedule suspension for distant tabs
  scheduleDistantSuspension();
}

/**
 * Called when a tab is closed.
 */
function onTabClosed(tabId) {
  _tabOrder = _tabOrder.filter(id => id !== tabId);
  clearSuspend(tabId);
  unregisterWebContents(tabId);
}

/**
 * Called when a tab is created.
 */
function onTabCreated(tabId) {
  if (!_tabOrder.includes(tabId)) {
    _tabOrder.unshift(tabId);
  }
}

/**
 * Register a webContents for lifecycle management.
 * Maps tabId → webContents for LOD throttling.
 */
function registerWebContents(tabId, webContents) {
  _webviewElements.set(tabId, webContents);
}

/**
 * Unregister webContents for a tab.
 */
function unregisterWebContents(tabId) {
  _webviewElements.delete(tabId);
}

/**
 * Get the LOD level for a tab.
 * @returns 'active' | 'adjacent' | 'distant'
 */
function getTabLod(tabId) {
  if (tabId === _activeTabId) return 'active';
  const idx = _tabOrder.indexOf(tabId);
  if (idx === -1) return 'distant';
  if (idx <= 1) return 'adjacent'; // 1 tab away from active
  return 'distant';
}

/**
 * Get all tab IDs ordered by recency.
 */
function getTabOrder() {
  return [..._tabOrder];
}

/**
 * Get active tab ID.
 */
function getActiveTabId() {
  return _activeTabId;
}

// ── Internal ───────────────────────────────────────────────

function clearSuspend(tabId) {
  const t = _suspendTimers.get(tabId);
  if (t) {
    clearTimeout(t);
    _suspendTimers.delete(tabId);
  }
}

function scheduleDistantSuspension() {
  // Count currentlylive webviews
  let liveCount = 0;
  for (const tabId of _tabOrder) {
    const lod = getTabLod(tabId);
    if (lod === 'active' || lod === 'adjacent') liveCount++;
  }

  // If too many live, suspend the most distant
  if (liveCount <= MAX_LIVE_WEBVIEWS) return;

  // Walk from the end (most distant) and suspend
  for (let i = _tabOrder.length - 1; i >= 0; i--) {
    const tabId = _tabOrder[i];
    if (tabId === _activeTabId) continue;
    if (_suspendTimers.has(tabId)) continue; // already scheduled

    // Schedule suspension
    const timer = setTimeout(() => {
      _suspendTimers.delete(tabId);
      // Notify renderer to suspend this tab's webview
      broadcastSuspend(tabId);
    }, DISTANT_SUSPEND_MS);

    _suspendTimers.set(tabId, timer);

    liveCount--;
    if (liveCount <= MAX_LIVE_WEBVIEWS) break;
  }
}

function broadcastSuspend(tabId) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('tab-lifecycle:suspend', tabId);
    }
  }
}

function getWebContents(tabId) {
  const wc = _webviewElements.get(tabId);
  return (wc && !wc.isDestroyed()) ? wc : null;
}

module.exports = {
  onTabActivated,
  onTabClosed,
  onTabCreated,
  registerWebContents,
  unregisterWebContents,
  getWebContents,
  getTabLod,
  getTabOrder,
  getActiveTabId,
};

const { ipcMain, webContents } = require('electron');
const tabManager = require('./tab-manager');
const windowManager = require('./window-manager');
const storage = require('./storage');
const lifecycle = require('./tab-lifecycle');
const tabLifecycle = require('./tab-lifecycle');

/**
 * Register all IPC handlers.
 */
function register() {

  // ── Tabs ──────────────────────────────────────────────
  ipcMain.handle('tabs:create', (_event, url) => {
    return tabManager.create(url);
  });

  ipcMain.handle('tabs:close', (_event, tabId) => {
    return tabManager.close(tabId);
  });

  ipcMain.handle('tabs:switch', (_event, tabId) => {
    return tabManager.switch(tabId);
  });

  ipcMain.handle('tabs:list', () => {
    return tabManager.getAll();
  });

  // ── Tab lifecycle (LOD / suspend-resume) ─────────────
  // Renderer calls this when a tab's webview visibility changes
  ipcMain.handle('tabs:notify-visibility', (_event, tabId, visible) => {
    const wc = webContents.fromId(tabId);
    if (wc && !wc.isDestroyed()) {
      wc.setBackgroundThrottled(!visible);
      if (visible) {
        wc.setFrameRate(60);
      } else {
        // Check LOD: adjacent gets 15fps, distant gets 1fps
        const lod = tabLifecycle.getTabLod(tabId);
        wc.setFrameRate(lod === 'adjacent' ? 15 : 1);
      }
    }
  });

  // Resume a suspended tab — reload its webview
  ipcMain.handle('tabs:resume', (_event, tabId, url) => {
    const tab = tabManager.get(tabId);
    if (!tab) return null;
    // Un-throttle
    const wc = webContents.fromId(tabId);
    if (wc && !wc.isDestroyed()) {
      wc.setBackgroundThrottled(false);
      wc.setFrameRate(60);
    }
    return tab;
  });

  // ── Sidebar ───────────────────────────────────────────
  ipcMain.handle('sidebar:toggle', () => {
    // Deprecated: renderer handles this via settings
    return { collapsed: false };
  });

  // ── Sidecar ───────────────────────────────────────────
  ipcMain.handle('sidecar:toggle', () => {
    // Deprecated: renderer handles this internally
    return { visible: false };
  });

  ipcMain.handle('sidecar:state', () => {
    return { visible: false };
  });

  // ── Extensions ────────────────────────────────────────
  ipcMain.handle('extensions:load', async (_event, extensionPath) => {
    const extLoader = require('./extension-loader');
    return extLoader.loadExtension(extensionPath);
  });

  ipcMain.handle('extensions:list', async () => {
    const extLoader = require('./extension-loader');
    return extLoader.listExtensions();
  });

  ipcMain.handle('extensions:unload', async (_event, extensionId) => {
    const extLoader = require('./extension-loader');
    return extLoader.unloadExtension(extensionId);
  });

  // ── Storage ──────────────────────────────────────────
  ipcMain.handle('storage:bookmarks:get', () => {
    return storage.getBookmarks();
  });

  ipcMain.handle('storage:bookmarks:add', (_event, bookmark) => {
    return storage.addBookmark(bookmark);
  });

  ipcMain.handle('storage:bookmarks:remove', (_event, id) => {
    return storage.removeBookmark(id);
  });

  ipcMain.handle('storage:bookmarks:update', (_event, id, patch) => {
    return storage.updateBookmark(id, patch);
  });

  ipcMain.handle('storage:history:get', (_event, limit) => {
    return storage.getHistory(limit);
  });

  ipcMain.handle('storage:history:add', (_event, entry) => {
    return storage.addHistoryEntry(entry);
  });

  ipcMain.handle('storage:history:clear', () => {
    storage.clearHistory();
    return true;
  });

  ipcMain.handle('storage:settings:get', () => {
    return storage.getSettings();
  });

  ipcMain.handle('storage:settings:update', (_event, patch) => {
    return storage.updateSettings(patch);
  });

  // ── Window controls ───────────────────────────────────
  ipcMain.on('window:minimize', () => {
    windowManager.minimize();
  });

  ipcMain.on('window:maximize', () => {
    windowManager.toggleMaximize();
  });

  ipcMain.on('window:close', () => {
    windowManager.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return windowManager.isMaximized();
  });
}

module.exports = { register };

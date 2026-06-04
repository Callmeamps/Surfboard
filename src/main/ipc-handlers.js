const { app, ipcMain, webContents, BrowserWindow } = require('electron');
const tabManager = require('./tab-manager');
const windowManager = require('./window-manager');
const storage = require('./storage');
const tabLifecycle = require('./tab-lifecycle');
const { createBrowserShellManager } = require('./browser-shell');

const shortcutListeners = new Set();
const shell = createBrowserShellManager();
let shellEventsBound = false;

app.on('before-quit', () => {
  shell.stop();
});

function broadcastToWindows(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function bindShellEvents() {
  if (shellEventsBound) return;
  shellEventsBound = true;

  shell.on('output', (payload) => {
    broadcastToWindows('shell:output', payload);
  });

  shell.on('status', (payload) => {
    broadcastToWindows('shell:status', payload);
  });

  shell.on('clear', () => {
    broadcastToWindows('shell:clear');
  });
}

function getShortcutAction(input) {
  const mod = input.control || input.meta;
  if (!mod) return null;

  const key = (input.key || '').toLowerCase();
  if (key === 'l') return 'show-omnibar';
  if (key === 't') return 'new-tab';
  if (key === 'w') return 'close-tab';
  if (key === 'h') return 'toggle-history';
  if (key === ',') return 'toggle-settings';
  if (key === 'b') return 'toggle-sidebar';
  if (input.shift && key === 'a') return 'toggle-sidecar';
  return null;
}

function sendRendererShortcut(action) {
  const win = windowManager.getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:shortcut', action);
  }
}

function runShortcutAction(action) {
  if (!action) return;

  switch (action) {
    case 'new-tab':
      tabManager.create('about:blank');
      break;
    case 'close-tab': {
      const activeId = tabManager.getActiveId();
      if (activeId) tabManager.close(activeId);
      break;
    }
    case 'show-omnibar':
    case 'toggle-history':
    case 'toggle-settings':
    case 'toggle-sidecar':
    case 'toggle-sidebar':
      sendRendererShortcut(action);
      break;
    default:
      break;
  }
}

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

  ipcMain.handle('tabs:update', (_event, tabId, patch) => {
    return tabManager.update(tabId, patch);
  });

  // ── Tab lifecycle (LOD / suspend-resume) ─────────────
  // Renderer registers webview webContents for LOD management
  ipcMain.on('tabs:register-webview', (_event, tabId, wcId) => {
    const wc = webContents.fromId(wcId);
    if (wc) {
      if (!shortcutListeners.has(wc.id)) {
        wc.on('before-input-event', (event, input) => {
          const action = getShortcutAction(input);
          if (!action) return;
          event.preventDefault();
          runShortcutAction(action);
        });
        wc.once('destroyed', () => shortcutListeners.delete(wc.id));
        shortcutListeners.add(wc.id);
      }
      tabLifecycle.registerWebContents(tabId, wc);
    }
  });

  // Renderer calls this when a tab's webview visibility changes
  ipcMain.handle('tabs:notify-visibility', (_event, tabId, visible) => {
    const wc = tabLifecycle.getWebContents(tabId);
    if (!wc) return;
    wc.setBackgroundThrottled(!visible);
    if (visible) {
      wc.setFrameRate(60);
    } else {
      const lod = tabLifecycle.getTabLod(tabId);
      wc.setFrameRate(lod === 'adjacent' ? 15 : 1);
    }
  });

  // Resume a suspended tab
  ipcMain.handle('tabs:resume', (_event, tabId, url) => {
    const tab = tabManager.get(tabId);
    if (!tab) return null;
    const wc = tabLifecycle.getWebContents(tabId);
    if (wc) {
      wc.setBackgroundThrottled(false);
      wc.setFrameRate(60);
    }
    return tab;
  });

  // ── Sidebar ───────────────────────────────────────────
  ipcMain.handle('sidebar:toggle', () => {
    return { collapsed: true };
  });

  ipcMain.handle('sidebar:state', () => {
    const s = storage.getSettings();
    return { collapsed: s.sidebarCollapsed || false };
  });

  ipcMain.handle('sidebar:state:save', (_event, collapsed) => {
    storage.updateSettings({ sidebarCollapsed: collapsed });
    return { collapsed };
  });

  ipcMain.handle('sidebar:state:load', () => {
    const s = storage.getSettings();
    return { collapsed: s.sidebarCollapsed || false };
  });

  // ── Sidecar ───────────────────────────────────────────
  ipcMain.handle('sidecar:toggle', () => {
    return { visible: false };
  });

  ipcMain.handle('sidecar:state', () => {
    return { visible: false };
  });

  // ── Browser shell ─────────────────────────────────────
  ipcMain.handle('shell:start', () => {
    bindShellEvents();
    return shell.start();
  });

  ipcMain.handle('shell:state', () => {
    bindShellEvents();
    return shell.getState();
  });

  ipcMain.handle('shell:command', (_event, commandLine) => {
    bindShellEvents();
    return shell.send(commandLine);
  });

  ipcMain.handle('shell:clear', () => {
    bindShellEvents();
    shell.clear();
    return { ok: true };
  });

  ipcMain.handle('shell:stop', () => {
    bindShellEvents();
    return shell.stop();
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

  // ── Changelog ──────────────────────────────────────────
  ipcMain.handle('changelog:get', () => {
    return storage.getChangelogData();
  });

  ipcMain.handle('changelog:shouldShow', () => {
    return { show: storage.shouldShowChangelog() };
  });

  ipcMain.handle('changelog:dismiss', () => {
    return storage.dismissChangelog();
  });
}

module.exports = { register };

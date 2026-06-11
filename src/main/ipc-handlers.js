const { app, ipcMain, webContents, BrowserWindow, Menu, clipboard, shell: electronShell } = require('electron');
const tabManager = require('./tab-manager');
const windowManager = require('./window-manager');
const storage = require('./storage');
const profiles = require('./profiles');
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

  ipcMain.handle('tabs:go-back', (_event, tabId) => {
    const wc = tabLifecycle.getWebContents(tabId);
    if (wc && wc.canGoBack()) wc.goBack();
    return true;
  });

  ipcMain.handle('tabs:go-forward', (_event, tabId) => {
    const wc = tabLifecycle.getWebContents(tabId);
    if (wc && wc.canGoForward()) wc.goForward();
    return true;
  });

  // ── Tab lifecycle (LOD / suspend-resume) ─────────────
  // Renderer registers webview webContents for LOD management
  ipcMain.on('tabs:register-webview', (_event, tabId, wcId) => {
    const wc = webContents.fromId(wcId);
    if (wc) {
      if (!shortcutListeners.has(wc.id)) {
        wc.on('before-input-event', (event, input) => {
          // Alt+Left/Right: back/forward navigation (handled directly on this webContents)
          if (input.alt && !input.control && !input.meta && !input.shift) {
            if (input.key === 'ArrowLeft') { event.preventDefault(); if (wc.canGoBack()) wc.goBack(); return; }
            if (input.key === 'ArrowRight') { event.preventDefault(); if (wc.canGoForward()) wc.goForward(); return; }
          }
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

  // ── SSH sessions ─────────────────────────────────────
  const { createSSHSessionManager } = require('./ssh-manager');
  const sshManager = createSSHSessionManager();
  let sshEventsBound = false;

  function bindSSHEvents() {
    if (sshEventsBound) return;
    sshEventsBound = true;
    sshManager.on('output', (data) => {
      broadcastToWindows('ssh:output', data);
    });
    sshManager.on('status', (status) => {
      broadcastToWindows('ssh:status', status);
    });
  }

  app.on('before-quit', () => {
    sshManager.disconnect();
  });

  ipcMain.handle('ssh:connect', async (_event, config) => {
    bindSSHEvents();
    return sshManager.connect(config);
  });

  ipcMain.handle('ssh:disconnect', async () => {
    return sshManager.disconnect();
  });

  ipcMain.handle('ssh:send', async (_event, command) => {
    return sshManager.send(command);
  });

  ipcMain.handle('ssh:state', () => {
    return sshManager.getState();
  });

  ipcMain.handle('ssh:connections:list', () => {
    return sshManager.getConnections();
  });

  ipcMain.handle('ssh:connections:save', async (_event, id, config) => {
    return sshManager.saveConnection(id, config);
  });

  ipcMain.handle('ssh:connections:delete', async (_event, id) => {
    return sshManager.deleteConnection(id);
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

  ipcMain.handle('storage:tab-order:get', () => {
    return storage.loadTabOrder();
  });

  ipcMain.handle('storage:tab-order:save', (_event, order) => {
    storage.saveTabOrder(order);
    return true;
  });

  ipcMain.handle('storage:tab-order:clear', () => {
    storage.clearTabOrder();
    return true;
  });

  // ── Dev Environments ─────────────────────────────────
  ipcMain.handle('storage:environments:list', () => {
    return profiles.getProfileEnvironments();
  });

  ipcMain.handle('storage:environments:add', (_event, env) => {
    return profiles.addProfileEnvironment(env);
  });

  ipcMain.handle('storage:environments:update', (_event, id, patch) => {
    return profiles.updateProfileEnvironment(id, patch);
  });

  ipcMain.handle('storage:environments:remove', (_event, id) => {
    return profiles.removeProfileEnvironment(id);
  });

  // ── Cookie management ────────────────────────────────
  ipcMain.handle('cookies:get', async (_event, filter) => {
    const ses = session.defaultSession;
    const cookies = await ses.cookies.get(filter || {});
    return cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expirationDate: c.expirationDate,
      hostOnly: c.hostOnly,
      httpOnly: c.httpOnly,
      secure: c.secure,
      session: c.session,
      sameSite: c.sameSite,
    }));
  });

  ipcMain.handle('cookies:set', async (_event, details) => {
    const ses = session.defaultSession;
    await ses.cookies.set(details);
    return true;
  });

  ipcMain.handle('cookies:remove', async (_event, url, name) => {
    const ses = session.defaultSession;
    await ses.cookies.remove(url, name);
    return true;
  });

  ipcMain.handle('cookies:clear', async () => {
    const ses = session.defaultSession;
    await ses.cookies.flushStore();
    return true;
  });

  ipcMain.handle('cookies:export', async () => {
    const ses = session.defaultSession;
    const cookies = await ses.cookies.get({});
    // Netscape format
    let output = '# Netscape HTTP Cookie File\n';
    for (const c of cookies) {
      const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
      const flag = c.hostOnly ? 'TRUE' : 'FALSE';
      const exp = c.session ? '0' : String(Math.floor(c.expirationDate || 0));
      const secure = c.secure ? 'TRUE' : 'FALSE';
      output += `${domain}\t${flag}\t${c.path}\t${secure}\t${exp}\t${c.name}\t${c.value}\n`;
    }
    return output;
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

  ipcMain.on('window:devtools', () => {
    const win = windowManager.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.toggleDevTools();
    }
  });

  ipcMain.handle('window:isMaximized', () => {
    return windowManager.isMaximized();
  });

  // ── Profiles ────────────────────────────────────────────
  ipcMain.handle('profiles:list', () => {
    return profiles.listProfiles();
  });

  ipcMain.handle('profiles:get', (_event, id) => {
    return profiles.getProfile(id);
  });

  ipcMain.handle('profiles:current', () => {
    return profiles.getCurrentProfile();
  });

  ipcMain.handle('profiles:create', (_event, opts) => {
    return profiles.createProfile(opts);
  });

  ipcMain.handle('profiles:update', (_event, id, patch) => {
    return profiles.updateProfile(id, patch);
  });

  ipcMain.handle('profiles:delete', (_event, id) => {
    return profiles.deleteProfile(id);
  });

  ipcMain.handle('profiles:switch', (_event, id) => {
    const result = profiles.switchProfile(id);
    if (result) {
      // Broadcast profile change to all windows
      broadcastToWindows('profiles:changed', result);
    }
    return result;
  });

  ipcMain.handle('profiles:session-partition', (_event, id) => {
    return { partition: profiles.getSessionPartition(id) };
  });

  // ── Session persistence ─────────────────────────────────
  ipcMain.handle('session:save', () => {
    const sessionPersistence = require('./session-persistence');
    return sessionPersistence.save(tabManager);
  });

  ipcMain.handle('session:load', () => {
    const sessionPersistence = require('./session-persistence');
    return sessionPersistence.load();
  });

  ipcMain.handle('session:clear', () => {
    const sessionPersistence = require('./session-persistence');
    profiles.clearProfileSession();
    return true;
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

  // ── Webview context menu ──────────────────────────────
  ipcMain.on('webview:context-menu', (_event, params) => {
    const win = windowManager.getWindow();
    if (!win || win.isDestroyed()) return;

    const template = [];

    if (params.mediaType === 'image') {
      template.push({ label: 'Open Image in New Tab', click: () => { if (params.srcURL) tabManager.create(params.srcURL); } });
      template.push({ label: 'Copy Image', click: () => { webContents.fromId(_event.sender.id)?.copyImageAt(params.x, params.y); } });
      template.push({ label: 'Copy Image Address', click: () => { if (params.srcURL) clipboard.writeText(params.srcURL); } });
      template.push({ type: 'separator' });
    }

    if (params.linkURL) {
      template.push({ label: 'Open Link in New Tab', click: () => tabManager.create(params.linkURL) });
      template.push({ label: 'Open Link in New Window', click: () => { if (params.linkURL) electronShell.openExternal(params.linkURL); } });
      template.push({ label: 'Copy Link Address', click: () => { if (params.linkURL) clipboard.writeText(params.linkURL); } });
      template.push({ type: 'separator' });
    }

    if (params.selectionText) {
      template.push({ label: `Copy`, accelerator: 'CmdOrCtrl+C', click: () => { webContents.fromId(_event.sender.id)?.copy(); } });
      template.push({ type: 'separator' });
    }

    if (params.mediaType === 'none' && !params.linkURL && !params.selectionText) {
      template.push({ label: 'Back', click: () => { const wc = webContents.fromId(_event.sender.id); if (wc && wc.canGoBack()) wc.goBack(); } });
      template.push({ label: 'Forward', click: () => { const wc = webContents.fromId(_event.sender.id); if (wc && wc.canGoForward()) wc.goForward(); } });
      template.push({ label: 'Reload', click: () => webContents.fromId(_event.sender.id)?.reload() });
      template.push({ type: 'separator' });
    }

    template.push({ label: 'Save Page As…', accelerator: 'CmdOrCtrl+S', click: () => { const win = windowManager.getWindow(); if (win) win.webContents.send('app:shortcut', 'save-page'); } });
    template.push({ label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => webContents.fromId(_event.sender.id)?.selectAll() });
    template.push({ type: 'separator' });
    template.push({ label: 'Inspect Element', click: () => webContents.fromId(_event.sender.id)?.inspectElement(params.x, params.y) });

    if (!template.length) return;

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
  });

module.exports = { register };

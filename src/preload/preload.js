const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Tabs ──────────────────────────────────────────────
  tabs: {
    create: (url) => ipcRenderer.invoke('tabs:create', url),
    close: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
    switch: (tabId) => ipcRenderer.invoke('tabs:switch', tabId),
    update: (tabId, patch) => ipcRenderer.invoke('tabs:update', tabId, patch),
    list: () => ipcRenderer.invoke('tabs:list'),
    registerWebview: (tabId, wcId) => ipcRenderer.send('tabs:register-webview', tabId, wcId),
    notifyVisibility: (tabId, visible) => ipcRenderer.invoke('tabs:notify-visibility', tabId, visible),
    resume: (tabId, url) => ipcRenderer.invoke('tabs:resume', tabId, url),
    onUpdated: (callback) => {
      const listener = (_e, tabs) => callback(tabs);
      ipcRenderer.on('tabs:updated', listener);
      return () => ipcRenderer.removeListener('tabs:updated', listener);
    },
    onSuspend: (callback) => {
      const listener = (_e, tabId) => callback(tabId);
      ipcRenderer.on('tab-lifecycle:suspend', listener);
      return () => ipcRenderer.removeListener('tab-lifecycle:suspend', listener);
    },
  },

  // ── Sidebar ───────────────────────────────────────────
  sidebar: {
    toggle: () => ipcRenderer.invoke('sidebar:toggle'),
    getState: () => ipcRenderer.invoke('sidebar:state'),
    saveState: (collapsed) => ipcRenderer.invoke('sidebar:state:save', collapsed),
    loadState: () => ipcRenderer.invoke('sidebar:state:load'),
  },

  // ── Sidecar ───────────────────────────────────────────
  sidecar: {
    toggle: () => ipcRenderer.invoke('sidecar:toggle'),
    getState: () => ipcRenderer.invoke('sidecar:state'),
  },

  // ── Browser shell ────────────────────────────────────
  shell: {
    start: () => ipcRenderer.invoke('shell:start'),
    state: () => ipcRenderer.invoke('shell:state'),
    command: (commandLine) => ipcRenderer.invoke('shell:command', commandLine),
    clear: () => ipcRenderer.invoke('shell:clear'),
    stop: () => ipcRenderer.invoke('shell:stop'),
    onOutput: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('shell:output', listener);
      return () => ipcRenderer.removeListener('shell:output', listener);
    },
    onStatus: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('shell:status', listener);
      return () => ipcRenderer.removeListener('shell:status', listener);
    },
    onClear: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('shell:clear', listener);
      return () => ipcRenderer.removeListener('shell:clear', listener);
    },
  },

  // ── Storage (bookmarks, history, settings) ──────────
  storage: {
    getBookmarks: () => ipcRenderer.invoke('storage:bookmarks:get'),
    addBookmark: (bookmark) => ipcRenderer.invoke('storage:bookmarks:add', bookmark),
    removeBookmark: (id) => ipcRenderer.invoke('storage:bookmarks:remove', id),
    updateBookmark: (id, patch) => ipcRenderer.invoke('storage:bookmarks:update', id, patch),
    getHistory: (limit) => ipcRenderer.invoke('storage:history:get', limit),
    addHistoryEntry: (entry) => ipcRenderer.invoke('storage:history:add', entry),
    clearHistory: () => ipcRenderer.invoke('storage:history:clear'),
    getSettings: () => ipcRenderer.invoke('storage:settings:get'),
    updateSettings: (patch) => ipcRenderer.invoke('storage:settings:update', patch),
  },

  // ── Extensions ────────────────────────────────────────
  extensions: {
    load: (extensionPath) => ipcRenderer.invoke('extensions:load', extensionPath),
    list: () => ipcRenderer.invoke('extensions:list'),
    unload: (extensionId) => ipcRenderer.invoke('extensions:unload', extensionId),
  },

  // ── Window controls ───────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // ── Changelog ──────────────────────────────────────────
  changelog: {
    get: () => ipcRenderer.invoke('changelog:get'),
    shouldShow: () => ipcRenderer.invoke('changelog:shouldShow'),
    dismiss: () => ipcRenderer.invoke('changelog:dismiss'),
  },

  // ── Generic helpers (used by sidebar.js) ─────────────
  on: (channel, callback) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});

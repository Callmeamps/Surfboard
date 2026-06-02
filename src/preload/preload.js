const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Tabs ──────────────────────────────────────────────
  tabs: {
    create: (url) => ipcRenderer.invoke('tabs:create', url),
    close: (tabId) => ipcRenderer.invoke('tabs:close', tabId),
    switch: (tabId) => ipcRenderer.invoke('tabs:switch', tabId),
    list: () => ipcRenderer.invoke('tabs:list'),
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

  // ── Generic helpers (used by sidebar.js) ─────────────
  on: (channel, callback) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});

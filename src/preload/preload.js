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
    goBack: (tabId) => ipcRenderer.invoke('tabs:go-back', tabId),
    goForward: (tabId) => ipcRenderer.invoke('tabs:go-forward', tabId),
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

    // ── Tab Groups ───────────────────────────────────────
    groups: () => ipcRenderer.invoke('tabs:groups:list'),
    createGroup: (title) => ipcRenderer.invoke('tabs:groups:create', title),
    setGroupColor: (groupId, color) => ipcRenderer.invoke('tabs:groups:color', groupId, color),
    assignToGroup: (tabId, groupId) => ipcRenderer.invoke('tabs:groups:assign', tabId, groupId),
    removeFromGroup: (tabId) => ipcRenderer.invoke('tabs:groups:remove', tabId),
    toggleGroupCollapse: (groupId) => ipcRenderer.invoke('tabs:groups:collapse', groupId),
    deleteGroup: (groupId) => ipcRenderer.invoke('tabs:groups:delete', groupId),
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

  // ── Profiles ─────────────────────────────────────────────
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    get: (id) => ipcRenderer.invoke('profiles:get', id),
    current: () => ipcRenderer.invoke('profiles:current'),
    create: (opts) => ipcRenderer.invoke('profiles:create', opts),
    update: (id, patch) => ipcRenderer.invoke('profiles:update', id, patch),
    delete: (id) => ipcRenderer.invoke('profiles:delete', id),
    switch: (id) => ipcRenderer.invoke('profiles:switch', id),
    sessionPartition: (id) => ipcRenderer.invoke('profiles:session-partition', id),
    onChanged: (callback) => {
      const listener = (_e, profile) => callback(profile);
      ipcRenderer.on('profiles:changed', listener);
      return () => ipcRenderer.removeListener('profiles:changed', listener);
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
    loadTabOrder: () => ipcRenderer.invoke('storage:tab-order:get'),
    saveTabOrder: (order) => ipcRenderer.invoke('storage:tab-order:save', order),
    clearTabOrder: () => ipcRenderer.invoke('storage:tab-order:clear'),
    environments: {
      list: () => ipcRenderer.invoke('storage:environments:list'),
      add: (env) => ipcRenderer.invoke('storage:environments:add', env),
      update: (id, patch) => ipcRenderer.invoke('storage:environments:update', id, patch),
      remove: (id) => ipcRenderer.invoke('storage:environments:remove', id),
    },
  },

  // ── Extensions ────────────────────────────────────────
  extensions: {
    load: (extensionPath) => ipcRenderer.invoke('extensions:load', extensionPath),
    list: () => ipcRenderer.invoke('extensions:list'),
    unload: (extensionId) => ipcRenderer.invoke('extensions:unload', extensionId),
  },

  // ── Cookie management ─────────────────────────────────
  cookies: {
    get: (filter) => ipcRenderer.invoke('cookies:get', filter),
    set: (details) => ipcRenderer.invoke('cookies:set', details),
    remove: (url, name) => ipcRenderer.invoke('cookies:remove', url, name),
    clear: () => ipcRenderer.invoke('cookies:clear'),
    export: () => ipcRenderer.invoke('cookies:export'),
  },

  // ── SSH sessions ─────────────────────────────────────
  ssh: {
    connect: (config) => ipcRenderer.invoke('ssh:connect', config),
    disconnect: () => ipcRenderer.invoke('ssh:disconnect'),
    send: (command) => ipcRenderer.invoke('ssh:send', command),
    state: () => ipcRenderer.invoke('ssh:state'),
    connections: {
      list: () => ipcRenderer.invoke('ssh:connections:list'),
      save: (id, config) => ipcRenderer.invoke('ssh:connections:save', id, config),
      delete: (id) => ipcRenderer.invoke('ssh:connections:delete', id),
    },
    onOutput: (listener) => {
      ipcRenderer.on('ssh:output', (_event, data) => listener(data));
      return () => ipcRenderer.removeListener('ssh:output', listener);
    },
    onStatus: (listener) => {
      ipcRenderer.on('ssh:status', (_event, status) => listener(status));
      return () => ipcRenderer.removeListener('ssh:status', listener);
    },
  },

  // ── Webview context menu ──────────────────────────────
  webview: {
    showContextMenu: (params) => ipcRenderer.send('webview:context-menu', params),
  },

  // ── Cloud Sessions ─────────────────────────────────────
  cloud: {
    status: (provider) => ipcRenderer.invoke('cloud:status', provider),
    startDeviceCode: () => ipcRenderer.invoke('cloud:start-device-code'),
    pollToken: (deviceCode, interval) => ipcRenderer.invoke('cloud:poll-token', deviceCode, interval),
    disconnect: (provider) => ipcRenderer.invoke('cloud:disconnect', provider),
    listWorkspaces: () => ipcRenderer.invoke('cloud:list-workspaces'),
    startWorkspace: (name) => ipcRenderer.invoke('cloud:start-workspace', name),
    stopWorkspace: (name) => ipcRenderer.invoke('cloud:stop-workspace', name),
    deleteWorkspace: (name) => ipcRenderer.invoke('cloud:delete-workspace', name),
    connectionDetails: (name) => ipcRenderer.invoke('cloud:connection-details', name),
  },

  // ── Window controls ───────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    devtools: () => ipcRenderer.send('window:devtools'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // ── Changelog ──────────────────────────────────────────
  changelog: {
    get: () => ipcRenderer.invoke('changelog:get'),
    shouldShow: () => ipcRenderer.invoke('changelog:shouldShow'),
    dismiss: () => ipcRenderer.invoke('changelog:dismiss'),
  },

  // ── Session persistence ─────────────────────────────────
  session: {
    save: () => ipcRenderer.invoke('session:save'),
    load: () => ipcRenderer.invoke('session:load'),
    clear: () => ipcRenderer.invoke('session:clear'),
  },

  // ── Generic helpers (used by sidebar.js) ─────────────
  on: (channel, callback) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});

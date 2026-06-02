const { BrowserWindow } = require('electron');
const lifecycle = require('./tab-lifecycle');

const tabs = new Map();
let activeTabId = null;
let idCounter = 0;

function generateId() {
  return `tab-${++idCounter}-${Date.now().toString(36)}`;
}

function broadcastUpdate() {
  const all = getAll();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('tabs:updated', all);
    }
  }
}

function create(url = 'about:blank') {
  const id = generateId();

  if (activeTabId && tabs.has(activeTabId)) {
    tabs.get(activeTabId).active = false;
  }

  const tab = {
    id,
    url,
    title: 'New Tab',
    favicon: '',
    active: true,
    loading: false,
  };

  tabs.set(id, tab);
  activeTabId = id;

  lifecycle.onTabCreated(id);
  lifecycle.onTabActivated(id);
  broadcastUpdate();
  return { ...tab };
}

function close(tabId) {
  if (!tabs.has(tabId)) return null;

  tabs.delete(tabId);

  if (activeTabId === tabId) {
    activeTabId = null;
    const remaining = getAll();
    if (remaining.length > 0) {
      const next = remaining[remaining.length - 1];
      tabs.get(next.id).active = true;
      activeTabId = next.id;
      lifecycle.onTabActivated(next.id);
    }
  }

  lifecycle.onTabClosed(tabId);
  broadcastUpdate();
  return activeTabId ? { ...tabs.get(activeTabId) } : null;
}

function switchTab(tabId) {
  if (!tabs.has(tabId)) return null;

  if (activeTabId && tabs.has(activeTabId)) {
    tabs.get(activeTabId).active = false;
  }

  tabs.get(tabId).active = true;
  activeTabId = tabId;

  lifecycle.onTabActivated(tabId);
  broadcastUpdate();
  return { ...tabs.get(tabId) };
}

function update(tabId, patch) {
  const tab = tabs.get(tabId);
  if (!tab) return null;
  Object.assign(tab, patch);
  broadcastUpdate();
  return { ...tab };
}

function get(tabId) {
  const tab = tabs.get(tabId);
  return tab ? { ...tab } : undefined;
}

function getAll() {
  return [...tabs.values()].map(t => ({ ...t }));
}

function getActiveId() {
  return activeTabId;
}

module.exports = {
  create,
  close,
  switch: switchTab,
  update,
  get,
  getAll,
  getActiveId,
};

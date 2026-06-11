const { BrowserWindow } = require('electron');
const lifecycle = require('./tab-lifecycle');

const tabs = new Map();
const groups = new Map();
let activeTabId = null;
let idCounter = 0;
let groupIdCounter = 0;
let _postUpdateHook = null;

function generateId() {
  return `tab-${++idCounter}-${Date.now().toString(36)}`;
}

function generateGroupId() {
  return `group-${++groupIdCounter}-${Date.now().toString(36)}`;
}

function broadcastUpdate() {
  const all = getAll();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('tabs:updated', all);
    }
  }
  if (_postUpdateHook) _postUpdateHook();
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
    groupId: null,
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

  // Remove from group if assigned
  const closingTab = tabs.get(tabId);
  if (closingTab.groupId && groups.has(closingTab.groupId)) {
    const group = groups.get(closingTab.groupId);
    group.tabIds = group.tabIds.filter(id => id !== tabId);
    if (group.tabIds.length === 0) {
      groups.delete(closingTab.groupId);
    }
  }

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

// ── Tab Groups ──────────────────────────────────────────

function createGroup(title = 'Group', color = null) {
  const groupId = generateGroupId();
  const group = {
    id: groupId,
    title,
    color: color || null,
    collapsed: false,
    tabIds: [],
  };
  groups.set(groupId, group);
  broadcastUpdate();
  return { ...group };
}

function assignToGroup(tabId, groupId) {
  if (!tabs.has(tabId) || !groups.has(groupId)) return null;

  // Remove from previous group
  const tab = tabs.get(tabId);
  if (tab.groupId && groups.has(tab.groupId)) {
    const prevGroup = groups.get(tab.groupId);
    prevGroup.tabIds = prevGroup.tabIds.filter(id => id !== tabId);
  }

  tab.groupId = groupId;
  const group = groups.get(groupId);
  if (!group.tabIds.includes(tabId)) {
    group.tabIds.push(tabId);
  }

  broadcastUpdate();
  return { ...tab };
}

function removeFromGroup(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || !tab.groupId) return null;

  const groupId = tab.groupId;
  if (groups.has(groupId)) {
    const group = groups.get(groupId);
    group.tabIds = group.tabIds.filter(id => id !== tabId);
    // Clean up empty groups
    if (group.tabIds.length === 0) {
      groups.delete(groupId);
    }
  }

  tab.groupId = null;
  broadcastUpdate();
  return { ...tab };
}

function toggleGroupCollapse(groupId) {
  const group = groups.get(groupId);
  if (!group) return null;
  group.collapsed = !group.collapsed;
  broadcastUpdate();
  return { ...group };
}

function deleteGroup(groupId) {
  const group = groups.get(groupId);
  if (!group) return false;
  // Unassign all tabs from this group
  for (const tabId of group.tabIds) {
    if (tabs.has(tabId)) {
      tabs.get(tabId).groupId = null;
    }
  }
  groups.delete(groupId);
  broadcastUpdate();
  return true;
}

function setGroupColor(groupId, color) {
  const group = groups.get(groupId);
  if (!group) return null;
  group.color = color || null;
  broadcastUpdate();
  return { ...group };
}

function getGroups() {
  return [...groups.values()].map(g => ({ ...g }));
}

function setPostUpdateHook(fn) {
  _postUpdateHook = fn;
}

module.exports = {
  create,
  close,
  switch: switchTab,
  update,
  get,
  getAll,
  getActiveId,
  setPostUpdateHook,
  createGroup,
  setGroupColor,
  assignToGroup,
  removeFromGroup,
  toggleGroupCollapse,
  deleteGroup,
  getGroups,
};

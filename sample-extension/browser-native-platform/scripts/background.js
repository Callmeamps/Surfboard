/* ── Browser-Native Feature Platform — Background Service Worker ──
   Phase 1: Mode state, command routing, permission checks, context menu   */

const MODES = ['browse', 'inspect', 'edit', 'action'];

// ── State ────────────────────────────────────────────────
const state = {
  mode: 'browse',        // current mode per tab
  permissions: {},       // tabId → { inspect: bool, edit: bool, action: bool }
  selections: {},        // tabId → last selected element path
};

// ── Permission defaults ──────────────────────────────────
// By default only inspect is allowed; edit and action require explicit grant
const DEFAULT_PERMISSIONS = { inspect: true, edit: false, action: false };

async function loadState() {
  const stored = await chrome.storage.local.get(['mode', 'permissions']);
  if (stored.mode && MODES.includes(stored.mode)) state.mode = stored.mode;
  if (stored.permissions) state.permissions = stored.permissions;
}

async function saveState() {
  await chrome.storage.local.set({
    mode: state.mode,
    permissions: state.permissions,
  });
}

// ── Mode switching ───────────────────────────────────────
function setMode(mode) {
  if (!MODES.includes(mode)) return false;
  state.mode = mode;
  saveState();
  broadcastMode();
  return true;
}

function broadcastMode() {
  chrome.tabs?.query?.({}, (tabs) => {
    for (const tab of tabs || []) {
      try {
        const result = chrome.tabs?.sendMessage?.(tab.id, {
          type: 'fp:mode-changed',
          mode: state.mode,
        });
        result?.catch?.(() => {}); // tab may not have content script
      } catch {
        // ignore tabs without content scripts or unsupported messaging
      }
    }
  });
  // Update badge
  if (chrome.action?.setBadgeText) {
    const badgeText = state.mode === 'browse' ? '' : state.mode[0].toUpperCase();
    chrome.action.setBadgeText({ text: badgeText });
    const badgeColors = {
      browse: '#4a4a4a',
      inspect: '#2196F3',
      edit: '#FF9800',
      action: '#9C27B0',
    };
    chrome.action.setBadgeBackgroundColor({ color: badgeColors[state.mode] || '#4a4a4a' });
  }
}

// ── Permission checks ────────────────────────────────────
function getPermissions(tabId) {
  return state.permissions[tabId] || { ...DEFAULT_PERMISSIONS };
}

function grantPermission(tabId, capability) {
  if (!state.permissions[tabId]) state.permissions[tabId] = { ...DEFAULT_PERMISSIONS };
  state.permissions[tabId][capability] = true;
  saveState();
}

function revokePermission(tabId, capability) {
  if (!state.permissions[tabId]) return;
  state.permissions[tabId][capability] = false;
  saveState();
}

function checkPermission(tabId, mode) {
  const perms = getPermissions(tabId);
  if (mode === 'browse') return true;
  if (mode === 'inspect') return perms.inspect;
  if (mode === 'edit') return perms.edit;
  if (mode === 'action') return perms.action;
  return false;
}

// ── Context menu ─────────────────────────────────────────
function installContextMenu() {
  if (!chrome.contextMenus?.removeAll || !chrome.contextMenus?.create) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'fp-mode-parent',
      title: 'Feature Platform',
      contexts: ['page', 'selection', 'link', 'image'],
    });
    for (const mode of MODES) {
      chrome.contextMenus.create({
        id: `fp-mode-${mode}`,
        parentId: 'fp-mode-parent',
        title: `Switch to ${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`,
        contexts: ['page'],
      });
    }
    chrome.contextMenus.create({ id: 'fp-sep', parentId: 'fp-mode-parent', type: 'separator', contexts: ['page'] });
    chrome.contextMenus.create({
      id: 'fp-perm-inspect',
      parentId: 'fp-mode-parent',
      title: '✓ Inspect allowed',
      type: 'checkbox',
      checked: true,
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: 'fp-perm-edit',
      parentId: 'fp-mode-parent',
      title: '✓ Edit allowed',
      type: 'checkbox',
      checked: false,
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: 'fp-perm-action',
      parentId: 'fp-mode-parent',
      title: '✓ Action allowed',
      type: 'checkbox',
      checked: false,
      contexts: ['page'],
    });
  });
}

// ── Message handling ─────────────────────────────────────
chrome.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (msg.type) {
    case 'fp:get-state':
      sendResponse({
        mode: state.mode,
        permissions: tabId ? getPermissions(tabId) : DEFAULT_PERMISSIONS,
        selection: tabId ? (state.selections[tabId] || null) : null,
      });
      return false; // synchronous

    case 'fp:set-mode':
      if (!checkPermission(tabId || 0, msg.mode)) {
        sendResponse({ ok: false, error: `Permission denied for ${msg.mode} mode` });
        return false;
      }
      const ok = setMode(msg.mode);
      sendResponse({ ok });
      return false;

    case 'fp:element-selected':
      if (tabId) state.selections[tabId] = msg.path;
      sendResponse({ ok: true });
      return false;

    case 'fp:get-permissions':
      sendResponse({ permissions: tabId ? getPermissions(tabId) : DEFAULT_PERMISSIONS });
      return false;

    case 'fp:grant-permission':
      if (tabId) grantPermission(tabId, msg.capability);
      sendResponse({ ok: true });
      return false;

    case 'fp:revoke-permission':
      if (tabId) revokePermission(tabId, msg.capability);
      sendResponse({ ok: true });
      return false;

    default:
      return false;
  }
});

// ── Command shortcuts ────────────────────────────────────
chrome.commands?.onCommand?.addListener((command) => {
  const modeMap = {
    'toggle-browse-mode': 'browse',
    'toggle-inspect-mode': 'inspect',
    'toggle-edit-mode': 'edit',
    'toggle-action-mode': 'action',
  };
  const mode = modeMap[command];
  if (mode) setMode(mode);
});

// ── Context menu clicks ──────────────────────────────────
chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  if (!tab) return;
  const modeMatch = info.menuItemId.match(/^fp-mode-(\w+)$/);
  if (modeMatch) {
    const mode = modeMatch[1];
    if (checkPermission(tab.id, mode)) {
      setMode(mode);
    }
    return;
  }
  const permMatch = info.menuItemId.match(/^fp-perm-(\w+)$/);
  if (permMatch) {
    const cap = permMatch[1];
    if (info.checked) {
      grantPermission(tab.id, cap);
    } else {
      revokePermission(tab.id, cap);
    }
  }
});

// ── Tab lifecycle ────────────────────────────────────────
chrome.tabs?.onRemoved?.addListener((tabId) => {
  delete state.permissions[tabId];
  delete state.selections[tabId];
});

// ── Init ─────────────────────────────────────────────────
chrome.runtime?.onInstalled?.addListener(() => {
  console.log('[FP] Browser-Native Feature Platform installed — Phase 1');
  installContextMenu();
  broadcastMode();
});

loadState().then(() => {
  installContextMenu();
  broadcastMode();
});

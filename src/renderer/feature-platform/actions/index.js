/**
 * ActionRegistry — Browser-Native Feature Platform
 * Contextual action discovery, permission checks, execution.
 * Floating buttons, command bar, hotkey launcher.
 *
 * Usage:
 *   ActionRegistry.init({ root: document.getElementById('app') })
 *   ActionRegistry.register({ id: 'copy', label: 'Copy', icon: '📋', execute: (ctx) => ... })
 *   ActionRegistry.registerContext('link', ['open', 'copy-link', 'bookmark'])
 *   ActionRegistry.enable()
 *   ActionRegistry.openCommandBar()
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let _root = null;
  let _enabled = false;
  let _actions = new Map();        // id → action descriptor
  let _contexts = new Map();       // contextKey → [actionId, ...]
  let _hotkeys = new Map();        // hotkey → actionId
  let _history = [];               // recent action executions
  const MAX_HISTORY = 50;

  // Floating button state
  let _floatingBtn = null;
  let _floatingAnchor = null;
  let _floatingMenu = null;

  // Command bar state
  let _commandBar = null;
  let _commandResults = [];
  let _commandActiveIdx = 0;
  let _commandFilter = '';

  // Context menu state
  let _contextMenu = null;

  let _listeners = [];

  // ── Types ──────────────────────────────────────────────
  // Action descriptor: {
  //   id: string
  //   label: string
  //   icon: string (emoji or class)
  //   description?: string
  //   hotkey?: string (e.g. 'Ctrl+C')
  //   category?: string
  //   contexts?: string[] — auto-detect contexts
  //   execute: (ctx) => bool|Promise<bool>
  //   enabled?: (ctx) => bool
  // }

  // ── Helpers ────────────────────────────────────────────
  function _notify(type, detail) {
    _listeners.forEach(fn => fn(type, detail));
  }

  function _isActionsOverlay(el) {
    return el && el.dataset && el.dataset.actionsOverlay !== undefined;
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function _parseHotkey(hotkey) {
    if (!hotkey) return null;
    const parts = hotkey.toLowerCase().split('+');
    const mods = { ctrl: false, shift: false, alt: false, meta: false };
    let key = '';
    parts.forEach(p => {
      if (p === 'ctrl') mods.ctrl = true;
      else if (p === 'shift') mods.shift = true;
      else if (p === 'alt') mods.alt = true;
      else if (p === 'meta' || p === 'cmd') mods.meta = true;
      else key = p;
    });
    return { ...mods, key };
  }

  function _matchHotkey(e, hotkey) {
    const hk = _parseHotkey(hotkey);
    if (!hk) return false;
    const c = e.ctrlKey || e.metaKey;
    return c === hk.ctrl && e.shiftKey === hk.shift && e.altKey === hk.alt && e.metaKey === hk.meta && e.key.toLowerCase() === hk.key;
  }

  function _getKey(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    return parts.join('+');
  }

  // ── Action Registry ────────────────────────────────────
  function register(action) {
    if (!action || !action.id) return false;
    _actions.set(action.id, { ...action });
    if (action.hotkey) _hotkeys.set(action.hotkey, action.id);
    _notify('registered', { id: action.id, action });
    return true;
  }

  function unregister(id) {
    const action = _actions.get(id);
    if (!action) return false;
    if (action.hotkey) _hotkeys.delete(action.hotkey);
    _actions.delete(id);
    // Remove from contexts
    _contexts.forEach((ids, ctx) => {
      _contexts.set(ctx, ids.filter(aid => aid !== id));
    });
    _notify('unregistered', { id });
    return true;
  }

  function get(id) { return _actions.get(id) || null; }

  function getAll() { return Array.from(_actions.values()); }

  function getByCategory(cat) {
    return Array.from(_actions.values()).filter(a => a.category === cat);
  }

  // ── Context ────────────────────────────────────────────
  function registerContext(contextKey, actionIds) {
    _contexts.set(contextKey, [...actionIds]);
  }

  function getContextActions(contextKey) {
    const ids = _contexts.get(contextKey) || [];
    return ids.map(id => _actions.get(id)).filter(Boolean);
  }

  function detectContext(el) {
    if (!el) return [];
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const contexts = [];
    if (tag === 'a') contexts.push('link');
    if (tag === 'img') contexts.push('image');
    if (/^(input|textarea|select)$/.test(tag)) contexts.push('input');
    if (tag === 'video' || tag === 'audio') contexts.push('media');
    if (/^h[1-6]$/.test(tag)) contexts.push('heading');
    if (tag === 'table') contexts.push('table');
    if (tag === 'code' || tag === 'pre') contexts.push('code');
    if (el.getAttribute('role')) contexts.push('role:' + el.getAttribute('role'));
    // Generic text
    if (el.textContent && el.textContent.trim().length > 0) contexts.push('text');
    // Any element
    contexts.push('element');
    return contexts;
  }

  function getActionsForElement(el) {
    const contexts = detectContext(el);
    const actions = new Map();
    contexts.forEach(ctx => {
      getContextActions(ctx).forEach(a => {
        if (!actions.has(a.id)) actions.set(a.id, a);
      });
    });
    return Array.from(actions.values());
  }

  // ── Execution ──────────────────────────────────────────
  function execute(actionId, context) {
    const action = _actions.get(actionId);
    if (!action) return false;

    // Permission check
    if (action.permission) {
      try {
        if (window.TrustManager) {
          window.TrustManager.require(action.permission.module, action.permission.action);
        }
      } catch (err) {
        _notify('denied', { id: actionId, error: err.message });
        return false;
      }
    }

    // Enabled check
    if (action.enabled && !action.enabled(context)) return false;

    // Execute
    try {
      const result = action.execute(context);
      const entry = { id: actionId, ts: Date.now(), context };
      _history.push(entry);
      if (_history.length > MAX_HISTORY) _history.shift();
      _notify('executed', entry);
      return result;
    } catch (err) {
      _notify('error', { id: actionId, error: err.message });
      return false;
    }
  }

  function getLastExecuted() {
    return _history.length ? _history[_history.length - 1] : null;
  }

  function getHistory(limit) {
    return _history.slice(-(limit || 20));
  }

  // ── Floating Buttons ───────────────────────────────────
  function _showFloatingButtons(el, actions) {
    _hideFloatingButtons();
    if (!el || !actions.length) return;
    const rect = el.getBoundingClientRect();
    const rootRect = (_root && _root.getBoundingClientRect) ? _root.getBoundingClientRect() : { top: 0, left: 0 };

    const menu = document.createElement('div');
    menu.className = 'actions-floating-menu';
    menu.dataset.actionsOverlay = '';
    menu.style.top = (rect.top - rootRect.top - 4) + 'px';
    menu.style.left = (rect.right - rootRect.left - actions.length * 32 - 4) + 'px';

    actions.slice(0, 6).forEach((action, i) => {
      const btn = document.createElement('button');
      btn.className = 'actions-floating-btn';
      btn.title = action.label + (action.hotkey ? ' (' + action.hotkey + ')' : '');
      btn.textContent = action.icon || '⚡';
      btn.style.left = (i * 32) + 'px';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        execute(action.id, { element: el, event: e });
        _hideFloatingButtons();
      });
      menu.appendChild(btn);
    });

    _root.appendChild(menu);
    _floatingMenu = menu;
    _floatingAnchor = el;
  }

  function _hideFloatingButtons() {
    if (_floatingMenu && _floatingMenu.parentNode) _floatingMenu.parentNode.removeChild(_floatingMenu);
    _floatingMenu = null;
    _floatingAnchor = null;
  }

  // ── Context Menu ───────────────────────────────────────
  function _showContextMenu(el, actions, x, y) {
    _hideContextMenu();
    if (!actions.length) return;

    const menu = document.createElement('div');
    menu.className = 'actions-context-menu';
    menu.dataset.actionsOverlay = '';
    menu.style.top = y + 'px';
    menu.style.left = x + 'px';

    actions.forEach(action => {
      const item = document.createElement('div');
      item.className = 'actions-context-item';
      if (action.icon) {
        const icon = document.createElement('span');
        icon.className = 'actions-context-icon';
        icon.textContent = action.icon;
        item.appendChild(icon);
      }
      const label = document.createElement('span');
      label.className = 'actions-context-label';
      label.textContent = action.label;
      item.appendChild(label);
      if (action.hotkey) {
        const hk = document.createElement('span');
        hk.className = 'actions-context-hotkey';
        hk.textContent = action.hotkey;
        item.appendChild(hk);
      }
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        execute(action.id, { element: el, event: e });
        _hideContextMenu();
      });
      menu.appendChild(item);
    });

    _root.appendChild(menu);
    _contextMenu = menu;
  }

  function _hideContextMenu() {
    if (_contextMenu && _contextMenu.parentNode) _contextMenu.parentNode.removeChild(_contextMenu);
    _contextMenu = null;
  }

  // ── Command Bar ────────────────────────────────────────
  function _showCommandBar() {
    if (_commandBar) return;
    _commandFilter = '';
    _commandResults = getAll();
    _commandActiveIdx = 0;

    const bar = document.createElement('div');
    bar.className = 'actions-command-bar';
    bar.dataset.actionsOverlay = '';

    const input = document.createElement('input');
    input.className = 'actions-command-input';
    input.placeholder = 'Type a command...';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    const list = document.createElement('div');
    list.className = 'actions-command-list';

    function renderResults() {
      list.innerHTML = '';
      const q = _commandFilter.toLowerCase();
      _commandResults = getAll().filter(a => {
        if (!q) return true;
        return (a.label || '').toLowerCase().includes(q) ||
               (a.id || '').toLowerCase().includes(q) ||
               (a.category || '').toLowerCase().includes(q) ||
               (a.description || '').toLowerCase().includes(q);
      });
      _commandActiveIdx = 0;

      _commandResults.forEach((action, i) => {
        const item = document.createElement('div');
        item.className = 'actions-command-item' + (i === _commandActiveIdx ? ' active' : '');
        if (action.icon) {
          const icon = document.createElement('span');
          icon.className = 'actions-command-icon';
          icon.textContent = action.icon;
          item.appendChild(icon);
        }
        const label = document.createElement('span');
        label.className = 'actions-command-label';
        label.textContent = action.label;
        item.appendChild(label);
        if (action.category) {
          const cat = document.createElement('span');
          cat.className = 'actions-command-category';
          cat.textContent = action.category;
          item.appendChild(cat);
        }
        if (action.hotkey) {
          const hk = document.createElement('span');
          hk.className = 'actions-command-hotkey';
          hk.textContent = action.hotkey;
          item.appendChild(hk);
        }
        item.addEventListener('click', () => {
          execute(action.id, { source: 'command-bar' });
          _hideCommandBar();
        });
        item.addEventListener('mouseenter', () => {
          _commandActiveIdx = i;
          renderResults();
        });
        list.appendChild(item);
      });
    }

    input.addEventListener('input', () => {
      _commandFilter = input.value;
      renderResults();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _commandActiveIdx = Math.min(_commandActiveIdx + 1, _commandResults.length - 1);
        renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _commandActiveIdx = Math.max(_commandActiveIdx - 1, 0);
        renderResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_commandResults[_commandActiveIdx]) {
          execute(_commandResults[_commandActiveIdx].id, { source: 'command-bar' });
          _hideCommandBar();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        _hideCommandBar();
      }
    });

    bar.appendChild(input);
    bar.appendChild(list);
    _root.appendChild(bar);
    _commandBar = bar;

    // Focus input after render
    setTimeout(() => input.focus(), 10);
    renderResults();
  }

  function _hideCommandBar() {
    if (_commandBar && _commandBar.parentNode) _commandBar.parentNode.removeChild(_commandBar);
    _commandBar = null;
    _commandFilter = '';
    _commandResults = [];
  }

  function openCommandBar() {
    if (!_enabled) return;
    if (_commandBar) {
      _hideCommandBar();
    } else {
      _showCommandBar();
    }
  }

  // ── Event Handlers ─────────────────────────────────────
  function _onMouseMove(e) {
    if (!_enabled || !_root) return;
    if (_isActionsOverlay(e.target)) return;
    const el = e.target;
    if (el === _root) {
      _hideFloatingButtons();
      return;
    }
    const actions = getActionsForElement(el);
    if (actions.length) {
      _showFloatingButtons(el, actions);
    } else {
      _hideFloatingButtons();
    }
  }

  function _onClick(e) {
    if (!_enabled || !_root) return;
    if (_isActionsOverlay(e.target)) return;
    _hideContextMenu();
  }

  function _onContextMenu(e) {
    if (!_enabled || !_root) return;
    if (_isActionsOverlay(e.target)) return;
    const el = e.target;
    if (el === _root) return;
    const actions = getActionsForElement(el);
    if (!actions.length) return;
    e.preventDefault();
    _showContextMenu(el, actions, e.clientY, e.clientX);
  }

  function _onKeyDown(e) {
    if (!_enabled) return;

    // Ctrl+Shift+P — command bar
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      openCommandBar();
      return;
    }

    // Escape — close menus
    if (e.key === 'Escape') {
      if (_commandBar) { _hideCommandBar(); return; }
      if (_contextMenu) { _hideContextMenu(); return; }
      return;
    }

    // Hotkey dispatch
    for (const [hotkey, actionId] of _hotkeys) {
      if (_matchHotkey(e, hotkey)) {
        // Don't fire if user is typing in an input
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) continue;
        e.preventDefault();
        execute(actionId, { source: 'hotkey', hotkey });
        return;
      }
    }
  }

  // ── Style injection ────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('actions-styles')) return;
    const style = document.createElement('style');
    style.id = 'actions-styles';
    style.textContent = [
      '/* ── ActionRegistry styles ─────────────────────────── */',
      '.actions-floating-menu {',
      '  position: absolute;',
      '  display: flex;',
      '  gap: 2px;',
      '  z-index: 7000;',
      '  pointer-events: auto;',
      '}',
      '.actions-floating-btn {',
      '  width: 28px;',
      '  height: 28px;',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 6px;',
      '  background: var(--bg-elevated, #1c1c1f);',
      '  color: var(--text, #d4d4d8);',
      '  font-size: 14px;',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  box-shadow: 0 2px 8px rgba(0,0,0,0.3);',
      '  transition: transform 0.1s, background 0.1s;',
      '}',
      '.actions-floating-btn:hover {',
      '  background: var(--accent, #60a5fa);',
      '  color: #fff;',
      '  transform: scale(1.1);',
      '}',
      '.actions-context-menu {',
      '  position: fixed;',
      '  min-width: 200px;',
      '  max-width: 320px;',
      '  background: var(--bg-elevated, #1c1c1f);',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 8px;',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.4);',
      '  padding: 4px;',
      '  z-index: 7001;',
      '  pointer-events: auto;',
      '}',
      '.actions-context-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 6px 10px;',
      '  border-radius: 4px;',
      '  cursor: pointer;',
      '  font-size: 12px;',
      '  color: var(--text, #d4d4d8);',
      '  white-space: nowrap;',
      '}',
      '.actions-context-item:hover {',
      '  background: var(--accent, #60a5fa);',
      '  color: #fff;',
      '}',
      '.actions-context-icon {',
      '  font-size: 14px;',
      '  width: 18px;',
      '  text-align: center;',
      '}',
      '.actions-context-label {',
      '  flex: 1;',
      '}',
      '.actions-context-hotkey {',
      '  font-size: 10px;',
      '  color: var(--text-faint, #52525b);',
      '  margin-left: 12px;',
      '}',
      '.actions-context-item:hover .actions-context-hotkey {',
      '  color: rgba(255,255,255,0.6);',
      '}',
      '.actions-command-bar {',
      '  position: fixed;',
      '  top: 20%;',
      '  left: 50%;',
      '  transform: translateX(-50%);',
      '  width: 480px;',
      '  max-width: 90vw;',
      '  background: var(--bg-elevated, #1c1c1f);',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 10px;',
      '  box-shadow: 0 16px 48px rgba(0,0,0,0.5);',
      '  z-index: 7002;',
      '  overflow: hidden;',
      '}',
      '.actions-command-input {',
      '  width: 100%;',
      '  height: 44px;',
      '  padding: 0 14px;',
      '  background: transparent;',
      '  border: none;',
      '  border-bottom: 1px solid var(--border, #2a2a30);',
      '  color: var(--text, #d4d4d8);',
      '  font-size: 14px;',
      '  font-family: inherit;',
      '  outline: none;',
      '}',
      '.actions-command-input::placeholder {',
      '  color: var(--text-faint, #52525b);',
      '}',
      '.actions-command-list {',
      '  max-height: 300px;',
      '  overflow-y: auto;',
      '}',
      '.actions-command-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  padding: 8px 14px;',
      '  cursor: pointer;',
      '  font-size: 13px;',
      '  color: var(--text, #d4d4d8);',
      '}',
      '.actions-command-item.active,',
      '.actions-command-item:hover {',
      '  background: var(--accent, #60a5fa);',
      '  color: #fff;',
      '}',
      '.actions-command-icon {',
      '  font-size: 14px;',
      '  width: 20px;',
      '  text-align: center;',
      '}',
      '.actions-command-label {',
      '  flex: 1;',
      '}',
      '.actions-command-category {',
      '  font-size: 10px;',
      '  color: var(--text-faint, #52525b);',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.5px;',
      '}',
      '.actions-command-item.active .actions-command-category,',
      '.actions-command-item:hover .actions-command-category {',
      '  color: rgba(255,255,255,0.5);',
      '}',
      '.actions-command-hotkey {',
      '  font-size: 10px;',
      '  color: var(--text-faint, #52525b);',
      '  font-family: monospace;',
      '}',
      '.actions-command-item.active .actions-command-hotkey,',
      '.actions-command-item:hover .actions-command-hotkey {',
      '  color: rgba(255,255,255,0.5);',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  try { _injectStyles(); } catch (e) { /* noop in non-browser */ }

  // ── Default Actions ────────────────────────────────────
  function _registerDefaults() {
    register({
      id: 'copy-text',
      label: 'Copy Text',
      icon: '📋',
      category: 'clipboard',
      hotkey: 'Ctrl+Shift+C',
      contexts: ['text'],
      execute: (ctx) => {
        if (ctx.element && ctx.element.textContent) {
          try { navigator.clipboard?.writeText(ctx.element.textContent); } catch(e) {}
          return true;
        }
        return false;
      },
    });

    register({
      id: 'open-link',
      label: 'Open Link',
      icon: '🔗',
      category: 'navigation',
      contexts: ['link'],
      execute: (ctx) => {
        if (ctx.element && ctx.element.href) {
          window.open(ctx.element.href, '_blank');
          return true;
        }
        return false;
      },
    });

    register({
      id: 'copy-link',
      label: 'Copy Link',
      icon: '📎',
      category: 'clipboard',
      contexts: ['link'],
      execute: (ctx) => {
        if (ctx.element && ctx.element.href) {
          try { navigator.clipboard?.writeText(ctx.element.href); } catch(e) {}
          return true;
        }
        return false;
      },
    });

    register({
      id: 'inspect-element',
      label: 'Inspect Element',
      icon: '🔍',
      category: 'dev',
      contexts: ['element'],
      execute: (ctx) => {
        if (ctx.element && window.Inspector) {
          window.Inspector.enable(_root);
          return true;
        }
        return false;
      },
    });

    register({
      id: 'edit-element',
      label: 'Edit Element',
      icon: '✏️',
      category: 'edit',
      contexts: ['element'],
      execute: (ctx) => {
        if (ctx.element && window.EditorEngine) {
          window.EditorEngine.enable(_root);
          return true;
        }
        return false;
      },
    });

    // Register default contexts
    registerContext('text', ['copy-text', 'inspect-element', 'edit-element']);
    registerContext('link', ['open-link', 'copy-link', 'inspect-element', 'edit-element']);
    registerContext('image', ['copy-link', 'inspect-element', 'edit-element']);
    registerContext('input', ['copy-text', 'inspect-element', 'edit-element']);
    registerContext('element', ['inspect-element', 'edit-element']);
  }

  // ── Public API ─────────────────────────────────────────
  function init(deps) {
    _root = deps?.root || null;
  }

  function enable(overrideRoot) {
    if (overrideRoot) _root = overrideRoot;
    if (!_root) return false;
    if (_enabled) return true;

    // Trust gate
    try {
      if (window.TrustManager) {
        window.TrustManager.require('actions', 'execute');
      }
    } catch (err) {
      _notify('denied', { error: err.message });
      return false;
    }

    _enabled = true;
    _registerDefaults();
    _root.addEventListener('mousemove', _onMouseMove, true);
    _root.addEventListener('click', _onClick, true);
    _root.addEventListener('contextmenu', _onContextMenu, true);
    document.addEventListener('keydown', _onKeyDown, true);
    _root.setAttribute('data-actions-active', '');
    _notify('enabled', {});
    return true;
  }

  function disable() {
    if (!_enabled) return;
    _enabled = false;
    _hideFloatingButtons();
    _hideContextMenu();
    _hideCommandBar();
    _root.removeEventListener('mousemove', _onMouseMove, true);
    _root.removeEventListener('click', _onClick, true);
    _root.removeEventListener('contextmenu', _onContextMenu, true);
    document.removeEventListener('keydown', _onKeyDown, true);
    _root.removeAttribute('data-actions-active');
    _root.querySelectorAll('[data-actions-overlay]').forEach(el => el.parentNode.removeChild(el));
    _notify('disabled', {});
  }

  function isEnabled() { return _enabled; }

  function onChange(fn) {
    _listeners.push(fn);
    return function () { _listeners = _listeners.filter(l => l !== fn); };
  }

  function reset() {
    disable();
    _actions = new Map();
    _contexts = new Map();
    _hotkeys = new Map();
    _history = [];
    _root = null;
    _listeners = [];
  }

  window.ActionRegistry = {
    init,
    enable,
    disable,
    isEnabled,
    register,
    unregister,
    get,
    getAll,
    getByCategory,
    registerContext,
    getContextActions,
    detectContext,
    getActionsForElement,
    execute,
    getLastExecuted,
    getHistory,
    openCommandBar,
    onChange,
    reset,
  };
})();

/**
 * PaperTM — Scrollable-strip tab manager
 *
 * Scrollable-strip paradigm from PaperWM/Niri.
 * Tabs = paper cards in vertical strip. Active = full size.
 * Inactive = 28px peek. No resize on add.
 */
(function () {
  'use strict';

  function _favicon(u) {
    try { return new URL(u).origin + '/favicon.ico'; } catch { return null; }
  }

  const _wvMap = new Map();   // tabId → <webview>
  let _tabsRaf = null;         // debounce handle
  let _activeTabId = null;
  let _tabs = new Map();
  let _groups = new Map();     // groupId → { title, collapsed, tabIds }
  let _minimapContainer = null;
  let _order = [];             // visual tab order — persisted to storage
  let _dragCount = 0;          // active drag operations
  let _saveTimeout = null;
  const _SAVE_DEBOUNCE_MS = 500;
  let _deps = null;

  // ── Scroll-to-switch state ─────────────────────────────
  let _scrollAccum = 0;
  let _scrollThreshold = 100;  // px of scroll before switching
  let _scrollResetTimer = null;
  const _SCROLL_RESET_MS = 200; // reset accumulator if no scroll events

  // Debounced persist order to storage
  function _persistOrder() {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      _deps.storage.saveTabOrder?.(_order.slice()).catch(() => {});
    }, _SAVE_DEBOUNCE_MS);
  }

  function _queueTabs() {
    if (_tabsRaf) return;
    _tabsRaf = requestAnimationFrame(() => { _tabsRaf = null; _doRenderTabs(); });
  }

  // Returns _tabs entries sorted by _order
  function _orderedEntries() {
    return Array.from(_tabs.entries()).sort((a, b) => {
      return _order.indexOf(a[0]) - _order.indexOf(b[0]);
    });
  }

  function _ensureWebview(tabId, url) {
    if (_wvMap.has(tabId)) return _wvMap.get(tabId);

    const wv = document.createElement('webview');
    wv.dataset.tabId = tabId;
    wv.setAttribute('partition', 'persist:riced');
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('httpreferrer', 'https://www.google.com/');
    wv.style.display = 'none';
    const _t = () => _tabs.get(tabId);
    const _syncTab = (patch) => {
      const t = _t();
      if (!t) return;
      Object.assign(t, patch);
      _deps.tabsIPC.update?.(tabId, patch).catch(() => {});
      _queueTabs();
    };
    wv.addEventListener('did-start-loading',   () => { _syncTab({ loading: true }); });
    wv.addEventListener('did-stop-loading',    () => { _syncTab({ loading: false }); });
    wv.addEventListener('did-fail-load', (e) => {
      _syncTab({ loading: false });
    });
    wv.addEventListener('dom-ready', () => {
      if (!wv.dataset.registered) {
        const wcId = wv.getWebContentsId?.();
        if (wcId) {
          _deps.tabsIPC.registerWebview?.(tabId, wcId);
          wv.dataset.registered = '1';
        }
      }
    });
    wv.addEventListener('page-title-updated', (e) => {
      const title = e.title || 'New Tab';
      const t = _t();
      if (t && tabId === _activeTabId) _deps.addrInput.value = t.url || '';
      _syncTab({ title });
    });
    wv.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons?.[0]) _syncTab({ favicon: e.favicons[0] });
    });
    wv.addEventListener('did-navigate', (e) => {
      const t = _t(); if (!t) return;
      const url = e.url;
      if (tabId === _activeTabId) _deps.addrInput.value = url;
      _syncTab({ url });
      _updateNTP();
      if (url && url !== 'about:blank' && t.title) {
        _deps.storage.addHistoryEntry?.({ url, title: t.title }).catch(() => {});
      }
    });
    wv.addEventListener('did-navigate-in-page', (e) => {
      const url = e.url;
      if (tabId === _activeTabId) _deps.addrInput.value = url;
      _syncTab({ url });
    });
    wv.addEventListener('new-window', (e) => { e.preventDefault(); if (e.url && e.url !== 'about:blank') _deps.tabsIPC.create(e.url); });

    _deps.wvContainer.appendChild(wv);
    _wvMap.set(tabId, wv);
    // Set src AFTER appending to DOM — required for navigation to trigger
    try { wv.loadURL(url || 'about:blank'); } catch { wv.src = url || 'about:blank'; }
    return wv;
  }

  function _showActiveWebview() {
    _wvMap.forEach((wv, id) => {
      wv.style.display = (id === _activeTabId) ? '' : 'none';
    });
  }

  function _buildGroupHeader(groupId) {
    const group = _groups.get(groupId);
    if (!group) return null;

    const el = document.createElement('div');
    el.className = 'tab-group-header' + (group.collapsed ? ' collapsed' : '');
    el.dataset.groupId = groupId;

    const toggle = document.createElement('span');
    toggle.className = 'group-toggle';
    toggle.textContent = group.collapsed ? '▶' : '▼';
    el.appendChild(toggle);

    const title = document.createElement('span');
    title.className = 'group-title';
    title.textContent = group.title || 'Group';
    el.appendChild(title);

    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = `(${group.tabIds.length})`;
    el.appendChild(count);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _deps.tabsIPC.toggleGroupCollapse?.(groupId);
    });

    return el;
  }

  function _buildTabEl(tab) {
    const el = document.createElement('div');
    const classes = ['tab'];
    if (tab.active) classes.push('active');
    if (tab.loading) classes.push('loading');
    if (tab.groupId) classes.push('grouped');
    el.className = classes.join(' ');
    el.dataset.tabId = tab.id;
    if (tab.groupId) el.dataset.groupId = tab.groupId;

    const img = document.createElement('img');
    img.className = 'tab-favicon'; img.width = 16; img.height = 16; img.alt = '';
    const fh = tab.favicon || _favicon(tab.url);
    if (fh) { img.src = fh; img.onerror = () => img.classList.add('hidden'); }
    else img.classList.add('hidden');
    el.appendChild(img);

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || tab.url || 'New Tab';
    el.appendChild(title);

    const loader = document.createElement('span');
    loader.className = 'tab-loader';
    loader.setAttribute('aria-hidden', 'true');
    el.appendChild(loader);

    const close = document.createElement('button');
    close.className = 'tab-close no-drag'; close.textContent = '✕'; close.setAttribute('aria-label', 'Close tab');
    el.appendChild(close);
    return el;
  }

  function _showTabContextMenu(e, tab) {
    const existing = document.querySelector('.tab-contextmenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'tab-contextmenu';
    menu.style.cssText = `position:fixed;top:${e.clientY}px;left:${e.clientX}px;z-index:500;`;

    if (tab.groupId) {
      const removeItem = document.createElement('div');
      removeItem.className = 'tab-ctx-item';
      removeItem.textContent = '📤 Remove from Group';
      removeItem.addEventListener('click', () => {
        menu.remove();
        _deps.tabsIPC.removeFromGroup?.(tab.id);
      });
      menu.appendChild(removeItem);
    } else {
      const groupList = Array.from(_groups.values());
      if (groupList.length > 0) {
        groupList.forEach(group => {
          const item = document.createElement('div');
          item.className = 'tab-ctx-item';
          item.textContent = `📁 Add to: ${group.title}`;
          item.addEventListener('click', () => {
            menu.remove();
            _deps.tabsIPC.assignToGroup?.(tab.id, group.id);
          });
          menu.appendChild(item);
        });
      }
      const newGroupItem = document.createElement('div');
      newGroupItem.className = 'tab-ctx-item';
      newGroupItem.textContent = '🆕 New Group';
      newGroupItem.addEventListener('click', () => {
        menu.remove();
        const result = _deps.tabsIPC.createGroup?.('Group');
        if (result) {
          const gid = result.id || result;
          _deps.tabsIPC.assignToGroup?.(tab.id, gid);
        }
      });
      menu.appendChild(newGroupItem);
    }

    document.body.appendChild(menu);
    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function _doRenderTabs() {
    _deps.tabList.innerHTML = '';
    const entries = _orderedEntries();
    let activeIdx = entries.findIndex(([, t]) => t.active);

    // Track rendered groups to avoid duplicate headers
    const renderedGroups = new Set();

    entries.forEach(([id, tab], idx) => {
      // Render group header before first tab in group
      if (tab.groupId && !renderedGroups.has(tab.groupId)) {
        renderedGroups.add(tab.groupId);
        const header = _buildGroupHeader(tab.groupId);
        if (header) _deps.tabList.appendChild(header);
      }

      // Skip tabs in collapsed groups (except active tab)
      if (tab.groupId) {
        const group = _groups.get(tab.groupId);
        if (group?.collapsed && !tab.active) return;
      }

      const el = _buildTabEl(tab);
      el.draggable = true;

      // ── Drag handlers ───────────────────────────────
      el.addEventListener('dragstart', (e) => {
        el.classList.add('dragging');
        _dragCount++;

        // Ghost: clone, apply GPU-composited opacity + transform, hide off-screen
        const ghost = el.cloneNode(true);
        ghost.style.opacity = '0.5';
        ghost.style.transform = 'scale(1.05)';
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.width = el.offsetWidth + 'px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 8, 8);
        // Clean up ghost synchronously — browser consumes it on next frame
        requestAnimationFrame(() => {
          if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
        });

        e.dataTransfer.setData('text/plain', '');
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        _dragCount--;
        // Reset any drop-target feedback
        _deps.tabList.querySelectorAll('.tab').forEach(t => { t.style.opacity = ''; });
      });

      // ── Stack position ──────────────────────────────
      if (idx < activeIdx) {
        el.style.zIndex = activeIdx - idx + 1;
        el.dataset.stackPos = 'above';
      } else if (idx === activeIdx) {
        el.style.zIndex = 100;
        el.dataset.stackPos = 'active';
      } else {
        el.style.zIndex = entries.length - idx + 1;
        el.dataset.stackPos = 'below';
      }

      el.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close')) { _deps.tabsIPC.close(tab.id); return; }
        _deps.tabsIPC.switch(tab.id);
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _showTabContextMenu(e, tab);
      });
      _deps.tabList.appendChild(el);
    });
  }

  function _renderWebviews() {
    _wvMap.forEach((wv, id) => {
      if (!_tabs.has(id)) {
        try { wv.stop(); } catch {}
        wv.remove();
        _wvMap.delete(id);
      }
    });
    _tabs.forEach((tab) => {
      _ensureWebview(tab.id, tab.url);
    });
    _showActiveWebview();
  }

  function _renderMinimap() {
    if (!_minimapContainer) return;
    _minimapContainer.innerHTML = '';
    const entries = Array.from(_tabs.entries());
    entries.forEach(([id, tab]) => {
      const el = document.createElement('div');
      el.className = 'minimap-item' + (tab.active ? ' active' : '');
      el.dataset.tabId = id;
      el.title = tab.title || tab.url || 'New Tab';
      el.addEventListener('click', () => { _deps.tabsIPC.switch(id); });
      _minimapContainer.appendChild(el);
    });
  }

  function _updateNTP() {
    const t = _tabs.get(_activeTabId);
    if (!t || t.url === 'about:blank') {
      _deps.ntp.classList.remove('hidden');
    } else {
      _deps.ntp.classList.add('hidden');
    }
  }

  // ── Scroll-to-switch ──────────────────────────────────
  function _onWheelScroll(e) {
    // Only trigger when tab list is scrollable
    const tabList = _deps.tabList;
    if (tabList.scrollHeight <= tabList.clientHeight) return;

    // Accumulate scroll delta
    _scrollAccum += e.deltaY;

    // Reset accumulator after pause in scrolling
    clearTimeout(_scrollResetTimer);
    _scrollResetTimer = setTimeout(() => { _scrollAccum = 0; }, _SCROLL_RESET_MS);

    // Check threshold
    if (Math.abs(_scrollAccum) >= _scrollThreshold) {
      const direction = _scrollAccum > 0 ? 1 : -1;
      _scrollAccum = 0;
      PaperTM.switchToDirection(direction);
    }
  }

  // ── Drag drop zone on tabList ──────────────────────────
  // Attached once per init
  let _dragListenersAttached = false;

  function _attachDragListeners() {
    if (_dragListenersAttached) return;
    _dragListenersAttached = true;

    _deps.tabList.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (_dragCount === 0) return;

      // Visual drop-indicator on target tab
      const target = e.target.closest('.tab');
      _deps.tabList.querySelectorAll('.tab').forEach(el => { el.style.opacity = ''; });
      if (target) {
        const rect = target.getBoundingClientRect();
        target.style.opacity = e.clientY > rect.top + rect.height * 0.5 ? '0.7' : '0.85';
      }
    });

    _deps.tabList.addEventListener('dragleave', (e) => {
      // Only clear when leaving the tabList entirely
      if (!e.relatedTarget || !_deps.tabList.contains(e.relatedTarget)) {
        _deps.tabList.querySelectorAll('.tab').forEach(el => { el.style.opacity = ''; });
      }
    });

    _deps.tabList.addEventListener('drop', (e) => {
      e.preventDefault();
      if (_dragCount === 0) return;

      _deps.tabList.querySelectorAll('.tab').forEach(el => { el.style.opacity = ''; });

      const draggedEl = _deps.tabList.querySelector('.dragging');
      const target = e.target.closest('.tab');
      if (!draggedEl || !target) return;

      const draggedId = draggedEl.dataset.tabId;
      const targetId = target.dataset.tabId;
      if (draggedId === targetId) return;

      const curOrder = _order.slice();
      const fromIdx = curOrder.indexOf(draggedId);
      const toIdx = curOrder.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) return;

      const rect = target.getBoundingClientRect();
      const insertBefore = e.clientY < rect.top + rect.height * 0.5;

      curOrder.splice(fromIdx, 1);
      const newToIdx = insertBefore ? toIdx : toIdx + 1;
      curOrder.splice(newToIdx > fromIdx ? newToIdx - 1 : newToIdx, 0, draggedId);

      _order = curOrder;
      _queueTabs();
      _persistOrder();
    });
  }

  // ── Public API ─────────────────────────────────────

  const PaperTM = {

    init(deps) {
      _deps = deps;
      _minimapContainer = deps.minimapContainer;
      _attachDragListeners();
      // Scroll-to-switch: wheel on tab list
      _deps.tabList.addEventListener('wheel', _onWheelScroll, { passive: true });
    },

    onTabsUpdated(data) {
      const arr = Array.isArray(data) ? data : [];
      _activeTabId = arr.find(t => t.active)?.id || null;
      const ids = new Set(arr.map(t => t.id));

      // Prune closed tabs from state
      for (const id of _tabs.keys()) {
        if (!ids.has(id)) {
          _tabs.delete(id);
          _order = _order.filter(o => o !== id);
        }
      }

      // Upsert incoming tabs
      for (const t of arr) {
        if (!_tabs.has(t.id)) {
          _tabs.set(t.id, { ...t });
          // New tabs append to strip end
          if (!_order.includes(t.id)) _order.push(t.id);
        } else {
          Object.assign(_tabs.get(t.id), t);
        }
      }

      // Restore persisted order if available and valid
      Promise.resolve(_deps.storage.loadTabOrder?.())
        .then(persisted => {
          if (persisted && Array.isArray(persisted) && persisted.every(id => _tabs.has(id))) {
            _order = persisted;
          }
          _doRenderTabs();
        })
        .catch(() => _doRenderTabs());

      _renderWebviews();
      _updateNTP();
      _renderMinimap();
    },

    setGroups(groupsData) {
      _groups.clear();
      if (Array.isArray(groupsData)) {
        groupsData.forEach(g => _groups.set(g.id, { ...g }));
      }
      _doRenderTabs();
    },

    getActiveTabId() {
      return _activeTabId;
    },

    getTabOrder() {
      return _order.slice();
    },

    // Expose internals for tests only
    _getState() {
      return { tabs: _tabs, activeTabId: _activeTabId, order: _order };
    },

    _renderTabs() {
      // Call the internal _renderTabs (renamed to _doRenderTabs)
      _doRenderTabs();
    },

    _persistOrder() {
      _persistOrder();
    },

    getWebview(tabId) {
      return _wvMap.get(tabId);
    },

    navigate(text) {
      const wv = _wvMap.get(_activeTabId);
      if (wv) {
        // loadURL returns a Promise in Electron 33
        try {
          wv.loadURL(text).catch(() => { wv.src = text; });
        } catch { wv.src = text; }
        return true;
      }
      return false;
    },

    cycleTab(direction) {
      const entries = _orderedEntries();
      if (entries.length < 2) return;
      const curIdx = entries.findIndex(([, t]) => t.active);
      const nextIdx = (curIdx + direction + entries.length) % entries.length;
      if (nextIdx === curIdx) return;
      _deps.tabsIPC.switch(entries[nextIdx][0]);
    },

    switchToDirection(direction) {
      // Use existing cycleTab which wraps via IPC switch
      PaperTM.cycleTab(direction);
    },
  };

  window.PaperTM = PaperTM;
})();

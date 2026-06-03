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
  let _order = [];             // visual tab order — persisted to storage
  let _dragCount = 0;          // active drag operations
  let _saveTimeout = null;
  const _SAVE_DEBOUNCE_MS = 500;
  let _deps = null;

  // Debounced persist order to storage
  function _persistOrder() {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      _deps.storage.saveTabOrder?.(_order.slice()).catch(() => {});
    }, _SAVE_DEBOUNCE_MS);
  }

  function _queueTabs() {
    if (_tabsRaf) return;
    _tabsRaf = requestAnimationFrame(() => { _tabsRaf = null; _renderTabs(); });
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
    wv.src = url || 'about:blank';
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
    wv.addEventListener('did-fail-load',        () => { _syncTab({ loading: false }); });
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
    return wv;
  }

  function _showActiveWebview() {
    _wvMap.forEach((wv, id) => {
      wv.style.display = (id === _activeTabId) ? 'flex' : 'none';
    });
  }

  function _buildTabEl(tab) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.active ? ' active' : '') + (tab.loading ? ' loading' : '');
    el.dataset.tabId = tab.id;

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

  function _renderTabs() {
    _deps.tabList.innerHTML = '';
    const entries = _orderedEntries();
    let activeIdx = entries.findIndex(([, t]) => t.active);

    entries.forEach(([id, tab], idx) => {
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

  function _updateNTP() {
    const t = _tabs.get(_activeTabId);
    if (!t || t.url === 'about:blank') {
      _deps.ntp.classList.remove('hidden');
    } else {
      _deps.ntp.classList.add('hidden');
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
      _attachDragListeners();
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
      _deps.storage.loadTabOrder().then(persisted => {
        if (persisted && Array.isArray(persisted) && persisted.every(id => _tabs.has(id))) {
          _order = persisted;
        }
        _renderTabs();
      });

      _renderWebviews();
      _updateNTP();
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

    getWebview(tabId) {
      return _wvMap.get(tabId);
    },

    navigate(text) {
      const wv = _wvMap.get(_activeTabId);
      if (wv) { wv.src = text; return true; }
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
  };

  window.PaperTM = PaperTM;
})();

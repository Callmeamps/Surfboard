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
  let _minimapContainer = null;
  let _deps = null;

  function _queueTabs() {
    if (_tabsRaf) return;
    _tabsRaf = requestAnimationFrame(() => { _tabsRaf = null; _renderTabs(); });
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
    const entries = Array.from(_tabs.entries());
    let activeIdx = entries.findIndex(([, t]) => t.active);

    entries.forEach(([id, tab], idx) => {
      const el = _buildTabEl(tab);
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

  // ── Public API ─────────────────────────────────────

  const PaperTM = {

    init(deps) {
      _deps = deps;
      _minimapContainer = deps.minimapContainer;
    },

    onTabsUpdated(data) {
      const arr = Array.isArray(data) ? data : [];
      _activeTabId = arr.find(t => t.active)?.id || null;
      const ids = new Set(arr.map(t => t.id));
      for (const id of _tabs.keys()) if (!ids.has(id)) _tabs.delete(id);
      for (const t of arr) {
        if (!_tabs.has(t.id)) _tabs.set(t.id, { ...t });
        else Object.assign(_tabs.get(t.id), t);
      }
      _renderTabs();
      _renderWebviews();
      _updateNTP();
      _renderMinimap();
    },

    getActiveTabId() {
      return _activeTabId;
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
      const entries = Array.from(_tabs.entries());
      if (entries.length < 2) return;
      const curIdx = entries.findIndex(([, t]) => t.active);
      const nextIdx = (curIdx + direction + entries.length) % entries.length;
      if (nextIdx === curIdx) return;
      _deps.tabsIPC.switch(entries[nextIdx][0]);
    },
  };

  window.PaperTM = PaperTM;
})();

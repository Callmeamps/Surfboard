/**
 * Canvas Pages — overlay pages for history, activity, bookmarks, agents, bash.
 * Uses HTML-in-Canvas API (Electron 38+ / Chromium 148+) when available.
 * Falls back to DOM overlay rendering on older Electron builds.
 *
 * Native mode: <canvas layoutsubtree> with ctx.drawElementImage()
 * Fallback mode: standard DOM overlay (identical UX, no canvas pipeline)
 */
(function () {
  'use strict';

  const _pages = {};
  let _unsubStorage = null;
  let _canvasEl = null;
  let _currentPage = null;
  let _observers = [];
  let _nativeSupported = false;

  // ── Feature detection ────────────────────────────────────
  function _detectNativeSupport() {
    try {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      return typeof ctx.drawElementImage === 'function';
    } catch {
      return false;
    }
  }

  // ── Canvas sizing (device pixel ratio) ───────────────────
  function _sizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
  }

  // ── Native canvas render ─────────────────────────────────
  function _renderNative(canvas, domNode) {
    const ctx = canvas.getContext('2d');

    // Use ResizeObserver for accurate pixel sizing
    const ro = new ResizeObserver(() => _sizeCanvas(canvas));
    ro.observe(canvas);

    // Initial size
    _sizeCanvas(canvas);

    // onpaint fires when canvas needs redrawing
    canvas.onpaint = () => {
      ctx.reset();
      const transform = ctx.drawElementImage(domNode, 0, 0);
      // Spatial sync: map clicks/hovers back to DOM
      domNode.style.transform = transform.toString();
    };

    // Trigger initial paint
    canvas.dispatchEvent(new Event('paint'));

    return ro;
  }

  // ── Register a page ──────────────────────────────────────
  function _register(id, title, renderer) {
    _pages[id] = { title, renderer };
  }

  // ── Open a canvas page ───────────────────────────────────
  async function open(id) {
    const page = _pages[id];
    if (!page) return;

    const content = await page.renderer();

    if (_nativeSupported && _canvasEl) {
      // Native mode: render DOM inside canvas
      _canvasEl.innerHTML = '';
      _canvasEl.setAttribute('layoutsubtree', '');
      const wrapper = document.createElement('div');
      wrapper.className = 'canvas-page';
      wrapper.innerHTML = content;
      _canvasEl.appendChild(wrapper);

      _currentPage = id;
      window.RightSidebar?.openCanvas(page.title, '');

      // Hide the DOM content container, show canvas
      const contentEl = document.getElementById('canvas-host-content');
      if (contentEl) contentEl.style.display = 'none';

      // Render into canvas
      _renderNative(_canvasEl, wrapper);

      // Wire click handlers inside canvas
      _wireCanvasItemClicks(wrapper);
    } else {
      // Fallback mode: DOM overlay (original behavior)
      window.RightSidebar?.openCanvas(page.title, content);
      _currentPage = id;
      _wireItemClicks();
    }

    _notifyChange(id);
  }

  // ── Close current page ───────────────────────────────────
  function close() {
    if (_nativeSupported && _canvasEl) {
      _canvasEl.onpaint = null;
      _canvasEl.innerHTML = '';
      _canvasEl.removeAttribute('layoutsubtree');
      const contentEl = document.getElementById('canvas-host-content');
      if (contentEl) contentEl.style.display = '';
    }
    _currentPage = null;
    window.RightSidebar?.closeCanvas();
    _notifyChange(null);
  }

  // ── Helpers ──────────────────────────────────────────────
  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function _dateGroup(ts) {
    const d = new Date(ts);
    const now = new Date();
    const dayMs = 86400000;
    const diff = Math.floor((now.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / dayMs);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return 'This Week';
    return 'Older';
  }

  function _fmtTime(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function _navigateUrl(url) {
    window.RightSidebar?.closeCanvas();
    if (window.PaperTM?.navigate) window.PaperTM.navigate(url);
    else if (window.electronAPI?.tabs?.create) window.electronAPI.tabs.create(url);
  }

  function _wireItemClicks() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.canvas-list-item').forEach(el => {
        el.addEventListener('click', () => {
          const url = el.dataset.url;
          if (url) _navigateUrl(url);
        });
      });
    });
  }

  function _wireCanvasItemClicks(root) {
    root.querySelectorAll('.canvas-list-item').forEach(el => {
      el.addEventListener('click', () => {
        const url = el.dataset.url;
        if (url) _navigateUrl(url);
      });
    });
  }

  function _loadingHtml() {
    return '<div style="padding:40px;text-align:center;color:var(--text-faint)">Loading…</div>';
  }

  function _errorHtml(msg) {
    return `<div style="padding:40px;text-align:center;color:var(--accent-warn)">${_esc(msg)}</div>`;
  }

  function _emptyHtml(label) {
    return `<div style="padding:40px;text-align:center;color:var(--text-faint)">No ${label} yet</div>`;
  }

  // ── Page renderers ───────────────────────────────────────

  function _renderHistoryHtml(history) {
    if (!history || !history.length) return _emptyHtml('history');
    const groups = {};
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
    history.forEach(h => {
      const g = _dateGroup(h.time);
      if (!groups[g]) groups[g] = [];
      groups[g].push(h);
    });
    let html = '<div class="canvas-page-inner">';
    groupOrder.forEach(g => {
      if (!groups[g]) return;
      html += `<div class="canvas-group-header">${g}</div>`;
      groups[g].forEach(h => {
        html += `<div class="canvas-list-item" data-url="${_esc(h.url)}">`
          + `<span class="canvas-item-icon">🕐</span>`
          + `<span class="canvas-item-label">${_esc(h.title || h.url)}</span>`
          + `<span class="canvas-item-time">${_fmtTime(h.time)}</span>`
          + `</div>`;
      });
    });
    html += '</div>';
    return html;
  }

  function _renderBookmarksHtml(bms) {
    if (!bms || !bms.length) return _emptyHtml('bookmarks');
    let html = '<div class="canvas-page-inner">';
    bms.forEach(bm => {
      html += `<div class="canvas-list-item" data-url="${_esc(bm.url)}">`
        + `<span class="canvas-item-icon">${bm.icon || '🔖'}</span>`
        + `<span class="canvas-item-label">${_esc(bm.label)}</span>`
        + `<span class="canvas-item-url">${_esc(bm.url)}</span>`
        + `</div>`;
    });
    html += '</div>';
    return html;
  }

  // ── Subscribers ──────────────────────────────────────────
  function onChange(fn) { _observers.push(fn); }
  function _notifyChange(pageId) { _observers.forEach(fn => fn(pageId)); }

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    _nativeSupported = _detectNativeSupport();
    console.log(`[CanvasPages] Native HTML-in-Canvas: ${_nativeSupported ? 'YES' : 'no (fallback)'}`);

    // Create hidden canvas element for native mode
    if (_nativeSupported) {
      _canvasEl = document.createElement('canvas');
      _canvasEl.id = 'canvas-pages-native';
      _canvasEl.style.cssText = 'display:none;width:100%;height:100%;position:absolute;top:0;left:0;';
      const host = document.getElementById('canvas-host');
      if (host) host.appendChild(_canvasEl);
    }

    const api = window.electronAPI?.storage;

    // ── History page ───────────────────────────────────────
    _register('history', 'Browsing History', async () => {
      if (!api) return _errorHtml('IPC unavailable');
      try {
        const history = await api.getHistory(100);
        return _renderHistoryHtml(history);
      } catch (err) {
        console.error('[CanvasPages] failed to load history:', err);
        return _errorHtml('Failed to load history');
      }
    });

    // ── Bookmarks page ─────────────────────────────────────
    _register('bookmarks', 'Bookmarks', async () => {
      if (!api) return _errorHtml('IPC unavailable');
      try {
        const bms = await api.getBookmarks();
        return _renderBookmarksHtml(bms);
      } catch (err) {
        console.error('[CanvasPages] failed to load bookmarks:', err);
        return _errorHtml('Failed to load bookmarks');
      }
    });

    // ── Activity page ──────────────────────────────────────
    _register('activity', 'Activity', async () => {
      return '<div class="canvas-page-inner" style="padding:40px;text-align:center;color:var(--text-faint)">Activity timeline coming soon</div>';
    });

    // ── Agents page ────────────────────────────────────────
    _register('agents', 'AI Agents', async () => {
      return '<div class="canvas-page-inner" style="padding:40px;text-align:center;color:var(--text-faint)">AI agent sessions coming soon</div>';
    });

    // ── Bash Sessions page ────────────────────────────────
    _register('bash', 'Bash Sessions', async () => {
      return '<div class="canvas-page-inner" style="padding:40px;text-align:center;color:var(--text-faint)">Terminal session history coming soon</div>';
    });
  }

  // ── Public API ───────────────────────────────────────────
  function isOpen() { return _currentPage !== null; }
  function getCurrent() { return _currentPage; }
  function isNativeMode() { return _nativeSupported; }
  function reset() {
    _observers = []; // clear first so close() doesn't notify stale subscribers
    close();
  }

  window.CanvasPages = {
    init,
    open,
    close,
    isOpen,
    getCurrent,
    isNativeMode,
    onChange,
    reset,
  };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

/**
 * Canvas Pages — overlay pages for history, activity, bookmarks, agents, bash.
 * Data sourced via IPC from main process storage module.
 * Note: HTML-in-Canvas API (drawElementImage) requires Electron 38+ / Chromium 148+.
 * Until upgrade, pages render as standard DOM overlays with identical UX.
 */
(function () {
  'use strict';

  const _pages = {};
  let _unsubStorage = null;

  function _register(id, title, renderer) {
    _pages[id] = { title, renderer };
  }

  async function open(id) {
    const page = _pages[id];
    if (!page) return;
    const content = await page.renderer();
    window.RightSidebar?.openCanvas(page.title, content);
  }

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

  function _wireItemClicks() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.canvas-list-item').forEach(el => {
        el.addEventListener('click', () => {
          window.RightSidebar?.closeCanvas();
          const url = el.dataset.url;
          if (window.PaperTM?.navigate) window.PaperTM.navigate(url);
          else if (window.electronAPI?.tabs?.create) window.electronAPI.tabs.create(url);
        });
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
    _wireItemClicks();
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
    _wireItemClicks();
    return html;
  }

  async function init() {
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

  function close() {
    window.RightSidebar?.closeCanvas();
  }

  // ── Public API ───────────────────────────────────────────
  window.CanvasPages = {
    init,
    open,
    close,
  };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

/**
 * Canvas Pages — overlay pages for history, activity, bookmarks, agents, bash.
 * Note: HTML-in-Canvas API (drawElementImage) requires Electron 38+ / Chromium 148+.
 * Until upgrade, pages render as standard DOM overlays with identical UX.
 */
(function () {
  'use strict';

  const _pages = {};

  function _register(id, title, renderer) {
    _pages[id] = { title, renderer };
  }

  function open(id) {
    const page = _pages[id];
    if (!page) return;
    window.RightSidebar?.openCanvas(page.title, page.renderer());
  }

  function init() {
    // ── History page ───────────────────────────────────────
    _register('history', 'Browsing History', () => {
      const history = window._phase7History || [];
      if (!history.length) {
        return '<div style="padding:40px;text-align:center;color:var(--text-faint)">No history yet</div>';
      }
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
      // Wire clicks after render
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
      return html;
    });

    // ── Bookmarks page ─────────────────────────────────────
    _register('bookmarks', 'Bookmarks', () => {
      const bms = window._phase7Bookmarks || [];
      if (!bms.length) {
        return '<div style="padding:40px;text-align:center;color:var(--text-faint)">No bookmarks yet</div>';
      }
      let html = '<div class="canvas-page-inner">';
      bms.forEach(bm => {
        html += `<div class="canvas-list-item" data-url="${_esc(bm.url)}">`
          + `<span class="canvas-item-icon">${bm.icon || '🔖'}</span>`
          + `<span class="canvas-item-label">${_esc(bm.label)}</span>`
          + `<span class="canvas-item-url">${_esc(bm.url)}</span>`
          + `</div>`;
      });
      html += '</div>';
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
      return html;
    });

    // ── Activity page ──────────────────────────────────────
    _register('activity', 'Activity', () => {
      return '<div class="canvas-page-inner" style="padding:40px;text-align:center;color:var(--text-faint)">Activity timeline coming soon</div>';
    });

    // ── Agents page ────────────────────────────────────────
    _register('agents', 'AI Agents', () => {
      return '<div class="canvas-page-inner" style="padding:40px;text-align:center;color:var(--text-faint)">AI agent sessions coming soon</div>';
    });

    // ── Bash Sessions page ────────────────────────────────
    _register('bash', 'Bash Sessions', () => {
      return '<div class="canvas-page-inner" style="padding:40px;text-align:center;color:var(--text-faint)">Terminal session history coming soon</div>';
    });
  }

  // ── Helpers ──────────────────────────────────────────────
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

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ── Public API ───────────────────────────────────────────
  window.CanvasPages = {
    init,
    open,
  };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();

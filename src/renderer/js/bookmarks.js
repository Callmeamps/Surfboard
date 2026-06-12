/**
 * Bookmarks — sidebar bookmarks, dialog, import/export
 */
(function () {
  'use strict';

  let _storage = null;
  let _tabs = null;
  let _toast = null;
  let _allBookmarks = [];

  // DOM refs (set during init)
  let $list = null;
  let $dialogOverlay = null;
  let $dialogTitle = null;
  let $dialogLabel = null;
  let $dialogUrl = null;
  let $addBtn = null;
  let $importBtn = null;
  let $exportBtn = null;

  function init(deps) {
    _storage = deps.storage || {};
    _tabs = deps.tabs || {};
    _toast = deps.toast || (() => {});

    $list = document.getElementById('bookmarks-list');
    $dialogOverlay = document.getElementById('bm-dialog-overlay');
    $dialogTitle = document.getElementById('bm-dialog-title');
    $dialogLabel = document.getElementById('bm-dialog-label');
    $dialogUrl = document.getElementById('bm-dialog-url');
    $addBtn = document.getElementById('bookmarks-add-btn');
    $importBtn = document.getElementById('bookmarks-import-btn');
    $exportBtn = document.getElementById('bookmarks-export-btn');

    $addBtn?.addEventListener('click', () => _openDialog());
    $importBtn?.addEventListener('click', _import);
    $exportBtn?.addEventListener('click', _export);
    document.getElementById('bm-dialog-save')?.addEventListener('click', _saveDialog);
    document.getElementById('bm-dialog-cancel')?.addEventListener('click', _closeDialog);
    document.getElementById('bm-dialog-close')?.addEventListener('click', _closeDialog);
    document.getElementById('bm-search')?.addEventListener('input', (e) => _filter(e.target.value));

    load();
  }

  async function load() {
    try {
      const bms = await _storage.getBookmarks?.() || [];
      _allBookmarks = bms;
      _render(bms);
    } catch {}
  }

  function _render(bms) {
    if (!$list) return;
    $list.innerHTML = '';
    if (!bms.length) {
      $list.innerHTML = '<div style="padding:12px;color:var(--text-faint);font-size:12px;text-align:center">No bookmarks</div>';
      return;
    }
    bms.forEach(bm => {
      const el = document.createElement('div');
      el.className = 'bookmark-item';
      el.dataset.url = bm.url;
      el.dataset.id = bm.id;
      el.innerHTML = `<span class="icon">${bm.icon || '🔖'}</span><span class="label">${bm.label}</span>`;
      el.addEventListener('click', () => _tabs.create(bm.url));
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); _showContextMenu(e, bm); });
      $list.appendChild(el);
    });
  }

  function _filter(query) {
    if (!query) { _render(_allBookmarks); return; }
    const q = query.toLowerCase();
    const filtered = _allBookmarks.filter(bm =>
      (bm.label || '').toLowerCase().includes(q) ||
      (bm.url || '').toLowerCase().includes(q)
    );
    _render(filtered);
  }

  function _showContextMenu(e, bm) {
    const existing = document.querySelector('.bm-contextmenu');
    if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.className = 'bm-contextmenu';
    menu.style.cssText = `position:fixed;top:${e.clientY}px;left:${e.clientX}px;z-index:500;`;
    menu.innerHTML = '<div class="bm-ctx-item" data-action="edit">✏️ Edit</div><div class="bm-ctx-item" data-action="delete">🗑️ Delete</div>';
    menu.querySelector('[data-action="edit"]').addEventListener('click', () => { menu.remove(); _openDialog(bm); });
    menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      menu.remove();
      await _storage.removeBookmark?.(bm.id);
      load();
      _toast('Bookmark removed');
    });
    document.body.appendChild(menu);
    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function _openDialog(bm = null) {
    if (!$dialogOverlay) return;
    $dialogTitle.textContent = bm ? 'Edit Bookmark' : 'Add Bookmark';
    $dialogLabel.value = bm ? bm.label : '';
    $dialogUrl.value = bm ? bm.url : '';
    $dialogOverlay.classList.remove('hidden');
    $dialogLabel.focus();
  }

  function _closeDialog() {
    $dialogOverlay?.classList.add('hidden');
  }

  async function _saveDialog() {
    const label = $dialogLabel.value.trim();
    const url = $dialogUrl.value.trim();
    if (!label || !url) { _toast('Label and URL required'); return; }
    await _storage.addBookmark?.({ label, url, icon: '🔖' });
    _closeDialog();
    load();
    _toast('Bookmark saved');
  }

  function _export() {
    if (!_allBookmarks.length) { _toast('No bookmarks to export'); return; }
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8"><TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>';
    _allBookmarks.forEach(bm => { html += `<DT><A HREF="${bm.url}">${bm.label}</A>`; });
    html += '</DL><p>';
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'surfboard-bookmarks.html';
    a.click();
    URL.revokeObjectURL(a.href);
    _toast(`Exported ${_allBookmarks.length} bookmarks`);
  }

  async function _import() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';
    input.onchange = async () => {
      try {
        const text = await input.files[0].text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const links = doc.querySelectorAll('a');
        let imported = 0;
        links.forEach(a => {
          const url = a.getAttribute('href');
          const label = a.textContent;
          if (url && label && !_allBookmarks.find(b => b.url === url)) {
            _storage.addBookmark?.({ label, url, icon: '🔖' });
            imported++;
          }
        });
        load();
        _toast(`Imported ${imported} bookmarks`);
      } catch { _toast('Import failed'); }
    };
    input.click();
  }

  window.Bookmarks = { init, load };
})();

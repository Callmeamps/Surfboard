/**
 * RicedChromium — Unified Renderer v4
 *
 * Simple tab/webview model: one webview per tab, show active, hide rest.
 * No pooling, no LOD — just works.
 */
(function () {
  'use strict';

  // ── DOM refs ─────────────────────────────────────────────
  const $app           = document.getElementById('app');
  const $sidebar       = document.getElementById('sidebar');
  const $sidebarToggle = document.getElementById('sidebar-toggle');
  const $tabList       = document.getElementById('tab-list');
  const $minimapContainer = document.getElementById('minimap-container');
  const $newTabBtn     = document.getElementById('new-tab-btn');
  const $navBack       = document.getElementById('nav-back');
  const $navForward    = document.getElementById('nav-forward');
  const $bookmarks     = document.getElementById('bookmarks-list');
  const $wvContainer   = document.getElementById('webview-container');
  const $addrBar       = document.getElementById('address-bar');
  const $addrInput     = document.getElementById('address-input');
  const $addrDD        = document.getElementById('suggestions-dropdown');
  const $addrList      = document.getElementById('suggestions-list');
  const $newTabPage    = document.getElementById('new-tab-page');
  const $newTabInput   = document.getElementById('new-tab-input');
  const $ntpDD         = document.getElementById('ntp-suggestions');
  const $ntpList       = document.getElementById('ntp-suggestions-list');
  const $rsidebarAi       = document.getElementById('rsidebar-ai');
  const $rsidebarShell    = document.getElementById('rsidebar-shell');
  const $rsidebarEdit     = document.getElementById('rsidebar-edit');
  const $rsidebarInspect  = document.getElementById('rsidebar-inspect');
  const $rsidebarActions  = document.getElementById('rsidebar-actions');
  const $rsidebarData     = document.getElementById('rsidebar-data');
  const $rsidebarWorkflows= document.getElementById('rsidebar-workflows');
  const $rsidebarMiniapps = document.getElementById('rsidebar-miniapps');
  const $rsidebarOmnibar  = document.getElementById('rsidebar-omnibar');
  const $rsidebarExt      = document.getElementById('rsidebar-extensions');
  const $rsidebarBookmark = document.getElementById('rsidebar-bookmark');
  const $sidecar       = document.getElementById('sidecar');
  const $sidecarHdr    = document.getElementById('sidecar-header');
  const $sidecarModeAi = document.getElementById('sidecar-mode-ai');
  const $sidecarModeShell = document.getElementById('sidecar-mode-shell');
  const $shellStatus   = document.getElementById('shell-status');
  const $sidecarConfig = document.getElementById('sidecar-config-btn');
  const $sidecarClose  = document.getElementById('sidecar-close-btn');
  const $sidecarAiPanel = document.getElementById('sidecar-ai-panel');
  const $sidecarShellPanel = document.getElementById('sidecar-shell-panel');
  const $sidecarExtPanel = document.getElementById('sidecar-ext-panel');
  const $sidecarModeExt = document.getElementById('sidecar-mode-ext');
  const $extPopupFrame = document.getElementById('ext-popup-frame');
  const $extPopupName = document.getElementById('ext-popup-name');
  const $extPopupEmpty = document.getElementById('ext-popup-empty');
  const $extPopupClose = document.getElementById('ext-popup-close');
  const $chatInput     = document.getElementById('chat-input');
  const $chatSend      = document.getElementById('chat-send');
  const $chatMessages  = document.getElementById('chat-messages');
  const $shellOutput   = document.getElementById('shell-output');
  const $shellInput    = document.getElementById('shell-input');
  const $shellRun      = document.getElementById('shell-run');
  const $shellClear    = document.getElementById('shell-clear');
  const $shellStop     = document.getElementById('shell-stop');
  const $shellHint     = document.getElementById('shell-hint');
  const $extPanel      = document.getElementById('extensions-panel');
  const $extPanelClose = document.getElementById('extensions-panel-close');
  const $extList       = document.getElementById('extensions-list');
  const $winMin        = document.getElementById('window-minimize');
  const $winMax        = document.getElementById('window-maximize');
  const $winClose      = document.getElementById('window-close');
  const $sidebarHistoryBtn  = document.getElementById('sidebar-history-btn');
  const $sidebarSettingsBtn = document.getElementById('sidebar-settings-btn');
  const $sidebarProfileBtn  = document.getElementById('sidebar-profile-btn');

  const $bmAddBtn           = document.getElementById('bookmarks-add-btn');
  const $bmImportBtn        = document.getElementById('bookmarks-import-btn');
  const $bmExportBtn        = document.getElementById('bookmarks-export-btn');
  const $bmSearch           = document.getElementById('bookmarks-search');
  const $bmDialogOverlay    = document.getElementById('bm-dialog-overlay');
  const $bmDialogTitle      = document.getElementById('bm-dialog-title');
  const $bmDialogLabel      = document.getElementById('bm-dialog-label');
  const $bmDialogUrl        = document.getElementById('bm-dialog-url');
  const $bmDialogSave       = document.getElementById('bm-dialog-save');
  const $bmDialogCancel     = document.getElementById('bm-dialog-cancel');
  const $bmDialogClose      = document.getElementById('bm-dialog-close');
  const $toastContainer     = document.getElementById('toast-container');
  const $changelogOverlay   = document.getElementById('changelog-overlay');
  const $changelogBody      = document.getElementById('changelog-body');
  const $changelogVersion   = document.getElementById('changelog-version');
  const $changelogClose     = document.getElementById('changelog-close');
  const $changelogDismiss   = document.getElementById('changelog-dismiss');

  // ── Print dialog refs ───────────────────────────────────
  const $printOverlay     = document.getElementById('print-dialog-overlay');
  const $printClose       = document.getElementById('print-dialog-close');
  const $printDest        = document.getElementById('print-destination');
  const $printCopies      = document.getElementById('print-copies');
  const $printPages       = document.getElementById('print-pages');
  const $printPageRange   = document.getElementById('print-page-range');
  const $printLandscape   = document.getElementById('print-landscape');
  const $printBg          = document.getElementById('print-bg');
  const $printScale       = document.getElementById('print-scale');
  const $printScaleVal    = document.getElementById('print-scale-val');
  const $printCancel      = document.getElementById('print-cancel');
  const $printSavePdf     = document.getElementById('print-save-pdf');
  const $printGo          = document.getElementById('print-go');

  // ── State ────────────────────────────────────────────────
  let suggestions = [];
  let addrActiveIdx = -1;
  let historyEntries = [];
  let settings = {};
  let sidebarCollapsed = false;
  let sidecarMode = 'ai';
  let shellState = { running: false, lastCommand: '', allowedCommands: [] };
  let dragState = null;
  let chatHistory = [];

  // ── IPC shorthand ────────────────────────────────────────
  const _storage = window.electronAPI?.storage || {};
  const _tabs    = window.electronAPI?.tabs || {};
  const _win     = window.electronAPI?.window || {};
  const _ext     = window.electronAPI?.extensions || {};
  const _shell   = window.electronAPI?.shell || {};

  // ── Helpers ──────────────────────────────────────────────
  function _isUrl(t) { return /^https?:\/\//i.test(t) || (/^[^\s]+\.[^\s]{2,}/.test(t) && !t.includes(' ')); }
  function _normUrl(t) { return /^https?:\/\//i.test(t) ? t : 'https://' + t; }
  function _fmtTime(ts) {
    const d = Date.now() - ts;
    if (d < 60000) return 'now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function _nav(text) {
    text = text.trim(); if (!text) return;
    text = _isUrl(text) ? _normUrl(text) : 'https://www.google.com/search?q=' + encodeURIComponent(text);
    const navigated = window.PaperTM?.navigate(text);
    console.log('[nav] navigated:', navigated);
    if (navigated) { _hideAddr(); return; }
    _tabs.create(text); _hideAddr();
  }

  // ── Sidebar ──────────────────────────────────────────────
  async function _setSidebar(c) {
    sidebarCollapsed = c;
    $sidebar.classList.toggle('collapsed', c);
    const svg = $sidebarToggle.querySelector('svg');
    if (svg) svg.innerHTML = c ? '<polyline points="1 1 5 5 1 9"/>' : '<polyline points="5 1 1 5 5 9"/>';
    try { await _storage.updateSettings?.({ sidebarCollapsed: c }); } catch {}
  }
  async function _toggleSidebar() { await _setSidebar(!sidebarCollapsed); }

// ── Address Bar ──────────────────────────────────────────
  let suggestionDebounceTimer = null;
  let lastSuggestionQuery = '';

  function _showAddr() { $addrBar.classList.remove('hidden'); $addrInput.focus(); $addrInput.select(); if ($addrInput.value) _buildSuggestions($addrInput.value); }
  function _hideAddr() { $addrBar.classList.add('hidden'); $addrInput.blur(); _hideSuggestions(); }
  function _hideSuggestions() { $addrDD.classList.add('hidden'); suggestions = []; addrActiveIdx = -1; }

  // Fuzzy score: consecutive char matches score higher
  function _fuzzyScore(text, query) {
    if (!text || !query) return 0;
    text = text.toLowerCase();
    query = query.toLowerCase();
    let score = 0;
    let lastMatchIdx = -1;
    for (let i = 0; i < query.length; i++) {
      const idx = text.indexOf(query[i], lastMatchIdx + 1);
      if (idx === -1) return 0;
      // Consecutive matches get bonus
      if (lastMatchIdx === -1 || idx === lastMatchIdx + 1) score += 2;
      else score += 1;
      lastMatchIdx = idx;
    }
    return score;
  }

  async function _fetchApiSuggestions(q) {
    // Only fetch for DDG or Brave search engines
    const engine = settings.searchEngine;
    if (engine !== 'ddg' && engine !== 'brave') return [];
    try {
      const res = await fetch('https://duckduckgo.com/ac/?q=' + encodeURIComponent(q));
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map(s => ({ icon: '🌐', text: s.Text || s, url: s.Url || `https://duckduckgo.com/?q=${encodeURIComponent(s)}` })).slice(0, 8);
    } catch { return []; }
  }

  async function _buildSuggestions(q) {
    if (!q) { _hideSuggestions(); return; }
    lastSuggestionQuery = q;

    // Cancel any pending API fetch
    if (suggestionDebounceTimer) clearTimeout(suggestionDebounceTimer);

    q = q.toLowerCase();
    const localItems = [];

    // Local fuzzy search
    historyEntries.forEach(h => {
      const title = h.title || h.url || '';
      const url = h.url || '';
      const score = _fuzzyScore(title, q) || _fuzzyScore(url, q);
      if (score) localItems.push({ icon: '🕐', text: title, url, score });
    });
    document.querySelectorAll('.bookmark-item').forEach(el => {
      const lbl = el.querySelector('.label');
      const u = el.dataset.url;
      if (lbl && u) {
        const score = _fuzzyScore(lbl.textContent, q) || _fuzzyScore(u, q);
        if (score) localItems.push({ icon: '🔖', text: lbl.textContent, url: u, score });
      }
    });

    // Add search suggestion
    const searchItem = { icon: '🔍', text: `Search "${q}"`, url: 'https://www.google.com/search?q=' + encodeURIComponent(q), score: 0 };

    // Render initial suggestions immediately
    suggestions = [...localItems, searchItem].slice(0, 8);
    _renderSuggestions();

    // Debounce API fetch and update suggestions
    suggestionDebounceTimer = setTimeout(async () => {
      if (lastSuggestionQuery !== q) return;
      const apiItems = await _fetchApiSuggestions(q);
      // Combine local items with API items, keeping search item at end
      const combined = [...localItems, ...apiItems, searchItem];
      combined.sort((a, b) => {
        // Search item always at end
        if (a.icon === '🔍') return 1;
        if (b.icon === '🔍') return -1;
        return b.score - a.score;
      });
      suggestions = combined.slice(0, 8);
      _renderSuggestions();
    }, 300);
  }

  function _renderSuggestions() {
    if (!suggestions.length) { _hideSuggestions(); return; }
    $addrList.innerHTML = '';
    suggestions.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item' + (i === addrActiveIdx ? ' active' : '');
      li.innerHTML = `<span class="ico">${s.icon}</span><span class="txt">${s.text}</span>${s.text !== s.url ? `<span class="url">${s.url}</span>` : ''}`;
      li.addEventListener('click', () => { $addrInput.value = s.url; _nav(s.url); });
      $addrList.appendChild(li);
    });
    $addrDD.classList.remove('hidden');
  }

  // ── Sidecar ──────────────────────────────────────────────
  function _renderShellState() {
    const running = Boolean(shellState?.running);
    if ($shellStatus) {
      $shellStatus.textContent = running ? 'running' : 'idle';
      $shellStatus.classList.toggle('active', running);
    }
    if ($shellStop) {
      $shellStop.textContent = running ? 'Stop' : 'Start';
    }
    if ($shellInput) {
      $shellInput.placeholder = running ? 'Allowlisted command…' : 'Starting shell…';
    }
    if ($shellHint) {
      const allowlist = Array.isArray(shellState?.allowedCommands) ? shellState.allowedCommands : [];
      $shellHint.textContent = allowlist.length
        ? `Allowlisted: ${allowlist.slice(0, 8).join(', ')}${allowlist.length > 8 ? '…' : ''}`
        : 'Allowlisted host commands only. Output streams from bash.';
    }
  }

  function _appendShellLine(stream, text) {
    if (!$shellOutput) return;
    const line = document.createElement('div');
    line.className = `shell-line ${stream}`;
    line.textContent = text;
    $shellOutput.appendChild(line);
    while ($shellOutput.childNodes.length > 400) {
      $shellOutput.removeChild($shellOutput.firstChild);
    }
    $shellOutput.scrollTop = $shellOutput.scrollHeight;
  }

  function _clearShellOutput() {
    if ($shellOutput) {
      $shellOutput.textContent = '';
    }
  }

  async function _ensureShellStarted() {
    try {
      const state = await _shell.start?.();
      if (state) {
        shellState = state;
        _renderShellState();
      }
    } catch (err) {
      _appendShellLine('stderr', `[shell] ${err.message}`);
    }
  }

  function _setShellMode(mode) {
    sidecarMode = mode === 'shell' ? 'shell' : mode === 'extension' ? 'extension' : 'ai';
    $sidecarModeAi?.classList.toggle('active', sidecarMode === 'ai');
    $sidecarModeShell?.classList.toggle('active', sidecarMode === 'shell');
    $sidecarModeExt?.classList.toggle('active', sidecarMode === 'extension');
    $sidecarAiPanel?.classList.toggle('hidden', sidecarMode !== 'ai');
    $sidecarShellPanel?.classList.toggle('hidden', sidecarMode !== 'shell');
    $sidecarExtPanel?.classList.toggle('hidden', sidecarMode !== 'extension');
    $rsidebarAi?.classList.toggle('active', sidecarMode === 'ai' && !$sidecar.classList.contains('sidecar-hidden'));
    $rsidebarShell?.classList.toggle('active', sidecarMode === 'shell' && !$sidecar.classList.contains('sidecar-hidden'));
    if (!$sidecar.classList.contains('sidecar-hidden')) {
      if (sidecarMode === 'shell') {
        _ensureShellStarted();
        $shellInput?.focus();
      } else if (sidecarMode === 'extension') {
        // popup already loaded by _showExtensionPopup
      } else {
        $chatInput?.focus();
      }
    }
  }

  function _showSidecar(mode = sidecarMode) {
    $sidecar.classList.remove('sidecar-hidden');
    _setShellMode(mode);
  }

  function _hideSidecar() {
    $sidecar.classList.add('sidecar-hidden');
    $rsidebarAi?.classList.remove('active');
    $rsidebarShell?.classList.remove('active');
  }

  function _toggleSidecar(mode = sidecarMode) {
    if ($sidecar.classList.contains('sidecar-hidden')) {
      _showSidecar(mode);
      return;
    }
    if (sidecarMode !== mode) {
      _setShellMode(mode);
      return;
    }
    _hideSidecar();
  }

  function _showExtensionPopup(name, url) {
    if (!url) return;
    $extPopupName.textContent = name || 'Extension Popup';
    $extPopupEmpty.classList.add('hidden');
    $extPopupFrame.classList.remove('hidden');
    $extPopupFrame.src = url;
    _showSidecar('extension');
  }

  function _sendShellCommand() {
    const text = $shellInput.value.trim();
    if (!text) return;

    try {
      window.TrustManager?.require('shell', 'execute');
    } catch (err) {
      _appendShellLine('stderr', '[trust] ' + (err.message || 'Permission denied for shell::execute'));
      return;
    }

    $shellInput.value = '';
    _appendShellLine('command', `› ${text}`);

    try {
      const res = _shell.command?.(text);
      if (!res?.ok) {
        _appendShellLine('stderr', res?.error || 'Command blocked');
      }
    } catch (err) {
      _appendShellLine('stderr', err.message || 'Shell command failed');
    }
  }

  function _startDrag(e) { if (e.button !== 0) return; e.preventDefault(); const r = $sidecar.getBoundingClientRect(); dragState = { sx: e.clientX, sy: e.clientY, ot: r.top, ol: r.left }; }
  function _onDrag(e) { if (!dragState) return; e.preventDefault(); $sidecar.style.top = (dragState.ot + e.clientY - dragState.sy) + 'px'; $sidecar.style.left = (dragState.ol + e.clientX - dragState.sx) + 'px'; $sidecar.style.right = 'auto'; }
  function _endDrag() { dragState = null; }

  // ── Extensions Panel ─────────────────────────────────────
  function _toggleExt() { $extPanel.classList.toggle('open'); $rsidebarExt?.classList.toggle('active', $extPanel.classList.contains('open')); }

  async function _loadExts() {
    try {
      const exts = await _ext.list?.() || [];
      $extList.innerHTML = '';
      if (!exts.length) { $extList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:13px">No extensions loaded</div>'; }
      else {
        exts.forEach(ex => {
          const el = document.createElement('div');
          el.className = 'ext-item';
          const iconHtml = ex.icon ? `<img class="ext-icon-img" src="${ex.icon}" alt=""/>` : `<div class="ext-icon">🧩</div>`;
          const linksHtml = [];
          if (ex.popupUrl) linksHtml.push(`<a class="ext-link" data-url="${ex.popupUrl}" title="Open popup">Popup</a>`);
          if (ex.optionsUrl) linksHtml.push(`<a class="ext-link" data-url="${ex.optionsUrl}" title="Open options">Options</a>`);
          el.innerHTML = `${iconHtml}<div class="ext-info"><div class="ext-name">${ex.name || ex.id}</div><div class="ext-desc">${ex.description || ''}</div>${linksHtml.length ? `<div class="ext-links">${linksHtml.join('')}</div>` : ''}</div><label class="ext-toggle"><input type="checkbox" ${ex.enabled ? 'checked' : ''} data-ext-id="${ex.id}"><span class="toggle-track"></span></label>`;
          el.querySelector('input').addEventListener('change', (e) => { e.target.checked ? _ext.load(ex.path).catch(() => {}) : _ext.unload(ex.id).catch(() => {}); });
          el.querySelectorAll('.ext-link').forEach(link => {
            link.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (link.dataset.url && link.textContent === 'Popup') {
                _showExtensionPopup(ex.name, link.dataset.url);
              } else {
                _tabs.create(link.dataset.url);
              }
            });
          });
          $extList.appendChild(el);
        });
      }
      // Render extension icon buttons in right sidebar
      const $extIcons = document.getElementById('rsidebar-ext-icons');
      if ($extIcons) {
        $extIcons.innerHTML = '';
        exts.filter(ex => ex.enabled && ex.icon).forEach(ex => {
          const btn = document.createElement('button');
          btn.className = 'rsidebar-btn';
          btn.title = ex.name || ex.id;
          btn.innerHTML = `<img src="${ex.icon}" alt="" style="width:16px;height:16px;border-radius:2px"/>`;
          btn.addEventListener('click', () => {
            if (ex.popupUrl) _showExtensionPopup(ex.name, ex.popupUrl);
            else _toggleExt();
          });
          $extIcons.appendChild(btn);
        });
      }
      // Badge count on extensions button
      const $rsidebarExt = document.getElementById('rsidebar-extensions');
      if ($rsidebarExt) {
        const existing = $rsidebarExt.querySelector('.ext-badge');
        if (existing) existing.remove();
        if (exts.length > 0) {
          const badge = document.createElement('span');
          badge.className = 'ext-badge';
          badge.textContent = exts.length;
          $rsidebarExt.appendChild(badge);
        }
      }
    } catch { /* */ }
  }

  // ── Toast ───────────────────────────────────────────────
  function _toast(msg, duration = 2500) {
    if (!$toastContainer) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ── Bookmarks ────────────────────────────────────────────
  let _allBookmarks = [];

  async function _loadBookmarks() {
    try {
      const bms = await _storage.getBookmarks?.() || [];
      _allBookmarks = bms;
      _renderBookmarks(bms);
    } catch {}
  }

  function _renderBookmarks(bms) {
    $bookmarks.innerHTML = '';
    if (!bms.length) { $bookmarks.innerHTML = '<div style="padding:12px;color:var(--text-faint);font-size:12px;text-align:center">No bookmarks</div>'; return; }
    bms.forEach(bm => {
      const el = document.createElement('div');
      el.className = 'bookmark-item'; el.dataset.url = bm.url; el.dataset.id = bm.id;
      el.innerHTML = `<span class="icon">${bm.icon || '🔖'}</span><span class="label">${bm.label}</span>`;
      el.addEventListener('click', () => _tabs.create(bm.url));
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); _showBmContextMenu(e, bm); });
      $bookmarks.appendChild(el);
    });
  }

  function _showBmContextMenu(e, bm) {
    const existing = document.querySelector('.bm-contextmenu');
    if (existing) existing.remove();
    const menu = document.createElement('div');
    menu.className = 'bm-contextmenu';
    menu.style.cssText = `position:fixed;top:${e.clientY}px;left:${e.clientX}px;z-index:500;`;
    menu.innerHTML = '<div class="bm-ctx-item" data-action="edit">✏️ Edit</div><div class="bm-ctx-item" data-action="delete">🗑️ Delete</div>';
    menu.querySelector('[data-action="edit"]').addEventListener('click', () => { menu.remove(); _openBmDialog(bm); });
    menu.querySelector('[data-action="delete"]').addEventListener('click', async () => { menu.remove(); await _storage.removeBookmark?.(bm.id); _loadBookmarks(); _toast('Bookmark removed'); });
    document.body.appendChild(menu);
    const close = () => { menu.remove(); document.removeEventListener('click', close); };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function _openBmDialog(bm = null) {
    if (!$bmDialogOverlay) return;
    $bmDialogTitle.textContent = bm ? 'Edit Bookmark' : 'Add Bookmark';
    $bmDialogLabel.value = bm ? bm.label : '';
    $bmDialogUrl.value = bm ? bm.url : '';
    $bmDialogOverlay.classList.remove('hidden');
    $bmDialogLabel.focus();
  }

  async function _saveBmDialog() {
    const label = $bmDialogLabel.value.trim();
    const url = $bmDialogUrl.value.trim();
    if (!label || !url) { _toast('Label and URL required'); return; }
    await _storage.addBookmark?.({ label, url, icon: '🔖' });
    $bmDialogOverlay.classList.add('hidden');
    _loadBookmarks();
    _toast('Bookmark saved');
  }

  // ── Import / Export ──────────────────────────────────────
  function _exportBookmarks() {
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

  async function _importBookmarks() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.html';
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
        _loadBookmarks();
        _toast(`Imported ${imported} bookmarks`);
      } catch { _toast('Import failed'); }
    };
    input.click();
  }

  // ── History ──────────────────────────────────────────────
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

  async function _toggleHistory() {
    try { const e = await (_storage.getHistory?.(50) || Promise.resolve([])).catch(() => []); if (e.length) historyEntries = e; } catch {}
    window.SettingsModule?.setHistory?.(historyEntries);
    if ($bookmarks.dataset.mode === 'history') { delete $bookmarks.dataset.mode; _loadBookmarks(); return; }
    $bookmarks.dataset.mode = 'history';
    $bookmarks.innerHTML = '';
    if (!historyEntries.length) { $bookmarks.innerHTML = '<div style="padding:12px;color:var(--text-faint);font-size:12px;text-align:center">No history</div>'; return; }
    // Group by date
    const groups = {};
    historyEntries.forEach(h => {
      const g = _dateGroup(h.time);
      if (!groups[g]) groups[g] = [];
      groups[g].push(h);
    });
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
    groupOrder.forEach(g => {
      if (!groups[g]) return;
      const header = document.createElement('div');
      header.className = 'history-group-header';
      header.textContent = g;
      $bookmarks.appendChild(header);
      groups[g].forEach(h => {
        const el = document.createElement('div');
        el.className = 'bookmark-item';
        el.innerHTML = `<span class="icon">🕐</span><span class="label">${h.title || h.url}</span><span style="font-size:10px;color:var(--text-faint);margin-left:auto">${_fmtTime(h.time)}</span>`;
        el.addEventListener('click', () => _tabs.create(h.url));
        $bookmarks.appendChild(el);
      });
    });
  }

  // ── Settings ─────────────────────────────────────────────
  // Delegated to settings.js module
  function _toggleSettings() { 
    // Open settings as a full tab
    _tabs.create('surfboard://settings');
  }
  function _openAiConfig() { window.SettingsModule.openAiConfig(); }

  // ── Shortcut Menu ────────────────────────────────────────
  const SHORTCUT_DATA = window.ShortcutData?.groups || [];
  let _shortcutMenuOpen = false;
  function _toggleShortcutMenu() {
    const $el = document.getElementById('shortcut-overlay');
    if (!$el) return;
    _shortcutMenuOpen = !_shortcutMenuOpen;
    if (_shortcutMenuOpen) {
      _renderShortcutMenu($el);
      $el.classList.remove('hidden');
    } else {
      $el.classList.add('hidden');
    }
  }
  function _renderShortcutMenu($el) {
    const $body = $el.querySelector('#shortcut-body');
    if (!$body) return;
    $body.innerHTML = '';
    for (const group of SHORTCUT_DATA) {
      const $title = document.createElement('div');
      $title.className = 'shortcut-group-title';
      $title.textContent = group.title;
      $body.appendChild($title);
      const $group = document.createElement('div');
      $group.className = 'shortcut-group';
      for (const [label, ...keys] of group.items) {
        const $row = document.createElement('div');
        $row.className = 'shortcut-group-item';
        const $label = document.createElement('span');
        $label.textContent = label;
        const $keys = document.createElement('div');
        $keys.className = 'shortcut-group-keys';
        for (const k of keys) {
          const $kbd = document.createElement('kbd');
          $kbd.textContent = k;
          $keys.appendChild($kbd);
        }
        $row.appendChild($label);
        $row.appendChild($keys);
        $group.appendChild($row);
      }
      $body.appendChild($group);
    }
  }
  function _setupShortcutOverlay() {
    const $el = document.getElementById('shortcut-overlay');
    if (!$el) return;
    $el.addEventListener('click', (e) => { if (e.target === $el) _toggleShortcutMenu(); });
    document.getElementById('shortcut-close')?.addEventListener('click', _toggleShortcutMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && _shortcutMenuOpen) { e.preventDefault(); _toggleShortcutMenu(); } });
  }

  // ── Print Dialog ───────────────────────────────────────
  let _printDialogOpen = false;

  async function _openPrintDialog() {
    if (_printDialogOpen) return;
    _printDialogOpen = true;
    $printOverlay.classList.remove('hidden');

    // Populate printer list
    const devices = await window.electronAPI?.print?.getDevices?.() || [];
    $printDest.innerHTML = '<option value="default">Default printer</option>';
    for (const d of devices) {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name + (d.isDefault ? ' (default)' : '');
      $printDest.appendChild(opt);
    }

    // Reset to defaults
    $printCopies.value = '1';
    $printPages.value = 'all';
    $printPageRange.classList.add('hidden');
    $printLandscape.checked = false;
    $printBg.checked = true;
    $printScale.value = '100';
    $printScaleVal.textContent = '100';
  }

  function _closePrintDialog() {
    _printDialogOpen = false;
    $printOverlay.classList.add('hidden');
  }

  async function _doPrint(destination) {
    const opts = {
      destination: destination || 'printer',
      deviceName: $printDest.value === 'default' ? '' : $printDest.value,
      copies: parseInt($printCopies.value, 10) || 1,
      landscape: $printLandscape.checked,
      printBackground: $printBg.checked,
      scaleFactor: parseInt($printScale.value, 10) || 100,
      pageRange: $printPages.value === 'custom' ? $printPageRange.value : '',
    };
    _closePrintDialog();
    const result = await window.electronAPI?.print?.do?.(opts);
    if (result && !result.success && result.error !== 'Cancelled') {
      console.warn('[print] failed:', result.error);
    }
  }

  function _setupPrintDialog() {
    if (!$printOverlay) return;
    $printOverlay.addEventListener('click', (e) => { if (e.target === $printOverlay) _closePrintDialog(); });
    $printClose?.addEventListener('click', _closePrintDialog);
    $printCancel?.addEventListener('click', _closePrintDialog);
    $printGo?.addEventListener('click', () => _doPrint('printer'));
    $printSavePdf?.addEventListener('click', () => _doPrint('pdf'));
    $printPages?.addEventListener('change', () => {
      $printPageRange.classList.toggle('hidden', $printPages.value !== 'custom');
    });
    $printScale?.addEventListener('input', () => {
      $printScaleVal.textContent = $printScale.value;
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _printDialogOpen) { e.preventDefault(); _closePrintDialog(); }
    });
  }

  // ── Chat ─────────────────────────────────────────────────
  async function _sendChat() {
    const text = $chatInput.value.trim(); if (!text) return;
    chatHistory.push({ role: 'user', content: text });
    const um = document.createElement('div'); um.className = 'chat-msg user'; um.textContent = text; $chatMessages.appendChild(um);
    $chatInput.value = ''; $chatInput.style.height = 'auto'; $chatMessages.scrollTop = $chatMessages.scrollHeight;

    const am = document.createElement('div'); am.className = 'chat-msg assistant'; am.textContent = '…'; $chatMessages.appendChild(am); $chatMessages.scrollTop = $chatMessages.scrollHeight;

    const apiKey = settings.aiApiKey;
    const baseUrl = (settings.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = settings.aiModel || 'gpt-4o';
    const temp = settings.aiTemperature ?? 0.7;

    if (!apiKey) {
      am.textContent = '⚙️ Set API key in Settings → AI Configuration.';
      chatHistory.pop();
      return;
    }

    try {
      let reply = '';

      if (settings.aiProvider === 'anthropic') {
        const body = { model, max_tokens: 4096, messages: chatHistory };
        if (settings.aiSystemPrompt) body.system = settings.aiSystemPrompt;
        const res = await fetch(baseUrl.replace('/v1', '') + '/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) { am.textContent = `❌ API error: ${res.status} ${res.statusText}`; chatHistory.pop(); return; }
        const data = await res.json();
        reply = data.content?.[0]?.text || JSON.stringify(data);
      } else {
        const messages = settings.aiSystemPrompt
          ? [{ role: 'system', content: settings.aiSystemPrompt }, ...chatHistory]
          : [...chatHistory];
        const res = await fetch(baseUrl + '/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature: temp }),
        });
        if (!res.ok) { am.textContent = `❌ API error: ${res.status} ${res.statusText}`; chatHistory.pop(); return; }
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content || JSON.stringify(data);
      }

      am.textContent = reply;
      chatHistory.push({ role: 'assistant', content: reply });
    } catch (err) {
      am.textContent = '❌ ' + err.message;
      chatHistory.pop();
    }
  }

  // ── Changelog ──────────────────────────────────────────
  async function _showChangelog() {
    try {
      const data = await window.electronAPI?.changelog?.get?.();
      if (!data?.entries?.length) return;

      $changelogVersion.textContent = data.currentVersion;
      $changelogBody.innerHTML = '';

      data.entries.forEach(entry => {
        const $entry = document.createElement('div');
        $entry.className = 'changelog-entry';

        const $header = document.createElement('div');
        $header.className = 'changelog-entry-header';
        $header.innerHTML = `<span class="changelog-entry-version">v${entry.version}</span><span class="changelog-entry-date">${entry.date}</span>`;
        $entry.appendChild($header);

        if (entry.features?.length) {
          const $featTitle = document.createElement('div');
          $featTitle.className = 'changelog-section-title';
          $featTitle.textContent = '✨ Features';
          $entry.appendChild($featTitle);

          const $featList = document.createElement('ul');
          $featList.className = 'changelog-list';
          entry.features.forEach(f => {
            const $li = document.createElement('li');
            $li.textContent = f;
            $featList.appendChild($li);
          });
          $entry.appendChild($featList);
        }

        if (entry.fixes?.length) {
          const $fixTitle = document.createElement('div');
          $fixTitle.className = 'changelog-section-title';
          $fixTitle.textContent = '🔧 Fixes';
          $entry.appendChild($fixTitle);

          const $fixList = document.createElement('ul');
          $fixList.className = 'changelog-list';
          entry.fixes.forEach(f => {
            const $li = document.createElement('li');
            $li.className = 'fix';
            $li.textContent = f;
            $fixList.appendChild($li);
          });
          $entry.appendChild($fixList);
        }

        $changelogBody.appendChild($entry);
      });

      $changelogOverlay.classList.remove('hidden');
    } catch (err) {
      console.warn('[changelog] failed to load:', err.message);
    }
  }

  async function _dismissChangelog() {
    $changelogOverlay.classList.add('hidden');
    try {
      await window.electronAPI?.changelog?.dismiss?.();
    } catch {}
  }

  // ── Shortcut actions ────────────────────────────────────
  function _handleShortcut(action) {
    switch (action) {
      case 'show-omnibar':
        _showAddr();
        break;
      case 'toggle-history':
        _toggleHistory();
        break;
      case 'toggle-settings':
        _toggleSettings();
        break;
      case 'toggle-sidecar':
        _toggleSidecar('ai');
        break;
      case 'toggle-sidebar':
        _toggleSidebar();
        break;
      default:
        break;
    }
  }

  // ── Keyboard ─────────────────────────────────────────────
  function _isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  function _setupKeys() {
    document.addEventListener('keydown', (e) => {
      // F12 — toggle DevTools
      if (e.key === 'F12') { e.preventDefault(); window.electronAPI?.window?.devtools?.(); return; }
      const c = e.ctrlKey || e.metaKey;
      if (c && e.key === 'l') { e.preventDefault(); _showAddr(); }
      else if (c && e.key === 't') { e.preventDefault(); _tabs.create('about:blank'); }
      else if (c && e.key === 'w') { e.preventDefault(); const id = window.PaperTM?.getActiveTabId(); if (id) _tabs.close(id); }
      else if (c && e.key === 'h') { e.preventDefault(); _toggleHistory(); }
      else if (c && e.key === ',') { e.preventDefault(); _toggleSettings(); }
      else if (c && e.shiftKey && e.key === 'A') { e.preventDefault(); _toggleSidecar('ai'); }
      else if (c && e.key === 'b') { e.preventDefault(); _toggleSidebar(); }
      else if (c && e.key === 'Tab') { e.preventDefault(); window.PaperTM?.cycleTab(e.shiftKey ? -1 : 1); }
      // ? — toggle shortcut menu
      else if (e.key === '?' && !c && !e.altKey && !_isInputFocused()) { e.preventDefault(); _toggleShortcutMenu(); }
      // Ctrl+Shift+0 — toggle miniapps
      else if (c && e.shiftKey && e.key === '0') { e.preventDefault(); _toggleMiniapps(); }
      // Ctrl+Shift+M — cycle feature-platform modes
      else if (c && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        const modes = window.ModeManager?.MODES;
        if (!modes) return;
        const all = Object.values(modes);
        const cur = window.ModeManager?.get();
        const idx = all.indexOf(cur);
        window.ModeManager?.set(all[(idx + 1) % all.length]);
      }
      // Ctrl+Shift+E — toggle edit mode
      else if (c && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        _toggleEditMode();
      }
      // Ctrl+Shift+I — toggle inspect mode
      else if (c && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        _toggleInspectMode();
      }
      // Ctrl+Shift+K — toggle action mode
      else if (c && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        _toggleActionMode();
      }
      // Ctrl+Shift+R — toggle workflow mode
      else if (c && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        _toggleWorkflowMode();
      }
      // Ctrl+Shift+D — toggle data mode
      else if (c && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        _toggleDataMode();
      }
      // Ctrl+Shift+S — toggle sidecar shell
      else if (c && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        _toggleSidecar('shell');
      }
      // Ctrl+Shift+X — open bash canvas page
      else if (c && e.shiftKey && e.key === 'X') {
        e.preventDefault();
        window.CanvasPages?.open('bash');
      }
      // Ctrl+Shift+H — open history canvas page
      else if (c && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        window.CanvasPages?.open('history');
      }
      // Ctrl+Shift+B — open bookmarks canvas page
      else if (c && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        window.CanvasPages?.open('bookmarks');
      }
      // Ctrl+Shift+G — open agents canvas page
      else if (c && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        window.CanvasPages?.open('agents');
      }
      // Ctrl+Shift+J — open activity canvas page
      else if (c && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        window.CanvasPages?.open('activity');
      }
      // Alt+Shift+letter — open full tab pages
      else if (e.altKey && e.shiftKey && e.key === 'X') {
        e.preventDefault();
        _tabs.create('surfboard://extensions');
      }
      else if (e.altKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        _tabs.create('surfboard://agents');
      }
      else if (e.altKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        _tabs.create('surfboard://shell');
      }
      else if (e.altKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        _tabs.create('surfboard://workflows');
      }
      else if (e.altKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        _tabs.create('surfboard://links');
      }
      else if (e.altKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        _tabs.create('surfboard://cookies');
      }
      else if (e.altKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        _tabs.create('surfboard://ssh');
      }
      else if (e.altKey && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        _tabs.create('surfboard://cloud');
      }
      // Ctrl+P — print dialog
      else if (c && e.key === 'p') {
        e.preventDefault();
        _openPrintDialog();
      }
    });
  }

  // ── Data Mode ─────────────────────────────────────────
  function _toggleDataMode() {
    if (window.DataPipeline?.isEnabled()) {
      window.DataPipeline.disable();
    } else {
      const root = $newTabPage?.classList.contains('hidden') ? $app : $newTabPage;
      window.DataPipeline?.enable(root);
    }
  }

  // ── Miniapps ───────────────────────────────────────────
  let _miniappsPanelOpen = false;

  function _toggleMiniapps() {
    if (_miniappsPanelOpen) {
      window.Miniapps?.close?.();
      window.RightSidebar?.closePanel?.();
      _miniappsPanelOpen = false;
      $rsidebarMiniapps?.classList.remove('active');
      return;
    }
    const list = window.Miniapps?.getList?.() || [];
    if (list.length === 0) return;

    // Show miniapp chooser in right sidebar panel
    window.RightSidebar?.openPanel?.('miniapps', 'Miniapps');
    const panel = document.getElementById('popup-panel-content');
    if (panel) {
      panel.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'miniapp-chooser';
      list.forEach(app => {
        const btn = document.createElement('button');
        btn.className = 'miniapp-chooser-btn';
        btn.innerHTML = `<span class="miniapp-chooser-icon">${app.icon || '🧩'}</span><span class="miniapp-chooser-name">${app.name}</span>`;
        btn.addEventListener('click', () => {
          window.Miniapps.open(app.id);
          _miniappsPanelOpen = true;
          $rsidebarMiniapps?.classList.add('active');
        });
        grid.appendChild(btn);
      });
      panel.appendChild(grid);
    }
    _miniappsPanelOpen = true;
    $rsidebarMiniapps?.classList.add('active');
  }

  // ── Workflow Mode ─────────────────────────────────────
  function _toggleWorkflowMode() {
    if (window.WorkflowEngine?.isEnabled()) {
      window.WorkflowEngine.disable();
    } else {
      const root = $newTabPage?.classList.contains('hidden') ? $app : $newTabPage;
      window.WorkflowEngine?.enable(root);
    }
  }

  // ── Action Mode ───────────────────────────────────────
  function _toggleActionMode() {
    if (window.ActionRegistry?.isEnabled()) {
      window.ActionRegistry.disable();
    } else {
      const root = $newTabPage?.classList.contains('hidden') ? $app : $newTabPage;
      window.ActionRegistry?.enable(root);
    }
  }

  // ── Inspect Mode ───────────────────────────────────────
  function _toggleInspectMode() {
    if (window.Inspector?.isEnabled()) {
      window.Inspector.disable();
    } else {
      const root = $newTabPage?.classList.contains('hidden') ? $app : $newTabPage;
      window.Inspector?.enable(root);
    }
  }

  // ── Edit Mode ───────────────────────────────────────────
  function _toggleEditMode() {
    if (window.EditorEngine?.isEnabled()) {
      window.EditorEngine.disable();
    } else {
      // Enable on the content area (not sidebar)
      const root = $newTabPage?.classList.contains('hidden') ? $app : $newTabPage;
      window.EditorEngine?.enable(root);
    }
  }

  // ── Mode change toast ──────────────────────────────────
  function _showModeIndicator(mode) {
    if (!mode || mode === 'browse') return;
    _toast('Mode: ' + mode, 1200);
  }

  // ── Boot ────────────────────────────────────────────────
  async function init() {
    try { $winMin?.addEventListener('click', () => _win.minimize?.()); } catch (e) { console.warn('[init] winMin:', e.message); }
    try { $winMax?.addEventListener('click', () => _win.maximize?.()); } catch (e) { console.warn('[init] winMax:', e.message); }
    try { $winClose?.addEventListener('click', () => _win.close?.()); } catch (e) { console.warn('[init] winClose:', e.message); }
    try { $sidebarToggle?.addEventListener('click', _toggleSidebar); } catch (e) { console.warn('[init] sidebarToggle:', e.message); }
    // Right sidebar toggle
    try { document.getElementById('right-sidebar-toggle')?.addEventListener('click', () => window.RightSidebar?.toggleSidebar()); } catch (e) { console.warn('[init] rightSidebarToggle:', e.message); }
    try { $newTabBtn?.addEventListener('click', () => _tabs.create('about:blank')); } catch (e) { console.warn('[init] newTabBtn:', e.message); }
    try {
      $navBack?.addEventListener('click', () => {
        const id = window.PaperTM?.getActiveTabId();
        if (id) _tabs.goBack?.(id);
      });
      $navForward?.addEventListener('click', () => {
        const id = window.PaperTM?.getActiveTabId();
        if (id) _tabs.goForward?.(id);
      });
    } catch (e) { console.warn('[init] nav buttons:', e.message); }
    try {
      window.PaperTM?.init({ tabList: $tabList, wvContainer: $wvContainer, addrInput: $addrInput, ntp: $newTabPage, storage: _storage, tabsIPC: _tabs, minimapContainer: $minimapContainer, settings, extensions: [], profiles: [], activeProfile: 'default' });
      _tabs.onUpdated?.(async (d) => {
        window.PaperTM?.onTabsUpdated(d);
        const groups = await _tabs.groups?.();
        if (groups) window.PaperTM?.setGroups(groups);
      });
    } catch (e) { console.warn('[init] PaperTM:', e.message); }
    try {
      window.electronAPI?.on?.('app:shortcut', (_event, action) => _handleShortcut(action));
      _shell.onOutput?.((payload) => {
        if (!payload) return;
        _appendShellLine(payload.stream || 'stdout', payload.text || '');
      });
      _shell.onStatus?.((state) => {
        if (!state) return;
        shellState = { ...shellState, ...state };
        _renderShellState();
      });
      _shell.onClear?.(() => _clearShellOutput());
    } catch (e) { console.warn('[init] IPC/shell:', e.message); }

    try {
      $sidecarModeAi?.addEventListener('click', () => _setShellMode('ai'));
      $sidecarModeShell?.addEventListener('click', () => _setShellMode('shell'));
      $sidecarModeExt?.addEventListener('click', () => _setShellMode('extension'));
      $extPopupClose?.addEventListener('click', () => {
        $extPopupFrame.src = '';
        $extPopupFrame.classList.add('hidden');
        $extPopupEmpty.classList.remove('hidden');
        _setShellMode('ai');
      });
    } catch (e) { console.warn('[init] sidecar modes:', e.message); }

    // Right sidebar buttons — all use ?. in case elements are missing
    try {
      const _btns = [
        [$rsidebarAi, 'ai', () => _toggleSidecar('ai')],
        [$rsidebarShell, 'shell', () => _toggleSidecar('shell')],
        [$rsidebarEdit, 'edit', () => _toggleEditMode()],
        [$rsidebarInspect, 'inspect', () => _toggleInspectMode()],
        [$rsidebarActions, 'actions', () => _toggleActionMode()],
        [$rsidebarData, 'data', () => _toggleDataMode()],
        [$rsidebarWorkflows, 'workflows', () => _toggleWorkflowMode()],
        [$rsidebarMiniapps, 'miniapps', () => _toggleMiniapps()],
      ];
      let attached = 0;
      _btns.forEach(([el, name, fn]) => {
        if (el) { el.addEventListener('click', fn); attached++; }
        else console.warn('[init] MISSING button:', name);
      });
      console.log('[init] rsidebar buttons attached:', attached + '/8');
    } catch (e) { console.error('[init] RIGHT SIDEBAR BUTTONS FAILED:', e.message); }
    try {
      $shellRun?.addEventListener('click', _sendShellCommand);
      $shellClear?.addEventListener('click', () => _shell.clear?.());
      $shellStop?.addEventListener('click', async () => {
        if (shellState.running) {
          await _shell.stop?.();
        } else {
          await _ensureShellStarted();
        }
      });
      $shellInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          _sendShellCommand();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          _hideSidecar();
        }
      });
    } catch (e) { console.warn('[init] shell controls:', e.message); }

    try {
      $addrInput?.addEventListener('input', () => { addrActiveIdx = -1; _buildSuggestions($addrInput.value); });
      $addrInput?.addEventListener('focus', () => { if ($addrInput.value) _buildSuggestions($addrInput.value); });
      $addrInput?.addEventListener('blur', () => setTimeout(() => { if (!$addrDD?.contains(document.activeElement)) _hideSuggestions(); }, 150));
      $addrInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); _nav($addrInput.value); }
        else if (e.key === 'Escape') { e.preventDefault(); _hideAddr(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); addrActiveIdx = Math.min(addrActiveIdx + 1, suggestions.length - 1); _renderSuggestions(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); addrActiveIdx = Math.max(addrActiveIdx - 1, -1); _renderSuggestions(); }
        else if (e.key === 'Tab' && suggestions.length) { e.preventDefault(); $addrInput.value = suggestions[0].url; _hideSuggestions(); }
      });
    } catch (e) { console.warn('[init] address bar:', e.message); }

    try {
      let ntpActiveIdx = -1;
      function _ntpHideSuggestions() { $ntpDD?.classList.add('hidden'); ntpActiveIdx = -1; }
      function _ntpRenderSuggestions(items) {
        if (!$ntpList || !$ntpDD) return;
        if (!items.length) { _ntpHideSuggestions(); return; }
        $ntpList.innerHTML = '';
        items.forEach((s, i) => {
          const li = document.createElement('li');
          li.className = 'suggestion-item' + (i === ntpActiveIdx ? ' active' : '');
          li.innerHTML = `<span class="ico">${s.icon}</span><span class="txt">${s.text}</span>`;
          li.addEventListener('click', () => { $newTabInput.value = s.text; _nav(s.url); });
          $ntpList.appendChild(li);
        });
        $ntpDD.classList.remove('hidden');
      }
      async function _ntpBuildSuggestions(q) {
        if (!q) { _ntpHideSuggestions(); return; }
        q = q.toLowerCase();
        const items = [];
        historyEntries.forEach(h => {
          const title = h.title || h.url || '';
          const score = _fuzzyScore(title, q);
          if (score) items.push({ icon: '🕐', text: title, url: h.url, score });
        });
        document.querySelectorAll('.bookmark-item').forEach(el => {
          const lbl = el.querySelector('.label');
          const u = el.dataset.url;
          if (lbl && u) {
            const score = _fuzzyScore(lbl.textContent, q);
            if (score) items.push({ icon: '🔖', text: lbl.textContent, url: u, score });
          }
        });
        items.push({ icon: '🔍', text: `Search "${q}"`, url: 'https://www.google.com/search?q=' + encodeURIComponent(q), score: 0 });
        items.sort((a, b) => { if (a.icon === '🔍') return 1; if (b.icon === '🔍') return -1; return b.score - a.score; });
        _ntpRenderSuggestions(items.slice(0, 8));
      }
      $newTabInput?.addEventListener('input', () => { ntpActiveIdx = -1; _ntpBuildSuggestions($newTabInput.value); });
      $newTabInput?.addEventListener('focus', () => { if ($newTabInput.value) _ntpBuildSuggestions($newTabInput.value); });
      $newTabInput?.addEventListener('blur', () => setTimeout(_ntpHideSuggestions, 150));
      $newTabInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const items = $ntpList ? [...$ntpList.querySelectorAll('.suggestion-item')] : [];
          const active = ntpActiveIdx >= 0 && items[ntpActiveIdx];
          if (active) { active.click(); } else { _nav($newTabInput.value); }
        } else if (e.key === 'Escape') {
          e.preventDefault(); _ntpHideSuggestions();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const count = $ntpList?.children.length || 0;
          ntpActiveIdx = Math.min(ntpActiveIdx + 1, count - 1);
          _ntpBuildSuggestions($newTabInput.value);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          ntpActiveIdx = Math.max(ntpActiveIdx - 1, -1);
          _ntpBuildSuggestions($newTabInput.value);
        }
      });
      document.querySelectorAll('.new-tab-link').forEach(l => l.addEventListener('click', (e) => { e.preventDefault(); if (l.dataset.url) _nav(l.dataset.url); }));
    } catch (e) { console.warn('[init] new tab:', e.message); }

    try {
      $rsidebarOmnibar?.addEventListener('click', _showAddr);
      $rsidebarExt?.addEventListener('click', _toggleExt);
      $sidecarHdr?.addEventListener('mousedown', _startDrag);
      document.addEventListener('mousemove', _onDrag);
      document.addEventListener('mouseup', _endDrag);
      $sidecarConfig?.addEventListener('click', _openAiConfig);
      $sidecarClose?.addEventListener('click', _hideSidecar);
      $chatSend?.addEventListener('click', _sendChat);
      $chatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendChat(); } });
      $chatInput?.addEventListener('input', () => { $chatInput.style.height = 'auto'; $chatInput.style.height = Math.min($chatInput.scrollHeight, 100) + 'px'; });
      $extPanelClose?.addEventListener('click', _toggleExt);
      $sidebarHistoryBtn?.addEventListener('click', _toggleHistory);
      $sidebarSettingsBtn?.addEventListener('click', _toggleSettings);
    } catch (e) { console.warn('[init] misc listeners:', e.message); }
    // Settings page changelog link
    window.addEventListener('show-changelog', () => {
      $changelogOverlay?.classList.remove('hidden');
    });
    // Bookmark wiring
    $rsidebarBookmark?.addEventListener('click', async () => {
      const activeId = window.PaperTM?.getActiveTabId();
      if (!activeId) return;
      const wv = window.PaperTM?.getWebview(activeId);
      const url = wv?.src || '';
      const title = wv?.getTitle?.() || url;
      if (!url || url === 'about:blank') { _toast('Nothing to bookmark'); return; }
      await _storage.addBookmark?.({ label: title, url, icon: '🔖' });
      _loadBookmarks();
      _toast('Bookmarked');
    });
    $bmAddBtn?.addEventListener('click', () => _openBmDialog());
    $bmImportBtn?.addEventListener('click', _importBookmarks);
    $bmExportBtn?.addEventListener('click', _exportBookmarks);
    $bmSearch?.addEventListener('input', () => {
      const q = $bmSearch.value.toLowerCase();
      const filtered = q ? _allBookmarks.filter(b => b.label.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)) : _allBookmarks;
      _renderBookmarks(filtered);
    });
    $bmDialogSave?.addEventListener('click', _saveBmDialog);
    $bmDialogCancel?.addEventListener('click', () => $bmDialogOverlay.classList.add('hidden'));
    $bmDialogClose?.addEventListener('click', () => $bmDialogOverlay.classList.add('hidden'));
    $bmDialogOverlay?.addEventListener('click', (e) => { if (e.target === $bmDialogOverlay) $bmDialogOverlay.classList.add('hidden'); });
    $bmDialogLabel?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $bmDialogUrl.focus(); });
    $bmDialogUrl?.addEventListener('keydown', (e) => { if (e.key === 'Enter') _saveBmDialog(); });

    // Profile button
    try { $sidebarProfileBtn?.addEventListener('click', () => window.ProfilesModule?.toggleSettingsPanel()); } catch (e) { console.warn('[init] profileBtn:', e.message); }

    // Changelog wiring
    $changelogClose?.addEventListener('click', _dismissChangelog);
    $changelogDismiss?.addEventListener('click', _dismissChangelog);
    $changelogOverlay?.addEventListener('click', (e) => { if (e.target === $changelogOverlay) _dismissChangelog(); });

    _setupKeys();
    _setupShortcutOverlay();
    _setupPrintDialog();

    // Feature platform: modes + trust bootstrap
    try {
      window.ModeManager?.init?.();
      window.TrustManager?.registerDefaults?.([
        { module: 'shell', action: 'execute' },
        { module: 'editor', action: 'write' },
        { module: 'inspector', action: 'inspectDom' },
        { module: 'actions', action: 'execute' },
        { module: 'data', action: 'scrape' },
        { module: 'workflows', action: 'execute' },
        { module: 'ai', action: 'complete' },
      ]);
      window.ModeManager?.onChange?.((detail) => {
        if ($shellHint) $shellHint.textContent = 'Mode: ' + detail.to;
        _showModeIndicator(detail.to);
      });
      window.TrustManager?.onRequest?.((type, detail) => {
        if (type === 'request') {
          detail.reject(new Error('not granted'));
        }
      });
    } catch (e) { console.warn('[init] mode/trust:', e.message); }

    // Editor engine: init + ModeManager sync
    try {
      window.EditorEngine?.init?.({ root: $app });
      window.EditorEngine?.onChange?.((type) => {
        if (type === 'enabled') {
          window.ModeManager?.set(window.ModeManager.MODES.EDIT);
        } else if (type === 'disabled') {
          window.ModeManager?.set(window.ModeManager.MODES.BROWSE);
        }
      });
    } catch (e) { console.warn('[init] EditorEngine:', e.message); }

    // Inspector: init + ModeManager sync
    try {
      window.Inspector?.init?.({ root: $app });
      window.Inspector?.onChange?.((type) => {
        if (type === 'enabled') {
          window.ModeManager?.set(window.ModeManager.MODES.INSPECT);
        } else if (type === 'disabled') {
          window.ModeManager?.set(window.ModeManager.MODES.BROWSE);
        }
      });
    } catch (e) { console.warn('[init] Inspector:', e.message); }

    // ActionRegistry: init + ModeManager sync
    try {
      window.ActionRegistry?.init?.({ root: $app });
      window.ActionRegistry?.onChange?.((type) => {
        if (type === 'enabled') {
          window.ModeManager?.set(window.ModeManager.MODES.ACTION);
        } else if (type === 'disabled') {
          window.ModeManager?.set(window.ModeManager.MODES.BROWSE);
        }
      });
    } catch (e) { console.warn('[init] ActionRegistry:', e.message); }

    // WorkflowEngine: init + ModeManager sync
    try {
      window.WorkflowEngine?.init?.({ root: $app });
      window.WorkflowEngine?.onChange?.((type) => {
        if (type === 'enabled') {
          window.ModeManager?.set(window.ModeManager.MODES.RUN);
        } else if (type === 'disabled') {
          window.ModeManager?.set(window.ModeManager.MODES.BROWSE);
        }
      });
    } catch (e) { console.warn('[init] WorkflowEngine:', e.message); }

    // DataPipeline: init + ModeManager sync
    try {
      window.DataPipeline?.init?.({ root: $app });
      window.DataPipeline?.onChange?.((type) => {
        if (type === 'enabled') {
          window.ModeManager?.set(window.ModeManager.MODES.RESULT);
        } else if (type === 'disabled') {
          window.ModeManager?.set(window.ModeManager.MODES.BROWSE);
        }
      });
    } catch (e) { console.warn('[init] DataPipeline:', e.message); }

    // AIClient: init
    try { window.AIClient?.init?.({ root: $app }); } catch (e) { console.warn('[init] AIClient:', e.message); }

    // Miniapps: init
    try { window.Miniapps?.reset?.(); } catch (e) { console.warn('[init] Miniapps:', e.message); }

    // Profiles: init
    try {
      window.ProfilesModule?.init?.({
        ipc: window.electronAPI,
        toast: _toast,
        reload: async () => {
          _loadBookmarks();
          _loadExts();
          try { settings = await _storage.getSettings?.() || {}; } catch {}
          window.SettingsModule?.updateSettings?.(settings);
        },
      });
    } catch (e) { console.warn('[init] Profiles:', e.message); }

    // Canvas pages: init
    try { window.CanvasPages?.init?.(); } catch (e) { console.warn('[init] CanvasPages:', e.message); }

    _loadBookmarks(); _loadExts();

 // Refresh extension list when main process broadcasts updates (e.g. after autoLoadExtensions)
 window.electronAPI?.on?.('extensions:updated', () => _loadExts());
    try { settings = await _storage.getSettings?.() || {}; } catch {}
    // Initialize settings module
    window.SettingsModule?.init?.({ storage: _storage, settings, history: historyEntries, onOpenAiConfig: () => _setShellMode('ai') });
    if (settings.sidebarCollapsed) _setSidebar(true);
    try { shellState = await _shell.state?.() || shellState; } catch {}
    _renderShellState();

    // Show changelog if version changed
    try {
      const cl = await window.electronAPI?.changelog?.shouldShow?.();
      if (cl?.show) _showChangelog();
    } catch {}

    try { const l = await _tabs.list?.(); if (l?.length) window.PaperTM?.onTabsUpdated(l); else _tabs.create('about:blank'); }
    catch { _tabs.create('about:blank'); }
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();

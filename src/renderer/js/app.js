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
  const $bookmarks     = document.getElementById('bookmarks-list');
  const $wvContainer   = document.getElementById('webview-container');
  const $addrBar       = document.getElementById('address-bar');
  const $addrInput     = document.getElementById('address-input');
  const $addrDD        = document.getElementById('suggestions-dropdown');
  const $addrList      = document.getElementById('suggestions-list');
  const $newTabPage    = document.getElementById('new-tab-page');
  const $newTabInput   = document.getElementById('new-tab-input');
  const $island        = document.getElementById('island');
  const $islandAi      = document.getElementById('island-ai');
  const $islandShell   = document.getElementById('island-shell');
  const $islandOmnibar = document.getElementById('island-omnibar');
  const $islandExt     = document.getElementById('island-extensions');
  const $sidecar       = document.getElementById('sidecar');
  const $sidecarHdr    = document.getElementById('sidecar-header');
  const $sidecarModeAi = document.getElementById('sidecar-mode-ai');
  const $sidecarModeShell = document.getElementById('sidecar-mode-shell');
  const $shellStatus   = document.getElementById('shell-status');
  const $sidecarConfig = document.getElementById('sidecar-config-btn');
  const $sidecarClose  = document.getElementById('sidecar-close-btn');
  const $sidecarAiPanel = document.getElementById('sidecar-ai-panel');
  const $sidecarShellPanel = document.getElementById('sidecar-shell-panel');
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
  const $islandBookmark     = document.getElementById('island-bookmark');
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
    sidecarMode = mode === 'shell' ? 'shell' : 'ai';
    $sidecarModeAi?.classList.toggle('active', sidecarMode === 'ai');
    $sidecarModeShell?.classList.toggle('active', sidecarMode === 'shell');
    $sidecarAiPanel?.classList.toggle('hidden', sidecarMode !== 'ai');
    $sidecarShellPanel?.classList.toggle('hidden', sidecarMode !== 'shell');
    $islandAi.classList.toggle('active', sidecarMode === 'ai' && !$sidecar.classList.contains('sidecar-hidden'));
    $islandShell.classList.toggle('active', sidecarMode === 'shell' && !$sidecar.classList.contains('sidecar-hidden'));
    if (!$sidecar.classList.contains('sidecar-hidden')) {
      if (sidecarMode === 'shell') {
        _ensureShellStarted();
        $shellInput?.focus();
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
    $islandAi.classList.remove('active');
    $islandShell.classList.remove('active');
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

  async function _sendShellCommand() {
    const text = $shellInput.value.trim();
    if (!text) return;

    $shellInput.value = '';
    _appendShellLine('command', `› ${text}`);

    try {
      const res = await _shell.command?.(text);
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
  function _toggleExt() { $extPanel.classList.toggle('open'); $islandExt.classList.toggle('active', $extPanel.classList.contains('open')); }

  async function _loadExts() {
    try {
      const exts = await _ext.list?.() || [];
      $extList.innerHTML = '';
      if (!exts.length) { $extList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:13px">No extensions loaded</div>'; return; }
      exts.forEach(ex => {
        const el = document.createElement('div');
        el.className = 'ext-item';
        el.innerHTML = `<div class="ext-icon">${ex.icon || '🧩'}</div><div class="ext-info"><div class="ext-name">${ex.name || ex.id}</div><div class="ext-desc">${ex.description || ''}</div></div><label class="ext-toggle"><input type="checkbox" ${ex.enabled ? 'checked' : ''} data-ext-id="${ex.id}"><span class="toggle-track"></span></label>`;
        el.querySelector('input').addEventListener('change', (e) => { e.target.checked ? _ext.load(ex.path).catch(() => {}) : _ext.unload(ex.id).catch(() => {}); });
        $extList.appendChild(el);
      });
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
});

  // ── Settings ─────────────────────────────────────────────
  // Delegated to settings.js module
  function _toggleSettings() { window.SettingsModule.toggle(); }
  function _openAiConfig() { window.SettingsModule.openAiConfig(); }

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
  function _setupKeys() {
    document.addEventListener('keydown', (e) => {
      const c = e.ctrlKey || e.metaKey;
      if (c && e.key === 'l') { e.preventDefault(); _showAddr(); }
      else if (c && e.key === 't') { e.preventDefault(); _tabs.create('about:blank'); }
      else if (c && e.key === 'w') { e.preventDefault(); const id = window.PaperTM?.getActiveTabId(); if (id) _tabs.close(id); }
      else if (c && e.key === 'h') { e.preventDefault(); _toggleHistory(); }
      else if (c && e.key === ',') { e.preventDefault(); _toggleSettings(); }
      else if (c && e.shiftKey && e.key === 'A') { e.preventDefault(); _toggleSidecar('ai'); }
      else if (c && e.key === 'b') { e.preventDefault(); _toggleSidebar(); }
      else if (c && e.key === 'Tab') { e.preventDefault(); window.PaperTM?.cycleTab(e.shiftKey ? -1 : 1); }
    });
  }

  // ── Boot ────────────────────────────────────────────────
  async function init() {
    $winMin.addEventListener('click', () => _win.minimize?.());
    $winMax.addEventListener('click', () => _win.maximize?.());
    $winClose.addEventListener('click', () => _win.close?.());
    $sidebarToggle.addEventListener('click', _toggleSidebar);
    $newTabBtn.addEventListener('click', () => _tabs.create('about:blank'));
    window.PaperTM?.init({ tabList: $tabList, wvContainer: $wvContainer, addrInput: $addrInput, ntp: $newTabPage, storage: _storage, tabsIPC: _tabs, minimapContainer: $minimapContainer });
    _tabs.onUpdated?.((d) => window.PaperTM?.onTabsUpdated(d));
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

    $sidecarModeAi?.addEventListener('click', () => _setShellMode('ai'));
    $sidecarModeShell?.addEventListener('click', () => _setShellMode('shell'));
    $islandAi.addEventListener('click', () => _toggleSidecar('ai'));
    $islandShell.addEventListener('click', () => _toggleSidecar('shell'));
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

    $addrInput.addEventListener('input', () => { addrActiveIdx = -1; _buildSuggestions($addrInput.value); });
    $addrInput.addEventListener('focus', () => { if ($addrInput.value) _buildSuggestions($addrInput.value); });
    $addrInput.addEventListener('blur', () => setTimeout(() => { if (!$addrDD.contains(document.activeElement)) _hideSuggestions(); }, 150));
    $addrInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); _nav($addrInput.value); }
      else if (e.key === 'Escape') { e.preventDefault(); _hideAddr(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); addrActiveIdx = Math.min(addrActiveIdx + 1, suggestions.length - 1); _renderSuggestions(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); addrActiveIdx = Math.max(addrActiveIdx - 1, -1); _renderSuggestions(); }
      else if (e.key === 'Tab' && suggestions.length) { e.preventDefault(); $addrInput.value = suggestions[0].url; _hideSuggestions(); }
    });

    $newTabInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); _nav($newTabInput.value); } });
    document.querySelectorAll('.new-tab-link').forEach(l => l.addEventListener('click', (e) => { e.preventDefault(); if (l.dataset.url) _nav(l.dataset.url); }));

    $islandOmnibar.addEventListener('click', _showAddr);
    $islandExt.addEventListener('click', _toggleExt);
    $sidecarHdr.addEventListener('mousedown', _startDrag);
    document.addEventListener('mousemove', _onDrag);
    document.addEventListener('mouseup', _endDrag);
    $sidecarConfig.addEventListener('click', _openAiConfig);
    $sidecarClose.addEventListener('click', _hideSidecar);
    $chatSend.addEventListener('click', _sendChat);
    $chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendChat(); } });
    $chatInput.addEventListener('input', () => { $chatInput.style.height = 'auto'; $chatInput.style.height = Math.min($chatInput.scrollHeight, 100) + 'px'; });
    $extPanelClose.addEventListener('click', _toggleExt);
    $sidebarHistoryBtn.addEventListener('click', _toggleHistory);
    $sidebarSettingsBtn.addEventListener('click', _toggleSettings);
    // Bookmark wiring
    $islandBookmark?.addEventListener('click', async () => {
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
    _setupKeys();

    _loadBookmarks(); _loadExts();
    try { settings = await _storage.getSettings?.() || {}; } catch {}
    // Initialize settings module
    window.SettingsModule?.init?.({ storage: _storage, settings, history: historyEntries, onOpenAiConfig: () => _setShellMode('ai') });
    if (settings.sidebarCollapsed) _setSidebar(true);
    try { shellState = await _shell.state?.() || shellState; } catch {}
    _renderShellState();

    try { const l = await _tabs.list?.(); if (l?.length) window.PaperTM?.onTabsUpdated(l); else _tabs.create('about:blank'); }
    catch { _tabs.create('about:blank'); }
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();

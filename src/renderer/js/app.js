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

  // ── State ────────────────────────────────────────────────
  let tabs = new Map();
  let activeTabId = null;
  let suggestions = [];
  let addrActiveIdx = -1;
  let historyEntries = [];
  let settings = {};
  let sidebarCollapsed = false;
  let sidecarMode = 'ai';
  let shellState = { running: false, lastCommand: '', allowedCommands: [] };
  let dragState = null;

  // ── Webview management ──────────────────────────────────
  // One webview per tab. Active tab's webview is visible, rest hidden.
  const _wvMap = new Map();  // tabId → <webview>
  let _tabsRaf  = null;       // debounce handle for tab bar renders

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
    // Start hidden — _showActiveWebview will reveal
    wv.style.display = 'none';

    const _t = () => tabs.get(tabId);
    const _syncTab = (patch) => {
      const t = _t();
      if (!t) return;
      Object.assign(t, patch);
      _tabs.update?.(tabId, patch).catch(() => {});
      _queueTabs();
    };
    wv.addEventListener('did-start-loading',  () => { _syncTab({ loading: true }); });
    wv.addEventListener('did-stop-loading',   () => { _syncTab({ loading: false }); });
    wv.addEventListener('did-fail-load',       () => { _syncTab({ loading: false }); });
    wv.addEventListener('dom-ready', () => {
      if (!wv.dataset.registered) {
        const wcId = wv.getWebContentsId?.();
        if (wcId) {
          _tabs.registerWebview?.(tabId, wcId);
          wv.dataset.registered = '1';
        }
      }
    });
    wv.addEventListener('page-title-updated', (e) => {
      const title = e.title || 'New Tab';
      const t = _t();
      if (t && tabId === activeTabId) $addrInput.value = t.url || '';
      _syncTab({ title });
    });
    wv.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons?.[0]) _syncTab({ favicon: e.favicons[0] });
    });
    wv.addEventListener('did-navigate', (e) => {
      const t = _t(); if (!t) return;
      const url = e.url;
      if (tabId === activeTabId) $addrInput.value = url;
      _syncTab({ url });
      _updateNTP();
      if (url && url !== 'about:blank' && t.title) {
        historyEntries = historyEntries.filter(h => h.url !== url);
        historyEntries.unshift({ url, title: t.title, time: Date.now() });
        _storage.addHistoryEntry?.({ url, title: t.title }).catch(() => {});
      }
    });
    wv.addEventListener('did-navigate-in-page', (e) => {
      const url = e.url;
      if (tabId === activeTabId) $addrInput.value = url;
      _syncTab({ url });
    });
    wv.addEventListener('new-window', (e) => { e.preventDefault(); if (e.url && e.url !== 'about:blank') _tabs.create(e.url); });

    $wvContainer.appendChild(wv);
    _wvMap.set(tabId, wv);
    return wv;
  }

  function _showActiveWebview() {
    _wvMap.forEach((wv, id) => {
      wv.style.display = (id === activeTabId) ? 'flex' : 'none';
    });
  }

  // ── IPC shorthand ────────────────────────────────────────
  const _storage = window.electronAPI?.storage || {};
  const _tabs    = window.electronAPI?.tabs || {};
  const _win     = window.electronAPI?.window || {};
  const _ext     = window.electronAPI?.extensions || {};
  const _shell   = window.electronAPI?.shell || {};

  // ── Helpers ──────────────────────────────────────────────
  function _favicon(u) { try { return new URL(u).origin + '/favicon.ico'; } catch { return null; } }
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
    const wv = _wvMap.get(activeTabId);
    if (wv) { wv.src = text; _hideAddr(); return; }
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

  // ── New Tab Page ─────────────────────────────────────────
  function _showNTP() { $newTabPage.classList.remove('hidden'); }
  function _hideNTP() { $newTabPage.classList.add('hidden'); }
  function _updateNTP() {
    const t = tabs.get(activeTabId);
    (!t || t.url === 'about:blank') ? _showNTP() : _hideNTP();
  }

  // ── Tabs rendering ───────────────────────────────────────
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
    $tabList.innerHTML = '';
    const entries = Array.from(tabs.entries());
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
        if (e.target.closest('.tab-close')) { _tabs.close(tab.id); return; }
        _tabs.switch(tab.id);
      });
      $tabList.appendChild(el);
    });
  }

  function _renderWebviews() {
    // Remove closed tabs' webviews
    _wvMap.forEach((wv, id) => {
      if (!tabs.has(id)) {
        try { wv.stop(); } catch {}
        wv.remove();
        _wvMap.delete(id);
      }
    });

    // Create webview for new tabs, show active, hide rest
    tabs.forEach((tab) => {
      _ensureWebview(tab.id, tab.url);
    });
    _showActiveWebview();
  }

  function _onTabsUpdated(data) {
    const arr = Array.isArray(data) ? data : [];
    activeTabId = arr.find(t => t.active)?.id || null;
    const ids = new Set(arr.map(t => t.id));
    for (const id of tabs.keys()) if (!ids.has(id)) tabs.delete(id);
    for (const t of arr) {
      if (!tabs.has(t.id)) tabs.set(t.id, { ...t });
      else Object.assign(tabs.get(t.id), t);
    }
    _renderTabs();
    _renderWebviews();
    _updateNTP();
  }

  // ── Address Bar ──────────────────────────────────────────
  function _showAddr() { $addrBar.classList.remove('hidden'); $addrInput.focus(); $addrInput.select(); if ($addrInput.value) _buildSuggestions($addrInput.value); }
  function _hideAddr() { $addrBar.classList.add('hidden'); $addrInput.blur(); _hideSuggestions(); }
  function _hideSuggestions() { $addrDD.classList.add('hidden'); suggestions = []; addrActiveIdx = -1; }

  function _buildSuggestions(q) {
    if (!q) { _hideSuggestions(); return; }
    q = q.toLowerCase();
    const items = [];
    historyEntries.forEach(h => { if (h.title?.toLowerCase().includes(q) || h.url?.toLowerCase().includes(q)) items.push({ icon: '🕐', text: h.title || h.url, url: h.url }); });
    document.querySelectorAll('.bookmark-item').forEach(el => {
      const lbl = el.querySelector('.label');
      if (lbl && lbl.textContent.toLowerCase().includes(q)) { const u = el.dataset.url; if (u) items.push({ icon: '🔖', text: lbl.textContent, url: u }); }
    });
    items.push({ icon: '🔍', text: `Search "${q}"`, url: 'https://www.google.com/search?q=' + encodeURIComponent(q) });
    suggestions = items.slice(0, 8);
    _renderSuggestions();
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

  // ── Bookmarks / History ──────────────────────────────────
  async function _loadBookmarks() {
    try {
      const bms = await _storage.getBookmarks?.() || [];
      $bookmarks.innerHTML = '';
      if (!bms.length) { $bookmarks.innerHTML = '<div style="padding:12px;color:var(--text-faint);font-size:12px;text-align:center">No bookmarks</div>'; return; }
      bms.forEach(bm => {
        const el = document.createElement('div');
        el.className = 'bookmark-item'; el.dataset.url = bm.url;
        el.innerHTML = `<span class="icon">${bm.icon || '🔖'}</span><span class="label">${bm.label}</span>`;
        el.addEventListener('click', () => _tabs.create(bm.url));
        $bookmarks.appendChild(el);
      });
    } catch {}
  }

  async function _toggleHistory() {
    try { const e = await (_storage.getHistory?.(30) || Promise.resolve([])).catch(() => []); if (e.length) historyEntries = e; } catch {}
    if ($bookmarks.dataset.mode === 'history') { delete $bookmarks.dataset.mode; _loadBookmarks(); return; }
    $bookmarks.dataset.mode = 'history';
    $bookmarks.innerHTML = '';
    if (!historyEntries.length) { $bookmarks.innerHTML = '<div style="padding:12px;color:var(--text-faint);font-size:12px;text-align:center">No history</div>'; return; }
    historyEntries.slice(0, 30).forEach(h => {
      const el = document.createElement('div');
      el.className = 'bookmark-item';
      el.innerHTML = `<span class="icon">🕐</span><span class="label">${h.title || h.url}</span><span style="font-size:10px;color:var(--text-faint);margin-left:auto">${_fmtTime(h.time)}</span>`;
      el.addEventListener('click', () => _tabs.create(h.url));
      $bookmarks.appendChild(el);
    });
  }

  // ── Settings ─────────────────────────────────────────────
  let $settingsOv = null;
  const THEMES = [
    { id: 'dark', bg: '#141416', surface: '#1a1a1e', accent: '#60a5fa' },
    { id: 'nord', bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0' },
    { id: 'drac', bg: '#282a36', surface: '#44475a', accent: '#bd93f9' },
    { id: 'gruv', bg: '#282828', surface: '#3c3836', accent: '#fabd2f' },
    { id: 'pard', bg: '#1e1e2e', surface: '#313244', accent: '#cba6f7' },
  ];
  const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));

  function _applyTheme(id) {
    const t = THEME_BY_ID[id] || THEME_BY_ID.dark;
    const r = document.documentElement.style;
    r.setProperty('--bg', t.bg); r.setProperty('--surface', t.surface); r.setProperty('--accent', t.accent);
    settings.theme = id; _storage.updateSettings?.({ theme: id });
  }

  function _buildSettings() {
    $settingsOv = document.createElement('div');
    $settingsOv.className = 'settings-overlay';
    $settingsOv.innerHTML = `<div class="settings-panel"><div class="settings-header"><h2>⚙️ Settings</h2><button class="settings-close no-drag">✕</button></div><div class="settings-body"><div class="settings-section"><div class="settings-section-title">Search</div><div class="settings-row"><div class="settings-label">Default Engine</div><select id="set-se" class="settings-select no-drag"><option value="google">Google</option><option value="ddg">DuckDuckGo</option><option value="brave">Brave</option></select></div></div><div class="settings-section"><div class="settings-section-title">Appearance</div><div class="settings-row"><div class="settings-label">Theme</div></div><div id="set-themes" class="theme-swatches"></div></div><div class="settings-section"><div class="settings-section-title" style="color:var(--accent)">AI Configuration</div><div class="ai-config-row"><label>Provider</label><select id="set-ai-provider" class="settings-select no-drag"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="ollama">Ollama</option><option value="custom">Custom / Other</option></select></div><div class="ai-config-row"><label>API Key</label><input id="set-ai-key" type="password" class="settings-input no-drag" placeholder="sk-..."><div class="ai-config-hint">Stored locally, never sent anywhere except your chosen API endpoint.</div></div><div class="ai-config-row"><label>Base URL <small>(leave blank for default)</small></label><input id="set-ai-baseurl" type="text" class="settings-input no-drag" placeholder="https://api.openai.com/v1"><div class="ai-config-hint">Override for Ollama, proxies, or compatible APIs.</div></div><div class="ai-config-row"><label>Model</label><input id="set-ai-model" type="text" class="settings-input no-drag" placeholder="gpt-4o"></div><div class="ai-config-row"><label>System Prompt</label><textarea id="set-ai-sysprompt" class="settings-textarea no-drag" placeholder="You are a helpful assistant..."></textarea></div><div class="ai-config-row"><div class="settings-label">Temperature <span id="set-ai-temp-val" style="color:var(--text-dim);font-size:11px;margin-left:4px">0.7</span></div><input id="set-ai-temp" type="range" min="0" max="2" step="0.1" value="0.7" style="min-width:200px"></div></div><div class="settings-section"><div class="settings-section-title" style="color:var(--danger)">Danger Zone</div><div class="settings-danger"><div class="settings-row"><div class="settings-label">Clear history</div><button id="set-clear-hist" class="btn-danger no-drag">Clear</button></div><div class="settings-row"><div class="settings-label">Reset all data</div><button id="set-clear-all" class="btn-danger no-drag">Reset</button></div></div></div></div></div>`;
    $app.appendChild($settingsOv);
    $settingsOv.querySelector('.settings-close').addEventListener('click', () => $settingsOv.classList.add('hidden'));
    $settingsOv.addEventListener('click', (e) => { if (e.target === $settingsOv) $settingsOv.classList.add('hidden'); });
    $settingsOv.querySelector('#set-se').addEventListener('change', (e) => _storage.updateSettings?.({ searchEngine: e.target.value }));
    const aiIds = { aiProvider: 'set-ai-provider', aiApiKey: 'set-ai-key', aiBaseUrl: 'set-ai-baseurl', aiModel: 'set-ai-model', aiSystemPrompt: 'set-ai-sysprompt' };
    Object.entries(aiIds).forEach(([f, id]) => { const el = $settingsOv.querySelector('#' + id); if (el) el.addEventListener('change', () => _storage.updateSettings?.({ [f]: el.type === 'checkbox' ? el.checked : el.value })); });
    const $tmp = $settingsOv.querySelector('#set-ai-temp'), $tmpV = $settingsOv.querySelector('#set-ai-temp-val');
    if ($tmp) { $tmp.addEventListener('input', () => { $tmpV.textContent = $tmp.value; }); $tmp.addEventListener('change', () => { _storage.updateSettings?.({ aiTemperature: parseFloat($tmp.value) }); }); }
    $settingsOv.querySelector('#set-clear-hist').addEventListener('click', async () => { if (!confirm('Clear all history?')) return; await _storage.clearHistory?.(); historyEntries = []; });
    $settingsOv.querySelector('#set-clear-all').addEventListener('click', async () => { if (!confirm('Reset all data?')) return; await _storage.clearHistory?.(); await _storage.updateSettings?.({ searchEngine: 'google', theme: 'dark' }); historyEntries = []; _applyTheme('dark'); $settingsOv.classList.add('hidden'); });
    const $sw = $settingsOv.querySelector('#set-themes');
    THEMES.forEach(t => {
      const el = document.createElement('div');
      el.className = 'theme-swatch' + (t.id === (settings.theme || 'dark') ? ' active' : '');
      el.style.background = `linear-gradient(135deg,${t.bg},${t.surface})`; el.style.color = t.accent; el.title = t.id;
      el.innerHTML = '<span class="check">✓</span>';
      el.addEventListener('click', () => { _applyTheme(t.id); $sw.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); });
      $sw.appendChild(el);
    });
  }

  function _populateAi() {
    if (!$settingsOv) return;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
    s('set-ai-provider', settings.aiProvider); s('set-ai-key', settings.aiApiKey); s('set-ai-baseurl', settings.aiBaseUrl);
    s('set-ai-model', settings.aiModel); s('set-ai-sysprompt', settings.aiSystemPrompt);
    const $t = document.getElementById('set-ai-temp'), $tV = document.getElementById('set-ai-temp-val');
    if ($t) { $t.value = settings.aiTemperature ?? 0.7; if ($tV) $tV.textContent = $t.value; }
  }

  function _toggleSettings() {
    if (!$settingsOv) _buildSettings();
    if ($settingsOv.classList.contains('hidden')) { $settingsOv.classList.remove('hidden'); $settingsOv.querySelector('#set-se').value = settings.searchEngine || 'google'; _populateAi(); }
    else $settingsOv.classList.add('hidden');
  }

  function _openAiConfig() {
    if (!$settingsOv) _buildSettings();
    _setShellMode('ai');
    $settingsOv.classList.remove('hidden');
    $settingsOv.querySelector('#set-se').value = settings.searchEngine || 'google';
    _populateAi();
    $settingsOv.querySelector('.settings-section:nth-child(3)')?.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Chat ─────────────────────────────────────────────────
  function _sendChat() {
    const text = $chatInput.value.trim(); if (!text) return;
    const um = document.createElement('div'); um.className = 'chat-msg user'; um.textContent = text; $chatMessages.appendChild(um);
    $chatInput.value = ''; $chatInput.style.height = 'auto'; $chatMessages.scrollTop = $chatMessages.scrollHeight;
    const am = document.createElement('div'); am.className = 'chat-msg assistant'; am.textContent = '⚙️ AI not configured. Open Settings → AI Configuration to set up your API key and model.'; $chatMessages.appendChild(am); $chatMessages.scrollTop = $chatMessages.scrollHeight;
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
      else if (c && e.key === 'w') { e.preventDefault(); if (activeTabId) _tabs.close(activeTabId); }
      else if (c && e.key === 'h') { e.preventDefault(); _toggleHistory(); }
      else if (c && e.key === ',') { e.preventDefault(); _toggleSettings(); }
      else if (c && e.shiftKey && e.key === 'A') { e.preventDefault(); _toggleSidecar('ai'); }
      else if (c && e.key === 'b') { e.preventDefault(); _toggleSidebar(); }
    });
  }

  // ── Boot ────────────────────────────────────────────────
  async function init() {
    $winMin.addEventListener('click', () => _win.minimize?.());
    $winMax.addEventListener('click', () => _win.maximize?.());
    $winClose.addEventListener('click', () => _win.close?.());
    $sidebarToggle.addEventListener('click', _toggleSidebar);
    $newTabBtn.addEventListener('click', () => _tabs.create('about:blank'));
    _tabs.onUpdated?.((d) => _onTabsUpdated(d));
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
    _setupKeys();

    _loadBookmarks(); _loadExts();
    try { settings = await _storage.getSettings?.() || {}; } catch {}
    if (settings.theme) _applyTheme(settings.theme);
    if (settings.sidebarCollapsed) _setSidebar(true);
    try { shellState = await _shell.state?.() || shellState; } catch {}
    _renderShellState();

    try { const l = await _tabs.list?.(); if (l?.length) _onTabsUpdated(l); else _tabs.create('about:blank'); }
    catch { _tabs.create('about:blank'); }
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();

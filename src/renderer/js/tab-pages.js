/**
 * Tab Pages — Full-tab internal pages for extensions, AI agents, shell, workflows.
 *
 * Each page opens as surfboard://<id> in a dedicated tab, similar to settings.
 * Pages are self-contained with their own sidebar navigation and content panels.
 */
(function () {
  'use strict';

  // ── Page registry ────────────────────────────────────────
  const PAGES = [
    { id: 'extensions', icon: '🧩', label: 'Extensions' },
    { id: 'agents', icon: '🤖', label: 'AI Agents' },
    { id: 'shell', icon: '💻', label: 'Shell' },
    { id: 'workflows', icon: '⚡', label: 'Workflows' },
    { id: 'links', icon: '🔗', label: 'Links' },
    { id: 'cookies', icon: '🍪', label: 'Cookies' },
    { id: 'ssh', icon: '🔐', label: 'SSH' },
    { id: 'cloud', icon: '☁️', label: 'Cloud' },
  ];
  const CLOUD_PROVIDERS = [
    { id: 'github', icon: '🐙', label: 'GitHub Codespaces' },
    { id: 'replit', icon: '🟧', label: 'Replit' },
    { id: 'gitpod', icon: '🟢', label: 'Gitpod' },
  ];

  let $container = null;
  let $activePage = null;
  let _unsubFns = [];

  function html(strings, ...values) {
    return strings.reduce((result, str, i) => result + str + (values[i] ?? ''), '');
  }

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ── Extensions page ──────────────────────────────────────
  function buildExtensionsPage(extensions) {
    const exts = extensions || [];
    return html`
      <div class="tp-page" data-page="extensions">
        <div class="tp-page-header">
          <h1 class="tp-page-title">🧩 Extensions</h1>
          <p class="tp-page-desc">Manage installed extensions, view permissions, and configure settings.</p>
        </div>

        <div class="tp-card-grid">
          ${exts.length === 0 ? `
            <div class="tp-empty">
              <div class="tp-empty-icon">🧩</div>
              <div class="tp-empty-text">No extensions installed</div>
              <button class="tp-btn tp-btn-primary" id="tp-ext-browse">Browse Extensions</button>
            </div>
          ` : exts.map(ex => `
            <div class="tp-card" data-ext-id="${_esc(ex.id)}">
              <div class="tp-card-header">
                ${ex.icon ? `<img class="tp-card-icon" src="${_esc(ex.icon)}" alt=""/>` : `<div class="tp-card-icon tp-card-icon-placeholder">🧩</div>`}
                <div class="tp-card-info">
                  <div class="tp-card-title">${_esc(ex.name || ex.id)}</div>
                  <div class="tp-card-meta">${_esc(ex.version || '')}${ex.enabled === false ? ' · <span class="tp-badge tp-badge-warn">Disabled</span>' : ''}</div>
                </div>
                <label class="tp-toggle">
                  <input type="checkbox" ${ex.enabled !== false ? 'checked' : ''} data-ext-toggle="${_esc(ex.id)}" />
                  <span class="tp-toggle-track"></span>
                </label>
              </div>
              ${ex.description ? `<div class="tp-card-desc">${_esc(ex.description)}</div>` : ''}
              <div class="tp-card-actions">
                ${ex.popupUrl ? `<button class="tp-btn tp-btn-sm" data-ext-popup="${_esc(ex.popupUrl)}">Popup</button>` : ''}
                ${ex.optionsUrl ? `<button class="tp-btn tp-btn-sm" data-ext-options="${_esc(ex.optionsUrl)}">Options</button>` : ''}
                <button class="tp-btn tp-btn-sm tp-btn-danger" data-ext-remove="${_esc(ex.id)}">Remove</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ── AI Agents page ───────────────────────────────────────
  function buildAgentsPage() {
    return html`
      <div class="tp-page" data-page="agents">
        <div class="tp-page-header">
          <h1 class="tp-page-title">🤖 AI Agents</h1>
          <p class="tp-page-desc">Manage AI agent sessions, configure providers, and browse conversation history.</p>
        </div>

        <div class="tp-agents-layout">
          <div class="tp-agents-sidebar">
            <div class="tp-agents-sidebar-header">
              <span>Sessions</span>
              <button class="tp-btn tp-btn-sm tp-btn-primary" id="tp-agent-new">+ New</button>
            </div>
            <div class="tp-agent-list" id="tp-agent-list">
              <div class="tp-agent-item active">
                <span class="tp-agent-icon">💬</span>
                <span class="tp-agent-name">New Chat</span>
              </div>
            </div>
          </div>
          <div class="tp-agents-main">
            <div class="tp-agent-messages" id="tp-agent-messages">
              <div class="tp-empty">
                <div class="tp-empty-icon">🤖</div>
                <div class="tp-empty-text">Start a conversation</div>
                <div class="tp-empty-hint">Type a message below to begin chatting with your AI assistant.</div>
              </div>
            </div>
            <div class="tp-agent-input-wrap">
              <textarea id="tp-agent-input" placeholder="Ask anything…" rows="1"></textarea>
              <button id="tp-agent-send" class="tp-btn tp-btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Shell page ───────────────────────────────────────────
  function buildShellPage() {
    return html`
      <div class="tp-page" data-page="shell">
        <div class="tp-page-header">
          <h1 class="tp-page-title">💻 Shell</h1>
          <p class="tp-page-desc">Integrated terminal with allowlisted host commands. Output streams from bash.</p>
        </div>

        <div class="tp-shell-layout">
          <div class="tp-shell-output" id="tp-shell-output">
            <div class="tp-shell-welcome">
              <div class="tp-shell-welcome-text">RicedChromium Shell v0.2.0</div>
              <div class="tp-shell-welcome-hint">Type a command and press Enter. Only allowlisted commands are permitted.</div>
            </div>
          </div>
          <div class="tp-shell-input-wrap">
            <span class="tp-shell-prompt">›</span>
            <input id="tp-shell-input" type="text" placeholder="Allowlisted command…" autocomplete="off" spellcheck="false" />
            <button id="tp-shell-run" class="tp-btn tp-btn-primary tp-btn-sm">Run</button>
          </div>
          <div class="tp-shell-actions">
            <button id="tp-shell-clear" class="tp-btn tp-btn-sm">Clear</button>
            <button id="tp-shell-stop" class="tp-btn tp-btn-sm tp-btn-danger">Stop</button>
            <span id="tp-shell-status" class="tp-shell-status">idle</span>
          </div>
        </div>
      </div>
    `;
  }

  // ── Workflows page ───────────────────────────────────────
  function buildWorkflowsPage() {
    return html`
      <div class="tp-page" data-page="workflows">
        <div class="tp-page-header">
          <h1 class="tp-page-title">⚡ Workflows</h1>
          <p class="tp-page-desc">Create, manage, and run automated workflows. Chain actions together to automate repetitive tasks.</p>
        </div>

        <div class="tp-workflows-layout">
          <div class="tp-workflows-sidebar">
            <div class="tp-workflows-sidebar-header">
              <span>Workflows</span>
              <button class="tp-btn tp-btn-sm tp-btn-primary" id="tp-wf-new">+ New</button>
            </div>
            <div class="tp-wf-list" id="tp-wf-list">
              <div class="tp-empty" style="padding:20px">
                <div class="tp-empty-text">No workflows yet</div>
              </div>
            </div>
          </div>
          <div class="tp-workflows-main">
            <div class="tp-empty">
              <div class="tp-empty-icon">⚡</div>
              <div class="tp-empty-text">No workflow selected</div>
              <div class="tp-empty-hint">Create a new workflow or select one from the sidebar.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Page builder dispatch ────────────────────────────────
  function buildPage(pageId, data) {
    switch (pageId) {
      case 'extensions': return buildExtensionsPage(data?.extensions);
      case 'agents':     return buildAgentsPage();
      case 'shell':      return buildShellPage();
      case 'workflows':  return buildWorkflowsPage();
      case 'links':      return buildLinksPage(data?.bookmarks);
      case 'cookies':    return buildCookiesPage(data?.cookies);
      case 'ssh':         return buildSSHPage(data?.sshConnections, data?.sshState, data?.sshEnvironments);
      case 'cloud':       return buildCloudPage(data?.cloudStatus, data?.cloudWorkspaces);
      default:           return '<div class="tp-empty"><div class="tp-empty-text">Page not found</div></div>';
    }
  }

  // ── Event binding ────────────────────────────────────────
  function bindEvents(pageId) {
    // Clean up previous listeners
    _unsubFns.forEach(fn => fn());
    _unsubFns = [];

    if (pageId === 'extensions') {
      bindExtensionsEvents();
    } else if (pageId === 'agents') {
      bindAgentsEvents();
    } else if (pageId === 'shell') {
      bindShellEvents();
    } else if (pageId === 'workflows') {
      bindWorkflowsEvents();
    } else if (pageId === 'links') {
      bindLinksEvents();
    } else if (pageId === 'cookies') {
      bindCookiesEvents();
    } else if (pageId === 'ssh') {
      bindSSHEvents();
    } else if (pageId === 'cloud') {
      bindCloudEvents();
    }
  }

  function bindExtensionsEvents() {
    // Toggle
    $container.querySelectorAll('[data-ext-toggle]').forEach(input => {
      input.addEventListener('change', (e) => {
        const extId = e.target.dataset.extToggle;
        if (e.target.checked) {
          window.electronAPI?.extensions?.load?.(extId);
        } else {
          window.electronAPI?.extensions?.unload?.(extId);
        }
      });
    });

    // Popup links
    $container.querySelectorAll('[data-ext-popup]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.electronAPI?.tabs?.create(btn.dataset.extPopup);
      });
    });

    // Options links
    $container.querySelectorAll('[data-ext-options]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.electronAPI?.tabs?.create(btn.dataset.extOptions);
      });
    });

    // Remove
    $container.querySelectorAll('[data-ext-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const extId = btn.dataset.extRemove;
        if (confirm(`Remove extension "${extId}"?`)) {
          window.electronAPI?.extensions?.unload?.(extId);
          btn.closest('.tp-card')?.remove();
        }
      });
    });

    // Browse
    const browseBtn = $container.querySelector('#tp-ext-browse');
    if (browseBtn) {
      browseBtn.addEventListener('click', () => {
        window.electronAPI?.tabs?.create('https://chrome.google.com/webstore');
      });
    }
  }

  function bindAgentsEvents() {
    const input = $container.querySelector('#tp-agent-input');
    const send = $container.querySelector('#tp-agent-send');
    const messages = $container.querySelector('#tp-agent-messages');
    const newBtn = $container.querySelector('#tp-agent-new');

    function appendMessage(role, text) {
      const msg = document.createElement('div');
      msg.className = `tp-agent-msg tp-agent-msg-${role}`;
      msg.innerHTML = `<span class="tp-agent-msg-role">${role === 'user' ? '👤' : '🤖'}</span><span class="tp-agent-msg-text">${_esc(text)}</span>`;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    }

    async function sendAgentMessage() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      input.style.height = 'auto';
      appendMessage('user', text);

      const am = document.createElement('div');
      am.className = 'tp-agent-msg tp-agent-msg-assistant';
      am.innerHTML = '<span class="tp-agent-msg-role">🤖</span><span class="tp-agent-msg-text">…</span>';
      messages.appendChild(am);
      messages.scrollTop = messages.scrollHeight;

      // Delegate to the existing chat system
      try {
        const settings = await window.electronAPI?.storage?.getSettings?.();
        if (!settings?.aiApiKey) {
          am.querySelector('.tp-agent-msg-text').textContent = '⚙️ Set API key in Settings → AI Configuration.';
          return;
        }
        // Use the existing chat send mechanism
        if (window.electronAPI?.chat) {
          const reply = await window.electronAPI.chat.send(text, settings);
          am.querySelector('.tp-agent-msg-text').textContent = reply || 'No response';
        } else {
          am.querySelector('.tp-agent-msg-text').textContent = 'Chat API not available. Use the AI Sidecar (Ctrl+Shift+A).';
        }
      } catch (err) {
        am.querySelector('.tp-agent-msg-text').textContent = '❌ ' + (err.message || 'Error');
      }
    }

    send?.addEventListener('click', sendAgentMessage);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAgentMessage(); }
    });
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    newBtn?.addEventListener('click', () => {
      messages.innerHTML = '';
      input?.focus();
    });
  }

  function bindShellEvents() {
    const input = $container.querySelector('#tp-shell-input');
    const run = $container.querySelector('#tp-shell-run');
    const clear = $container.querySelector('#tp-shell-clear');
    const stop = $container.querySelector('#tp-shell-stop');
    const output = $container.querySelector('#tp-shell-output');
    const status = $container.querySelector('#tp-shell-status');

    function appendLine(stream, text) {
      const line = document.createElement('div');
      line.className = `tp-shell-line tp-shell-${stream}`;
      line.textContent = text;
      output.appendChild(line);
      while (output.childNodes.length > 500) output.removeChild(output.firstChild);
      output.scrollTop = output.scrollHeight;
    }

    function runCommand() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      appendLine('command', `› ${text}`);
      try {
        const res = window.electronAPI?.shell?.command?.(text);
        if (!res?.ok) {
          appendLine('stderr', res?.error || 'Command blocked');
        }
      } catch (err) {
        appendLine('stderr', err.message || 'Shell command failed');
      }
    }

    run?.addEventListener('click', runCommand);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runCommand(); }
    });
    clear?.addEventListener('click', () => {
      output.innerHTML = '';
      window.electronAPI?.shell?.clear?.();
    });
    stop?.addEventListener('click', async () => {
      if (status?.textContent === 'running') {
        await window.electronAPI?.shell?.stop?.();
        if (status) status.textContent = 'idle';
      } else {
        try {
          await window.electronAPI?.shell?.start?.();
          if (status) status.textContent = 'running';
        } catch (err) {
          appendLine('stderr', `[shell] ${err.message}`);
        }
      }
    });

    // Listen for shell output
    const unsub = window.electronAPI?.shell?.onOutput?.((payload) => {
      if (payload) appendLine(payload.stream || 'stdout', payload.text || '');
    });
    if (unsub) _unsubFns.push(unsub);

    const unsubStatus = window.electronAPI?.shell?.onStatus?.((state) => {
      if (status && state) status.textContent = state.running ? 'running' : 'idle';
    });
    if (unsubStatus) _unsubFns.push(unsubStatus);
  }

  function bindWorkflowsEvents() {
    const newBtn = $container.querySelector('#tp-wf-new');
    const wfList = $container.querySelector('#tp-wf-list');
    const main = $container.querySelector('.tp-workflows-main');

    newBtn?.addEventListener('click', () => {
      // Create a new empty workflow editor
      main.innerHTML = `
        <div class="tp-wf-editor">
          <div class="tp-wf-editor-header">
            <input id="tp-wf-name" class="tp-input" placeholder="Workflow name…" />
            <button id="tp-wf-save" class="tp-btn tp-btn-primary tp-btn-sm">Save</button>
          </div>
          <div class="tp-wf-editor-hint">Add steps to your workflow. Each step is an action that runs in sequence.</div>
          <div class="tp-wf-steps" id="tp-wf-steps"></div>
          <button id="tp-wf-add-step" class="tp-btn tp-btn-sm">+ Add Step</button>
        </div>
      `;

      const steps = main.querySelector('#tp-wf-steps');
      main.querySelector('#tp-wf-add-step')?.addEventListener('click', () => {
        const step = document.createElement('div');
        step.className = 'tp-wf-step';
        step.innerHTML = `
          <span class="tp-wf-step-num">${steps.children.length + 1}</span>
          <input class="tp-input tp-wf-step-action" placeholder="Action (e.g., navigate, click, type)…" />
          <input class="tp-input tp-wf-step-target" placeholder="Target (selector, URL, text)…" />
          <button class="tp-btn tp-btn-sm tp-btn-danger tp-wf-step-remove">✕</button>
        `;
        step.querySelector('.tp-wf-step-remove')?.addEventListener('click', () => step.remove());
        steps.appendChild(step);
      });

      main.querySelector('#tp-wf-save')?.addEventListener('click', () => {
        const name = main.querySelector('#tp-wf-name')?.value.trim() || 'Untitled';
        // Add to sidebar list
        if (wfList && wfList.querySelector('.tp-empty')) {
          wfList.innerHTML = '';
        }
        const item = document.createElement('div');
        item.className = 'tp-wf-item active';
        item.innerHTML = `<span class="tp-wf-icon">⚡</span><span class="tp-wf-name">${_esc(name)}</span>`;
        wfList?.appendChild(item);
        // Show saved state
        main.innerHTML = `<div class="tp-empty"><div class="tp-empty-icon">✅</div><div class="tp-empty-text">Workflow "${_esc(name)}" saved</div></div>`;
      });
    });
  }

  // ── Links page ───────────────────────────────────────────
  function buildLinksPage(bookmarks) {
    const bms = bookmarks || [];
    // Group by folder
    const folders = {};
    for (const bm of bms) {
      const f = bm.folder || 'Unsorted';
      if (!folders[f]) folders[f] = [];
      folders[f].push(bm);
    }
    const folderNames = Object.keys(folders).sort();

    return html`
      <div class="tp-page" data-page="links">
        <div class="tp-page-header">
          <h1 class="tp-page-title">🔗 Links</h1>
          <p class="tp-page-desc">Saved bookmarks organized by collection. Click to open, right-click to edit.</p>
        </div>

        <div class="tp-links-toolbar">
          <input class="tp-input tp-links-search" id="tp-links-search" placeholder="Search links…" />
          <button class="tp-btn tp-btn-primary" id="tp-links-add">+ Add Link</button>
          <button class="tp-btn" id="tp-links-import">Import</button>
          <button class="tp-btn" id="tp-links-export">Export</button>
        </div>

        ${bms.length === 0 ? `
          <div class="tp-empty">
            <div class="tp-empty-icon">🔗</div>
            <div class="tp-empty-text">No saved links yet</div>
            <div class="tp-empty-hint">Bookmark pages with Ctrl+D or use the sidebar bookmark button</div>
          </div>
        ` : folderNames.map(folder => `
          <div class="tp-links-folder" data-folder="${_esc(folder)}">
            <div class="tp-links-folder-header">
              <span class="tp-links-folder-icon">📁</span>
              <span class="tp-links-folder-name">${_esc(folder)}</span>
              <span class="tp-links-folder-count">${folders[folder].length}</span>
            </div>
            <div class="tp-links-grid">
              ${folders[folder].map(bm => `
                <div class="tp-links-card" data-bm-id="${_esc(bm.id)}" data-bm-url="${_esc(bm.url)}">
                  <div class="tp-links-card-icon">🌐</div>
                  <div class="tp-links-card-body">
                    <div class="tp-links-card-title">${_esc(bm.label || bm.url)}</div>
                    <div class="tp-links-card-url">${_esc(bm.url)}</div>
                  </div>
                  <div class="tp-links-card-actions">
                    <button class="tp-btn tp-btn-sm tp-links-edit" data-bm-edit="${_esc(bm.id)}">✏️</button>
                    <button class="tp-btn tp-btn-sm tp-btn-danger tp-links-delete" data-bm-delete="${_esc(bm.id)}">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindLinksEvents() {
    if (!$container) return;
    const main = $container.querySelector('.tp-content');
    if (!main) return;

    // Search filter
    main.querySelector('#tp-links-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      main.querySelectorAll('.tp-links-card').forEach(card => {
        const title = (card.querySelector('.tp-links-card-title')?.textContent || '').toLowerCase();
        const url = (card.dataset.bmUrl || '').toLowerCase();
        card.style.display = (title.includes(q) || url.includes(q)) ? '' : 'none';
      });
      // Show/hide empty folders
      main.querySelectorAll('.tp-links-folder').forEach(folder => {
        const visible = folder.querySelectorAll('.tp-links-card:not([style*="display: none"])').length;
        folder.style.display = visible > 0 ? '' : 'none';
      });
    });

    // Click card to open URL
    main.querySelectorAll('.tp-links-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.tp-links-edit') || e.target.closest('.tp-links-delete')) return;
        const url = card.dataset.bmUrl;
        if (url) window.electronAPI?.tabs?.create?.(url);
      });
    });

    // Delete bookmark
    main.querySelectorAll('[data-bm-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.bmDelete;
        if (!id) return;
        await window.electronAPI?.storage?.removeBookmark?.(id);
        // Re-fetch and re-render
        try {
          const bms = await window.electronAPI?.storage?.getBookmarks?.() || [];
          const page = main.querySelector('[data-page="links"]');
          if (page) page.outerHTML = buildLinksPage(bms);
          bindLinksEvents();
        } catch { /* */ }
      });
    });

    // Edit bookmark (inline rename)
    main.querySelectorAll('[data-bm-edit]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.bmEdit;
        const card = btn.closest('.tp-links-card');
        if (!id || !card) return;
        const titleEl = card.querySelector('.tp-links-card-title');
        const currentLabel = titleEl?.textContent || '';
        const newLabel = prompt('Rename bookmark:', currentLabel);
        if (newLabel && newLabel !== currentLabel) {
          await window.electronAPI?.storage?.updateBookmark?.(id, { label: newLabel });
          if (titleEl) titleEl.textContent = newLabel;
        }
      });
    });

    // Add link
    main.querySelector('#tp-links-add')?.addEventListener('click', async () => {
      const url = prompt('URL:');
      if (!url) return;
      const label = prompt('Label:', url);
      await window.electronAPI?.storage?.addBookmark?.({ url, label: label || url, folder: 'Bookmarks Bar' });
      // Re-render
      try {
        const bms = await window.electronAPI?.storage?.getBookmarks?.() || [];
        const page = main.querySelector('[data-page="links"]');
        if (page) page.outerHTML = buildLinksPage(bms);
        bindLinksEvents();
      } catch { /* */ }
    });

    // Export bookmarks
    main.querySelector('#tp-links-export')?.addEventListener('click', async () => {
      const bms = await window.electronAPI?.storage?.getBookmarks?.() || [];
      if (!bms.length) return;
      let html_content = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
      bms.forEach(bm => { html_content += `  <DT><A HREF="${bm.url}">${bm.label}</A>\n`; });
      html_content += '</DL><p>';
      const blob = new Blob([html_content], { type: 'text/html' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'surfboard-links.html'; a.click();
    });

    // Import (file picker)
    main.querySelector('#tp-links-import')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.html,.json';
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        const text = await file.text();
        let imported = 0;
        // Try Netscape HTML format
        const re = /<A\s+HREF="([^"]+)"[^>]*>([^<]*)<\/A>/gi;
        let m;
        while ((m = re.exec(text))) {
          const url = m[1]; const label = m[2];
          if (url && label) {
            await window.electronAPI?.storage?.addBookmark?.({ url, label, folder: 'Imported' });
            imported++;
          }
        }
        if (imported > 0) {
          const bms = await window.electronAPI?.storage?.getBookmarks?.() || [];
          const page = main.querySelector('[data-page="links"]');
          if (page) page.outerHTML = buildLinksPage(bms);
          bindLinksEvents();
        }
      });
      input.click();
    });
  }

  // ── Cookies page ────────────────────────────────────────
  function buildCookiesPage(cookies) {
    const list = cookies || [];
    // Group by domain
    const byDomain = {};
    for (const c of list) {
      const d = c.domain || '(no domain)';
      if (!byDomain[d]) byDomain[d] = [];
      byDomain[d].push(c);
    }
    const domains = Object.keys(byDomain).sort();

    return html`
      <div class="tp-page" data-page="cookies">
        <div class="tp-page-header">
          <h1 class="tp-page-title">🍪 Cookies</h1>
          <p class="tp-page-desc">View, edit, and delete cookies stored by the browser.</p>
        </div>

        <div class="tp-links-toolbar">
          <input class="tp-input tp-links-search" id="tp-cookie-search" placeholder="Search cookies…" />
          <button class="tp-btn tp-btn-danger" id="tp-cookie-clear-all">Clear All</button>
          <button class="tp-btn" id="tp-cookie-export">Export</button>
        </div>

        ${list.length === 0 ? `
          <div class="tp-empty">
            <div class="tp-empty-icon">🍪</div>
            <div class="tp-empty-text">No cookies stored</div>
            <div class="tp-empty-hint">Cookies are added automatically as you browse</div>
          </div>
        ` : domains.map(domain => `
          <div class="tp-links-folder" data-domain="${_esc(domain)}">
            <div class="tp-links-folder-header">
              <span class="tp-links-folder-icon">🌐</span>
              <span class="tp-links-folder-name">${_esc(domain)}</span>
              <span class="tp-links-folder-count">${byDomain[domain].length}</span>
            </div>
            <div class="tp-cookie-table">
              <div class="tp-cookie-row tp-cookie-header">
                <span class="tp-cookie-name">Name</span>
                <span class="tp-cookie-value">Value</span>
                <span class="tp-cookie-path">Path</span>
                <span class="tp-cookie-flags">Flags</span>
                <span class="tp-cookie-actions"></span>
              </div>
              ${byDomain[domain].map(c => `
                <div class="tp-cookie-row" data-cookie-name="${_esc(c.name)}" data-cookie-domain="${_esc(c.domain)}">
                  <span class="tp-cookie-name" title="${_esc(c.name)}">${_esc(c.name)}</span>
                  <span class="tp-cookie-value" title="${_esc(c.value)}">${_esc(c.value.length > 40 ? c.value.slice(0, 40) + '…' : c.value)}</span>
                  <span class="tp-cookie-path">${_esc(c.path)}</span>
                  <span class="tp-cookie-flags">
                    ${c.secure ? '<span class="tp-badge">🔒</span>' : ''}
                    ${c.httpOnly ? '<span class="tp-badge">H</span>' : ''}
                    ${c.session ? '<span class="tp-badge tp-badge-warn">S</span>' : ''}
                  </span>
                  <span class="tp-cookie-actions">
                    <button class="tp-btn tp-btn-sm tp-btn-danger tp-cookie-delete" data-cookie-url="${_esc('http' + (c.secure ? 's' : '') + '://' + c.domain + c.path)}" data-cookie-name="${_esc(c.name)}">🗑️</button>
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindCookiesEvents() {
    if (!$container) return;
    const main = $container.querySelector('.tp-content');
    if (!main) return;

    // Search filter
    main.querySelector('#tp-cookie-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      main.querySelectorAll('.tp-cookie-row:not(.tp-cookie-header)').forEach(row => {
        const name = (row.querySelector('.tp-cookie-name')?.textContent || '').toLowerCase();
        const value = (row.querySelector('.tp-cookie-value')?.textContent || '').toLowerCase();
        row.style.display = (name.includes(q) || value.includes(q)) ? '' : 'none';
      });
      main.querySelectorAll('.tp-links-folder').forEach(folder => {
        const visible = folder.querySelectorAll('.tp-cookie-row:not(.tp-cookie-header):not([style*="display: none"])').length;
        folder.style.display = visible > 0 ? '' : 'none';
      });
    });

    // Delete cookie
    main.querySelectorAll('.tp-cookie-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = btn.dataset.cookieUrl;
        const name = btn.dataset.cookieName;
        if (!url || !name) return;
        await window.electronAPI?.cookies?.remove?.(url, name);
        btn.closest('.tp-cookie-row')?.remove();
      });
    });

    // Clear all
    main.querySelector('#tp-cookie-clear-all')?.addEventListener('click', async () => {
      if (!confirm('Clear all cookies?')) return;
      // Get all cookies and remove them
      const cookies = await window.electronAPI?.cookies?.get?.({}) || [];
      for (const c of cookies) {
        const url = 'http' + (c.secure ? 's' : '') + '://' + c.domain + c.path;
        await window.electronAPI?.cookies?.remove?.(url, c.name);
      }
      // Re-render
      const empty = main.querySelector('.tp-page[data-page="cookies"]');
      if (empty) empty.outerHTML = buildCookiesPage([]);
      bindCookiesEvents();
    });

    // Export
    main.querySelector('#tp-cookie-export')?.addEventListener('click', async () => {
      const data = await window.electronAPI?.cookies?.export?.();
      if (!data) return;
      const blob = new Blob([data], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cookies.txt'; a.click();
    });
  }

  // ── SSH page ─────────────────────────────────────────────
  let _sshOutputBuffer = '';
  let _sshUnsubOutput = null;
  let _sshUnsubStatus = null;

  function buildSSHPage(connections, state, environments) {
    const conns = connections || [];
    const envs = environments || [];
    const isConnected = state?.connected || false;
    const isReconnecting = state?.reconnecting || false;
    const showTerminal = isConnected || isReconnecting;
    const statusText = isReconnecting
      ? `🟡 Reconnecting to ${_esc(state?.host || '')} (${state?.reconnectAttempt || 0}/${state?.reconnectMaxAttempts || 0})`
      : isConnected
        ? `🟢 Connected to ${_esc(state?.host || '')}`
        : 'Disconnected';

    return html`
      <div class="tp-page" data-page="ssh">
        <div class="tp-page-header">
          <h1 class="tp-page-title">🔐 SSH Sessions</h1>
          <p class="tp-page-desc">Connect to remote servers via SSH. Save connection profiles for quick access.</p>
        </div>

        <div class="tp-ssh-layout">
          <div class="tp-ssh-sidebar">
            <div class="tp-ssh-sidebar-header">
              <span>Saved Connections</span>
              <button class="tp-btn tp-btn-sm" id="ssh-add-connection">+</button>
            </div>
            <div class="tp-ssh-connections-list">
              ${conns.length === 0 ? `
                <div class="tp-empty">
                  <div class="tp-empty-text" style="font-size:11px">No saved connections</div>
                </div>
              ` : conns.map(c => `
                <div class="tp-ssh-conn-item ${isConnected && state?.host === c.host ? 'active' : ''}" data-conn-id="${_esc(c.id)}">
                  <div class="tp-ssh-conn-info">
                    <div class="tp-ssh-conn-name">${_esc(c.name)}</div>
                    <div class="tp-ssh-conn-host">${_esc(c.username)}@${_esc(c.host)}:${c.port}</div>
                  </div>
                  <button class="tp-btn tp-btn-sm tp-btn-danger tp-ssh-conn-delete" data-conn-delete="${_esc(c.id)}">🗑️</button>
                </div>
              `).join('')}
            </div>

            <div class="tp-ssh-sidebar-header" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
              <span>Environments</span>
              <button class="tp-btn tp-btn-sm" id="ssh-add-env">+</button>
            </div>
            <div class="tp-ssh-env-list">
              ${envs.length === 0 ? `
                <div class="tp-empty">
                  <div class="tp-empty-text" style="font-size:11px">No saved environments</div>
                </div>
              ` : envs.map(e => `
                <div class="tp-ssh-env-item" data-env-id="${_esc(e.id)}">
                  <div class="tp-ssh-conn-info">
                    <div class="tp-ssh-conn-name">${_esc(e.name)}</div>
                    <div class="tp-ssh-conn-host">${_esc(e.workdir || '~')}</div>
                  </div>
                  <button class="tp-btn tp-btn-sm tp-btn-danger tp-ssh-env-delete" data-env-delete="${_esc(e.id)}">🗑️</button>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="tp-ssh-main">
            ${!showTerminal ? `
              <div class="tp-ssh-connect-form" id="ssh-connect-form">
                <h3 style="margin-bottom:12px;color:var(--text)">New Connection</h3>
                <div class="tp-ssh-form-row">
                  <input class="tp-input" id="ssh-host" placeholder="Host (e.g., example.com)" />
                  <input class="tp-input tp-input-sm" id="ssh-port" placeholder="22" value="22" style="width:80px" />
                </div>
                <div class="tp-ssh-form-row">
                  <input class="tp-input" id="ssh-username" placeholder="Username" />
                  <input class="tp-input" id="ssh-password" placeholder="Password (optional)" type="password" />
                </div>
                <div class="tp-ssh-form-row">
                  <input class="tp-input" id="ssh-key-path" placeholder="Private key path (optional)" />
                </div>
                <div class="tp-ssh-form-actions">
                  <button class="tp-btn tp-btn-primary" id="ssh-connect-btn">Connect</button>
                  <button class="tp-btn" id="ssh-save-btn">Save Connection</button>
                </div>
              </div>
            ` : `
              <div class="tp-ssh-terminal-header">
                <span class="tp-ssh-status">${statusText}${isReconnecting && state?.lastError ? ` · ${_esc(state.lastError)}` : ''}</span>
                <button class="tp-btn tp-btn-sm tp-btn-danger" id="ssh-disconnect-btn">Disconnect</button>
              </div>
              <div class="tp-ssh-terminal" id="ssh-output"></div>
              <div class="tp-ssh-input-row">
                <span class="tp-ssh-prompt">$</span>
                <input class="tp-input tp-ssh-input" id="ssh-input" placeholder="${isReconnecting ? 'Reconnecting…' : 'Enter command…'}" ${isReconnecting ? 'disabled' : ''} autofocus />
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function bindSSHEvents() {
    if (!$container) return;
    const main = $container.querySelector('.tp-content');
    if (!main) return;

    // Cleanup previous listeners
    if (_sshUnsubOutput) { _sshUnsubOutput(); _sshUnsubOutput = null; }
    if (_sshUnsubStatus) { _sshUnsubStatus(); _sshUnsubStatus = null; }

    // Subscribe to SSH output
    _sshUnsubOutput = window.electronAPI?.ssh?.onOutput?.((data) => {
      const output = main.querySelector('#ssh-output');
      if (!output) return;
      _sshOutputBuffer += data.text;
      output.textContent = _sshOutputBuffer;
      output.scrollTop = output.scrollHeight;
    });

    _sshUnsubStatus = window.electronAPI?.ssh?.onStatus?.((status) => {
      // Re-render on status change
      _refreshSSHPage(main);
    });

    // Connect button
    main.querySelector('#ssh-connect-btn')?.addEventListener('click', async () => {
      const host = main.querySelector('#ssh-host')?.value.trim();
      const port = parseInt(main.querySelector('#ssh-port')?.value) || 22;
      const username = main.querySelector('#ssh-username')?.value.trim();
      const password = main.querySelector('#ssh-password')?.value;
      const privateKeyPath = main.querySelector('#ssh-key-path')?.value.trim();

      if (!host || !username) {
        alert('Host and username are required');
        return;
      }

      try {
        await window.electronAPI?.ssh?.connect?.({ host, port, username, password, privateKeyPath });
        _sshOutputBuffer = '';
        _refreshSSHPage(main);
      } catch (err) {
        alert(`Connection failed: ${err.message}`);
      }
    });

    // Save connection
    main.querySelector('#ssh-save-btn')?.addEventListener('click', async () => {
      const host = main.querySelector('#ssh-host')?.value.trim();
      const port = parseInt(main.querySelector('#ssh-port')?.value) || 22;
      const username = main.querySelector('#ssh-username')?.value.trim();
      const privateKeyPath = main.querySelector('#ssh-key-path')?.value.trim();

      if (!host || !username) {
        alert('Host and username are required');
        return;
      }

      const id = `${username}@${host}`;
      const name = prompt('Connection name:', id) || id;
      await window.electronAPI?.ssh?.connections?.save?.(id, { name, host, port, username, privateKeyPath });
      _refreshSSHPage(main);
    });

    // Disconnect
    main.querySelector('#ssh-disconnect-btn')?.addEventListener('click', async () => {
      await window.electronAPI?.ssh?.disconnect?.();
      _sshOutputBuffer = '';
      _refreshSSHPage(main);
    });

    // SSH input
    main.querySelector('#ssh-input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const input = main.querySelector('#ssh-input');
        const cmd = input?.value.trim();
        if (!cmd) return;
        input.value = '';
        await window.electronAPI?.ssh?.send?.(cmd);
      }
    });

    // Click saved connection to connect
    main.querySelectorAll('.tp-ssh-conn-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.closest('.tp-ssh-conn-delete')) return;
        const id = item.dataset.connId;
        // Find connection details from the list
        const conns = await window.electronAPI?.ssh?.connections?.list?.() || [];
        const conn = conns.find(c => c.id === id);
        if (!conn) return;
        try {
          await window.electronAPI?.ssh?.connect?.({
            host: conn.host,
            port: conn.port,
            username: conn.username,
          });
          _sshOutputBuffer = '';
          _refreshSSHPage(main);
        } catch (err) {
          alert(`Connection failed: ${err.message}`);
        }
      });
    });

    // Delete saved connection
    main.querySelectorAll('[data-conn-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.connDelete;
        if (!confirm('Delete this saved connection?')) return;
        await window.electronAPI?.ssh?.connections?.delete?.(id);
        _refreshSSHPage(main);
      });
    });

    // Add environment
    main.querySelector('#ssh-add-env')?.addEventListener('click', async () => {
      const name = prompt('Environment name:');
      if (!name) return;
      const workdir = prompt('Working directory:', '~') || '~';
      const envVars = prompt('Environment variables (KEY=value, comma-separated):', '');
      const vars = {};
      if (envVars) {
        envVars.split(',').forEach(pair => {
          const [k, ...v] = pair.split('=');
          if (k) vars[k.trim()] = v.join('=').trim();
        });
      }
      await window.electronAPI?.storage?.environments?.add?.({ name, workdir, vars });
      _refreshSSHPage(main);
    });

    // Click environment to load
    main.querySelectorAll('.tp-ssh-env-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.closest('.tp-ssh-env-delete')) return;
        const id = item.dataset.envId;
        const envs = await window.electronAPI?.storage?.environments?.list?.() || [];
        const env = envs.find(e => e.id === id);
        if (!env) return;
        // Populate form with environment settings
        const workdirInput = main.querySelector('#ssh-host');
        if (workdirInput && env.host) workdirInput.value = env.host;
        // If env has a host, auto-connect
        if (env.host && env.username) {
          try {
            await window.electronAPI?.ssh?.connect?.({
              host: env.host,
              port: env.port || 22,
              username: env.username,
            });
            _sshOutputBuffer = '';
            // Send cd command if workdir is set
            if (env.workdir && env.workdir !== '~') {
              await window.electronAPI?.ssh?.send?.(`cd ${env.workdir}`);
            }
            _refreshSSHPage(main);
          } catch (err) {
            alert(`Connection failed: ${err.message}`);
          }
        }
      });
    });

    // Delete environment
    main.querySelectorAll('[data-env-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.envDelete;
        if (!confirm('Delete this environment?')) return;
        await window.electronAPI?.storage?.environments?.remove?.(id);
        _refreshSSHPage(main);
      });
    });
  }

  async function _refreshSSHPage(main) {
    const page = main.querySelector('.tp-page[data-page="ssh"]');
    if (!page) return;
    const connections = await window.electronAPI?.ssh?.connections?.list?.() || [];
    const state = await window.electronAPI?.ssh?.state?.() || {};
    const environments = await window.electronAPI?.storage?.environments?.list?.() || [];
    page.outerHTML = buildSSHPage(connections, state, environments);
    bindSSHEvents();
  }

  // ── Cloud page ──────────────────────────────────────────
  function buildCloudPage(cloudStatus, workspaces) {
    const providers = cloudStatus?.providers || {};
    const legacyConnected = cloudStatus?.connected || false;
    const ws = workspaces || [];

    const providerCards = CLOUD_PROVIDERS.map(provider => {
      const connected = providers[provider.id]?.connected || (provider.id === 'github' && legacyConnected);
      return `
        <div class="tp-cloud-provider-card" data-provider="${provider.id}">
          <div class="tp-cloud-provider-icon">${provider.icon}</div>
          <div class="tp-cloud-provider-info">
            <div class="tp-cloud-provider-name">${_esc(provider.label)}</div>
            <div class="tp-cloud-provider-status">${connected ? '● Connected' : 'Not connected'}</div>
          </div>
          ${connected
            ? `<button class="tp-btn tp-btn-danger tp-cloud-disconnect" data-provider="${provider.id}">Disconnect</button>`
            : `<button class="tp-btn tp-btn-primary tp-cloud-connect" data-provider="${provider.id}">Connect</button>`
          }
        </div>
      `;
    }).join('');

    return html`
      <div class="tp-page" data-page="cloud">
        <div class="tp-page-header">
          <h1 class="tp-page-title">☁️ Cloud Sessions</h1>
          <p class="tp-page-desc">Connect to GitHub Codespaces, Replit, and Gitpod development environments.</p>
        </div>

        <div class="tp-cloud-providers">
          ${providerCards}
        </div>

        <!-- Device code flow modal -->
        <div class="tp-cloud-device-code hidden" id="cloud-device-code">
          <div class="tp-cloud-dc-header" id="cloud-dc-header">Authenticate</div>
          <div class="tp-cloud-dc-step">1. Open <a href="#" class="tp-cloud-dc-url" id="cloud-dc-url"></a></div>
          <div class="tp-cloud-dc-step">2. Enter code:</div>
          <div class="tp-cloud-dc-code" id="cloud-dc-code">------</div>
          <div class="tp-cloud-dc-status" id="cloud-dc-status">Waiting for authorization…</div>
          <button class="tp-btn tp-btn-secondary tp-cloud-dc-cancel" id="cloud-dc-cancel">Cancel</button>
        </div>

        <!-- Workspace list -->
        <div class="tp-cloud-workspaces" id="cloud-workspaces">
          ${ws.length === 0 ? `
            <div class="tp-empty">
              <div class="tp-empty-icon">☁️</div>
              <div class="tp-empty-text">${ws.length === 0 && Object.values(providers).some(p => p?.connected) ? 'No cloud workspaces found' : 'Connect a provider to see your cloud environments'}</div>
            </div>
          ` : ws.map(w => `
            <div class="tp-cloud-ws-card" data-name="${_esc(w.name)}" data-provider="${_esc(w.provider || 'github')}">
              <div class="tp-cloud-ws-header">
                <div>
                  <span class="tp-cloud-ws-name">${_esc(w.displayName)}</span>
                  <span class="tp-cloud-ws-provider">${_esc(CLOUD_PROVIDERS.find(p => p.id === (w.provider || 'github'))?.label || w.provider || 'Cloud')}</span>
                </div>
                <span class="tp-cloud-ws-state tp-cloud-ws-state--${_esc(w.state)}">${_esc(w.state)}</span>
              </div>
              <div class="tp-cloud-ws-meta">
                ${w.repository ? `<span>${_esc(w.repository)}</span>` : ''}
                ${w.machineType ? `<span>${_esc(w.machineType)}</span>` : ''}
                ${w.region ? `<span>${_esc(w.region)}</span>` : ''}
                ${w.url ? `<a class="tp-cloud-ws-url" href="${_esc(w.url)}" target="_blank" rel="noreferrer">Open</a>` : ''}
              </div>
              ${w.gitStatus ? `
                <div class="tp-cloud-ws-git">
                  ${_esc(w.gitStatus.ref || '')}
                  ${w.gitStatus.hasUncommittedChanges ? ' ● uncommitted' : ''}
                  ${w.gitStatus.hasUnpushedChanges ? ' ↑ unpushed' : ''}
                </div>
              ` : ''}
              <div class="tp-cloud-ws-actions">
                ${w.state === 'Shutdown' ? `<button class="tp-btn tp-btn-primary tp-cloud-ws-start" data-provider="${_esc(w.provider || 'github')}" data-name="${_esc(w.name)}">Start</button>` : ''}
                ${w.state === 'Running' ? `<button class="tp-btn tp-btn-secondary tp-cloud-ws-stop" data-provider="${_esc(w.provider || 'github')}" data-name="${_esc(w.name)}">Stop</button>` : ''}
                <button class="tp-btn tp-btn-danger tp-cloud-ws-delete" data-provider="${_esc(w.provider || 'github')}" data-name="${_esc(w.name)}">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async function _refreshCloudPage() {
    const page = $container?.querySelector('.tp-page[data-page="cloud"]');
    if (!page) return;
    const cloudAPI = window.electronAPI?.cloud;
    let cloudStatus = { providers: {} };
    let workspaces = [];
    try { cloudStatus = await cloudAPI?.status?.() || cloudStatus; } catch {}
    const providers = cloudStatus.providers || {};
    for (const provider of CLOUD_PROVIDERS) {
      if (!providers[provider.id]?.connected) continue;
      try {
        const list = await cloudAPI?.listWorkspaces?.(provider.id) || [];
        workspaces.push(...list.map(w => ({ ...w, provider: w.provider || provider.id })));
      } catch {}
    }
    page.outerHTML = buildCloudPage(cloudStatus, workspaces);
    bindCloudEvents();
  }

  function bindCloudEvents() {
    if (!$container) return;
    const cloudAPI = window.electronAPI?.cloud;
    if (!cloudAPI) return;
    const main = $container.querySelector('.tp-content');
    if (!main) return;
    let pollTimer = null;
    let pollAbort = false;

    // Connect button
    main.querySelectorAll('.tp-cloud-connect').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider || 'github';
        try {
          const dc = await cloudAPI.startDeviceCode(provider);
          const dcBox = main.querySelector('#cloud-device-code');
          const dcHeader = main.querySelector('#cloud-dc-header');
          const dcCode = main.querySelector('#cloud-dc-code');
          const dcUrl = main.querySelector('#cloud-dc-url');
          const dcStatus = main.querySelector('#cloud-dc-status');
          const dcCancel = main.querySelector('#cloud-dc-cancel');
          const providerLabel = CLOUD_PROVIDERS.find(p => p.id === provider)?.label || provider;
          if (dcBox) dcBox.classList.remove('hidden');
          if (dcHeader) dcHeader.textContent = `Authenticate with ${providerLabel}`;
          if (dcCode) dcCode.textContent = dc.userCode;
          if (dcUrl) {
            const url = dc.verificationUriComplete || dc.verificationUri;
            dcUrl.href = url;
            dcUrl.textContent = url;
          }
          if (dcStatus) dcStatus.textContent = 'Waiting for authorization…';
          btn.disabled = true;

          // Open device code URL in default browser
          try { require('electron').shell.openExternal(dc.verificationUriComplete || dc.verificationUri); } catch {}

          pollAbort = false;
          const interval = dc.interval ? dc.interval * 1000 : 5000;
          const pollOnce = async () => {
            if (pollAbort) { clearInterval(pollTimer); return; }
            try {
              const result = await cloudAPI.pollToken(provider, dc.deviceCode, interval);
              if (result.token) {
                clearInterval(pollTimer);
                if (dcBox) dcBox.classList.add('hidden');
                await _refreshCloudPage();
              } else if (result.retryAfter) {
                clearInterval(pollTimer);
                pollTimer = setInterval(pollOnce, result.retryAfter);
              }
            } catch (err) {
              clearInterval(pollTimer);
              if (dcStatus) dcStatus.textContent = err.message;
              setTimeout(() => { if (dcBox) dcBox.classList.add('hidden'); }, 3000);
            }
          };
          pollTimer = setInterval(pollOnce, interval);

          // Cancel button
          if (dcCancel) {
            dcCancel.addEventListener('click', () => {
              pollAbort = true;
              if (pollTimer) clearInterval(pollTimer);
              dcBox.classList.add('hidden');
              btn.disabled = false;
            }, { once: true });
          }
        } catch (err) {
          alert('Failed to start authentication: ' + err.message);
        }
      });
    });

    // Disconnect button
    main.querySelectorAll('.tp-cloud-disconnect').forEach(btn => {
      btn.addEventListener('click', async () => {
        await cloudAPI.disconnect(btn.dataset.provider);
        await _refreshCloudPage();
      });
    });

    // Workspace actions
    main.querySelectorAll('.tp-cloud-ws-start').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider || 'github';
        btn.disabled = true; btn.textContent = 'Starting…';
        try { await cloudAPI.startWorkspace(provider, btn.dataset.name); } catch (err) { alert(err.message); }
        await _refreshCloudPage();
      });
    });
    main.querySelectorAll('.tp-cloud-ws-stop').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider || 'github';
        btn.disabled = true; btn.textContent = 'Stopping…';
        try { await cloudAPI.stopWorkspace(provider, btn.dataset.name); } catch (err) { alert(err.message); }
        await _refreshCloudPage();
      });
    });
    main.querySelectorAll('.tp-cloud-ws-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider || 'github';
        if (!confirm(`Delete workspace "${btn.dataset.name}" from ${provider}? This cannot be undone.`)) return;
        btn.disabled = true; btn.textContent = 'Deleting…';
        try { await cloudAPI.deleteWorkspace(provider, btn.dataset.name); } catch (err) { alert(err.message); }
        await _refreshCloudPage();
      });
    });

    _unsubFns.push(() => { if (pollTimer) clearInterval(pollTimer); });
  }

  // ── Navigation ───────────────────────────────────────────
  function showPage(pageId) {
    $container.querySelectorAll('.tp-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageId);
    });
    $container.querySelectorAll('.tp-page').forEach(page => {
      page.classList.toggle('hidden', page.dataset.page !== pageId);
    });
    $activePage = pageId;
    bindEvents(pageId);
  }

  // ── Main render ──────────────────────────────────────────
  async function render(container, pageId, data) {
    $container = container;
    $activePage = pageId;

    // Fetch extensions data if on extensions page
    let extensions = [];
    if (pageId === 'extensions') {
      try {
        extensions = await window.electronAPI?.extensions?.list?.() || [];
      } catch { /* */ }
    }

    // Fetch bookmarks if on links page
    let bookmarks = [];
    if (pageId === 'links') {
      try {
        bookmarks = await window.electronAPI?.storage?.getBookmarks?.() || [];
      } catch { /* */ }
    }

    // Fetch cookies if on cookies page
    let cookies = [];
    if (pageId === 'cookies') {
      try {
        cookies = await window.electronAPI?.cookies?.get?.({}) || [];
      } catch { /* */ }
    }

    // Fetch SSH data if on SSH page
    let sshConnections = [];
    let sshState = {};
    let sshEnvironments = [];
    if (pageId === 'ssh') {
      try {
        sshConnections = await window.electronAPI?.ssh?.connections?.list?.() || [];
        sshState = await window.electronAPI?.ssh?.state?.() || {};
        sshEnvironments = await window.electronAPI?.storage?.environments?.list?.() || [];
      } catch { /* */ }
    }

    // Fetch cloud data if on cloud page
    let cloudStatus = { connected: false };
    let cloudWorkspaces = [];
    if (pageId === 'cloud') {
      try {
        cloudStatus = await window.electronAPI?.cloud?.status?.() || cloudStatus;
        const providers = cloudStatus.providers || {};
        for (const provider of CLOUD_PROVIDERS) {
          if (!providers[provider.id]?.connected) continue;
          try {
            const list = await window.electronAPI?.cloud?.listWorkspaces?.(provider.id) || [];
            cloudWorkspaces.push(...list.map(w => ({ ...w, provider: w.provider || provider.id })));
          } catch { /* */ }
        }
      } catch { /* */ }
    }

    const pageData = { extensions, bookmarks, cookies, sshConnections, sshState, sshEnvironments, cloudStatus, cloudWorkspaces };

    container.innerHTML = html`
      <div class="tab-pages">
        <nav class="tp-sidebar">
          <div class="tp-sidebar-header">
            <span class="tp-sidebar-icon">📑</span>
            <span class="tp-sidebar-title">Pages</span>
          </div>
          <div class="tp-nav">
            ${PAGES.map(p => `
              <button class="tp-nav-item ${p.id === pageId ? 'active' : ''}" data-page="${p.id}">
                <span class="tp-nav-icon">${p.icon}</span>
                <span class="tp-nav-label">${p.label}</span>
              </button>
            `).join('')}
          </div>
        </nav>
        <main class="tp-content">
          ${PAGES.map(p => `<div class="tp-page ${p.id === pageId ? '' : 'hidden'}" data-page="${p.id}">${buildPage(p.id, pageData)}</div>`).join('')}
        </main>
      </div>
    `;

    // Nav events
    container.querySelectorAll('.tp-nav-item').forEach(btn => {
      btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    bindEvents(pageId);
  }

  // ── Public API ───────────────────────────────────────────
  window.TabPages = {
    render,
    getPageIds: () => PAGES.map(p => p.id),
    getCloudProviders: () => CLOUD_PROVIDERS.map(p => ({ ...p })),
  };
})();

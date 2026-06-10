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

    const pageData = { extensions };

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
  };
})();

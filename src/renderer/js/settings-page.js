/**
 * Settings Page Module — Full-tab settings UI
 * Opens as surfboard://settings in a dedicated tab
 */
(function () {
  'use strict';

  const THEMES = [
    { id: 'dark', bg: '#141416', surface: '#1a1a1e', accent: '#60a5fa', label: 'Dark' },
    { id: 'nord', bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0', label: 'Nord' },
    { id: 'drac', bg: '#282a36', surface: '#44475a', accent: '#bd93f9', label: 'Dracula' },
    { id: 'gruv', bg: '#282828', surface: '#3c3836', accent: '#fabd2f', label: 'Gruvbox' },
    { id: 'pard', bg: '#1e1e2e', surface: '#313244', accent: '#cba6f7', label: 'Catppuccin' },
  ];

  const SEARCH_ENGINES = [
    { id: 'google', label: 'Google' },
    { id: 'ddg', label: 'DuckDuckGo' },
    { id: 'brave', label: 'Brave' },
  ];

  const AI_PROVIDERS = [
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'ollama', label: 'Ollama (Local)' },
    { id: 'custom', label: 'Custom / Other' },
  ];

  const SECTIONS = [
    { id: 'general', icon: '⚙️', label: 'General' },
    { id: 'appearance', icon: '🎨', label: 'Appearance' },
    { id: 'ai', icon: '🤖', label: 'AI Configuration' },
    { id: 'extensions', icon: '🧩', label: 'Extensions' },
    { id: 'privacy', icon: '🔒', label: 'Privacy & Security' },
    { id: 'profiles', icon: '👤', label: 'Profiles' },
    { id: 'shortcuts', icon: '⌨️', label: 'Keyboard Shortcuts' },
    { id: 'about', icon: 'ℹ️', label: 'About' },
  ];

  let $container = null;
  let $activeSection = null;
  let settings = {};
  let deps = {};

  function html(strings, ...values) {
    return strings.reduce((result, str, i) => result + str + (values[i] ?? ''), '');
  }

  function buildSectionGeneral() {
    const currentEngine = settings.searchEngine || 'google';
    const homepage = settings.homepage || 'about:blank';
    const restoreSession = settings.restoreSession !== false;

    return html`
      <div class="sp-section" data-section="general">
        <h2 class="sp-section-title">General</h2>
        
        <div class="sp-group">
          <div class="sp-group-title">Search</div>
          <div class="sp-field">
            <label class="sp-label">Default Search Engine</label>
            <select id="sp-search-engine" class="sp-select">
              ${SEARCH_ENGINES.map(e => `<option value="${e.id}" ${e.id === currentEngine ? 'selected' : ''}>${e.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="sp-group">
          <div class="sp-group-title">Startup</div>
          <div class="sp-field">
            <label class="sp-label">Homepage</label>
            <input id="sp-homepage" type="text" class="sp-input" value="${homepage}" placeholder="about:blank" />
            <span class="sp-hint">URL to open on new tab. Use "about:blank" for empty tab.</span>
          </div>
          <div class="sp-field sp-field-row">
            <div>
              <label class="sp-label">Restore Previous Session</label>
              <span class="sp-hint">Reopen tabs from last session on startup</span>
            </div>
            <label class="sp-toggle">
              <input type="checkbox" id="sp-restore-session" ${restoreSession ? 'checked' : ''} />
              <span class="sp-toggle-track"></span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  function buildSectionAppearance() {
    const currentTheme = settings.theme || 'dark';
    const fontSize = settings.fontSize || 13;
    const sidebarPosition = settings.sidebarPosition || 'left';

    return html`
      <div class="sp-section" data-section="appearance">
        <h2 class="sp-section-title">Appearance</h2>
        
        <div class="sp-group">
          <div class="sp-group-title">Theme</div>
          <div class="sp-theme-grid">
            ${THEMES.map(t => `
              <div class="sp-theme-card ${t.id === currentTheme ? 'active' : ''}" data-theme="${t.id}">
                <div class="sp-theme-preview" style="background: linear-gradient(135deg, ${t.bg}, ${t.surface}); border-color: ${t.id === currentTheme ? t.accent : 'transparent'}">
                  <div class="sp-theme-accent" style="background: ${t.accent}"></div>
                </div>
                <span class="sp-theme-label">${t.label}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="sp-group">
          <div class="sp-group-title">Layout</div>
          <div class="sp-field">
            <label class="sp-label">Font Size</label>
            <div class="sp-range-row">
              <input id="sp-font-size" type="range" min="11" max="18" value="${fontSize}" class="sp-range" />
              <span id="sp-font-size-val" class="sp-range-val">${fontSize}px</span>
            </div>
          </div>
          <div class="sp-field">
            <label class="sp-label">Sidebar Position</label>
            <div class="sp-radio-group">
              <label class="sp-radio">
                <input type="radio" name="sidebar-pos" value="left" ${sidebarPosition === 'left' ? 'checked' : ''} />
                <span class="sp-radio-label">Left</span>
              </label>
              <label class="sp-radio">
                <input type="radio" name="sidebar-pos" value="right" ${sidebarPosition === 'right' ? 'checked' : ''} />
                <span class="sp-radio-label">Right</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildSectionAI() {
    const provider = settings.aiProvider || 'openai';
    const apiKey = settings.aiApiKey || '';
    const baseUrl = settings.aiBaseUrl || '';
    const model = settings.aiModel || '';
    const sysPrompt = settings.aiSystemPrompt || '';
    const temperature = settings.aiTemperature ?? 0.7;

    return html`
      <div class="sp-section" data-section="ai">
        <h2 class="sp-section-title">AI Configuration</h2>
        
        <div class="sp-group">
          <div class="sp-group-title">Provider</div>
          <div class="sp-field">
            <label class="sp-label">AI Provider</label>
            <select id="sp-ai-provider" class="sp-select">
              ${AI_PROVIDERS.map(p => `<option value="${p.id}" ${p.id === provider ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="sp-group">
          <div class="sp-group-title">Connection</div>
          <div class="sp-field">
            <label class="sp-label">API Key</label>
            <input id="sp-ai-key" type="password" class="sp-input" value="${apiKey}" placeholder="sk-..." />
            <span class="sp-hint">Stored locally, never sent anywhere except your chosen API endpoint.</span>
          </div>
          <div class="sp-field">
            <label class="sp-label">Base URL <small>(leave blank for default)</small></label>
            <input id="sp-ai-baseurl" type="text" class="sp-input" value="${baseUrl}" placeholder="https://api.openai.com/v1" />
            <span class="sp-hint">Override for Ollama, proxies, or compatible APIs.</span>
          </div>
        </div>

        <div class="sp-group">
          <div class="sp-group-title">Model</div>
          <div class="sp-field">
            <label class="sp-label">Model Name</label>
            <input id="sp-ai-model" type="text" class="sp-input" value="${model}" placeholder="gpt-4o" />
          </div>
          <div class="sp-field">
            <label class="sp-label">System Prompt</label>
            <textarea id="sp-ai-sysprompt" class="sp-textarea" placeholder="You are a helpful assistant...">${sysPrompt}</textarea>
          </div>
          <div class="sp-field">
            <label class="sp-label">Temperature <span id="sp-ai-temp-val" class="sp-range-val">${temperature}</span></label>
            <input id="sp-ai-temp" type="range" min="0" max="2" step="0.1" value="${temperature}" class="sp-range" />
          </div>
        </div>
      </div>
    `;
  }

  function buildSectionExtensions(extensions = []) {
    return html`
      <div class="sp-section" data-section="extensions">
        <h2 class="sp-section-title">Extensions</h2>
        
        <div class="sp-group">
          <div class="sp-group-title">Installed Extensions</div>
          ${extensions.length === 0 ? `
            <div class="sp-empty">No extensions installed</div>
          ` : `
            <div class="sp-ext-list">
              ${extensions.map(ex => `
                <div class="sp-ext-item">
                  <div class="sp-ext-icon">${ex.icon || '🧩'}</div>
                  <div class="sp-ext-info">
                    <div class="sp-ext-name">${ex.name || ex.id}</div>
                    <div class="sp-ext-version">${ex.version || ''}</div>
                  </div>
                  <label class="sp-toggle">
                    <input type="checkbox" data-ext-id="${ex.id}" ${ex.enabled !== false ? 'checked' : ''} />
                    <span class="sp-toggle-track"></span>
                  </label>
                </div>
              `).join('')}
            </div>
          `}
          <button id="sp-ext-reload" class="sp-btn sp-btn-secondary">Reload Extensions</button>
        </div>
      </div>
    `;
  }

  function buildSectionPrivacy() {
    return html`
      <div class="sp-section" data-section="privacy">
        <h2 class="sp-section-title">Privacy & Security</h2>
        
        <div class="sp-group">
          <div class="sp-group-title">Clear Browsing Data</div>
          <div class="sp-field sp-field-row">
            <div>
              <label class="sp-label">History</label>
              <span class="sp-hint">Clear all browsing history</span>
            </div>
            <button id="sp-clear-history" class="sp-btn sp-btn-danger">Clear History</button>
          </div>
          <div class="sp-field sp-field-row">
            <div>
              <label class="sp-label">All Data</label>
              <span class="sp-hint">Reset all browser data including bookmarks and settings</span>
            </div>
            <button id="sp-clear-all" class="sp-btn sp-btn-danger">Reset Everything</button>
          </div>
        </div>
      </div>
    `;
  }

  function buildSectionProfiles(profiles = [], activeProfile = 'default') {
    return html`
      <div class="sp-section" data-section="profiles">
        <h2 class="sp-section-title">Profiles</h2>
        
        <div class="sp-group">
          <div class="sp-group-title">Manage Profiles</div>
          <div class="sp-profile-list">
            ${profiles.map(p => `
              <div class="sp-profile-item ${p.id === activeProfile ? 'active' : ''}">
                <div class="sp-profile-avatar" style="background: ${p.color || '#60a5fa'}">${(p.name || p.id)[0].toUpperCase()}</div>
                <div class="sp-profile-info">
                  <div class="sp-profile-name">${p.name || p.id}</div>
                  <div class="sp-profile-id">${p.id}</div>
                </div>
                ${p.id === activeProfile ? '<span class="sp-profile-active">Active</span>' : ''}
              </div>
            `).join('')}
          </div>
          <button id="sp-profile-new" class="sp-btn sp-btn-secondary">New Profile</button>
        </div>
      </div>
    `;
  }

  function buildSectionShortcuts() {
    const shortcuts = [
      { category: 'Navigation', items: [
        { label: 'New Tab', keys: ['Ctrl', 'T'] },
        { label: 'Close Tab', keys: ['Ctrl', 'W'] },
        { label: 'Reopen Closed Tab', keys: ['Ctrl', 'Shift', 'T'] },
        { label: 'Next Tab', keys: ['Ctrl', 'Tab'] },
        { label: 'Previous Tab', keys: ['Ctrl', 'Shift', 'Tab'] },
        { label: 'Go Back', keys: ['Alt', '←'] },
        { label: 'Go Forward', keys: ['Alt', '→'] },
      ]},
      { category: 'Interface', items: [
        { label: 'Address Bar', keys: ['Ctrl', 'L'] },
        { label: 'Toggle Sidebar', keys: ['Ctrl', 'B'] },
        { label: 'Settings', keys: ['Ctrl', ','] },
        { label: 'History', keys: ['Ctrl', 'H'] },
      ]},
      { category: 'Tools', items: [
        { label: 'AI Sidecar', keys: ['Ctrl', 'Shift', 'A'] },
        { label: 'Shell', keys: ['Ctrl', 'Shift', 'S'] },
        { label: 'Edit Mode', keys: ['Ctrl', 'Shift', 'E'] },
        { label: 'Inspect Mode', keys: ['Ctrl', 'Shift', 'I'] },
        { label: 'Actions', keys: ['Ctrl', 'Shift', 'K'] },
        { label: 'Data', keys: ['Ctrl', 'Shift', 'D'] },
        { label: 'Workflows', keys: ['Ctrl', 'Shift', 'R'] },
      ]},
    ];

    return html`
      <div class="sp-section" data-section="shortcuts">
        <h2 class="sp-section-title">Keyboard Shortcuts</h2>
        
        ${shortcuts.map(cat => `
          <div class="sp-group">
            <div class="sp-group-title">${cat.category}</div>
            <div class="sp-shortcuts-list">
              ${cat.items.map(s => `
                <div class="sp-shortcut-row">
                  <span class="sp-shortcut-label">${s.label}</span>
                  <span class="sp-shortcut-keys">
                    ${s.keys.map(k => `<kbd class="sp-key">${k}</kbd>`).join('<span class="sp-key-sep">+</span>')}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function buildSectionAbout() {
    return html`
      <div class="sp-section" data-section="about">
        <h2 class="sp-section-title">About</h2>
        
        <div class="sp-group">
          <div class="sp-about">
            <div class="sp-about-logo">🏄</div>
            <div class="sp-about-name">RicedChromium</div>
            <div class="sp-about-version">Version 0.2.0</div>
            <div class="sp-about-desc">A riced browser built on Electron</div>
          </div>
        </div>

        <div class="sp-group">
          <div class="sp-group-title">Links</div>
          <div class="sp-about-links">
            <a href="https://github.com" class="sp-link">GitHub Repository</a>
            <a href="https://github.com/issues" class="sp-link">Report Issue</a>
            <a href="#" id="sp-changelog-link" class="sp-link">View Changelog</a>
          </div>
        </div>
      </div>
    `;
  }

  async function render(container, settingsData, extensions, profilesList, activeProfile, storageDeps) {
    $container = container;
    settings = settingsData || {};
    deps = storageDeps || {};

    // Fetch profiles if not provided
    if (!profilesList || profilesList.length === 0) {
      try {
        profilesList = await window.electronAPI?.profiles?.list?.() || [];
        activeProfile = (await window.electronAPI?.profiles?.current?.())?.id || 'default';
      } catch {
        profilesList = [];
      }
    }

    // Fetch extensions if not provided
    if (!extensions || extensions.length === 0) {
      try {
        extensions = await window.electronAPI?.extensions?.list?.() || [];
      } catch {
        extensions = [];
      }
    }

    $container.innerHTML = html`
      <div class="settings-page">
        <nav class="sp-sidebar">
          <div class="sp-sidebar-header">
            <span class="sp-sidebar-logo">⚙️</span>
            <span class="sp-sidebar-title">Settings</span>
          </div>
          <div class="sp-nav">
            ${SECTIONS.map(s => `
              <button class="sp-nav-item ${s.id === 'general' ? 'active' : ''}" data-section="${s.id}">
                <span class="sp-nav-icon">${s.icon}</span>
                <span class="sp-nav-label">${s.label}</span>
              </button>
            `).join('')}
          </div>
        </nav>
        <main class="sp-content">
          ${buildSectionGeneral()}
          ${buildSectionAppearance()}
          ${buildSectionAI()}
          ${buildSectionExtensions(extensions)}
          ${buildSectionPrivacy()}
          ${buildSectionProfiles(profilesList, activeProfile)}
          ${buildSectionShortcuts()}
          ${buildSectionAbout()}
        </main>
      </div>
    `;

    bindEvents();
    showSection('general');
  }

  function bindEvents() {
    // Navigation
    $container.querySelectorAll('.sp-nav-item').forEach(btn => {
      btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Theme selection
    $container.querySelectorAll('.sp-theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const themeId = card.dataset.theme;
        $container.querySelectorAll('.sp-theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        settings.theme = themeId;
        deps.updateSettings?.({ theme: themeId });
        // Apply theme immediately
        applyTheme(themeId);
      });
    });

    // Search engine
    $container.querySelector('#sp-search-engine')?.addEventListener('change', (e) => {
      settings.searchEngine = e.target.value;
      deps.updateSettings?.({ searchEngine: e.target.value });
    });

    // Homepage
    $container.querySelector('#sp-homepage')?.addEventListener('change', (e) => {
      settings.homepage = e.target.value;
      deps.updateSettings?.({ homepage: e.target.value });
    });

    // Restore session toggle
    $container.querySelector('#sp-restore-session')?.addEventListener('change', (e) => {
      settings.restoreSession = e.target.checked;
      deps.updateSettings?.({ restoreSession: e.target.checked });
    });

    // Font size
    const fontSizeInput = $container.querySelector('#sp-font-size');
    const fontSizeVal = $container.querySelector('#sp-font-size-val');
    fontSizeInput?.addEventListener('input', (e) => {
      fontSizeVal.textContent = e.target.value + 'px';
    });
    fontSizeInput?.addEventListener('change', (e) => {
      settings.fontSize = parseInt(e.target.value);
      deps.updateSettings?.({ fontSize: parseInt(e.target.value) });
      document.documentElement.style.fontSize = e.target.value + 'px';
    });

    // Sidebar position
    $container.querySelectorAll('input[name="sidebar-pos"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        settings.sidebarPosition = e.target.value;
        deps.updateSettings?.({ sidebarPosition: e.target.value });
      });
    });

    // AI fields
    const aiFields = {
      aiProvider: 'sp-ai-provider',
      aiApiKey: 'sp-ai-key',
      aiBaseUrl: 'sp-ai-baseurl',
      aiModel: 'sp-ai-model',
      aiSystemPrompt: 'sp-ai-sysprompt',
    };
    Object.entries(aiFields).forEach(([key, id]) => {
      $container.querySelector('#' + id)?.addEventListener('change', (e) => {
        settings[key] = e.target.value;
        deps.updateSettings?.({ [key]: e.target.value });
      });
    });

    // AI temperature
    const aiTemp = $container.querySelector('#sp-ai-temp');
    const aiTempVal = $container.querySelector('#sp-ai-temp-val');
    aiTemp?.addEventListener('input', (e) => {
      aiTempVal.textContent = e.target.value;
    });
    aiTemp?.addEventListener('change', (e) => {
      settings.aiTemperature = parseFloat(e.target.value);
      deps.updateSettings?.({ aiTemperature: parseFloat(e.target.value) });
    });

    // Clear history
    $container.querySelector('#sp-clear-history')?.addEventListener('click', async () => {
      if (!confirm('Clear all browsing history?')) return;
      await deps.clearHistory?.();
      showToast('History cleared');
    });

    // Reset all
    $container.querySelector('#sp-clear-all')?.addEventListener('click', async () => {
      if (!confirm('Reset all browser data? This cannot be undone.')) return;
      if (!confirm('Are you really sure?')) return;
      await deps.clearHistory?.();
      await deps.updateSettings?.({ searchEngine: 'google', theme: 'dark' });
      applyTheme('dark');
      showToast('All data reset');
    });

    // Extension reload
    $container.querySelector('#sp-ext-reload')?.addEventListener('click', () => {
      showToast('Extensions reloaded');
    });

    // Changelog link
    $container.querySelector('#sp-changelog-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('show-changelog'));
    });
  }

  function showSection(sectionId) {
    // Update nav
    $container.querySelectorAll('.sp-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    // Show/hide sections
    $container.querySelectorAll('.sp-section').forEach(section => {
      section.classList.toggle('hidden', section.dataset.section !== sectionId);
    });

    $activeSection = sectionId;
  }

  function applyTheme(id) {
    const THEMES_MAP = {
      dark: { bg: '#141416', surface: '#1a1a1e', accent: '#60a5fa' },
      nord: { bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0' },
      drac: { bg: '#282a36', surface: '#44475a', accent: '#bd93f9' },
      gruv: { bg: '#282828', surface: '#3c3836', accent: '#fabd2f' },
      pard: { bg: '#1e1e2e', surface: '#313244', accent: '#cba6f7' },
    };
    const t = THEMES_MAP[id] || THEMES_MAP.dark;
    const r = document.documentElement.style;
    r.setProperty('--bg', t.bg);
    r.setProperty('--surface', t.surface);
    r.setProperty('--accent', t.accent);
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'sp-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  window.SettingsPage = { render };
})();

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

  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  const THEME_FIELDS = [
    { key: 'name', label: 'Theme Name', id: 'sp-theme-name', type: 'text', fallback: 'Custom Theme' },
    { key: 'bg', label: 'Background', id: 'sp-theme-bg', type: 'color', fallback: '#141416' },
    { key: 'surface', label: 'Surface', id: 'sp-theme-surface', type: 'color', fallback: '#1a1a1e' },
    { key: 'accent', label: 'Accent', id: 'sp-theme-accent', type: 'color', fallback: '#60a5fa' },
    { key: 'text', label: 'Text', id: 'sp-theme-text', type: 'color', fallback: '#d4d4d8' },
    { key: 'border', label: 'Border', id: 'sp-theme-border', type: 'color', fallback: '#2a2a30' },
  ];

  let currentExtensions = [];
  let currentProfiles = [];
  let currentActiveProfile = 'default';

  function _esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function normalizeColor(value, fallback) {
    return HEX_COLOR_RE.test(value || '') ? value : fallback;
  }

  function getThemeTokens(theme = {}) {
    const tokens = theme.tokens && typeof theme.tokens === 'object' ? theme.tokens : {};
    return {
      name: theme.name || theme.label || theme.id || 'Custom Theme',
      bg: normalizeColor(tokens.bg || theme.bg, '#141416'),
      surface: normalizeColor(tokens.surface || theme.surface, '#1a1a1e'),
      accent: normalizeColor(tokens.accent || theme.accent, '#60a5fa'),
      text: normalizeColor(tokens.text || theme.text, '#d4d4d8'),
      border: normalizeColor(tokens.border || theme.border, '#2a2a30'),
    };
  }

  function getCustomThemes() {
    return Array.isArray(settings.customThemes) ? settings.customThemes.filter(t => t && t.id) : [];
  }

  function getAllThemes() {
    return [
      ...THEMES.map(t => ({ ...t, builtIn: true })),
      ...getCustomThemes().map(t => ({ ...t, label: t.name, custom: true })),
    ];
  }

  function slugifyThemeName(name, currentId = '') {
    const base = String(name || 'custom-theme').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-theme';
    let id = base;
    let i = 1;
    while (getAllThemes().some(t => t.id === id && t.id !== currentId)) {
      id = `${base}-${i++}`;
    }
    return id;
  }

  function buildThemeCard(theme) {
    const tokens = getThemeTokens(theme);
    const currentTheme = settings.theme || 'dark';
    const active = theme.id === currentTheme;
    const label = _esc(tokens.name);
    const id = _esc(theme.id);
    const owner = theme.custom ? '<span class="sp-theme-owner">Custom</span>' : '';
    const actions = theme.custom ? `
              <div class="sp-theme-actions">
                <button type="button" class="sp-theme-action" data-edit-theme="${id}">Edit</button>
                <button type="button" class="sp-theme-action sp-theme-action-danger" data-delete-theme="${id}">Delete</button>
              </div>
            ` : '';

    return `
              <div class="sp-theme-card ${active ? 'active' : ''}" data-theme="${id}">
                <div class="sp-theme-preview" style="background: linear-gradient(135deg, ${tokens.bg}, ${tokens.surface}); border-color: ${active ? tokens.accent : 'transparent'}">
                  <div class="sp-theme-accent" style="background: ${tokens.accent}"></div>
                </div>
                <span class="sp-theme-label">${label}</span>
                ${owner}
                ${actions}
              </div>
            `;
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
    const sidebarWidth = settings.sidebarWidth || 220;
    const titlebarHeight = settings.titlebarHeight || 36;
    const customCSS = settings.customCSS || '';
    const customThemes = getCustomThemes();

    return html`
      <div class="sp-section" data-section="appearance">
        <h2 class="sp-section-title">Appearance</h2>
        
        <div class="sp-group">
          <div class="sp-group-title">Theme</div>
          <div class="sp-theme-grid">
            ${THEMES.map(buildThemeCard).join('')}
          </div>
        </div>

        <div class="sp-group">
          <div class="sp-group-title">Custom Themes</div>
          <div class="sp-theme-actions-row">
            <button type="button" id="sp-theme-new" class="sp-btn sp-btn-secondary">Create Custom Theme</button>
          </div>
          <div class="sp-theme-grid sp-theme-grid-custom">
            ${customThemes.length ? customThemes.map(t => buildThemeCard({ ...t, label: t.name, custom: true })).join('') : `
              <div class="sp-empty sp-theme-empty">No custom themes yet. Create one to store your own color tokens.</div>
            `}
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
            <label class="sp-label">Sidebar Width</label>
            <div class="sp-range-row">
              <input id="sp-sidebar-width" type="range" min="160" max="320" value="${sidebarWidth}" class="sp-range" />
              <span id="sp-sidebar-width-val" class="sp-range-val">${sidebarWidth}px</span>
            </div>
          </div>
          <div class="sp-field">
            <label class="sp-label">Titlebar Height</label>
            <div class="sp-range-row">
              <input id="sp-titlebar-height" type="range" min="28" max="48" value="${titlebarHeight}" class="sp-range" />
              <span id="sp-titlebar-height-val" class="sp-range-val">${titlebarHeight}px</span>
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

        <div class="sp-group">
          <div class="sp-group-title">Custom CSS</div>
          <div class="sp-field">
            <label class="sp-label">CSS Overrides</label>
            <textarea id="sp-custom-css" class="sp-textarea" rows="8" placeholder=":root { --accent: #ff6b6b; }">${customCSS}</textarea>
            <span class="sp-hint">Override any CSS variable or selector. Changes apply live.</span>
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

  function buildThemeDialog() {
    return html`
      <div id="sp-theme-dialog" class="sp-dialog-overlay hidden">
        <div class="sp-dialog" role="dialog" aria-labelledby="sp-theme-dialog-title">
          <div class="sp-dialog-header">
            <h3 id="sp-theme-dialog-title">Custom Theme</h3>
            <button type="button" id="sp-theme-dialog-close" class="sp-dialog-close" aria-label="Close">✕</button>
          </div>
          <div class="sp-dialog-body">
            <input id="sp-theme-id" type="hidden" value="" />
            ${THEME_FIELDS.map(f => `
              <div class="sp-field">
                <label class="sp-label" for="${f.id}">${f.label}</label>
                <input id="${f.id}" class="sp-input sp-theme-field" type="${f.type}" value="" placeholder="${_esc(f.fallback)}" />
              </div>
            `).join('')}
            <div id="sp-theme-dialog-error" class="sp-form-error" role="alert"></div>
          </div>
          <div class="sp-dialog-footer">
            <button type="button" id="sp-theme-dialog-cancel" class="sp-btn sp-btn-secondary">Cancel</button>
            <button type="button" id="sp-theme-dialog-save" class="sp-btn sp-btn-primary">Save Theme</button>
          </div>
        </div>
      </div>
    `;
  }

  async function render(container, settingsData, extensions, profilesList, activeProfile, storageDeps) {
    $container = container;
    settings = settingsData || {};
    deps = storageDeps || {};
    currentExtensions = extensions || [];
    currentProfiles = profilesList || [];
    currentActiveProfile = activeProfile || 'default';

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

    currentExtensions = extensions || [];
    currentProfiles = profilesList || [];
    currentActiveProfile = activeProfile || 'default';

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
          ${buildThemeDialog()}
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
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit-theme], [data-delete-theme]')) return;
        const themeId = card.dataset.theme;
        $container.querySelectorAll('.sp-theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        settings.theme = themeId;
        deps.updateSettings?.({ theme: themeId });
        // Apply theme immediately
        applyTheme(themeId);
      });
    });

    // Custom theme builder
    $container.querySelector('#sp-theme-new')?.addEventListener('click', () => openThemeDialog());
    $container.querySelectorAll('[data-edit-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = getCustomThemes().find(t => t.id === btn.dataset.editTheme);
        openThemeDialog(theme);
      });
    });
    $container.querySelectorAll('[data-delete-theme]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this custom theme?')) return;
        const themeId = btn.dataset.deleteTheme;
        settings.customThemes = getCustomThemes().filter(t => t.id !== themeId);
        if (settings.theme === themeId) {
          settings.theme = settings.customThemes[0]?.id || 'dark';
          applyTheme(settings.theme);
        }
        await deps.updateSettings?.({ theme: settings.theme, customThemes: settings.customThemes });
        await refreshSettingsPage();
        showToast('Custom theme deleted');
      });
    });
    $container.querySelector('#sp-theme-dialog-close')?.addEventListener('click', closeThemeDialog);
    $container.querySelector('#sp-theme-dialog-cancel')?.addEventListener('click', closeThemeDialog);
    $container.querySelector('#sp-theme-dialog')?.addEventListener('click', (e) => {
      if (e.target.id === 'sp-theme-dialog') closeThemeDialog();
    });
    $container.querySelector('#sp-theme-dialog-save')?.addEventListener('click', saveThemeDialog);

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

    // Sidebar width
    const sidebarWidthInput = $container.querySelector('#sp-sidebar-width');
    const sidebarWidthVal = $container.querySelector('#sp-sidebar-width-val');
    sidebarWidthInput?.addEventListener('input', (e) => {
      sidebarWidthVal.textContent = e.target.value + 'px';
      document.documentElement.style.setProperty('--sidebar-w', e.target.value + 'px');
    });
    sidebarWidthInput?.addEventListener('change', (e) => {
      settings.sidebarWidth = parseInt(e.target.value);
      deps.updateSettings?.({ sidebarWidth: parseInt(e.target.value) });
    });

    // Titlebar height
    const titlebarHeightInput = $container.querySelector('#sp-titlebar-height');
    const titlebarHeightVal = $container.querySelector('#sp-titlebar-height-val');
    titlebarHeightInput?.addEventListener('input', (e) => {
      titlebarHeightVal.textContent = e.target.value + 'px';
      document.documentElement.style.setProperty('--titlebar-h', e.target.value + 'px');
    });
    titlebarHeightInput?.addEventListener('change', (e) => {
      settings.titlebarHeight = parseInt(e.target.value);
      deps.updateSettings?.({ titlebarHeight: parseInt(e.target.value) });
    });

    // Custom CSS
    let customCSSTimer = null;
    const customCSSTextarea = $container.querySelector('#sp-custom-css');
    let customCSSStyleEl = document.getElementById('sp-custom-css-style');
    if (!customCSSStyleEl) {
      customCSSStyleEl = document.createElement('style');
      customCSSStyleEl.id = 'sp-custom-css-style';
      document.head.appendChild(customCSSStyleEl);
    }
    // Apply existing custom CSS on load
    if (settings.customCSS) {
      customCSSStyleEl.textContent = settings.customCSS;
    }
    customCSSTextarea?.addEventListener('input', (e) => {
      clearTimeout(customCSSTimer);
      customCSSTimer = setTimeout(() => {
        customCSSStyleEl.textContent = e.target.value;
      }, 300);
    });
    customCSSTextarea?.addEventListener('change', (e) => {
      settings.customCSS = e.target.value;
      deps.updateSettings?.({ customCSS: e.target.value });
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

  function openThemeDialog(theme) {
    const overlay = document.getElementById('sp-theme-dialog');
    if (!overlay) return;
    const tokens = theme ? getThemeTokens(theme) : {};
    THEME_FIELDS.forEach(f => {
      const el = document.getElementById(f.id);
      if (!el) return;
      el.value = theme ? (f.key === 'name' ? tokens.name : tokens[f.key]) : (f.key === 'name' ? '' : f.fallback);
    });
    document.getElementById('sp-theme-dialog-title').textContent = theme ? 'Edit Custom Theme' : 'Create Custom Theme';
    const idEl = document.getElementById('sp-theme-id');
    if (idEl) idEl.value = theme?.id || '';
    setThemeDialogError('');
    overlay.classList.remove('hidden');
    document.getElementById('sp-theme-name')?.focus();
  }

  function closeThemeDialog() {
    document.getElementById('sp-theme-dialog')?.classList.add('hidden');
    setThemeDialogError('');
  }

  function setThemeDialogError(message) {
    const el = document.getElementById('sp-theme-dialog-error');
    if (el) el.textContent = message || '';
  }

  function readThemeDialog() {
    const values = {
      id: document.getElementById('sp-theme-id')?.value || '',
    };
    for (const f of THEME_FIELDS) {
      const el = document.getElementById(f.id);
      values[f.key] = el?.value ?? '';
    }
    return values;
  }

  async function saveThemeDialog() {
    const values = readThemeDialog();
    const name = values.name.trim();
    if (!name) {
      setThemeDialogError('Theme name is required.');
      return;
    }

    const existing = getCustomThemes().find(t => t.id === values.id);
    const id = existing?.id || slugifyThemeName(name, values.id);
    if (THEMES.some(t => t.id === id)) {
      setThemeDialogError('That theme id already exists.');
      return;
    }

    const nextThemes = getCustomThemes().filter(t => t.id !== id);
    const theme = {
      id,
      name,
      tokens: {
        bg: normalizeColor(values.bg, '#141416'),
        surface: normalizeColor(values.surface, '#1a1a1e'),
        accent: normalizeColor(values.accent, '#60a5fa'),
        text: normalizeColor(values.text, '#d4d4d8'),
        border: normalizeColor(values.border, '#2a2a30'),
      },
      updatedAt: Date.now(),
    };

    const invalidColor = Object.entries(theme.tokens).find(([, color]) => !HEX_COLOR_RE.test(color));
    if (invalidColor) {
      setThemeDialogError('Use valid 6-digit hex colors.');
      return;
    }

    nextThemes.push(theme);
    settings.customThemes = nextThemes;
    settings.theme = id;
    if (deps.updateSettings) {
      await deps.updateSettings({ theme: id, customThemes: nextThemes });
    }
    applyTheme(id);
    closeThemeDialog();
    await refreshSettingsPage();
    showToast('Custom theme saved');
  }

  async function refreshSettingsPage() {
    if (!$container) return;
    const active = $activeSection || 'appearance';
    await render($container, settings, currentExtensions, currentProfiles, currentActiveProfile, deps);
    showSection(active);
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
    const allThemes = getAllThemes();
    const t = allThemes.find(t => t.id === id) || allThemes[0];
    const tokens = getThemeTokens(t);
    const r = document.documentElement.style;
    r.setProperty('--bg', tokens.bg);
    r.setProperty('--bg-elevated', tokens.surface);
    r.setProperty('--bg-hover', tokens.surface);
    r.setProperty('--bg-active', tokens.border);
    r.setProperty('--surface', tokens.surface);
    r.setProperty('--border', tokens.border);
    r.setProperty('--text', tokens.text);
    r.setProperty('--text-dim', tokens.text);
    r.setProperty('--text-faint', tokens.text);
    r.setProperty('--accent', tokens.accent);
    r.setProperty('--accent-hover', tokens.accent);
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

  window.SettingsPage = { render, applyTheme, openThemeDialog, saveThemeDialog };
})();

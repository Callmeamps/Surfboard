/**
 * Settings Module - Extracted from app.js
 * Handles settings overlay UI, theme swatches, AI config, danger zone
 */
(function () {
  'use strict';

  const THEMES = [
    { id: 'dark', bg: '#141416', surface: '#1a1a1e', accent: '#60a5fa' },
    { id: 'nord', bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0' },
    { id: 'drac', bg: '#282a36', surface: '#44475a', accent: '#bd93f9' },
    { id: 'gruv', bg: '#282828', surface: '#3c3836', accent: '#fabd2f' },
    { id: 'pard', bg: '#1e1e2e', surface: '#313244', accent: '#cba6f7' },
  ];
  const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));

  let $settingsOv = null;
  let deps = null;
  let currentSettings = {};
  let historyEntries = [];

  function applyTheme(id) {
    const t = THEME_BY_ID[id] || THEME_BY_ID.dark;
    const r = document.documentElement.style;
    r.setProperty('--bg', t.bg);
    r.setProperty('--surface', t.surface);
    r.setProperty('--accent', t.accent);
    currentSettings.theme = id;
    deps?.storage?.updateSettings?.({ theme: id });
  }

  function setHistory(entries) {
    historyEntries = entries;
  }

  function updateSettings(newSettings) {
    Object.assign(currentSettings, newSettings);
  }

  function populateAi() {
    if (!$settingsOv) return;
    const s = (id, v) => {
      const e = document.getElementById(id);
      if (e) e.value = v || '';
    };
    s('set-ai-provider', currentSettings.aiProvider);
    s('set-ai-key', currentSettings.aiApiKey);
    s('set-ai-baseurl', currentSettings.aiBaseUrl);
    s('set-ai-model', currentSettings.aiModel);
    s('set-ai-sysprompt', currentSettings.aiSystemPrompt);
    const $t = document.getElementById('set-ai-temp');
    const $tV = document.getElementById('set-ai-temp-val');
    if ($t) {
      $t.value = currentSettings.aiTemperature ?? 0.7;
      if ($tV) $tV.textContent = $t.value;
    }
  }

  function buildSettings() {
    const $app = document.getElementById('app');
    $settingsOv = document.createElement('div');
    $settingsOv.className = 'settings-overlay';
    $settingsOv.innerHTML = `<div class="settings-panel">
<div class="settings-header"><h2>⚙️ Settings</h2><button class="settings-close no-drag">✕</button></div>
<div class="settings-body">
  <div class="settings-section">
    <div class="settings-section-title">Search</div>
    <div class="settings-row">
      <div class="settings-label">Default Engine</div>
      <select id="set-se" class="settings-select no-drag">
        <option value="google">Google</option>
        <option value="ddg">DuckDuckGo</option>
        <option value="brave">Brave</option>
      </select>
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-title">Appearance</div>
    <div class="settings-row"><div class="settings-label">Theme</div></div>
    <div id="set-themes" class="theme-swatches"></div>
  </div>
  <div class="settings-section">
    <div class="settings-section-title" style="color:var(--accent)">AI Configuration</div>
    <div class="ai-config-row"><label>Provider</label>
      <select id="set-ai-provider" class="settings-select no-drag">
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="ollama">Ollama</option>
        <option value="custom">Custom / Other</option>
      </select>
    </div>
    <div class="ai-config-row"><label>API Key</label>
      <input id="set-ai-key" type="password" class="settings-input no-drag" placeholder="sk-...">
      <div class="ai-config-hint">Stored locally, never sent anywhere except your chosen API endpoint.</div>
    </div>
    <div class="ai-config-row"><label>Base URL <small>(leave blank for default)</small></label>
      <input id="set-ai-baseurl" type="text" class="settings-input no-drag" placeholder="https://api.openai.com/v1">
      <div class="ai-config-hint">Override for Ollama, proxies, or compatible APIs.</div>
    </div>
    <div class="ai-config-row"><label>Model</label>
      <input id="set-ai-model" type="text" class="settings-input no-drag" placeholder="gpt-4o">
    </div>
    <div class="ai-config-row"><label>System Prompt</label>
      <textarea id="set-ai-sysprompt" class="settings-textarea no-drag" placeholder="You are a helpful assistant..."></textarea>
    </div>
    <div class="ai-config-row">
      <div class="settings-label">Temperature <span id="set-ai-temp-val" style="color:var(--text-dim);font-size:11px;margin-left:4px">0.7</span></div>
      <input id="set-ai-temp" type="range" min="0" max="2" step="0.1" value="0.7" style="min-width:200px">
    </div>
  </div>
  <div class="settings-section">
    <div class="settings-section-title" style="color:var(--danger)">Danger Zone</div>
    <div class="settings-danger">
      <div class="settings-row">
        <div class="settings-label">Clear history</div>
        <button id="set-clear-hist" class="btn-danger no-drag">Clear</button>
      </div>
      <div class="settings-row">
        <div class="settings-label">Reset all data</div>
        <button id="set-clear-all" class="btn-danger no-drag">Reset</button>
      </div>
    </div>
  </div>
</div></div>`;

    $app.appendChild($settingsOv);
    $settingsOv.querySelector('.settings-close').addEventListener('click', () => $settingsOv.classList.add('hidden'));
    $settingsOv.addEventListener('click', (e) => {
      if (e.target === $settingsOv) $settingsOv.classList.add('hidden');
    });

    $settingsOv.querySelector('#set-se').addEventListener('change', (e) => {
      deps?.storage?.updateSettings?.({ searchEngine: e.target.value });
    });

    const aiIds = {
      aiProvider: 'set-ai-provider',
      aiApiKey: 'set-ai-key',
      aiBaseUrl: 'set-ai-baseurl',
      aiModel: 'set-ai-model',
      aiSystemPrompt: 'set-ai-sysprompt'
    };
    Object.entries(aiIds).forEach(([f, id]) => {
      const el = $settingsOv.querySelector('#' + id);
      if (el) el.addEventListener('change', () => {
        deps?.storage?.updateSettings?.({ [f]: el.type === 'checkbox' ? el.checked : el.value });
      });
    });

    const $tmp = $settingsOv.querySelector('#set-ai-temp');
    const $tmpV = $settingsOv.querySelector('#set-ai-temp-val');
    if ($tmp) {
      $tmp.addEventListener('input', () => {
        $tmpV.textContent = $tmp.value;
      });
      $tmp.addEventListener('change', () => {
        deps?.storage?.updateSettings?.({ aiTemperature: parseFloat($tmp.value) });
      });
    }

    $settingsOv.querySelector('#set-clear-hist').addEventListener('click', async () => {
      if (!confirm('Clear all history?')) return;
      await deps?.storage?.clearHistory?.();
      historyEntries = [];
    });

    $settingsOv.querySelector('#set-clear-all').addEventListener('click', async () => {
      if (!confirm('Reset all data?')) return;
      await deps?.storage?.clearHistory?.();
      await deps?.storage?.updateSettings?.({ searchEngine: 'google', theme: 'dark' });
      historyEntries = [];
      applyTheme('dark');
      $settingsOv.classList.add('hidden');
    });

    const $sw = $settingsOv.querySelector('#set-themes');
    THEMES.forEach(t => {
      const el = document.createElement('div');
      el.className = 'theme-swatch' + (t.id === (currentSettings.theme || 'dark') ? ' active' : '');
      el.style.background = `linear-gradient(135deg,${t.bg},${t.surface})`;
      el.style.color = t.accent;
      el.title = t.id;
      el.innerHTML = '<span class="check">✓</span>';
      el.addEventListener('click', () => {
        applyTheme(t.id);
        $sw.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
      });
      $sw.appendChild(el);
    });
  }

  function toggle() {
    if (!$settingsOv) buildSettings();
    if ($settingsOv.classList.contains('hidden')) {
      $settingsOv.classList.remove('hidden');
      $settingsOv.querySelector('#set-se').value = currentSettings.searchEngine || 'google';
      populateAi();
    } else {
      $settingsOv.classList.add('hidden');
    }
  }

  function openAiConfig() {
    if (!$settingsOv) buildSettings();
    $settingsOv.classList.remove('hidden');
    $settingsOv.querySelector('#set-se').value = currentSettings.searchEngine || 'google';
    populateAi();
    $settingsOv.querySelector('.settings-section:nth-child(3)')?.scrollIntoView({ behavior: 'smooth' });
    deps?.onOpenAiConfig?.();
  }

  function init(dependencies) {
    deps = dependencies;
    if (dependencies?.settings) {
      updateSettings(dependencies.settings);
    }
    if (dependencies?.history) {
      setHistory(dependencies.history);
    }
    if (dependencies?.settings?.theme) {
      applyTheme(dependencies.settings.theme);
    }
  }

window.SettingsModule = {
    init,
    toggle,
    setHistory,
    updateSettings,
    applyTheme,
    openAiConfig
  };
})();
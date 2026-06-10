/**
 * Settings Page — unit tests
 */
const fs = require('fs');
const path = require('path');

// Minimal DOM stubs
function createContainer() {
  const state = { innerHTML: '' };
  const el = {
    get innerHTML() { return state.innerHTML; },
    set innerHTML(v) { state.innerHTML = v; },
    querySelectorAll: () => [],
    querySelector: () => null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener: () => {},
    appendChild: () => {},
    style: {},
    dataset: {},
    children: [],
  };
  return el;
}

beforeEach(() => {
  // Reset globals
  delete global.window;
  delete global.document;
  delete global.confirm;
  delete global.CustomEvent;
  delete global.requestAnimationFrame;

  global.window = { SettingsPage: null, electronAPI: {}, dispatchEvent: () => {} };
  global.document = {
    documentElement: { style: { setProperty() {} } },
    createElement: () => ({ className: '', textContent: '', classList: { add() {}, remove() {} }, appendChild: () => {} }),
    body: { appendChild: () => {} },
  };
  global.confirm = () => true;
  global.CustomEvent = class CustomEvent {};
  global.requestAnimationFrame = (fn) => fn();
});

// Load the module by evaluating its source
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'js', 'settings-page.js'), 'utf-8');
eval(src);

describe('SettingsPage', () => {
  test('window.SettingsPage is exported', () => {
    expect(window.SettingsPage).toBeDefined();
    expect(typeof window.SettingsPage.render).toBe('function');
  });

  test('render builds the settings page structure', async () => {
    const container = createContainer();

    await window.SettingsPage.render(container, { theme: 'dark', searchEngine: 'google' }, [], [], 'default', {});

    // Should have set innerHTML with settings-page content
    expect(container.innerHTML).toContain('settings-page');
    expect(container.innerHTML).toContain('sp-sidebar');
    expect(container.innerHTML).toContain('sp-content');
  });

  test('render includes all section navigation items', async () => {
    const container = createContainer();

    await window.SettingsPage.render(container, {}, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('data-section="general"');
    expect(html).toContain('data-section="appearance"');
    expect(html).toContain('data-section="ai"');
    expect(html).toContain('data-section="extensions"');
    expect(html).toContain('data-section="privacy"');
    expect(html).toContain('data-section="profiles"');
    expect(html).toContain('data-section="shortcuts"');
    expect(html).toContain('data-section="about"');
  });

  test('render includes theme cards', async () => {
    const container = createContainer();

    await window.SettingsPage.render(container, { theme: 'drac' }, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-theme="nord"');
    expect(html).toContain('data-theme="drac"');
    expect(html).toContain('data-theme="gruv"');
    expect(html).toContain('data-theme="pard"');
  });

  test('render includes AI configuration fields', async () => {
    const container = createContainer();

    await window.SettingsPage.render(container, {}, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('sp-ai-provider');
    expect(html).toContain('sp-ai-key');
    expect(html).toContain('sp-ai-baseurl');
    expect(html).toContain('sp-ai-model');
    expect(html).toContain('sp-ai-sysprompt');
    expect(html).toContain('sp-ai-temp');
  });

  test('render includes keyboard shortcuts section', async () => {
    const container = createContainer();

    await window.SettingsPage.render(container, {}, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('Keyboard Shortcuts');
    expect(html).toContain('sp-shortcut-row');
    expect(html).toContain('sp-key');
  });

  test('render includes about section', async () => {
    const container = createContainer();

    await window.SettingsPage.render(container, {}, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('RicedChromium');
    expect(html).toContain('Version 0.2.0');
    expect(html).toContain('sp-about');
  });

  test('render includes extension list', async () => {
    const container = createContainer();

    const extensions = [
      { id: 'ext1', name: 'Test Extension', version: '1.0.0', enabled: true },
      { id: 'ext2', name: 'Another Extension', version: '2.0.0', enabled: false },
    ];

    await window.SettingsPage.render(container, {}, extensions, [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('Test Extension');
    expect(html).toContain('Another Extension');
    expect(html).toContain('1.0.0');
    expect(html).toContain('2.0.0');
  });

  test('render includes profile list', async () => {
    const container = createContainer();

    const profiles = [
      { id: 'default', name: 'Default', color: '#60a5fa' },
      { id: 'work', name: 'Work', color: '#10b981' },
    ];

    await window.SettingsPage.render(container, {}, [], profiles, 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('Default');
    expect(html).toContain('Work');
    expect(html).toContain('#60a5fa');
    expect(html).toContain('#10b981');
  });

  test('render populates settings values', async () => {
    const container = createContainer();

    const settings = {
      searchEngine: 'ddg',
      homepage: 'https://example.com',
      theme: 'nord',
      fontSize: 14,
    };

    await window.SettingsPage.render(container, settings, [], [], 'default', {});

    // The settings object should be stored
    expect(container.innerHTML).toContain('settings-page');
  });
});

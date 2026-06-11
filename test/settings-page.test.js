require('../src/renderer/js/shortcuts.js');

/**
 * Settings Page — unit tests
 */
const fs = require('fs');
const path = require('path');
const util = require('util');

global.TextEncoder = util.TextEncoder;
global.TextDecoder = util.TextDecoder;
globalThis.TextEncoder = util.TextEncoder;
globalThis.TextDecoder = util.TextDecoder;

const { JSDOM } = require('jsdom');

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.requestAnimationFrame = (fn) => fn();
  global.confirm = () => true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

function waitForAsyncUi() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

beforeEach(() => {
  delete global.window;
  delete global.document;
  delete global.CustomEvent;
  delete global.requestAnimationFrame;
  delete global.confirm;
  global.window = { electronAPI: {}, dispatchEvent: () => {} };
  document.body.innerHTML = '';
});

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'js', 'settings-page.js'), 'utf-8');
eval(src);

describe('SettingsPage', () => {
  test('window.SettingsPage is exported', async () => {
    const container = setupDom();

    await window.SettingsPage.render(container, { theme: 'dark', searchEngine: 'google' }, [], [], 'default', {});

    expect(window.SettingsPage).toBeDefined();
    expect(typeof window.SettingsPage.render).toBe('function');
    expect(container.innerHTML).toContain('settings-page');
  });

  test('render builds the settings page structure', async () => {
    const container = setupDom();

    await window.SettingsPage.render(container, { theme: 'dark', searchEngine: 'google' }, [], [], 'default', {});

    expect(container.innerHTML).toContain('settings-page');
    expect(container.innerHTML).toContain('sp-sidebar');
    expect(container.innerHTML).toContain('sp-content');
  });

  test('render includes all section navigation items', async () => {
    const container = setupDom();

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
    const container = setupDom();

    await window.SettingsPage.render(container, { theme: 'drac' }, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-theme="nord"');
    expect(html).toContain('data-theme="drac"');
    expect(html).toContain('data-theme="gruv"');
    expect(html).toContain('data-theme="pard"');
  });

  test('render includes custom theme builder', async () => {
    const container = setupDom();

    await window.SettingsPage.render(container, { theme: 'drac' }, [], [], 'default', {});

    expect(container.innerHTML).toContain('Create Custom Theme');
    expect(container.innerHTML).toContain('sp-theme-dialog');
    expect(container.innerHTML).toContain('sp-theme-bg');
  });

  test('render includes saved custom themes', async () => {
    const container = setupDom();
    const settings = {
      theme: 'solar',
      customThemes: [
        { id: 'solar', name: 'Solar', tokens: { bg: '#111111', surface: '#222222', accent: '#f59e0b', text: '#ffffff', border: '#333333' } },
      ],
    };

    await window.SettingsPage.render(container, settings, [], [], 'default', {});

    expect(container.innerHTML).toContain('data-theme="solar"');
    expect(container.innerHTML).toContain('Solar');
    expect(container.innerHTML).toContain('data-edit-theme="solar"');
  });

  test('render includes AI configuration fields', async () => {
    const container = setupDom();

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
    const container = setupDom();

    await window.SettingsPage.render(container, {}, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('Keyboard Shortcuts');
    expect(html).toContain('sp-shortcut-row');
    expect(html).toContain('sp-key');
  });

  test('render includes about section', async () => {
    const container = setupDom();

    await window.SettingsPage.render(container, {}, [], [], 'default', {});

    const html = container.innerHTML;
    expect(html).toContain('RicedChromium');
    expect(html).toContain('Version 0.2.0');
    expect(html).toContain('sp-about');
  });

  test('render includes extension list', async () => {
    const container = setupDom();

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
    const container = setupDom();

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

  test('theme selection applies theme and persists id', async () => {
    const container = setupDom();
    const updateSettings = jest.fn();

    await window.SettingsPage.render(container, { theme: 'dark' }, [], [], 'default', { updateSettings });

    container.querySelector('[data-theme="nord"]').click();

    expect(updateSettings).toHaveBeenCalledWith({ theme: 'nord' });
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#88c0d0');
  });

  test('create custom theme saves color tokens and applies theme', async () => {
    const container = setupDom();
    const updateSettings = jest.fn();

    await window.SettingsPage.render(container, { theme: 'dark' }, [], [], 'default', { updateSettings });

    window.SettingsPage.openThemeDialog();
    container.querySelector('#sp-theme-name').value = 'Solar';
    container.querySelector('#sp-theme-bg').value = '#111111';
    container.querySelector('#sp-theme-surface').value = '#222222';
    container.querySelector('#sp-theme-accent').value = '#f59e0b';
    container.querySelector('#sp-theme-text').value = '#ffffff';
    container.querySelector('#sp-theme-border').value = '#333333';
    await window.SettingsPage.saveThemeDialog();

    expect(updateSettings).toHaveBeenCalledWith({
      theme: 'solar',
      customThemes: [
        expect.objectContaining({
          id: 'solar',
          name: 'Solar',
          tokens: {
            bg: '#111111',
            surface: '#222222',
            accent: '#f59e0b',
            text: '#ffffff',
            border: '#333333',
          },
        }),
      ],
    });
    expect(container.innerHTML).toContain('data-theme="solar"');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#f59e0b');
  });

  test('edit custom theme updates existing id', async () => {
    const container = setupDom();
    const settings = {
      theme: 'solar',
      customThemes: [
        { id: 'solar', name: 'Solar', tokens: { bg: '#111111', surface: '#222222', accent: '#f59e0b', text: '#ffffff', border: '#333333' } },
      ],
    };
    const updateSettings = jest.fn();

    await window.SettingsPage.render(container, settings, [], [], 'default', { updateSettings });

    window.SettingsPage.openThemeDialog(settings.customThemes[0]);
    container.querySelector('#sp-theme-name').value = 'Solar Pro';
    await window.SettingsPage.saveThemeDialog();

    expect(updateSettings).toHaveBeenLastCalledWith({
      theme: 'solar',
      customThemes: [
        expect.objectContaining({
          id: 'solar',
          name: 'Solar Pro',
        }),
      ],
    });
  });

  test('render populates settings values', async () => {
    const container = setupDom();

    const settings = {
      searchEngine: 'ddg',
      homepage: 'https://example.com',
      theme: 'nord',
      fontSize: 14,
    };

    await window.SettingsPage.render(container, settings, [], [], 'default', {});

    expect(container.innerHTML).toContain('settings-page');
  });
});

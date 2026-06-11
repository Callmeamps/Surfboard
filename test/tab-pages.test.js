/**
 * Tab Pages module tests
 * Tests page rendering, navigation, event binding, and IPC integration.
 */
describe('TabPages', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="internal-pages"></div>
        <aside id="right-sidebar">
          <div id="right-sidebar-tools"></div>
          <button id="right-sidebar-toggle"></button>
        </aside>
        <div id="popup-panel" class="hidden">
          <div id="popup-panel-header">
            <span id="popup-panel-title">Panel</span>
            <div id="popup-panel-actions">
              <button id="popup-panel-pin"></button>
              <button id="popup-panel-close"></button>
            </div>
          </div>
          <div id="popup-panel-content"></div>
        </div>
        <div id="canvas-host" class="hidden">
          <div id="canvas-host-header">
            <span id="canvas-host-title">Canvas</span>
            <button id="canvas-host-close"></button>
          </div>
          <div id="canvas-host-content"></div>
        </div>
      </div>
    `;
    container = document.getElementById('internal-pages');

    // Mock electronAPI
    window.electronAPI = {
      extensions: {
        list: jest.fn().mockResolvedValue([]),
        load: jest.fn().mockResolvedValue({}),
        unload: jest.fn().mockResolvedValue({}),
      },
      tabs: {
        create: jest.fn().mockResolvedValue({}),
      },
      storage: {
        getSettings: jest.fn().mockResolvedValue({}),
      },
      shell: {
        start: jest.fn().mockResolvedValue({}),
        stop: jest.fn().mockResolvedValue({}),
        clear: jest.fn().mockResolvedValue({}),
        command: jest.fn().mockResolvedValue({ ok: true }),
        onOutput: jest.fn().mockReturnValue(() => {}),
        onStatus: jest.fn().mockReturnValue(() => {}),
      },
      chat: {
        send: jest.fn().mockResolvedValue('test response'),
      },
    };

    // Reset modules
    delete window.RightSidebar;
    delete window.TabPages;

    const rsSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/renderer/js/right-sidebar.js'), 'utf8'
    );
    const tpSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/renderer/js/tab-pages.js'), 'utf8'
    );
    eval(rsSrc);
    eval(tpSrc);
  });

  afterEach(() => {
    delete window.electronAPI;
    delete window.RightSidebar;
    delete window.TabPages;
  });

  // ── Public API ──────────────────────────────────────────

  test('TabPages exposes render and getPageIds', () => {
    expect(window.TabPages).toBeDefined();
    expect(typeof window.TabPages.render).toBe('function');
    expect(typeof window.TabPages.getPageIds).toBe('function');
  });

  test('getPageIds returns all page IDs', () => {
    const ids = window.TabPages.getPageIds();
    expect(ids).toEqual(['extensions', 'agents', 'shell', 'workflows', 'links', 'cookies']);
  });

  // ── Extensions page ──────────────────────────────────────

  test('render extensions page with no extensions shows empty state', async () => {
    window.electronAPI.extensions.list.mockResolvedValue([]);
    await window.TabPages.render(container, 'extensions', {});
    expect(container.innerHTML).toContain('No extensions installed');
    expect(container.innerHTML).toContain('Browse Extensions');
  });

  test('render extensions page with extensions shows cards', async () => {
    window.electronAPI.extensions.list.mockResolvedValue([
      { id: 'ublock', name: 'uBlock Origin', version: '1.0', enabled: true, description: 'Ad blocker' },
      { id: 'vsc', name: 'Video Speed Controller', version: '2.0', enabled: false },
    ]);
    await window.TabPages.render(container, 'extensions', {});
    expect(container.innerHTML).toContain('uBlock Origin');
    expect(container.innerHTML).toContain('Video Speed Controller');
    expect(container.innerHTML).toContain('Ad blocker');
  });

  test('extensions page shows popup and options links when available', async () => {
    window.electronAPI.extensions.list.mockResolvedValue([{
      id: 'test', name: 'Test Ext', popupUrl: 'popup.html', optionsUrl: 'options.html',
    }]);
    await window.TabPages.render(container, 'extensions', {});
    expect(container.innerHTML).toContain('Popup');
    expect(container.innerHTML).toContain('Options');
  });

  test('extensions page toggle calls load/unload', async () => {
    window.electronAPI.extensions.list.mockResolvedValue([
      { id: 'ext1', name: 'Ext 1', enabled: true },
    ]);
    await window.TabPages.render(container, 'extensions', {});
    const toggle = container.querySelector('[data-ext-toggle]');
    expect(toggle).not.toBeNull();
    // Uncheck → should call unload
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(window.electronAPI.extensions.unload).toHaveBeenCalledWith('ext1');
  });

  test('extensions page remove button calls unload', async () => {
    window.electronAPI.extensions.list.mockResolvedValue([
      { id: 'ext1', name: 'Ext 1' },
    ]);
    await window.TabPages.render(container, 'extensions', {});
    // Mock confirm to auto-accept
    const origConfirm = window.confirm;
    window.confirm = jest.fn().mockReturnValue(true);
    const removeBtn = container.querySelector('[data-ext-remove]');
    expect(removeBtn).not.toBeNull();
    removeBtn.click();
    expect(window.electronAPI.extensions.unload).toHaveBeenCalledWith('ext1');
    window.confirm = origConfirm;
  });

  // ── Agents page ──────────────────────────────────────────

  test('render agents page shows session list and chat area', async () => {
    await window.TabPages.render(container, 'agents', {});
    expect(container.innerHTML).toContain('AI Agents');
    expect(container.innerHTML).toContain('Sessions');
    expect(container.innerHTML).toContain('New Chat');
    expect(container.innerHTML).toContain('Start a conversation');
  });

  test('agents page new button clears messages', async () => {
    await window.TabPages.render(container, 'agents', {});
    const newBtn = container.querySelector('#tp-agent-new');
    expect(newBtn).not.toBeNull();
    newBtn.click();
    const messages = container.querySelector('#tp-agent-messages');
    expect(messages.innerHTML).toBe('');
  });

  test('agents page send button delegates to chat API', async () => {
    window.electronAPI.storage.getSettings.mockResolvedValue({ aiApiKey: 'sk-test' });
    await window.TabPages.render(container, 'agents', {});
    const input = container.querySelector('#tp-agent-input');
    const send = container.querySelector('#tp-agent-send');
    input.value = 'Hello';
    send.click();
    // Wait for async
    await new Promise(r => setTimeout(r, 100));
    expect(window.electronAPI.chat.send).toHaveBeenCalled();
  });

  // ── Shell page ───────────────────────────────────────────

  test('render shell page shows terminal layout', async () => {
    await window.TabPages.render(container, 'shell', {});
    expect(container.innerHTML).toContain('Shell');
    expect(container.innerHTML).toContain('RicedChromium Shell');
    expect(container.innerHTML).toContain('Allowlisted command');
  });

  test('shell page run button sends command', async () => {
    await window.TabPages.render(container, 'shell', {});
    const input = container.querySelector('#tp-shell-input');
    const run = container.querySelector('#tp-shell-run');
    input.value = 'ls -la';
    run.click();
    expect(window.electronAPI.shell.command).toHaveBeenCalledWith('ls -la');
    expect(input.value).toBe('');
  });

  test('shell page clear button clears output', async () => {
    await window.TabPages.render(container, 'shell', {});
    const clear = container.querySelector('#tp-shell-clear');
    clear.click();
    expect(window.electronAPI.shell.clear).toHaveBeenCalled();
    const output = container.querySelector('#tp-shell-output');
    expect(output.innerHTML).toBe('');
  });

  test('shell page stop button stops running shell', async () => {
    await window.TabPages.render(container, 'shell', {});
    const stop = container.querySelector('#tp-shell-stop');
    const status = container.querySelector('#tp-shell-status');
    status.textContent = 'running';
    stop.click();
    expect(window.electronAPI.shell.stop).toHaveBeenCalled();
  });

  test('shell page stop button starts idle shell', async () => {
    await window.TabPages.render(container, 'shell', {});
    const stop = container.querySelector('#tp-shell-stop');
    const status = container.querySelector('#tp-shell-status');
    status.textContent = 'idle';
    stop.click();
    expect(window.electronAPI.shell.start).toHaveBeenCalled();
  });

  // ── Workflows page ───────────────────────────────────────

  test('render workflows page shows sidebar and empty main', async () => {
    await window.TabPages.render(container, 'workflows', {});
    expect(container.innerHTML).toContain('Workflows');
    expect(container.innerHTML).toContain('No workflows yet');
    expect(container.innerHTML).toContain('No workflow selected');
  });

  test('workflows page new button opens editor', async () => {
    await window.TabPages.render(container, 'workflows', {});
    const newBtn = container.querySelector('#tp-wf-new');
    newBtn.click();
    expect(container.innerHTML).toContain('Workflow name');
    expect(container.innerHTML).toContain('Add Step');
  });

  test('workflows editor add step creates step row', async () => {
    await window.TabPages.render(container, 'workflows', {});
    container.querySelector('#tp-wf-new').click();
    const addStep = container.querySelector('#tp-wf-add-step');
    addStep.click();
    const steps = container.querySelector('#tp-wf-steps');
    expect(steps.children.length).toBe(1);
    expect(container.innerHTML).toContain('Action');
    expect(container.innerHTML).toContain('Target');
  });

  test('workflows editor save adds to sidebar', async () => {
    await window.TabPages.render(container, 'workflows', {});
    container.querySelector('#tp-wf-new').click();
    const nameInput = container.querySelector('#tp-wf-name');
    nameInput.value = 'My Workflow';
    container.querySelector('#tp-wf-save').click();
    expect(container.innerHTML).toContain('My Workflow');
    expect(container.innerHTML).toContain('saved');
  });

  // ── Navigation ───────────────────────────────────────────

  test('sidebar navigation switches pages', async () => {
    window.electronAPI.extensions.list.mockResolvedValue([]);
    await window.TabPages.render(container, 'extensions', {});
    // Use .tp-page selector to avoid matching nav buttons (same data-page attr)
    const extPage = container.querySelector('.tp-page[data-page="extensions"]');
    const agentPage = container.querySelector('.tp-page[data-page="agents"]');
    expect(extPage.classList.contains('hidden')).toBe(false);
    expect(agentPage.classList.contains('hidden')).toBe(true);
    // Click on agents nav item
    const agentsNav = container.querySelector('.tp-nav-item[data-page="agents"]');
    agentsNav.click();
    // Extensions page should be hidden, agents visible
    expect(extPage.classList.contains('hidden')).toBe(true);
    expect(agentPage.classList.contains('hidden')).toBe(false);
  });

  test('active nav item is highlighted', async () => {
    await window.TabPages.render(container, 'shell', {});
    const shellNav = container.querySelector('[data-page="shell"]');
    expect(shellNav.classList.contains('active')).toBe(true);
    const extNav = container.querySelector('[data-page="extensions"]');
    expect(extNav.classList.contains('active')).toBe(false);
  });

  // ── PaperTM internal URL integration ─────────────────────

  test('INTERNAL_URLS includes new tab page URLs', () => {
    // Verify papertm.js recognizes the new URLs
    const ptSrc = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/renderer/js/papertm.js'), 'utf8'
    );
    expect(ptSrc).toContain("surfboard://extensions");
    expect(ptSrc).toContain("surfboard://agents");
    expect(ptSrc).toContain("surfboard://shell");
    expect(ptSrc).toContain("surfboard://workflows");
  });
});

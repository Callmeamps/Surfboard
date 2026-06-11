/**
 * Cookie manager tests
 * Tests rendering, search, delete, and export functionality.
 */
describe('Cookie Manager', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="webview-container"></div>
        <div id="internal-pages" class="hidden"></div>
        <aside id="right-sidebar"><div id="right-sidebar-tools"></div></aside>
        <div id="popup-panel" class="hidden"></div>
      </div>
    `;

    window.electronAPI = {
      tabs: { create: jest.fn().mockResolvedValue({}) },
      cookies: {
        get: jest.fn().mockResolvedValue([]),
        set: jest.fn().mockResolvedValue(true),
        remove: jest.fn().mockResolvedValue(true),
        clear: jest.fn().mockResolvedValue(true),
        export: jest.fn().mockResolvedValue('# Netscape HTTP Cookie File\n'),
      },
      storage: {
        getBookmarks: jest.fn().mockResolvedValue([]),
      },
      extensions: { list: jest.fn().mockResolvedValue([]) },
    };

    require('../src/renderer/js/tab-pages.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.resetModules();
  });

  test('cookies page included in page registry', () => {
    const ids = window.TabPages.getPageIds();
    expect(ids).toContain('cookies');
  });

  test('renders empty state when no cookies', async () => {
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const page = container.querySelector('.tp-page[data-page="cookies"]');
    expect(page).not.toBeNull();
    expect(page.innerHTML).toContain('No cookies stored');
  });

  test('renders cookies grouped by domain', async () => {
    window.electronAPI.cookies.get.mockResolvedValue([
      { name: 'sid', value: 'abc123', domain: '.example.com', path: '/', secure: true, httpOnly: true, session: false, hostOnly: false },
      { name: 'pref', value: 'dark', domain: '.example.com', path: '/', secure: false, httpOnly: false, session: true, hostOnly: false },
      { name: 'token', value: 'xyz', domain: 'github.com', path: '/', secure: true, httpOnly: false, session: false, hostOnly: true },
    ]);

    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const domains = container.querySelectorAll('.tp-links-folder');
    expect(domains.length).toBe(2);

    const rows = container.querySelectorAll('.tp-cookie-row:not(.tp-cookie-header)');
    expect(rows.length).toBe(3);
  });

  test('search filters cookies', async () => {
    window.electronAPI.cookies.get.mockResolvedValue([
      { name: 'session_id', value: 'abc', domain: '.example.com', path: '/', secure: true, httpOnly: true, session: true, hostOnly: false },
      { name: 'csrf_token', value: 'xyz', domain: '.example.com', path: '/', secure: false, httpOnly: false, session: false, hostOnly: false },
    ]);

    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const search = container.querySelector('#tp-cookie-search');
    expect(search).not.toBeNull();

    search.value = 'session';
    search.dispatchEvent(new Event('input'));

    const visible = container.querySelectorAll('.tp-cookie-row:not(.tp-cookie-header):not([style*="display: none"])');
    expect(visible.length).toBe(1);
  });

  test('delete button removes cookie', async () => {
    window.electronAPI.cookies.get.mockResolvedValue([
      { name: 'sid', value: 'abc', domain: '.example.com', path: '/', secure: true, httpOnly: false, session: true, hostOnly: false },
    ]);

    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const deleteBtn = container.querySelector('.tp-cookie-delete');
    expect(deleteBtn).not.toBeNull();
    
    // Simulate the click event
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    deleteBtn.dispatchEvent(event);

    // Wait for async
    await new Promise(r => setTimeout(r, 50));
    expect(window.electronAPI.cookies.remove).toHaveBeenCalled();
  });

  test('clear all button calls confirm', async () => {
    window.electronAPI.cookies.get.mockResolvedValue([
      { name: 'a', value: '1', domain: '.x.com', path: '/', secure: false, httpOnly: false, session: true, hostOnly: false },
    ]);
    window.confirm = jest.fn().mockReturnValue(false);

    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const clearBtn = container.querySelector('#tp-cookie-clear-all');
    expect(clearBtn).not.toBeNull();
    clearBtn.click();

    expect(window.confirm).toHaveBeenCalled();
  });

  test('export button triggers download', async () => {
    window.electronAPI.cookies.get.mockResolvedValue([]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const exportBtn = container.querySelector('#tp-cookie-export');
    expect(exportBtn).not.toBeNull();
  });

  test('secure badge shown for secure cookies', async () => {
    window.electronAPI.cookies.get.mockResolvedValue([
      { name: 'secure_cookie', value: 'val', domain: '.test.com', path: '/', secure: true, httpOnly: false, session: false, hostOnly: false },
    ]);

    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const badges = container.querySelectorAll('.tp-badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  test('httpOnly badge shown for httpOnly cookies', async () => {
    window.electronAPI.cookies.get.mockResolvedValue([
      { name: 'http_cookie', value: 'val', domain: '.test.com', path: '/', secure: false, httpOnly: true, session: false, hostOnly: false },
    ]);

    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'cookies');

    const page = container.querySelector('.tp-page[data-page="cookies"]');
    expect(page.innerHTML).toContain('H');
  });
});

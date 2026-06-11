/**
 * Links dashboard tests
 * Tests rendering, search, CRUD operations, and keyboard shortcut.
 */
describe('Links Dashboard', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="webview-container"></div>
        <div id="internal-pages" class="hidden"></div>
        <aside id="right-sidebar"><div id="right-sidebar-tools"></div></aside>
        <div id="popup-panel" class="hidden"></div>
        <div id="shortcut-overlay" class="shortcut-overlay hidden">
          <div class="shortcut-dialog">
            <div class="shortcut-dialog-header">
              <span class="shortcut-dialog-title">Keyboard Shortcuts</span>
              <button id="shortcut-close">✕</button>
            </div>
            <div id="shortcut-body" class="shortcut-dialog-body"></div>
          </div>
        </div>
      </div>
    `;

    window.electronAPI = {
      tabs: { create: jest.fn().mockResolvedValue({}) },
      storage: {
        getBookmarks: jest.fn().mockResolvedValue([]),
        addBookmark: jest.fn().mockResolvedValue({}),
        removeBookmark: jest.fn().mockResolvedValue({}),
        updateBookmark: jest.fn().mockResolvedValue({}),
      },
      extensions: { list: jest.fn().mockResolvedValue([]) },
    };

    // Load tab-pages module
    require('../src/renderer/js/tab-pages.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.resetModules();
  });

  test('links page included in page registry', () => {
    const ids = window.TabPages.getPageIds();
    expect(ids).toContain('links');
  });

  test('buildLinksPage renders empty state when no bookmarks', async () => {
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');
    // Debug: check what's in the links page
    const linksPage = container.querySelector('.tp-page[data-page="links"]');
    expect(linksPage).not.toBeNull();
    // The links page should contain empty state
    expect(linksPage.innerHTML).toContain('No saved links');
  });

  test('buildLinksPage renders bookmarks grouped by folder', async () => {
    window.electronAPI.storage.getBookmarks.mockResolvedValue([
      { id: '1', url: 'https://example.com', label: 'Example', folder: 'Dev' },
      { id: '2', url: 'https://github.com', label: 'GitHub', folder: 'Dev' },
      { id: '3', url: 'https://news.ycombinator.com', label: 'HN', folder: 'Reading' },
    ]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    const folders = container.querySelectorAll('.tp-links-folder');
    expect(folders.length).toBe(2);

    const cards = container.querySelectorAll('.tp-links-card');
    expect(cards.length).toBe(3);
  });

  test('search input filters cards', async () => {
    window.electronAPI.storage.getBookmarks.mockResolvedValue([
      { id: '1', url: 'https://example.com', label: 'Example', folder: 'Dev' },
      { id: '2', url: 'https://github.com', label: 'GitHub', folder: 'Dev' },
    ]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    const search = container.querySelector('#tp-links-search');
    expect(search).not.toBeNull();

    // Simulate search
    search.value = 'git';
    search.dispatchEvent(new Event('input'));

    const visibleCards = container.querySelectorAll('.tp-links-card:not([style*="display: none"])');
    expect(visibleCards.length).toBe(1);
  });

  test('add button exists', async () => {
    window.electronAPI.storage.getBookmarks.mockResolvedValue([]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    const addBtn = container.querySelector('#tp-links-add');
    expect(addBtn).not.toBeNull();
    expect(addBtn.textContent).toContain('Add Link');
  });

  test('import and export buttons exist', async () => {
    window.electronAPI.storage.getBookmarks.mockResolvedValue([]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    expect(container.querySelector('#tp-links-import')).not.toBeNull();
    expect(container.querySelector('#tp-links-export')).not.toBeNull();
  });

  test('delete button calls removeBookmark', async () => {
    window.electronAPI.storage.getBookmarks
      .mockResolvedValueOnce([
        { id: '1', url: 'https://example.com', label: 'Example', folder: 'Dev' },
      ])
      .mockResolvedValueOnce([]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    const deleteBtn = container.querySelector('[data-bm-delete="1"]');
    expect(deleteBtn).not.toBeNull();

    // jsdom doesn't have prompt, mock it
    window.prompt = jest.fn();
    await deleteBtn.click();

    expect(window.electronAPI.storage.removeBookmark).toHaveBeenCalledWith('1');
  });

  test('card click opens URL in new tab', async () => {
    window.electronAPI.storage.getBookmarks.mockResolvedValue([
      { id: '1', url: 'https://example.com', label: 'Example', folder: 'Dev' },
    ]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    const card = container.querySelector('.tp-links-card');
    expect(card).not.toBeNull();
    card.click();

    expect(window.electronAPI.tabs.create).toHaveBeenCalledWith('https://example.com');
  });

  test('links page has correct data-page attribute', async () => {
    window.electronAPI.storage.getBookmarks.mockResolvedValue([]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    const page = container.querySelector('.tp-page[data-page="links"]');
    expect(page).not.toBeNull();
  });

  test('folder header shows count', async () => {
    window.electronAPI.storage.getBookmarks.mockResolvedValue([
      { id: '1', url: 'https://a.com', label: 'A', folder: 'Work' },
      { id: '2', url: 'https://b.com', label: 'B', folder: 'Work' },
      { id: '3', url: 'https://c.com', label: 'C', folder: 'Work' },
    ]);
    const container = document.getElementById('internal-pages');
    container.classList.remove('hidden');
    await window.TabPages.render(container, 'links');

    const count = container.querySelector('.tp-links-folder-count');
    expect(count.textContent).toBe('3');
  });
});

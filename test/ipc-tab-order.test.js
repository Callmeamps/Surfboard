describe('tab order IPC wiring', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('preload exposes tab order storage methods', () => {
    const invoke = jest.fn();
    const exposed = {};

    jest.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld: jest.fn((key, value) => {
          exposed[key] = value;
        }),
      },
      ipcRenderer: {
        invoke,
        send: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
      },
    }));

    require('../src/preload/preload');

    expect(exposed.electronAPI.storage.loadTabOrder).toEqual(expect.any(Function));
    expect(exposed.electronAPI.storage.saveTabOrder).toEqual(expect.any(Function));
    expect(exposed.electronAPI.storage.clearTabOrder).toEqual(expect.any(Function));

    exposed.electronAPI.storage.loadTabOrder();
    exposed.electronAPI.storage.saveTabOrder(['tab-1', 'tab-2']);
    exposed.electronAPI.storage.clearTabOrder();

    expect(invoke).toHaveBeenCalledWith('storage:tab-order:get');
    expect(invoke).toHaveBeenCalledWith('storage:tab-order:save', ['tab-1', 'tab-2']);
    expect(invoke).toHaveBeenCalledWith('storage:tab-order:clear');
  });

  test('main process registers tab order storage handlers', async () => {
    const handlers = new Map();
    const shell = {
      stop: jest.fn(),
      start: jest.fn(() => ({ running: false })),
      getState: jest.fn(() => ({ running: false })),
      send: jest.fn(() => ({ ok: true })),
      clear: jest.fn(),
      on: jest.fn(),
    };

    jest.doMock('electron', () => ({
      app: { on: jest.fn() },
      ipcMain: {
        handle: jest.fn((channel, fn) => handlers.set(channel, fn)),
        on: jest.fn((channel, fn) => handlers.set(channel, fn)),
      },
      webContents: { fromId: jest.fn(() => null) },
      BrowserWindow: { getAllWindows: jest.fn(() => []) },
    }));

    jest.doMock('../src/main/browser-shell', () => ({
      createBrowserShellManager: jest.fn(() => shell),
    }));

    jest.doMock('../src/main/storage', () => ({
      getBookmarks: jest.fn(),
      addBookmark: jest.fn(),
      removeBookmark: jest.fn(),
      updateBookmark: jest.fn(),
      getHistory: jest.fn(),
      addHistoryEntry: jest.fn(),
      clearHistory: jest.fn(),
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
      loadTabOrder: jest.fn(() => Promise.resolve(['tab-1'])),
      saveTabOrder: jest.fn(),
      clearTabOrder: jest.fn(),
      getChangelogData: jest.fn(),
      shouldShowChangelog: jest.fn(),
      dismissChangelog: jest.fn(),
    }));

    const ipcHandlers = require('../src/main/ipc-handlers');
    ipcHandlers.register();

    await expect(handlers.get('storage:tab-order:get')()).resolves.toEqual(['tab-1']);
    expect(handlers.get('storage:tab-order:save')(null, ['tab-2', 'tab-3'])).toBe(true);
    expect(handlers.get('storage:tab-order:clear')()).toBe(true);
  });
});

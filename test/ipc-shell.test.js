describe('ipc shell wiring', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('register wires shell handlers and broadcasts shell output', () => {
    const handlers = new Map();
    const windowSend = jest.fn();
    const shellListeners = {};
    const shell = {
      start: jest.fn(() => ({ running: true, allowedCommands: ['git'] })),
      getState: jest.fn(() => ({ running: false, allowedCommands: ['git'] })),
      send: jest.fn((line) => ({ ok: true, command: line })),
      clear: jest.fn(),
      stop: jest.fn(() => true),
      on: jest.fn((event, cb) => {
        shellListeners[event] = cb;
      }),
    };

    jest.doMock('electron', () => ({
      app: { on: jest.fn() },
      ipcMain: {
        handle: jest.fn((channel, fn) => handlers.set(channel, fn)),
        on: jest.fn((channel, fn) => handlers.set(channel, fn)),
      },
      webContents: { fromId: jest.fn() },
      BrowserWindow: {
        getAllWindows: jest.fn(() => [{ isDestroyed: () => false, webContents: { send: windowSend } }]),
      },
    }));

    jest.doMock('../src/main/browser-shell', () => ({
      createBrowserShellManager: jest.fn(() => shell),
    }));

    const ipcHandlers = require('../src/main/ipc-handlers');
    ipcHandlers.register();

    expect(handlers.has('shell:start')).toBe(true);
    expect(handlers.has('shell:state')).toBe(true);
    expect(handlers.has('shell:command')).toBe(true);
    expect(handlers.has('shell:clear')).toBe(true);
    expect(handlers.has('shell:stop')).toBe(true);

    expect(handlers.get('shell:start')()).toEqual({ running: true, allowedCommands: ['git'] });
    expect(shell.start).toHaveBeenCalledTimes(1);
    expect(handlers.get('shell:state')()).toEqual({ running: false, allowedCommands: ['git'] });
    expect(handlers.get('shell:command')(null, 'git status')).toEqual({ ok: true, command: 'git status' });
    expect(shell.send).toHaveBeenCalledWith('git status');

    handlers.get('shell:clear')();
    expect(shell.clear).toHaveBeenCalledTimes(1);
    handlers.get('shell:stop')();
    expect(shell.stop).toHaveBeenCalledTimes(1);

    shellListeners.output({ stream: 'stdout', text: 'hello\n' });
    expect(windowSend).toHaveBeenCalledWith('shell:output', { stream: 'stdout', text: 'hello\n' });
    shellListeners.status({ running: false });
    expect(windowSend).toHaveBeenCalledWith('shell:status', { running: false });
    shellListeners.clear();
    expect(windowSend).toHaveBeenCalledWith('shell:clear', undefined);
  });
});

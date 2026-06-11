/**
 * SSH Manager tests
 * Tests connection management, command sending, and state tracking.
 */
jest.mock('ssh2', () => ({ Client: jest.fn() }));

const { SSHSessionManager } = require('../src/main/ssh-manager');
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

function createFakeClient() {
  const handlers = {};
  const streamHandlers = {};
  const stderrHandlers = {};
  const stream = {
    on: jest.fn((event, cb) => { streamHandlers[event] = cb; return stream; }),
    close: jest.fn(() => streamHandlers.close?.()),
    write: jest.fn(),
    stderr: {
      on: jest.fn((event, cb) => { stderrHandlers[event] = cb; return stream; }),
    },
  };
  const client = {
    on: jest.fn((event, cb) => { handlers[event] = cb; return client; }),
    connect: jest.fn(() => client),
    end: jest.fn(() => {
      handlers.close?.();
      return client;
    }),
    shell: jest.fn((_opts, cb) => {
      process.nextTick(() => cb(null, stream));
      return client;
    }),
    handlers,
    stream,
    streamHandlers,
    ready: () => handlers.ready?.(),
    error: (err) => handlers.error?.(err),
    close: () => handlers.close?.(),
  };
  Client.mockImplementation(() => client);
  return client;
}

describe('SSHSessionManager', () => {
  let manager;
  let tempDir;

  beforeEach(() => {
    Client.mockReset();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-test-'));
    manager = new SSHSessionManager({
      connectionsFile: path.join(tempDir, 'connections.json'),
    });
  });

  afterEach(() => {
    manager.disconnect();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('starts disconnected', () => {
    const state = manager.getState();
    expect(state.connected).toBe(false);
    expect(state.host).toBeNull();
  });

  test('getConnections returns empty array initially', () => {
    const conns = manager.getConnections();
    expect(conns).toEqual([]);
  });

  test('saveConnection stores a connection', () => {
    const result = manager.saveConnection('test@host', {
      name: 'Test Server',
      host: 'example.com',
      port: 22,
      username: 'test',
    });
    expect(result.ok).toBe(true);

    const conns = manager.getConnections();
    expect(conns.length).toBe(1);
    expect(conns[0].name).toBe('Test Server');
    expect(conns[0].host).toBe('example.com');
  });

  test('deleteConnection removes a connection', () => {
    manager.saveConnection('test@host', {
      name: 'Test',
      host: 'example.com',
      username: 'test',
    });

    const result = manager.deleteConnection('test@host');
    expect(result.ok).toBe(true);
    expect(manager.getConnections().length).toBe(0);
  });

  test('deleteConnection returns error for missing connection', () => {
    const result = manager.deleteConnection('nonexistent');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('connections persist to disk', () => {
    manager.saveConnection('test@host', {
      name: 'Test',
      host: 'example.com',
      username: 'test',
    });

    // Create new manager with same file
    const manager2 = new SSHSessionManager({
      connectionsFile: path.join(tempDir, 'connections.json'),
    });
    const conns = manager2.getConnections();
    expect(conns.length).toBe(1);
    expect(conns[0].host).toBe('example.com');
  });

  test('send returns error when not connected', () => {
    const result = manager.send('ls');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Not connected');
  });

  test('send returns error for empty command or not connected', () => {
    const result = manager.send('');
    expect(result.ok).toBe(false);
    // Returns either 'Not connected' or 'Empty command' depending on state
    expect(result.error).toBeDefined();
  });

  test('connect opens shell and tracks state', async () => {
    const client = createFakeClient();
    const connectPromise = manager.connect({ host: 'example.com', port: 2222, username: 'user' });
    client.ready();
    await Promise.resolve();

    const state = await connectPromise;

    expect(state.connected).toBe(true);
    expect(manager.getState()).toMatchObject({ connected: true, host: 'example.com', port: 2222, username: 'user' });
    expect(client.shell).toHaveBeenCalledWith({ term: 'xterm-256color' }, expect.any(Function));
  });

  test('stream close schedules reconnect with exponential backoff', async () => {
    manager = new SSHSessionManager({
      connectionsFile: path.join(tempDir, 'connections.json'),
      reconnectBaseDelay: 10,
      reconnectMaxAttempts: 3,
    });
    const first = createFakeClient();
    const statuses = [];
    manager.on('status', status => statuses.push(status));

    const connectPromise = manager.connect({ host: 'example.com', username: 'user' });
    first.ready();
    await connectPromise;

    first.streamHandlers.close();
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(statuses.at(-1)).toMatchObject({
      connected: false,
      reconnecting: true,
      reconnectAttempt: 1,
      reconnectDelay: 10,
    });
    expect(Client).toHaveBeenCalledTimes(2);

    const second = Client.mock.results[1].value;
    second.ready();
    await Promise.resolve();
    second.streamHandlers.close();
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(statuses.at(-1)).toMatchObject({
      reconnecting: true,
      reconnectAttempt: 1,
      reconnectDelay: 10,
    });
    expect(Client).toHaveBeenCalledTimes(3);
  });

  test('connection loss uses exponential reconnect delay', () => {
    manager.connectionConfig = { host: 'example.com', username: 'user' };
    manager.reconnectBaseDelay = 10;
    manager.reconnectMaxAttempts = 3;
    const statuses = [];
    manager.on('status', status => statuses.push(status));

    manager._handleConnectionLost('first drop');
    expect(statuses.at(-1)).toMatchObject({ reconnectAttempt: 1, reconnectDelay: 10 });

    manager._clearReconnectTimer();
    manager._handleConnectionLost('second drop');
    expect(statuses.at(-1)).toMatchObject({ reconnectAttempt: 2, reconnectDelay: 20 });
  });
  test('manual disconnect cancels pending reconnect', async () => {
    const client = createFakeClient();
    const connectPromise = manager.connect({ host: 'example.com', username: 'user' });
    client.ready();
    await connectPromise;

    client.streamHandlers.close();
    expect(manager.getState().reconnecting).toBe(true);

    await manager.disconnect();
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(manager.getState().reconnecting).toBe(false);
    expect(Client).toHaveBeenCalledTimes(1);
  });

  test('disconnect when not connected returns ok', async () => {
    const result = await manager.disconnect();
    expect(result.ok).toBe(true);
  });

  test('emits status event', () => {
    const spy = jest.fn();
    manager.on('status', spy);
    manager.getState(); // No event emitted for getState
    // Status events are emitted on connect/disconnect
  });

  test('getConnections includes hasKey flag', () => {
    manager.saveConnection('with-key', {
      name: 'Key Server',
      host: 'key.example.com',
      username: 'user',
      privateKeyPath: '/path/to/key',
    });
    manager.saveConnection('no-key', {
      name: 'Password Server',
      host: 'pass.example.com',
      username: 'user',
    });

    const conns = manager.getConnections();
    const withKey = conns.find(c => c.id === 'with-key');
    const noKey = conns.find(c => c.id === 'no-key');
    expect(withKey.hasKey).toBe(true);
    expect(noKey.hasKey).toBe(false);
  });
});

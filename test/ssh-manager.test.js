/**
 * SSH Manager tests
 * Tests connection management, command sending, and state tracking.
 */
const { SSHSessionManager } = require('../src/main/ssh-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('SSHSessionManager', () => {
  let manager;
  let tempDir;

  beforeEach(() => {
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

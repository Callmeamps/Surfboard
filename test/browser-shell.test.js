const { EventEmitter } = require('events');
const {
  BrowserShellManager,
  isAllowedCommandLine,
  tokenizeCommandLine,
} = require('../src/main/browser-shell');

function createChildStub() {
  const child = new EventEmitter();
  child.pid = 4242;
  child.killed = false;
  child.stdin = {
    destroyed: false,
    write: jest.fn(),
    end: jest.fn(),
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn((signal) => {
    child.killed = true;
    child.emit('close', 0, signal || null);
    return true;
  });
  return child;
}

describe('browser shell allowlist', () => {
  test('tokenizeCommandLine keeps quoted args intact', () => {
    const parsed = tokenizeCommandLine('git commit -m "hello world"');
    expect(parsed.ok).toBe(true);
    expect(parsed.tokens).toEqual(['git', 'commit', '-m', 'hello world']);
  });

  test('tokenizeCommandLine blocks shell operators', () => {
    const parsed = tokenizeCommandLine('git status && rm -rf /');
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/Blocked shell operator/);
  });

  test('isAllowedCommandLine checks command name', () => {
    expect(isAllowedCommandLine('git status').ok).toBe(true);
    expect(isAllowedCommandLine('rm -rf /').ok).toBe(false);
  });
});

describe('browser shell manager', () => {
  test('starts shell, streams output, and accepts allowlisted commands', () => {
    const child = createChildStub();
    const spawnImpl = jest.fn(() => child);
    const mgr = new BrowserShellManager({
      spawnImpl,
      allowedCommands: ['git', 'echo', 'pwd', 'clear'],
    });

    const outputs = [];
    const statuses = [];
    const clears = [];
    mgr.on('output', (payload) => outputs.push(payload));
    mgr.on('status', (payload) => statuses.push(payload));
    mgr.on('clear', () => clears.push(true));

    const started = mgr.start();
    expect(spawnImpl).toHaveBeenCalledTimes(1);
    expect(started.running).toBe(true);

    child.stdout.emit('data', Buffer.from('hello\n'));
    child.stderr.emit('data', Buffer.from('oops\n'));
    expect(outputs).toEqual([
      { stream: 'stdout', text: 'hello\n' },
      { stream: 'stderr', text: 'oops\n' },
    ]);

    const ok = mgr.send('git status');
    expect(ok.ok).toBe(true);
    expect(child.stdin.write).toHaveBeenCalledWith('git status\n');

    const blocked = mgr.send('rm -rf /');
    expect(blocked.ok).toBe(false);
    expect(child.stdin.write).toHaveBeenCalledTimes(1);

    const cleared = mgr.send('clear');
    expect(cleared.ok).toBe(true);
    expect(clears).toHaveLength(1);

    const stopped = mgr.stop();
    expect(stopped).toBe(true);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(statuses.some((s) => s.running === false)).toBe(true);
  });

  test('send auto-starts shell when needed', () => {
    const child = createChildStub();
    const spawnImpl = jest.fn(() => child);
    const mgr = new BrowserShellManager({
      spawnImpl,
      allowedCommands: ['echo'],
    });

    const res = mgr.send('echo hi');
    expect(res.ok).toBe(true);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
    expect(child.stdin.write).toHaveBeenCalledWith('echo hi\n');
  });
});

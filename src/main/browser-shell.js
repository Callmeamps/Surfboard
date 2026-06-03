const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');

const DEFAULT_SHELL = process.platform === 'win32' ? 'bash' : '/bin/bash';
const DEFAULT_ALLOWED_COMMANDS = [
  'bd',
  'cat',
  'cd',
  'clear',
  'echo',
  'date',
  'df',
  'fd',
  'find',
  'git',
  'head',
  'ls',
  'mkdir',
  'npm',
  'pnpm',
  'printenv',
  'pwd',
  'sed',
  'setup-extensions.sh',
  'sort',
  'tail',
  'touch',
  'wc',
  'which',
  'whoami',
  'yarn',
  'rg',
  'grep',
  'du',
  'cut',
  'awk',
];

function charIsOperator(ch) {
  return /[;&|<>`$]/.test(ch);
}

function pushToken(tokens, current) {
  tokens.push(current);
  return '';
}

function handleEscapeChar(ch, state) {
  state.current += ch;
  state.escape = false;
}

function handleSingleQuotedChar(ch, state) {
  if (ch === "'") {
    state.quote = null;
  } else {
    state.current += ch;
  }
}

function handleDoubleQuotedChar(ch, state) {
  if (ch === '"') {
    state.quote = null;
  } else if (ch === '\\') {
    state.escape = true;
  } else {
    state.current += ch;
  }
}

function handleUnquotedChar(ch, state, tokens) {
  if (/\s/.test(ch)) {
    if (state.current) {
      state.current = pushToken(tokens, state.current);
    }
    return {};
  }

  if (ch === "'") {
    state.quote = 'single';
    return {};
  }

  if (ch === '"') {
    state.quote = 'double';
    return {};
  }

  if (ch === '\\') {
    state.escape = true;
    return {};
  }

  if (charIsOperator(ch)) {
    return { error: `Blocked shell operator: ${ch}` };
  }

  state.current += ch;
  return {};
}

function finalizeTokens(state, tokens) {
  if (state.escape) {
    return { ok: false, error: 'Trailing escape', tokens: [] };
  }

  if (state.quote) {
    return { ok: false, error: 'Unterminated quote', tokens: [] };
  }

  if (state.current) {
    pushToken(tokens, state.current);
  }

  if (!tokens.length) {
    return { ok: false, error: 'Empty command', tokens: [] };
  }

  return { ok: true, tokens };
}

function tokenizeCommandLine(input) {
  const text = String(input ?? '').trim();
  const tokens = [];
  const state = { current: '', quote: null, escape: false };

  if (!text) {
    return { ok: false, error: 'Empty command', tokens: [] };
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (state.escape) {
      handleEscapeChar(ch, state);
      continue;
    }

    if (state.quote === 'single') {
      handleSingleQuotedChar(ch, state);
      continue;
    }

    if (state.quote === 'double') {
      handleDoubleQuotedChar(ch, state);
      continue;
    }

    const { error } = handleUnquotedChar(ch, state, tokens);
    if (error) {
      return { ok: false, error, tokens: [] };
    }
  }

  return finalizeTokens(state, tokens);
}

function normalizeCommandName(command) {
  return path.basename(String(command || '').trim());
}

function isAllowedCommandLine(input, allowedCommands = DEFAULT_ALLOWED_COMMANDS) {
  const parsed = tokenizeCommandLine(input);
  if (!parsed.ok) return parsed;

  const [command, ...args] = parsed.tokens;
  const commandName = normalizeCommandName(command);
  const allowlist = allowedCommands instanceof Set ? allowedCommands : new Set(allowedCommands);

  if (!allowlist.has(commandName) && !allowlist.has(command)) {
    return {
      ok: false,
      error: `Command not allowlisted: ${commandName}`,
      tokens: parsed.tokens,
      command: commandName,
    };
  }

  return {
    ok: true,
    tokens: parsed.tokens,
    command: commandName,
    args,
  };
}

class BrowserShellManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.spawnImpl = options.spawnImpl || spawn;
    this.shellPath = options.shellPath || DEFAULT_SHELL;
    this.allowedCommands = new Set(options.allowedCommands || DEFAULT_ALLOWED_COMMANDS);
    this.cwd = options.cwd || process.cwd();
    this.child = null;
    this.startedAt = null;
    this.lastCommand = '';
    this.shutdownTimer = null;
  }

  getState() {
    return {
      running: Boolean(this.child && !this.child.killed),
      pid: this.child?.pid || null,
      cwd: this.cwd,
      lastCommand: this.lastCommand,
      allowedCommands: [...this.allowedCommands],
      shellPath: this.shellPath,
    };
  }

  start() {
    if (this.child && !this.child.killed) {
      return this.getState();
    }

    const child = this.spawnImpl(this.shellPath, ['--noprofile', '--norc'], {
      cwd: this.cwd,
      env: {
        ...process.env,
        TERM: 'dumb',
        PS1: '',
        PROMPT_COMMAND: '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child = child;
    this.startedAt = Date.now();

    child.stdout.on('data', (chunk) => {
      this.emit('output', { stream: 'stdout', text: chunk.toString('utf8') });
    });

    child.stderr.on('data', (chunk) => {
      this.emit('output', { stream: 'stderr', text: chunk.toString('utf8') });
    });

    child.once('error', (err) => {
      this.emit('output', { stream: 'stderr', text: `[shell] ${err.message}\n` });
      this.emit('status', { ...this.getState(), running: false, error: err.message });
    });

    child.once('close', (code, signal) => {
      if (this.child === child) {
        this.child = null;
      }
      if (this.shutdownTimer) {
        clearTimeout(this.shutdownTimer);
        this.shutdownTimer = null;
      }
      this.emit('status', { ...this.getState(), running: false, exitCode: code, signal });
    });

    this.emit('status', this.getState());
    return this.getState();
  }

  stop() {
    if (!this.child) {
      return false;
    }

    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
    }

    const child = this.child;
    this.child = null;

    try {
      child.stdin?.end();
    } catch {
      // noop
    }

    try {
      child.kill('SIGTERM');
    } catch {
      // noop
    }

    this.shutdownTimer = setTimeout(() => {
      try {
        if (!child.killed) child.kill('SIGKILL');
      } catch {
        // noop
      }
      this.shutdownTimer = null;
    }, 1500);
    this.shutdownTimer.unref?.();

    this.emit('status', { ...this.getState(), running: false });
    return true;
  }

  clear() {
    this.emit('clear');
  }

  send(commandLine) {
    const line = String(commandLine ?? '').trim();
    if (!line) {
      return { ok: false, error: 'Empty command' };
    }

    if (line === 'clear') {
      this.clear();
      return { ok: true, type: 'clear' };
    }

    if (line === 'exit') {
      this.stop();
      return { ok: true, type: 'exit' };
    }

    const verdict = isAllowedCommandLine(line, this.allowedCommands);
    if (!verdict.ok) {
      return { ok: false, error: verdict.error };
    }

    if (!this.child || this.child.killed) {
      this.start();
    }

    if (!this.child || !this.child.stdin || this.child.stdin.destroyed) {
      return { ok: false, error: 'Shell is not running' };
    }

    this.lastCommand = line;
    this.child.stdin.write(`${line}\n`);
    this.emit('command', { command: line, tokens: verdict.tokens, at: Date.now() });
    return { ok: true, command: verdict.command };
  }
}

function createBrowserShellManager(options) {
  return new BrowserShellManager(options);
}

module.exports = {
  DEFAULT_ALLOWED_COMMANDS,
  BrowserShellManager,
  createBrowserShellManager,
  isAllowedCommandLine,
  normalizeCommandName,
  tokenizeCommandLine,
};

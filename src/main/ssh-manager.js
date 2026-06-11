/**
 * SSH Session Manager
 * Manages SSH connections to remote servers using ssh2.
 * Provides a terminal-like interface for sending commands and receiving output.
 */
const { Client } = require('ssh2');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');

const DEFAULT_SSH_PORT = 22;
const DEFAULT_CONNECT_TIMEOUT = 10000;
const DEFAULT_RECONNECT_BASE_DELAY = 1000;
const DEFAULT_RECONNECT_MAX_DELAY = 30000;
const DEFAULT_RECONNECT_MAX_ATTEMPTS = 5;
const CONNECTIONS_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.config', 'riced-chromium', 'ssh-connections.json'
);

class SSHSessionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.client = null;
    this.stream = null;
    this.connectionConfig = null;
    this.connected = false;
    this.connectTimeout = options.connectTimeout || DEFAULT_CONNECT_TIMEOUT;
    this.reconnectEnabled = options.reconnectEnabled !== false;
    this.reconnectBaseDelay = options.reconnectBaseDelay || DEFAULT_RECONNECT_BASE_DELAY;
    this.reconnectMaxDelay = options.reconnectMaxDelay || DEFAULT_RECONNECT_MAX_DELAY;
    this.reconnectMaxAttempts = options.reconnectMaxAttempts ?? DEFAULT_RECONNECT_MAX_ATTEMPTS;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._manualDisconnect = false;
    this._lastReconnectDelay = 0;
    this._lastError = null;
    this.connectionsFile = options.connectionsFile || CONNECTIONS_FILE;
    this._connections = this._loadConnections();
  }

  /**
   * Get saved connection profiles
   */
  getConnections() {
    return Object.entries(this._connections).map(([id, conn]) => ({
      id,
      name: conn.name || id,
      host: conn.host,
      port: conn.port || DEFAULT_SSH_PORT,
      username: conn.username,
      hasKey: Boolean(conn.privateKeyPath),
    }));
  }

  /**
   * Save a connection profile
   */
  saveConnection(id, config) {
    this._connections[id] = {
      name: config.name || id,
      host: config.host,
      port: config.port || DEFAULT_SSH_PORT,
      username: config.username,
      privateKeyPath: config.privateKeyPath || null,
      passphrase: config.passphrase || null,
    };
    this._persistConnections();
    return { ok: true, id };
  }

  /**
   * Delete a connection profile
   */
  deleteConnection(id) {
    if (this._connections[id]) {
      delete this._connections[id];
      this._persistConnections();
      return { ok: true };
    }
    return { ok: false, error: 'Connection not found' };
  }

  /**
   * Connect to a remote server
   */
  async connect(config) {
    this._manualDisconnect = false;
    this._clearReconnectTimer();
    this._reconnectAttempts = 0;
    this._lastError = null;

    return this._connect(config);
  }

  _connect(config) {
    if (this.connected) {
      this._manualDisconnect = true;
      return this.disconnect().then(() => this._connect(config));
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();
      this.client = conn;
      this.connectionConfig = { ...config };
      let settled = false;
      let streamOpened = false;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.connected = false;
        this.stream = null;
        this._lastError = err.message || String(err);
        this.emit('status', { ...this.getState(), error: this._lastError });
        reject(err);
      };

      const timeout = setTimeout(() => {
        conn.end();
        fail(new Error('Connection timeout'));
      }, this.connectTimeout);

      conn.on('ready', () => {
        clearTimeout(timeout);
        this.connected = true;
        this._reconnectAttempts = 0;
        this._lastError = null;
        this.emit('status', this.getState());

        // Open a shell session
        conn.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            this.connected = false;
            this.stream = null;
            this._lastError = err.message;
            this.emit('status', { ...this.getState(), error: this._lastError });
            fail(err);
            return;
          }

          streamOpened = true;
          this.stream = stream;

          stream.on('close', () => {
            this.connected = false;
            this.stream = null;
            this.emit('status', this.getState());
            this.emit('output', { stream: 'system', text: '[ssh] Connection closed\n' });
            this._handleConnectionLost('Connection closed');
          });

          stream.on('data', (data) => {
            this.emit('output', { stream: 'stdout', text: data.toString('utf8') });
          });

          stream.stderr.on('data', (data) => {
            this.emit('output', { stream: 'stderr', text: data.toString('utf8') });
          });

          if (!settled) {
            settled = true;
            resolve(this.getState());
          }
        });
      });

      conn.on('error', (err) => {
        if (!streamOpened && !this.connected) {
          fail(err);
          return;
        }
        this.connected = false;
        this.stream = null;
        this._lastError = err.message;
        this.emit('status', { ...this.getState(), error: this._lastError });
        this._handleConnectionLost(err.message);
      });

      conn.on('close', () => {
        if (!streamOpened && !this.connected) return;
        this.connected = false;
        this.stream = null;
        this.emit('status', this.getState());
        this._handleConnectionLost('Connection closed');
      });

      // Build connect config
      const connectConfig = {
        host: config.host,
        port: config.port || DEFAULT_SSH_PORT,
        username: config.username,
        readyTimeout: this.connectTimeout,
      };

      // Add authentication
      if (config.privateKeyPath) {
        try {
          connectConfig.privateKey = fs.readFileSync(config.privateKeyPath);
          if (config.passphrase) {
            connectConfig.passphrase = config.passphrase;
          }
        } catch (err) {
          fail(new Error(`Failed to read private key: ${err.message}`));
          return;
        }
      } else if (config.password) {
        connectConfig.password = config.password;
      }

      conn.connect(connectConfig);
    });
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _handleConnectionLost(reason) {
    if (this._manualDisconnect || !this.reconnectEnabled || !this.connectionConfig) {
      this.emit('status', this.getState());
      return;
    }

    if (this._reconnectAttempts >= this.reconnectMaxAttempts) {
      this._lastError = `Reconnect failed after ${this.reconnectMaxAttempts} attempts: ${reason}`;
      this.emit('status', { ...this.getState(), error: this._lastError });
      return;
    }

    if (this._reconnectTimer) return;

    const delay = Math.min(
      this.reconnectMaxDelay,
      this.reconnectBaseDelay * (2 ** this._reconnectAttempts)
    );
    this._lastReconnectDelay = delay;
    this._reconnectAttempts += 1;
    this.emit('status', {
      ...this.getState(),
      reconnecting: true,
      reconnectAttempt: this._reconnectAttempts,
      reconnectMaxAttempts: this.reconnectMaxAttempts,
      reconnectDelay: delay,
      lastError: reason,
    });

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.emit('output', { stream: 'system', text: `[ssh] Reconnecting (${this._reconnectAttempts}/${this.reconnectMaxAttempts})…\n` });
      this._connect(this.connectionConfig).catch((err) => {
        this._lastError = err.message;
        this._handleConnectionLost(err.message);
      });
    }, delay);
  }

  /**
   * Disconnect from current session
   */
  async disconnect() {
    this._manualDisconnect = true;
    this._clearReconnectTimer();
    this._reconnectAttempts = 0;
    if (this.stream) {
      this.stream.close();
      this.stream = null;
    }
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    this.connected = false;
    this.emit('status', this.getState());
    return { ok: true };
  }

  /**
   * Send a command to the SSH session
   */
  send(command) {
    if (!this.connected || !this.stream) {
      return { ok: false, error: 'Not connected' };
    }

    const line = String(command ?? '').trim();
    if (!line) {
      return { ok: false, error: 'Empty command' };
    }

    if (line === 'exit') {
      this.disconnect();
      return { ok: true, type: 'exit' };
    }

    this.stream.write(`${line}\n`);
    this.emit('command', { command: line, at: Date.now() });
    return { ok: true };
  }

  /**
   * Get current session state
   */
  getState() {
    return {
      connected: this.connected,
      host: this.connectionConfig?.host || null,
      port: this.connectionConfig?.port || DEFAULT_SSH_PORT,
      username: this.connectionConfig?.username || null,
      reconnectEnabled: this.reconnectEnabled,
      reconnecting: Boolean(this._reconnectTimer),
      reconnectAttempt: this._reconnectAttempts,
      reconnectMaxAttempts: this.reconnectMaxAttempts,
      reconnectDelay: this._reconnectTimer ? this._lastReconnectDelay : 0,
      lastError: this._lastError || null,
    };
  }

  /**
   * Load saved connections from disk
   */
  _loadConnections() {
    try {
      if (fs.existsSync(this.connectionsFile)) {
        return JSON.parse(fs.readFileSync(this.connectionsFile, 'utf8'));
      }
    } catch (err) {
      console.warn('[ssh] Failed to load connections:', err.message);
    }
    return {};
  }

  /**
   * Persist connections to disk
   */
  _persistConnections() {
    try {
      const dir = path.dirname(this.connectionsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.connectionsFile, JSON.stringify(this._connections, null, 2));
    } catch (err) {
      console.warn('[ssh] Failed to save connections:', err.message);
    }
  }
}

function createSSHSessionManager(options) {
  return new SSHSessionManager(options);
}

module.exports = {
  SSHSessionManager,
  createSSHSessionManager,
  DEFAULT_SSH_PORT,
  DEFAULT_CONNECT_TIMEOUT,
  DEFAULT_RECONNECT_BASE_DELAY,
  DEFAULT_RECONNECT_MAX_DELAY,
  DEFAULT_RECONNECT_MAX_ATTEMPTS,
  CONNECTIONS_FILE,
};

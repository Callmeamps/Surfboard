/**
 * cloud-manager.js — Cloud development environment integration
 *
 * Supports GitHub Codespaces, Replit, and Gitpod device-code OAuth flows.
 * Stores tokens per-profile via profiles.js.
 */

const { net } = require('electron');
const profiles = require('./profiles');
const config = require('../../config');

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

const PROVIDERS = {
  github: {
    id: 'github',
    label: 'GitHub Codespaces',
    icon: '🐙',
    clientId: () => config.github.clientId,
    deviceCodeUrl: 'https://github.com/login/device/code',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    apiBase: 'https://api.github.com',
    scope: 'codespace',
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    workspace: {
      list: '/user/codespaces',
      start: name => `/user/codespaces/${encodeURIComponent(name)}/start`,
      stop: name => `/user/codespaces/${encodeURIComponent(name)}/stop`,
      delete: name => `/user/codespaces/${encodeURIComponent(name)}`,
      connection: name => `/user/codespaces/${encodeURIComponent(name)}/connections`,
    },
    normalizeWorkspace: cs => ({
      provider: 'github',
      name: cs.name,
      displayName: cs.display_name || cs.name,
      state: cs.state,
      owner: cs.owner?.login || '',
      repository: cs.repository?.full_name || '',
      machineType: cs.machine_type || '',
      createdAt: cs.created_at,
      lastUsedAt: cs.last_used_at,
      billsUsed: cs.billable_owner?.login || '',
      region: cs.region || '',
      url: cs.web_url || cs.url || '',
      gitStatus: cs.git_status ? {
        ref: cs.git_status.ref,
        hasUncommittedChanges: cs.git_status.has_uncommitted_changes,
        hasUnpushedChanges: cs.git_status.has_unpushed_changes,
      } : null,
    }),
  },
  replit: {
    id: 'replit',
    label: 'Replit',
    icon: '🟧',
    clientId: () => config.replit.clientId,
    deviceCodeUrl: () => config.replit.deviceCodeUrl,
    tokenUrl: () => config.replit.tokenUrl,
    apiBase: () => config.replit.apiBase,
    scope: () => config.replit.scope,
    headers: { 'Accept': 'application/json' },
    workspace: {
      list: '/workspaces',
      start: name => `/workspaces/${encodeURIComponent(name)}/start`,
      stop: name => `/workspaces/${encodeURIComponent(name)}/stop`,
      delete: name => `/workspaces/${encodeURIComponent(name)}`,
      connection: name => `/workspaces/${encodeURIComponent(name)}`,
    },
    normalizeWorkspace: ws => ({
      provider: 'replit',
      name: ws.name || ws.id || ws.slug || '',
      displayName: ws.title || ws.name || ws.url || ws.slug || ws.id || 'Replit Workspace',
      state: ws.state || ws.status || 'Unknown',
      owner: ws.owner?.name || ws.owner?.username || ws.user?.name || '',
      repository: ws.repository?.full_name || ws.repository?.name || ws.url || '',
      machineType: ws.machine?.name || ws.machine_type || ws.plan || '',
      createdAt: ws.created_at || ws.createdAt || '',
      lastUsedAt: ws.updated_at || ws.last_used_at || ws.updatedAt || '',
      region: ws.region || '',
      url: ws.url || ws.workspace_url || '',
    }),
  },
  gitpod: {
    id: 'gitpod',
    label: 'Gitpod',
    icon: '🟢',
    clientId: () => config.gitpod.clientId,
    deviceCodeUrl: () => config.gitpod.deviceCodeUrl,
    tokenUrl: () => config.gitpod.tokenUrl,
    apiBase: () => config.gitpod.apiBase,
    scope: () => config.gitpod.scope,
    headers: { 'Accept': 'application/json' },
    workspace: {
      list: '/workspaces',
      start: name => `/workspaces/${encodeURIComponent(name)}/start`,
      stop: name => `/workspaces/${encodeURIComponent(name)}/stop`,
      delete: name => `/workspaces/${encodeURIComponent(name)}`,
      connection: name => `/workspaces/${encodeURIComponent(name)}`,
    },
    normalizeWorkspace: ws => {
      const instance = ws.latestInstance || ws;
      const name = ws.id || instance?.id || '';
      const repo = ws.context?.repository || {};
      return {
        provider: 'gitpod',
        name,
        displayName: ws.description || repo.name || name || 'Gitpod Workspace',
        state: instance?.status?.phase || instance?.status?.name || ws.status || 'Unknown',
        owner: ws.owner?.name || ws.user?.name || '',
        repository: repo.full_name || repo.url || repo.name || '',
        machineType: instance?.workspaceClass || instance?.workspace_class || '',
        createdAt: ws.creationTime || ws.created_at || '',
        lastUsedAt: instance?.startedTime || instance?.started_time || '',
        region: ws.region || '',
        url: instance?.ideUrl || instance?.ide_url || ws.url || '',
      };
    },
  },
};

// ── Provider helpers ─────────────────────────────────────

function getCloudProviders() {
  return Object.values(PROVIDERS).map(p => ({
    id: p.id,
    label: p.label,
    icon: p.icon,
    configured: !!_clientId(p),
  }));
}

function getProvider(provider = 'github') {
  const p = PROVIDERS[provider];
  if (!p) throw new Error(`Unknown cloud provider: ${provider}`);
  return p;
}

function _clientId(provider) {
  return typeof provider.clientId === 'function' ? provider.clientId() : provider.clientId;
}

function _url(provider, value) {
  return typeof value === 'function' ? value() : value;
}

function _apiBase(provider) {
  return _url(provider, provider.apiBase).replace(/\/$/, '');
}

function _workspacePath(provider, action, name) {
  const path = provider.workspace[action];
  if (typeof path !== 'function') throw new Error(`Unsupported workspace action for ${provider.id}: ${action}`);
  return path(name);
}

function _getTokenKey(provider) {
  return `cloud_${provider}_token`;
}

function _saveToken(provider, token) {
  const key = _getTokenKey(provider);
  profiles.updateCurrentProfile({ [key]: token });
}

function _loadToken(provider) {
  const profile = profiles.getCurrentProfile();
  return profile?.[_getTokenKey(provider)] || null;
}

function _clearToken(provider) {
  const key = _getTokenKey(provider);
  profiles.updateCurrentProfile({ [key]: null });
}

// ── HTTP helpers ──────────────────────────────────────

function _formEncode(body) {
  return Object.entries(body || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function _request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method,
      url,
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    });

    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        if (response.statusCode === 204) {
          resolve({ ok: true });
          return;
        }
        const raw = data.trim();
        if (!raw) {
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300 });
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(raw);
        }
      });
    });
    request.on('error', reject);
    if (body !== undefined && body !== null) request.write(body);
    request.end();
  });
}

function _post(url, body, headers = {}, form = false) {
  return _request('POST', url, form ? _formEncode(body) : JSON.stringify(body || {}), {
    'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
    ...headers,
  });
}

function _apiHeaders(provider, token) {
  return {
    ...provider.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

function _get(url, token, provider) {
  return _request('GET', url, undefined, _apiHeaders(provider, token));
}

function _delete(url, token, provider) {
  return _request('DELETE', url, undefined, _apiHeaders(provider, token));
}

function _apiUrl(provider, path) {
  return `${_apiBase(provider)}${path.startsWith('/') ? path : `/${path}`}`;
}

// ── Device Code Flow ─────────────────────────────────

function _normalizeDeviceCode(resp) {
  if (!resp.device_code) {
    throw new Error(resp.error_description || resp.error || 'Failed to start device code flow');
  }

  return {
    deviceCode: resp.device_code,
    userCode: resp.user_code,
    verificationUri: resp.verification_uri || '',
    verificationUriComplete: resp.verification_uri_complete || '',
    expiresIn: resp.expires_in,
    interval: resp.interval,
  };
}

async function startDeviceCodeFlow(provider = 'github') {
  const p = getProvider(provider);
  const clientId = _clientId(p);
  if (!clientId) throw new Error(`Missing ${p.id.toUpperCase()}_CLIENT_ID`);

  const body = { client_id: clientId };
  const scope = _url(p, p.scope);
  if (scope) body.scope = scope;

  const resp = await _post(_url(p, p.deviceCodeUrl), body, {}, true);
  return _normalizeDeviceCode(resp);
}

function _normalizePollArgs(providerOrDeviceCode, deviceCodeOrInterval, interval) {
  if (PROVIDERS[providerOrDeviceCode]) {
    return [providerOrDeviceCode, deviceCodeOrInterval, interval || POLL_INTERVAL_MS];
  }
  return ['github', providerOrDeviceCode, deviceCodeOrInterval || POLL_INTERVAL_MS];
}

async function pollForToken(providerOrDeviceCode, deviceCodeOrInterval, interval) {
  const [providerName, deviceCode, pollInterval] = _normalizePollArgs(providerOrDeviceCode, deviceCodeOrInterval, interval);
  const p = getProvider(providerName);
  const clientId = _clientId(p);
  if (!clientId) throw new Error(`Missing ${p.id.toUpperCase()}_CLIENT_ID`);

  const resp = await _post(_url(p, p.tokenUrl), {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  }, {}, true);

  if (resp.access_token) {
    _saveToken(p.id, resp.access_token);
    return { token: resp.access_token, scope: resp.scope };
  }

  if (resp.error === 'authorization_pending') {
    return { pending: true };
  }

  if (resp.error === 'slow_down') {
    return { pending: true, retryAfter: (resp.interval || 5) * 1000 };
  }

  if (resp.error === 'expired_token') {
    throw new Error('Device code expired — restart authentication');
  }

  if (resp.error === 'access_denied') {
    throw new Error('User denied access');
  }

  throw new Error(resp.error_description || resp.error || 'Token poll failed');
}

// ── Workspace API ─────────────────────────────────────

function _workspaceItems(provider, resp) {
  if (Array.isArray(resp.codespaces)) return resp.codespaces;
  if (Array.isArray(resp.workspaces)) return resp.workspaces;
  if (Array.isArray(resp.items)) return resp.items;
  if (Array.isArray(resp.data)) return resp.data;
  return [];
}

function _normalizeWorkspaceArgs(providerOrName, name) {
  if (PROVIDERS[providerOrName]) return [providerOrName, name];
  return ['github', providerOrName];
}

async function listWorkspaces(provider = 'github') {
  const p = getProvider(provider);
  const token = _loadToken(p.id);
  if (!token) throw new Error(`Not authenticated — connect ${p.label} first`);

  const resp = await _get(_apiUrl(p, p.workspace.list), token, p);
  if (resp.message) throw new Error(resp.message);

  return _workspaceItems(p, resp).map(item => p.normalizeWorkspace(item)).filter(ws => ws.name);
}

async function startWorkspace(providerOrName, name) {
  const [providerName, workspaceName] = _normalizeWorkspaceArgs(providerOrName, name);
  const p = getProvider(providerName);
  const token = _loadToken(p.id);
  if (!token) throw new Error('Not authenticated');

  const resp = await _post(_apiUrl(p, _workspacePath(p, 'start', workspaceName)), {}, _apiHeaders(p, token));
  if (resp.message) throw new Error(resp.message);
  return { ok: true, state: resp.state || resp.status || 'Starting', url: resp.url || '' };
}

async function stopWorkspace(providerOrName, name) {
  const [providerName, workspaceName] = _normalizeWorkspaceArgs(providerOrName, name);
  const p = getProvider(providerName);
  const token = _loadToken(p.id);
  if (!token) throw new Error('Not authenticated');

  const resp = await _post(_apiUrl(p, _workspacePath(p, 'stop', workspaceName)), {}, _apiHeaders(p, token));
  if (resp.message) throw new Error(resp.message);
  return { ok: true, state: resp.state || resp.status || 'Stopping', url: resp.url || '' };
}

async function deleteWorkspace(providerOrName, name) {
  const [providerName, workspaceName] = _normalizeWorkspaceArgs(providerOrName, name);
  const p = getProvider(providerName);
  const token = _loadToken(p.id);
  if (!token) throw new Error('Not authenticated');

  const result = await _delete(_apiUrl(p, _workspacePath(p, 'delete', workspaceName)), token, p);
  return result;
}

async function getConnectionDetails(providerOrName, name) {
  const [providerName, workspaceName] = _normalizeWorkspaceArgs(providerOrName, name);
  const p = getProvider(providerName);
  const token = _loadToken(p.id);
  if (!token) throw new Error('Not authenticated');

  const resp = await _get(_apiUrl(p, _workspacePath(p, 'connection', workspaceName)), token, p);
  if (resp.message) throw new Error(resp.message);
  return resp;
}

// Backward-compatible GitHub-only aliases
const listCodespaces = () => listWorkspaces('github');
const startCodespace = name => startWorkspace('github', name);
const stopCodespace = name => stopWorkspace('github', name);
const deleteCodespace = name => deleteWorkspace('github', name);

// ── Status ───────────────────────────────────────────

function getProviderStatus() {
  return Object.fromEntries(Object.keys(PROVIDERS).map(id => [id, { connected: isConnected(id) }]));
}

function isConnected(provider = 'github') {
  return !!_loadToken(getProvider(provider).id);
}

function disconnect(provider = 'github') {
  _clearToken(getProvider(provider).id);
  return { ok: true };
}

module.exports = {
  getCloudProviders,
  getProviderStatus,
  startDeviceCodeFlow,
  pollForToken,
  listWorkspaces,
  startWorkspace,
  stopWorkspace,
  deleteWorkspace,
  getConnectionDetails,
  listCodespaces,
  startCodespace,
  stopCodespace,
  deleteCodespace,
  isConnected,
  disconnect,
  // Internal-ish exports used by tests/debugging.
  PROVIDERS,
  POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
};

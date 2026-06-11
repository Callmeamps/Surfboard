/**
 * cloud-manager.js — Cloud development environment integration
 *
 * Supports: GitHub Codespaces (device code OAuth flow)
 * Stores tokens per-profile via profiles.js.
 */

const { net } = require('electron');
const profiles = require('./profiles');

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API = 'https://api.github.com';

// OAuth app client_id — replace with your own for production
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Iv1.b507a32c69ecf754';
const GITHUB_SCOPE = 'codespace';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

// ── Token storage ─────────────────────────────────────

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

function _post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers,
      },
    });

    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    request.on('error', reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}

function _get(url, token) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function _delete(url, token) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'DELETE',
      url,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => {
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300 });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

// ── Device Code Flow ─────────────────────────────────

async function startDeviceCodeFlow() {
  const resp = await _post(GITHUB_DEVICE_CODE_URL, {
    client_id: GITHUB_CLIENT_ID,
    scope: GITHUB_SCOPE,
  });

  if (!resp.device_code) {
    throw new Error(resp.error_description || 'Failed to start device code flow');
  }

  return {
    deviceCode: resp.device_code,
    userCode: resp.user_code,
    verificationUri: resp.verification_uri,
    expiresIn: resp.expires_in,
    interval: resp.interval,
  };
}

async function pollForToken(deviceCode, interval = POLL_INTERVAL_MS) {
  const resp = await _post(GITHUB_TOKEN_URL, {
    client_id: GITHUB_CLIENT_ID,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });

  if (resp.access_token) {
    _saveToken('github', resp.access_token);
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

// ── GitHub Codespaces API ────────────────────────────

async function listCodespaces() {
  const token = _loadToken('github');
  if (!token) throw new Error('Not authenticated — connect GitHub first');

  const resp = await _get(`${GITHUB_API}/user/codespaces`, token);
  if (resp.message) throw new Error(resp.message);

  return (resp.codespaces || []).map(cs => ({
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
    gitStatus: cs.git_status ? {
      ref: cs.git_status.ref,
      hasUncommittedChanges: cs.git_status.has_uncommitted_changes,
      hasUnpushedChanges: cs.git_status.has_unpushed_changes,
    } : null,
  }));
}

async function startCodespace(name) {
  const token = _loadToken('github');
  if (!token) throw new Error('Not authenticated');

  const resp = await _post(`${GITHUB_API}/user/codespaces/${name}/start`, {}, {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  if (resp.message) throw new Error(resp.message);
  return { ok: true, state: resp.state || 'Starting' };
}

async function stopCodespace(name) {
  const token = _loadToken('github');
  if (!token) throw new Error('Not authenticated');

  const resp = await _post(`${GITHUB_API}/user/codespaces/${name}/stop`, {}, {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  if (resp.message) throw new Error(resp.message);
  return { ok: true, state: resp.state || 'Stopping' };
}

async function deleteCodespace(name) {
  const token = _loadToken('github');
  if (!token) throw new Error('Not authenticated');

  const result = await _delete(`${GITHUB_API}/user/codespaces/${name}`, token);
  return result;
}

async function getConnectionDetails(name) {
  const token = _loadToken('github');
  if (!token) throw new Error('Not authenticated');

  const resp = await _get(`${GITHUB_API}/user/codespaces/${name}/connections`, token);
  if (resp.message) throw new Error(resp.message);

  return resp;
}

// ── Status ───────────────────────────────────────────

function isConnected(provider = 'github') {
  return !!_loadToken(provider);
}

function disconnect(provider = 'github') {
  _clearToken(provider);
  return { ok: true };
}

module.exports = {
  startDeviceCodeFlow,
  pollForToken,
  listCodespaces,
  startCodespace,
  stopCodespace,
  deleteCodespace,
  getConnectionDetails,
  isConnected,
  disconnect,
};

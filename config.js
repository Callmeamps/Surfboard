/**
 * config.js — Application configuration
 *
 * Credentials and settings can be overridden via environment variables.
 * For local development, create a .env file (not committed to git).
 */

const path = require('path');

// Load .env if it exists (development only)
try {
  const fs = require('fs');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
} catch { /* .env not found, using env vars only */ }

module.exports = {
  // GitHub OAuth
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    // Create your own OAuth app at: https://github.com/settings/developers
    // Required scopes: 'codespace'
  },

  // Replit OAuth
  replit: {
    clientId: process.env.REPLIT_CLIENT_ID || '',
    deviceCodeUrl: process.env.REPLIT_DEVICE_CODE_URL || 'https://replit.com/api/auth/device/code',
    tokenUrl: process.env.REPLIT_TOKEN_URL || 'https://replit.com/api/auth/token',
    apiBase: process.env.REPLIT_API_BASE || 'https://replit.com/api',
    scope: process.env.REPLIT_SCOPE || '',
  },

  // Gitpod OAuth
  gitpod: {
    clientId: process.env.GITPOD_CLIENT_ID || '',
    deviceCodeUrl: process.env.GITPOD_DEVICE_CODE_URL || 'https://gitpod.io/api/oauth/device/code',
    tokenUrl: process.env.GITPOD_TOKEN_URL || 'https://gitpod.io/api/oauth/token',
    apiBase: process.env.GITPOD_API_BASE || 'https://api.gitpod.io',
    scope: process.env.GITPOD_SCOPE || '',
  },
};

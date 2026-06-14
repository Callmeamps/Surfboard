/**
 * config.js — OAuth client IDs for cloud providers.
 *
 * Copy this to config.local.js and fill in your own client IDs.
 * Values from config.local.js take precedence.
 */

let local = {};
try { local = require('./config.local'); } catch (_) {}

module.exports = {
  github: {
    clientId: local.github?.clientId || process.env.GITHUB_CLIENT_ID || '',
  },
  replit: {
    clientId: local.replit?.clientId || process.env.REPLIT_CLIENT_ID || '',
    deviceCodeUrl: local.replit?.deviceCodeUrl || 'https://replit.com/auth/cli/device-code',
    tokenUrl: local.replit?.tokenUrl || 'https://replit.com/auth/cli/token',
    apiBase: local.replit?.apiBase || 'https://replit.com/api/v1',
    scope: local.replit?.scope || 'identity',
  },
  gitpod: {
    clientId: local.gitpod?.clientId || process.env.GITPOD_CLIENT_ID || '',
    deviceCodeUrl: local.gitpod?.deviceCodeUrl || 'https://api.gitpod.io/idp/device/code',
    tokenUrl: local.gitpod?.tokenUrl || 'https://api.gitpod.io/idp/token',
    apiBase: local.gitpod?.apiBase || 'https://api.gitpod.io',
    scope: local.gitpod?.scope || 'openid email profile',
  },
};

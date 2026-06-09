/**
 * TrustManager — Permission / Trust Layer
 * Browser-Native Feature Platform
 * Usage: await TrustManager.request('inspector', 'inspectDom')
 */
(function () {
  'use strict';

  // module::action -> bool
  let permissions = {};
  let listeners = [];
  let auditLog = [];
  let pendingRequests = new Map(); // module::action -> [{resolve, reject}, ...]

  function _key(module, action) { return module + '::' + action; }

  function isAllowed(module, action) {
    return !!permissions[_key(module, action)];
  }

  function grant(module, action) {
    permissions[_key(module, action)] = true;
    _notify('granted', { module, action });
    _log(module, action, 'granted');
    return true;
  }

  function revoke(module, action) {
    delete permissions[_key(module, action)];
    _notify('revoked', { module, action });
    _log(module, action, 'revoked');
    return true;
  }

  function require(module, action) {
    const key = _key(module, action);
    if (permissions[key]) { return true; }
    throw new Error('TrustManager: permission denied for ' + key);
  }

  function request(module, action) {
    return new Promise((resolve, reject) => {
      const key = _key(module, action);
      if (permissions[key]) { return resolve(true); }
      if (pendingRequests.has(key)) {
        pendingRequests.get(key).push({ resolve, reject });
        return;
      }
      pendingRequests.set(key, [{ resolve, reject }]);
      _notify('request', { module, action, resolve: (val) => {
        const resolvers = pendingRequests.get(key) || [];
        pendingRequests.delete(key);
        resolvers.forEach(r => r.resolve(!!val));
      }, reject: (err) => {
        const resolvers = pendingRequests.get(key) || [];
        pendingRequests.delete(key);
        resolvers.forEach(r => r.reject(err));
      }});
    });
  }

  function _notify(type, detail) {
    listeners.forEach(fn => fn(type, detail));
  }

  function onRequest(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(l => l !== fn);
    };
  }

  function _log(module, action, result) {
    auditLog.push({ module, action, result, ts: new Date().toISOString() });
  }

  function getAudit(limit) {
    const list = [...auditLog];
    return list.reverse().slice(0, limit || 50);
  }

  function registerDefaults(allowed) {
    allowed.forEach(({ module, action }) => grant(module, action));
  }

  function reset() {
    permissions = {};
    auditLog = [];
    pendingRequests = new Map();
    // NOTE: does NOT clear listeners — those are registered at app boot
  }

  window.TrustManager = {
    isAllowed,
    grant,
    revoke,
    require,
    request,
    onRequest,
    getAudit,
    registerDefaults,
    reset,
  };
})();

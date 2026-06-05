/**
 * Mode Manager
 * Browser-Native Feature Platform — state machine for modes
 * Usage: ModeManager.set(ModeManager.MODES.INSPECT)
 */
(function () {
  'use strict';

  const MODES = {
    BROWSE:  'browse',
    INSPECT: 'inspect',
    EDIT:    'edit',
    ACTION:  'action',
    RUN:     'run',
    RESULT:  'result',
  };

  let current = MODES.BROWSE;
  let listeners = [];
  let stack = [];
  let _initialized = false;

  function get() { return current; }

  function getAll() { return Object.values(MODES); }

  function is(mode) { return current === mode; }

  function set(mode, data) {
    if (!Object.values(MODES).includes(mode)) { return false; }
    if (current === mode) { return false; }
    const from = current;
    current = mode;
    _updateBodyClass();
    listeners.forEach(fn => fn({ from, to: mode, data }));
    return true;
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(l => l !== fn);
    };
  }

  function pushState(mode, data) {
    stack.push(current);
    return set(mode, data);
  }

  function popState() {
    const prev = stack.pop();
    if (prev) {
      const result = set(prev, { restore: true });
      return result ? prev : null;
    }
    return null;
  }

  function _updateBodyClass() {
    try {
      const mode = current;
      // Remove all previous mode-* classes from body
      document.body.classList.forEach(cls => {
        if (cls.startsWith('mode-')) { document.body.classList.remove(cls); }
      });
      document.body.classList.add('mode-' + mode);
    } catch (e) {
      // noop if body not ready
    }
  }

  function init(defaultMode) {
    if (_initialized) { return; }
    _initialized = true;
    if (defaultMode && Object.values(MODES).includes(defaultMode)) {
      current = defaultMode;
    }
    _updateBodyClass();
  }

  function reset() {
    current = MODES.BROWSE;
    stack = [];
    // NOTE: does NOT reset listeners or _initialized — those are global bootstrap
    try {
      document.body.classList.forEach(cls => {
        if (cls.startsWith('mode-')) { document.body.classList.remove(cls); }
      });
    } catch (e) { /* noop */ }
  }

  window.ModeManager = {
    MODES,
    get,
    set,
    is,
    onChange,
    pushState,
    popState,
    getAll,
    init,
  };
})();

/**
 * AIClient — Browser-Native Feature Platform
 * Context extraction, model calls, interactive results, workflow generation.
 *
 * Usage:
 * AIClient.init({ root: document.getElementById('app') })
 * AIClient.enable()
 * const context = AIClient.extractContext({ element: document.body })
 * const completion = await AIClient.complete({ prompt: 'Summarize', context })
 * AIClient.inlineResult({ text: completion.text })
 */
(function () {
  'use strict';

  let _root = null;
  let _enabled = false;
  let _listeners = [];
  let _inlineHost = null;

  // --- Helpers ----------------------------------------------------------

  function _notify(type, detail) {
    _listeners.forEach((fn) => fn(type, detail));
  }

  function _toText(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    return Array.from(node.childNodes)
      .map(_toText)
      .join('')
      .trim();
  }

  function _query(el, sel) {
    try { return el && el.querySelector(sel); } catch (e) { return null; }
  }

  function _queryAll(el, sel) {
    try { return el && Array.from(el.querySelectorAll(sel)) || []; } catch (e) { return []; }
  }

  // --- State ------------------------------------------------------------

  function init(deps) {
    _root = deps?.root || null;
  }

  function enable(overrideRoot) {
    if (overrideRoot) _root = overrideRoot;
    if (!_root) return false;
    if (_enabled) return true;
    try {
      if (window.TrustManager) window.TrustManager.require('ai', 'complete');
    } catch (err) {
      _notify('failed-enable', { error: err.message });
      return false;
    }
    _enabled = true;
    _root.setAttribute('data-ai-active', '');
    _notify('enabled');
    return true;
  }

  function disable() {
    if (!_enabled) return;
    _enabled = false;
    if (_inlineHost && _inlineHost.parentNode) {
      _inlineHost.parentNode.removeChild(_inlineHost);
    }
    if (_root) _root.removeAttribute('data-ai-active');
    _notify('disabled');
    _inlineHost = null;
  }

  // --- Context ----------------------------------------------------------

  function extractContext(opts = {}) {
    const el = opts.element || _root;
    if (!_enabled || !el) return {};
    const context = {
      timestamp: Date.now(),
      nodeType: el?.nodeType,
      tagName: el?.tagName?.toLowerCase() || '',
      id: el?.id || '',
      classes: el?.className ? String(el.className).split(/\s+/) : [],
      href: el?.href || '',
      text: opts.includeText ? _toText(el) : '',
      children: Array.from(el?.childNodes || []).length,
    };
    _notify('context-extracted', { context });
    return context;
  }

  // --- Model -----------------------------------------------------------

  function complete(opts = {}) {
    if (!_enabled) throw new Error('AIClient is not enabled');
    if (typeof opts.prompt !== 'string') throw new Error('Prompt must be a string');

    const fakeResult = {
      completionId: 'cmpl-' + Date.now(),
      status: 'simulated',
      model: 'browser-native/simulated',
      prompt: opts.prompt,
      context: extractContext({ element: opts.element, includeText: false }),
      completions: [
        {
          index: 0,
          text: `Simulated completion for prompt: ${opts.prompt.slice(0, 80)}${opts.prompt.length > 80 ? '...' : ''}`,
          tokens: Math.max(8, Math.floor(opts.prompt.length / 4)),
        },
      ],
    };
    _notify('completion', fakeResult);
    return Promise.resolve(fakeResult);
  }

  // --- Workflow --------------------------------------------------------

  function generateWorkflowFromPrompt(opts = {}) {
    if (!_enabled) throw new Error('AIClient is not enabled');
    if (!opts.prompt) {
      return Promise.resolve(null);
    }
    const workflow = {
      id: 'wf-' + Date.now(),
      name: '\u{1F477} Generated from prompt: ' + (opts.name || opts.prompt.slice(0, 40)),
      generatedSource: opts.prompt,
      steps: [
        { id: 'step-1', type: 'trigger', name: 'Start' },
        {
          id: 'step-2',
          type: opts.actionType || 'api-call',
          name: opts.actionName || 'Fetch data'
        },
        { id: 'step-3', type: 'result', name: 'Show result' }
      ],
      context: opts.contextIds || [],
    };
    _notify('workflow-generated', { workflow });
    return Promise.resolve(workflow);
  }

  // --- Inline UI ------------------------------------------------------

  function _ensureInlineHost() {
    if (_inlineHost && _inlineHost.parentNode) return _inlineHost;
    const host = document.createElement('div');
    host.className = 'ai-inline-host';
    host.dataset.aiOverlay = '';

    const header = document.createElement('div');
    header.className = 'ai-inline-header';
    header.textContent = 'AI Result';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ai-inline-close';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => {
      if (_inlineHost && _inlineHost.parentNode) {
        _inlineHost.parentNode.removeChild(_inlineHost);
      }
      _inlineHost = null;
      _notify('inline-closed');
    });
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'ai-inline-body';
    body.textContent = 'Waiting...';

    host.appendChild(header);
    host.appendChild(body);
    _root.appendChild(host);
    _inlineHost = host;
    return host;
  }

  function inlineResult(opts = {}) {
    if (!_enabled || !_root) return;
    const host = _ensureInlineHost();
    const body = _query(host, '.ai-inline-body');
    if (!body) return;

    let display = 'No result';
    if (opts.text) {
      display = opts.text;
      body.textContent = display;
    } else if (opts.markdown) {
      display = opts.markdown;
      body.textContent = display;
    } else if (opts.json) {
      display = JSON.stringify(opts.json, null, 2);
      body.textContent = display;
    }
    _notify('inline-result', { text: display });
    return host;
  }

  // --- Cleanup --------------------------------------------------------

  function reset() {
    disable();
    _root = null;
    _listeners = [];
    _inlineHost = null;
  }

  function onChange(fn) {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  }

  // --- Public API ----------------------------------------------------

  window.AIClient = {
    init,
    enable,
    disable,
    isEnabled: () => _enabled,
    onChange,
    reset,

    // Context
    extractContext,

    // Model
    complete,

    // Workflow
    generateWorkflowFromPrompt,

    // UI
    inlineResult,
  };
})();

/**
 * Miniapps Host — register, launch, and manage sandboxed miniapps
 *
 * Security model:
 *  - Built-in miniapps (calculator, notes, todo) render inline — trusted code.
 *  - Third-party miniapps with `sandbox: true` render in an iframe with
 *    sandbox="allow-scripts" and a strict CSP via srcdoc. They communicate
 *    with the host via postMessage.
 *  - All user-supplied text is set via textContent, never innerHTML, to
 *    prevent XSS.
 */
(function () {
  'use strict';

  const _apps = {};
  let _activeId = null;
  let _sandboxFrame = null;
  let _sandboxReady = false;
  let _sandboxReadyCallbacks = [];

  // ── Sandbox iframe template ──────────────────────────────
  // The sandboxed frame runs with:
  //   allow-scripts — miniapp JS must execute
  //   allow-same-origin — NOT set, so the iframe gets a unique opaque origin
  //   This means: no cookies, no localStorage, no DOM access to parent,
  //   no fetch to parent origin. Only postMessage works.
  const _SANDBOX_CSP = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "connect-src 'none'",
    "img-src data:",
    "font-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
  ].join('; ');

  function _buildSandboxSrcdoc(appId, appHtml, appCss) {
    return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${_SANDBOX_CSP}">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; font-size: 13px; color: #ccc; background: transparent; padding: 8px; }
  ${appCss || ''}
</style>
</head>
<body>
${appHtml}
<script>
(function() {
  // Expose a minimal API to the miniapp
  window.MiniappSDK = {
    postMessage: function(type, data) {
      parent.postMessage({ appId: '${appId}', type: type, data: data }, '*');
    },
    onMessage: null
  };

  window.addEventListener('message', function(e) {
    if (e.data && e.data.appId === '${appId}' && MiniappSDK.onMessage) {
      MiniappSDK.onMessage(e.data.type, e.data.data);
    }
  });

  // Signal ready
  parent.postMessage({ appId: '${appId}', type: '__ready' }, '*');
})();
</script>
</body>
</html>`;
  }

  // ── Sandbox bridge ───────────────────────────────────────
  function _onSandboxMessage(e) {
    const msg = e.data;
    if (!msg || !msg.appId) return;

    if (msg.type === '__ready') {
      _sandboxReady = true;
      _sandboxReadyCallbacks.forEach(fn => fn());
      _sandboxReadyCallbacks = [];
      return;
    }

    // Forward to registered message handlers
    const app = _apps[msg.appId];
    if (app && app.onMessage) {
      app.onMessage(msg.type, msg.data);
    }
  }

  function _sendToSandbox(appId, type, data) {
    if (_sandboxFrame && _sandboxFrame.contentWindow) {
      _sandboxFrame.contentWindow.postMessage({ appId, type, data }, '*');
    }
  }

  function _waitForSandboxReady() {
    return new Promise(resolve => {
      if (_sandboxReady) { resolve(); return; }
      _sandboxReadyCallbacks.push(resolve);
    });
  }

  // ── Core API ─────────────────────────────────────────────
  function register(app) {
    if (!app || !app.id) return;
    _apps[app.id] = { ...app };
  }

  function open(id) {
    const app = _apps[id];
    if (!app) return;
    _activeId = id;

    if (app.sandbox) {
      _openSandboxed(app);
    } else {
      _openInline(app);
    }
  }

  function _openInline(app) {
    const title = app.name;
    const content = `<div class="miniapp-frame">`
      + `<div class="miniapp-header">`
      + `<span class="miniapp-icon">${_esc(app.icon || '🧩')}</span>`
      + `<span class="miniapp-name">${_esc(app.name)}</span>`
      + `</div>`
      + `<div class="miniapp-body">`
      + (app.render ? app.render() : `<p style="color:var(--text-faint)">Miniapp loaded</p>`)
      + `</div>`
      + `</div>`;

    window.RightSidebar?.openPanel('miniapps', title);
    const panelContent = document.getElementById('popup-panel-content');
    if (panelContent) panelContent.innerHTML = content;
    _wireRenderedMiniapp(app.id);
  }

  function _openSandboxed(app) {
    const title = app.name;
    const appHtml = app.render ? app.render() : `<p style="color:var(--text-faint)">Miniapp loaded</p>`;
    const appCss = app.css || '';

    window.RightSidebar?.openPanel('miniapps', title);
    const panelContent = document.getElementById('popup-panel-content');
    if (!panelContent) return;

    panelContent.innerHTML = `<div class="miniapp-frame miniapp-sandboxed">`
      + `<div class="miniapp-header">`
      + `<span class="miniapp-icon">${_esc(app.icon || '🧩')}</span>`
      + `<span class="miniapp-name">${_esc(app.name)}</span>`
      + `</div>`
      + `<div class="miniapp-body">`
      + `<iframe id="miniapp-sandbox-frame" class="miniapp-iframe"`
      + ` sandbox="allow-scripts"`
      + ` style="width:100%;height:100%;border:none;background:transparent;"></iframe>`
      + `</div></div>`;

    _sandboxReady = false;
    _sandboxFrame = document.getElementById('miniapp-sandbox-frame');
    if (!_sandboxFrame) return;

    _sandboxFrame.srcdoc = _buildSandboxSrcdoc(app.id, appHtml, appCss);
    _sandboxFrame.addEventListener('load', () => {
      // Frame loaded; wait for __ready message
      _waitForSandboxReady().then(() => {
        if (app.onReady) app.onReady();
      });
    });
  }

  function close() {
    if (_sandboxFrame) {
      _sandboxFrame.srcdoc = '';
      _sandboxFrame = null;
    }
    _sandboxReady = false;
    _activeId = null;
  }

  function isActive(id) {
    return _activeId === id;
  }

  function getList() {
    return Object.values(_apps);
  }

  /** Send a message to a sandboxed miniapp */
  function sendTo(appId, type, data) {
    _sendToSandbox(appId, type, data);
  }

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ── Default miniapps ─────────────────────────────────────
  function _registerDefaults() {
    register({
      id: 'calculator',
      name: 'Calculator',
      icon: '🧮',
      render() {
        return `<div class="miniapp-calc">`
          + `<input type="text" id="calc-display" class="calc-display" readonly value="0"/>`
          + `<div class="calc-grid">`
          + `<button class="calc-btn" data-val="C">C</button>`
          + `<button class="calc-btn" data-val="±">±</button>`
          + `<button class="calc-btn" data-val="%">%</button>`
          + `<button class="calc-btn calc-op" data-val="/">÷</button>`
          + `<button class="calc-btn" data-val="7">7</button>`
          + `<button class="calc-btn" data-val="8">8</button>`
          + `<button class="calc-btn" data-val="9">9</button>`
          + `<button class="calc-btn calc-op" data-val="*">×</button>`
          + `<button class="calc-btn" data-val="4">4</button>`
          + `<button class="calc-btn" data-val="5">5</button>`
          + `<button class="calc-btn" data-val="6">6</button>`
          + `<button class="calc-btn calc-op" data-val="-">−</button>`
          + `<button class="calc-btn" data-val="1">1</button>`
          + `<button class="calc-btn" data-val="2">2</button>`
          + `<button class="calc-btn" data-val="3">3</button>`
          + `<button class="calc-btn calc-op" data-val="+">+</button>`
          + `<button class="calc-btn calc-zero" data-val="0">0</button>`
          + `<button class="calc-btn" data-val=".">.</button>`
          + `<button class="calc-btn calc-eq" data-val="=">=</button>`
          + `</div></div>`;
      },
    });

    register({
      id: 'notes',
      name: 'Notes',
      icon: '📝',
      render() {
        return `<div class="miniapp-notes">`
          + `<textarea class="notes-area" placeholder="Write a quick note…"></textarea>`
          + `<div class="notes-footer">`
          + `<button class="notes-save-btn">Save</button>`
          + `<span class="notes-status"></span>`
          + `</div></div>`;
      },
    });

    register({
      id: 'todo',
      name: 'Todo',
      icon: '✅',
      render() {
        return `<div class="miniapp-todo">`
          + `<div class="todo-input-row">`
          + `<input type="text" class="todo-input" placeholder="Add a task…"/>`
          + `<button class="todo-add-btn">Add</button>`
          + `</div>`
          + `<ul class="todo-list"></ul>`
          + `</div>`;
      },
    });
  }

  // ── Wire rendered miniapp interactions ───────────────────
  function _wireRenderedMiniapp(id) {
    requestAnimationFrame(() => {
      if (id === 'calculator') {
        // Safe expression evaluator — no eval()
        function _calcEval(expr) {
          const s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/[^0-9+\-*/.()]/g, '');
          if (!s) return 0;
          try {
            const tokens = s.match(/\d+\.?\d*|[+\-*/()]/g) || [];
            let pos = 0;
            function parseExpr() {
              let left = parseTerm();
              while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
                const op = tokens[pos++];
                const right = parseTerm();
                left = op === '+' ? left + right : left - right;
              }
              return left;
            }
            function parseTerm() {
              let left = parseFactor();
              while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
                const op = tokens[pos++];
                const right = parseFactor();
                if (op === '*') left = left * right;
                else { if (right === 0) throw new Error('div0'); left = left / right; }
              }
              return left;
            }
            function parseFactor() {
              if (tokens[pos] === '(') { pos++; const v = parseExpr(); pos++; return v; }
              return parseFloat(tokens[pos++]);
            }
            const result = parseExpr();
            if (!isFinite(result)) throw new Error('nan');
            return Math.round(result * 1e10) / 1e10;
          } catch { return NaN; }
        }
        document.querySelectorAll('.calc-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const display = document.getElementById('calc-display');
            if (!display) return;
            const val = btn.dataset.val;
            if (val === 'C') { display.value = '0'; return; }
            if (val === '=') {
              const result = _calcEval(display.value);
              display.value = isNaN(result) ? 'Error' : String(result);
              return;
            }
            if (val === '±') { display.value = String(-parseFloat(display.value) || 0); return; }
            if (val === '%') { display.value = String(parseFloat(display.value) / 100); return; }
            if (display.value === '0' && !['.', '±', '%'].includes(val)) { display.value = val; }
            else { display.value += val; }
          });
        });
      }

      if (id === 'notes') {
        const saveBtn = document.querySelector('.notes-save-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', () => {
            const area = document.querySelector('.notes-area');
            const status = document.querySelector('.notes-status');
            if (area && status) {
              localStorage.setItem('surfboard-note', area.value);
              status.textContent = 'Saved!';
              setTimeout(() => { status.textContent = ''; }, 1500);
            }
          });
        }
        const saved = localStorage.getItem('surfboard-note');
        const area = document.querySelector('.notes-area');
        if (saved && area) area.value = saved;
      }

      if (id === 'todo') {
        const addBtn = document.querySelector('.todo-add-btn');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            const row = addBtn.closest('.todo-input-row');
            const input = row?.querySelector('.todo-input');
            const list = addBtn.closest('.miniapp-todo')?.querySelector('.todo-list');
            if (input && list && input.value.trim()) {
              const li = document.createElement('li');
              li.className = 'todo-item';

              // Build DOM safely — no innerHTML with user input
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              const span = document.createElement('span');
              span.textContent = input.value.trim();
              li.appendChild(cb);
              li.appendChild(span);
              list.appendChild(li);
              input.value = '';
            }
          });
        }
        document.querySelectorAll('.todo-item input[type="checkbox"]').forEach(cb => {
          cb.addEventListener('change', () => {
            cb.nextElementSibling.style.textDecoration = cb.checked ? 'line-through' : '';
            cb.nextElementSibling.style.opacity = cb.checked ? '0.5' : '';
          });
        });
      }
    });
  }

  // ── Listen for sandbox messages ──────────────────────────
  window.addEventListener('message', _onSandboxMessage);

  // ── Public API ───────────────────────────────────────────
  window.Miniapps = {
    register,
    open,
    close,
    isActive,
    getList,
    sendTo,
    reset() {
      _activeId = null;
      _sandboxFrame = null;
      _sandboxReady = false;
      _sandboxReadyCallbacks = [];
      for (const k of Object.keys(_apps)) delete _apps[k];
      _registerDefaults();
    },
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    _registerDefaults();
  }

  if (document.readyState !== 'loading') init();
  else if (document.addEventListener) document.addEventListener('DOMContentLoaded', init);
})();

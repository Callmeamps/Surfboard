/**
 * Miniapps Host — register, launch, and manage sandboxed miniapps
 */
(function () {
  'use strict';

  const _apps = {};
  let _activeId = null;

  function register(app) {
    if (!app || !app.id) return;
    _apps[app.id] = { ...app };
  }

  function open(id) {
    const app = _apps[id];
    if (!app) return;
    _activeId = id;

    // Build miniapp content for popup panel
    const title = app.name;
    const content = `<div class="miniapp-frame">`
      + `<div class="miniapp-header">`
      + `<span class="miniapp-icon">${app.icon || '🧩'}</span>`
      + `<span class="miniapp-name">${_esc(app.name)}</span>`
      + `</div>`
      + `<div class="miniapp-body">`
      + (app.render ? app.render() : `<p style="color:var(--text-faint)">Miniapp loaded</p>`)
      + `</div>`
      + `</div>`;

    window.RightSidebar?.openPanel('miniapps', title);
    const panelContent = document.getElementById('popup-panel-content');
    if (panelContent) panelContent.innerHTML = content;
    _wireRenderedMiniapp(id);
  }

  function close() {
    _activeId = null;
  }

  function isActive(id) {
    return _activeId === id;
  }

  function getList() {
    return Object.values(_apps);
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
              li.innerHTML = `<input type="checkbox"/><span>${input.value.trim()}</span>`;
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

  // ── Public API ───────────────────────────────────────────
  window.Miniapps = {
    register,
    open,
    close,
    isActive,
    getList,
    reset() {
      _activeId = null;
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

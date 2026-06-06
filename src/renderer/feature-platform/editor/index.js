/**
 * EditEngine — Browser-Native Feature Platform
 * Inline contenteditable editing, drag-drop resize, style panel, undo/redo
 *
 * Usage:
 *   EditorEngine.init({ root: document.getElementById('app') })
 *   EditorEngine.enable()
 *   EditorEngine.disable()
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let _root = null;          // DOM root for editing
  let _enabled = false;      // editing active?
  let _selected = null;      // currently selected element
  let _resizeHandles = [];   // resize handle elements
  let _selectionBox = null;  // selection outline element
  let _stylePanel = null;    // floating style panel
  let _undoStack = [];       // snapshots for undo
  let _redoStack = [];       // snapshots for redo
  const MAX_UNDO = 100;
  let _dragState = null;     // active resize drag
  let _listeners = [];       // onChange listeners
  let _mutObs = null;        // MutationObserver for change tracking
  let _snapshotTimer = null; // debounce snapshot on input

  // ── Element path (for re-selection after undo/redo) ────
  function _path(el) {
    if (!el || !_root || el === _root) return [];
    const parts = [];
    let cur = el;
    while (cur && cur !== _root) {
      const parent = cur.parentNode;
      if (!parent) break;
      const siblings = Array.from(parent.childNodes).filter(n => n.nodeType === 1);
      const idx = siblings.indexOf(cur);
      parts.unshift(idx);
      cur = parent;
    }
    return parts;
  }

  function _resolvePath(path) {
    if (!path || !path.length || !_root) return null;
    let cur = _root;
    for (const idx of path) {
      const children = Array.from(cur.childNodes).filter(n => n.nodeType === 1);
      if (!children[idx]) return null;
      cur = children[idx];
    }
    return cur;
  }

  // ── Snapshot ───────────────────────────────────────────
  function _takeSnapshot() {
    if (!_root) return;
    const snap = {
      html: _root.innerHTML,
      selectedPath: _selected ? _path(_selected) : null,
      ts: Date.now()
    };
    _undoStack.push(snap);
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();
    _redoStack = []; // new edit clears redo
  }

  // Exposed for tests (and external sync)
  function snapshot() {
    _takeSnapshot();
    if (_snapshotTimer) { clearTimeout(_snapshotTimer); _snapshotTimer = null; }
  }

  function _applySnapshot(snap) {
    if (!_root || !snap) return;
    _root.innerHTML = snap.html;
    // Re-select
    if (snap.selectedPath) {
      const el = _resolvePath(snap.selectedPath);
      _selectElement(el);
    } else {
      _deselect();
    }
    _notify('snapshot-applied', { undoStack: _undoStack.length, redoStack: _redoStack.length });
  }

  function _debouncedSnapshot() {
    if (_snapshotTimer) clearTimeout(_snapshotTimer);
    _snapshotTimer = setTimeout(() => {
      _takeSnapshot();
      _snapshotTimer = null;
    }, 300);
  }

  // ── Undo / Redo ────────────────────────────────────────
  function undo() {
    if (_undoStack.length <= 1) return false; // keep at least initial state
    const current = _undoStack.pop();
    _redoStack.push(current);
    const prev = _undoStack[_undoStack.length - 1];
    _applySnapshot(prev);
    return true;
  }

  function redo() {
    if (!_redoStack.length) return false;
    const snap = _redoStack.pop();
    _undoStack.push(snap);
    _applySnapshot(snap);
    return true;
  }

  function canUndo() { return _undoStack.length > 1; }
  function canRedo() { return _redoStack.length > 0; }

  // ── Selection ──────────────────────────────────────────
  function _selectElement(el) {
    if (!_enabled || !el || el === _root) return;
    _deselect();
    _selected = el;
    el.setAttribute('data-editor-selected', '');
    _showSelectionBox(el);
    _showResizeHandles(el);
    _showStylePanel(el);
    _notify('select', { element: el });
  }

  function _deselect() {
    if (_selected) {
      _selected.removeAttribute('data-editor-selected');
      _selected = null;
    }
    _hideSelectionBox();
    _hideResizeHandles();
    _hideStylePanel();
  }

  function _showSelectionBox(el) {
    _hideSelectionBox();
    const box = document.createElement('div');
    box.className = 'editor-selection-box';
    box.setAttribute('data-editor-overlay', '');
    const rect = el.getBoundingClientRect();
    const rootRect = _root.getBoundingClientRect();
    box.style.top = (rect.top - rootRect.top) + 'px';
    box.style.left = (rect.left - rootRect.left) + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    _root.appendChild(box);
    _selectionBox = box;
  }

  function _hideSelectionBox() {
    if (_selectionBox && _selectionBox.parentNode) {
      _selectionBox.parentNode.removeChild(_selectionBox);
    }
    _selectionBox = null;
  }

  // ── Resize Handles ─────────────────────────────────────
  const HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  const HANDLE_CURSORS = {
    nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
    se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize'
  };

  function _showResizeHandles(el) {
    _hideResizeHandles();
    const rect = el.getBoundingClientRect();
    const rootRect = _root.getBoundingClientRect();
    HANDLE_POSITIONS.forEach(pos => {
      const h = document.createElement('div');
      h.className = 'editor-resize-handle editor-resize-' + pos;
      h.setAttribute('data-editor-overlay', '');
      h.setAttribute('data-handle-pos', pos);
      h.dataset.pos = pos;

      const size = 8;
      const offset = -size / 2;

      if (pos.includes('n')) h.style.top = (rect.top - rootRect.top + offset) + 'px';
      if (pos === 'n' || pos === 's') h.style.left = (rect.left - rootRect.left + rect.width / 2 + offset) + 'px';
      if (pos.includes('s')) h.style.top = (rect.top - rootRect.top + rect.height + offset) + 'px';
      if (pos.includes('w')) h.style.left = (rect.left - rootRect.left + offset) + 'px';
      if (pos === 'e' || pos === 'w') h.style.top = (rect.top - rootRect.top + rect.height / 2 + offset) + 'px';
      if (pos.includes('e')) h.style.left = (rect.left - rootRect.left + rect.width + offset) + 'px';

      h.style.cursor = HANDLE_CURSORS[pos];

      h.addEventListener('mousedown', (e) => _startResize(e, el, pos));
      _root.appendChild(h);
      _resizeHandles.push(h);
    });
  }

  function _hideResizeHandles() {
    _resizeHandles.forEach(h => { if (h.parentNode) h.parentNode.removeChild(h); });
    _resizeHandles = [];
  }

  // ── Resize Drag ────────────────────────────────────────
  function _startResize(e, el, pos) {
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    _dragState = {
      el, pos,
      startX: e.clientX, startY: e.clientY,
      startW: rect.width, startH: rect.height,
      startLeft: el.offsetLeft, startTop: el.offsetTop
    };
    document.addEventListener('mousemove', _onResizeMove);
    document.addEventListener('mouseup', _onResizeEnd);
  }

  function _onResizeMove(e) {
    if (!_dragState) return;
    const { el, pos, startX, startY, startW, startH, startLeft, startTop } = _dragState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newW = startW, newH = startH, newLeft = startLeft, newTop = startTop;

    if (pos.includes('e')) newW = Math.max(20, startW + dx);
    if (pos.includes('w')) { newW = Math.max(20, startW - dx); newLeft = startLeft + dx; }
    if (pos.includes('s')) newH = Math.max(20, startH + dy);
    if (pos.includes('n')) { newH = Math.max(20, startH - dy); newTop = startTop + dy; }

    el.style.width = newW + 'px';
    el.style.height = newH + 'px';
    el.style.position = el.style.position || 'relative';
    if (pos.includes('w') || pos.includes('n')) {
      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
    }

    // Refresh overlays
    _showSelectionBox(el);
    _showResizeHandles(el);
  }

  function _onResizeEnd() {
    if (_dragState) {
      _takeSnapshot();
      _notify('resize', { element: _dragState.el });
    }
    _dragState = null;
    document.removeEventListener('mousemove', _onResizeMove);
    document.removeEventListener('mouseup', _onResizeEnd);
  }

  // ── Style Panel ────────────────────────────────────────
  function _showStylePanel(el) {
    _hideStylePanel();
    const panel = document.createElement('div');
    panel.className = 'editor-style-panel';
    panel.setAttribute('data-editor-overlay', '');

    const cs = window.getComputedStyle ? window.getComputedStyle(el) : {};
    const rect = el.getBoundingClientRect();
    const rootRect = _root.getBoundingClientRect();

    const fields = [
      { key: 'color', label: 'Color', value: el.style.color || cs.color || '' },
      { key: 'backgroundColor', label: 'Background', value: el.style.backgroundColor || cs.backgroundColor || '' },
      { key: 'fontSize', label: 'Font Size', value: el.style.fontSize || cs.fontSize || '' },
      { key: 'fontWeight', label: 'Font Weight', value: el.style.fontWeight || cs.fontWeight || '' },
      { key: 'fontFamily', label: 'Font', value: el.style.fontFamily || cs.fontFamily || '' },
      { key: 'textAlign', label: 'Align', value: el.style.textAlign || cs.textAlign || '' },
      { key: 'padding', label: 'Padding', value: el.style.padding || cs.padding || '' },
      { key: 'margin', label: 'Margin', value: el.style.margin || cs.margin || '' },
      { key: 'border', label: 'Border', value: el.style.border || '' },
      { key: 'borderRadius', label: 'Radius', value: el.style.borderRadius || cs.borderRadius || '' },
      { key: 'opacity', label: 'Opacity', value: el.style.opacity || cs.opacity || '' },
    ];

    let html = '<div class="editor-style-panel-header">Style</div>';
    html += '<div class="editor-style-panel-size">' +
      Math.round(rect.width) + ' × ' + Math.round(rect.height) + '</div>';
    fields.forEach(f => {
      html += '<label class="editor-style-label">' + f.label +
        '<input class="editor-style-input" data-style-key="' + f.key +
        '" value="' + _escAttr(f.value) + '" spellcheck="false"/>' +
        '</label>';
    });
    html += '<button class="editor-style-delete" data-action="delete">Delete Element</button>';

    panel.innerHTML = html;

    // Position: right side of selection, or left if no room
    const panelW = 220;
    const rootW = _root.offsetWidth || 800;
    let left = (rect.right - rootRect.left) + 12;
    if (left + panelW > rootW) {
      left = (rect.left - rootRect.left) - panelW - 12;
    }
    if (left < 0) left = 8;
    let top = (rect.top - rootRect.top);
    if (top < 0) top = 8;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';

    // Wire inputs
    panel.querySelectorAll('.editor-style-input').forEach(inp => {
      inp.addEventListener('input', () => {
        if (!_selected) return;
        const key = inp.dataset.styleKey;
        _selected.style[key] = inp.value;
        _showSelectionBox(_selected);
        _showResizeHandles(_selected);
        _debouncedSnapshot();
      });
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation(); // prevent editor shortcuts while typing
      });
    });

    // Delete button
    panel.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (_selected && _selected.parentNode) {
        const el = _selected;
        _deselect();
        el.parentNode.removeChild(el);
        _takeSnapshot();
        _notify('delete', {});
      }
    });

    _root.appendChild(panel);
    _stylePanel = panel;
  }

  function _hideStylePanel() {
    if (_stylePanel && _stylePanel.parentNode) {
      _stylePanel.parentNode.removeChild(_stylePanel);
    }
    _stylePanel = null;
  }

  function _escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ── Click-to-select ────────────────────────────────────
  function _onClick(e) {
    if (!_enabled) return;
    // Ignore clicks on editor overlays (check target and ancestors)
    if (e.target && e.target.closest && e.target.closest('[data-editor-overlay]') !== null) return;
    // Click on root itself = deselect
    if (e.target === _root) {
      _deselect();
      return;
    }
    // Select the clicked element (if within root)
    if (_root.contains(e.target)) {
      e.preventDefault();
      _selectElement(e.target);
    }
  }

  // ── Input tracking ─────────────────────────────────────
  function _onInput(e) {
    if (!_enabled) return;
    _debouncedSnapshot();
  }

  // ── Keyboard shortcuts (edit mode) ─────────────────────
  function _onKeyDown(e) {
    if (!_enabled) return;

    // Don't capture when typing in style panel inputs
    if (e.target.closest && e.target.closest('.editor-style-panel')) return;

    const c = e.ctrlKey || e.metaKey;

    // Ctrl+Z = undo
    if (c && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    // Ctrl+Shift+Z or Ctrl+Y = redo
    if (c && e.shiftKey && e.key === 'z') {
      e.preventDefault();
      redo();
      return;
    }
    if (c && e.key === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    // Escape = deselect or disable
    if (e.key === 'Escape') {
      if (_selected) {
        _deselect();
      } else {
        disable();
      }
      return;
    }
    // Delete/Backspace on selected = delete element
    if ((e.key === 'Delete' || e.key === 'Backspace') && _selected && !(e.target && e.target.closest && e.target.closest('[contenteditable]'))) {
      e.preventDefault();
      if (_selected.parentNode) {
        _selected.parentNode.removeChild(_selected);
        _deselect();
        _takeSnapshot();
        _notify('delete', {});
      }
    }
  }

  // ── MutationObserver ───────────────────────────────────
  function _startMutationObserver() {
    if (!_root) return;
    _stopMutationObserver();
    _mutObs = new MutationObserver(() => {
      if (!_enabled) return;
      _notify('mutation', {});
    });
    _mutObs.observe(_root, { childList: true, subtree: true, attributes: true, characterData: true });
  }

  function _stopMutationObserver() {
    if (_mutObs) {
      _mutObs.disconnect();
      _mutObs = null;
    }
  }

  // ── Listeners ──────────────────────────────────────────
  function _notify(type, detail) {
    _listeners.forEach(fn => fn(type, detail));
  }

  function onChange(fn) {
    _listeners.push(fn);
    return function () { _listeners = _listeners.filter(l => l !== fn); };
  }

  // ── Enable / Disable ───────────────────────────────────
  function init(deps) {
    _root = deps?.root || null;
  }

  function enable(overrideRoot) {
    if (overrideRoot) _root = overrideRoot;
    if (!_root) return false;
    if (_enabled) return true;

    // Trust gate
    try {
      if (window.TrustManager) {
        window.TrustManager.require('editor', 'write');
      }
    } catch (err) {
      _notify('denied', { error: err.message });
      return false;
    }

    _enabled = true;
    _undoStack = [];
    _redoStack = [];
    _takeSnapshot(); // initial state

    // Make editable elements contenteditable
    _root.setAttribute('data-editor-active', '');

    // Set contenteditable on direct text children
    _setEditable(_root, true);

    _root.addEventListener('click', _onClick, true);
    _root.addEventListener('input', _onInput, true);
    document.addEventListener('keydown', _onKeyDown, true);
    _startMutationObserver();

    _notify('enabled', {});
    return true;
  }

  function _setEditable(root, on) {
    // Make text-containing elements editable
    const editables = root.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,p,span,div,a,li,td,th,button,label,figcaption,blockquote,pre,code,strong,em,b,i,u,small,mark,del,ins,sub,sup,caption,summary,details'
    );
    editables.forEach(el => {
      if (el.getAttribute('data-editor-overlay') !== null) return;
      if (on) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('data-editor-editable', '');
      } else {
        el.removeAttribute('contenteditable');
        el.removeAttribute('data-editor-editable');
      }
    });
  }

  function disable() {
    if (!_enabled) return;
    _enabled = false;
    _deselect();
    _setEditable(_root, false);
    _root.removeAttribute('data-editor-active');
    _root.removeEventListener('click', _onClick, true);
    _root.removeEventListener('input', _onInput, true);
    document.removeEventListener('keydown', _onKeyDown, true);
    _stopMutationObserver();

    // Clean up any remaining overlays
    _root.querySelectorAll('[data-editor-overlay]').forEach(el => el.parentNode.removeChild(el));

    if (_snapshotTimer) { clearTimeout(_snapshotTimer); _snapshotTimer = null; }

    _notify('disabled', {});
  }

  function isEnabled() { return _enabled; }
  function getSelected() { return _selected; }
  function getUndoCount() { return _undoStack.length; }
  function getRedoCount() { return _redoStack.length; }

  // ── Style injection ────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('editor-engine-styles')) return;
    const style = document.createElement('style');
    style.id = 'editor-engine-styles';
    style.textContent = [
      '/* ── EditEngine styles ─────────────────────────────── */',
      '[data-editor-active] [data-editor-editable]:hover {',
      '  outline: 1px dashed rgba(96,165,250,0.5);',
      '  outline-offset: 2px;',
      '}',
      '[data-editor-active] [data-editor-selected] {',
      '  outline: 2px solid var(--accent, #60a5fa) !important;',
      '  outline-offset: 1px;',
      '}',
      '.editor-selection-box {',
      '  position: absolute;',
      '  border: 2px solid var(--accent, #60a5fa);',
      '  background: rgba(96,165,250,0.06);',
      '  pointer-events: none;',
      '  z-index: 9000;',
      '}',
      '.editor-resize-handle {',
      '  position: absolute;',
      '  width: 8px;',
      '  height: 8px;',
      '  background: var(--accent, #60a5fa);',
      '  border: 1px solid #fff;',
      '  border-radius: 2px;',
      '  z-index: 9001;',
      '}',
      '.editor-style-panel {',
      '  position: absolute;',
      '  width: 220px;',
      '  max-height: 60vh;',
      '  overflow-y: auto;',
      '  background: var(--bg-elevated, #1c1c1f);',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 8px;',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.4);',
      '  padding: 10px;',
      '  z-index: 9002;',
      '  font-size: 11px;',
      '  color: var(--text, #d4d4d8);',
      '  pointer-events: auto;',
      '}',
      '.editor-style-panel-header {',
      '  font-weight: 700;',
      '  font-size: 12px;',
      '  margin-bottom: 4px;',
      '  color: var(--accent, #60a5fa);',
      '}',
      '.editor-style-panel-size {',
      '  font-size: 10px;',
      '  color: var(--text-faint, #52525b);',
      '  margin-bottom: 8px;',
      '}',
      '.editor-style-label {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 2px;',
      '  margin-bottom: 6px;',
      '  font-size: 10px;',
      '  color: var(--text-dim, #71717a);',
      '}',
      '.editor-style-input {',
      '  width: 100%;',
      '  height: 24px;',
      '  padding: 0 6px;',
      '  background: var(--bg, #141416);',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 4px;',
      '  color: var(--text, #d4d4d8);',
      '  font-size: 11px;',
      '  font-family: inherit;',
      '  outline: none;',
      '}',
      '.editor-style-input:focus {',
      '  border-color: var(--accent, #60a5fa);',
      '}',
      '.editor-style-delete {',
      '  width: 100%;',
      '  margin-top: 8px;',
      '  padding: 6px 0;',
      '  background: transparent;',
      '  border: 1px solid var(--danger, #ef4444);',
      '  border-radius: 4px;',
      '  color: var(--danger, #ef4444);',
      '  font-size: 11px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  font-family: inherit;',
      '}',
      '.editor-style-delete:hover {',
      '  background: var(--danger, #ef4444);',
      '  color: #fff;',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  // Inject styles on load
  try { _injectStyles(); } catch (e) { /* noop in non-browser */ }

  // ── Reset (for tests) ──────────────────────────────────
  function reset() {
    disable();
    _undoStack = [];
    _redoStack = [];
    _root = null;
    _listeners = [];
  }

  // ── Public API ─────────────────────────────────────────
  window.EditorEngine = {
    init,
    enable,
    disable,
    isEnabled,
    getSelected,
    select: _selectElement,
    deselect: _deselect,
    undo,
    redo,
    canUndo,
    canRedo,
    getUndoCount,
    getRedoCount,
    onChange,
    reset,
    snapshot,
  };
})();

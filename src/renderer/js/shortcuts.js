/**
 * Shared keyboard shortcut data for the renderer.
 *
 * Loaded before app.js in index.html. The same data is used by:
 * - the top-bar shortcut dropdown
 * - the full shortcut overlay rendered by app.js
 */
(function (root, doc) {
  'use strict';

  const SHORTCUT_GROUPS = [
    { title: 'Navigation', items: [
      ['Address bar', 'Ctrl', 'L'],
      ['New tab', 'Ctrl', 'T'],
      ['Close tab', 'Ctrl', 'W'],
      ['Next tab', 'Ctrl', 'Tab'],
      ['Prev tab', 'Ctrl', 'Shift', 'Tab'],
      ['Back', 'Alt', '←'],
      ['Forward', 'Alt', '→'],
    ]},
    { title: 'Sidecar & Panels', items: [
      ['AI sidecar', 'Ctrl', 'Shift', 'A'],
      ['Shell sidecar', 'Ctrl', 'Shift', 'S'],
      ['Sidebar', 'Ctrl', 'B'],
      ['History', 'Ctrl', 'H'],
      ['Settings', 'Ctrl', ','],
    ]},
    { title: 'Feature Platform', items: [
      ['Cycle modes', 'Ctrl', 'Shift', 'M'],
      ['Edit mode', 'Ctrl', 'Shift', 'E'],
      ['Inspect mode', 'Ctrl', 'Shift', 'I'],
      ['Action mode', 'Ctrl', 'Shift', 'K'],
      ['Workflow mode', 'Ctrl', 'Shift', 'R'],
      ['Data mode', 'Ctrl', 'Shift', 'D'],
    ]},
    { title: 'Canvas Pages', items: [
      ['Bash', 'Ctrl', 'Shift', 'X'],
      ['History', 'Ctrl', 'Shift', 'H'],
      ['Bookmarks', 'Ctrl', 'Shift', 'B'],
      ['Agents', 'Ctrl', 'Shift', 'G'],
      ['Activity', 'Ctrl', 'Shift', 'J'],
    ]},
    { title: 'Tab Pages', items: [
      ['Extensions', 'Alt', 'Shift', 'X'],
      ['Agents', 'Alt', 'Shift', 'G'],
      ['Shell', 'Alt', 'Shift', 'L'],
      ['Workflows', 'Alt', 'Shift', 'F'],
      ['Links', 'Alt', 'Shift', 'K'],
      ['Cookies', 'Alt', 'Shift', 'C'],
      ['SSH Sessions', 'Alt', 'Shift', 'S'],
      ['Cloud Sessions', 'Alt', 'Shift', 'O'],
    ]},
    { title: 'Dev', items: [
      ['DevTools', 'F12'],
      ['Shortcuts', '?'],
    ]},
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function renderList(container) {
    if (!container) return;
    container.innerHTML = '';

    for (const group of SHORTCUT_GROUPS) {
      const $title = doc.createElement('div');
      $title.className = 'shortcut-group-title';
      $title.textContent = group.title;
      container.appendChild($title);

      const $group = doc.createElement('div');
      $group.className = 'shortcut-group';

      for (const [label, ...keys] of group.items) {
        const $row = doc.createElement('div');
        $row.className = 'shortcut-row';

        const $label = doc.createElement('span');
        $label.textContent = label;
        $row.appendChild($label);

        const $keysEl = doc.createElement('span');
        $keysEl.className = 'shortcut-keys';
        for (const key of keys) {
          const $kbd = doc.createElement('kbd');
          $kbd.textContent = key;
          $keysEl.appendChild($kbd);
        }
        $row.appendChild($keysEl);
        $group.appendChild($row);
      }

      container.appendChild($group);
    }
  }

  function renderAll() {
    if (!doc) return;
    doc.querySelectorAll('[data-shortcut-list]').forEach(renderList);
  }

  root.ShortcutData = {
    groups: SHORTCUT_GROUPS,
    renderList,
    renderAll,
    escapeHtml,
  };

  if (doc && doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', renderAll, { once: true });
  } else {
    renderAll();
  }
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);

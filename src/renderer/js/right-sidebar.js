/**
 * Right Sidebar — vertical island + popup panel state management
 */
(function () {
  'use strict';

  const $rightSidebar = document.getElementById('right-sidebar');
  const $toggle = document.getElementById('right-sidebar-toggle');
  const $popupPanel = document.getElementById('popup-panel');
  const $popupTitle = document.getElementById('popup-panel-title');
  const $popupContent = document.getElementById('popup-panel-content');
  const $popupPin = document.getElementById('popup-panel-pin');
  const $popupClose = document.getElementById('popup-panel-close');
  const $canvasHost = document.getElementById('canvas-host');
  const $canvasTitle = document.getElementById('canvas-host-title');
  const $canvasContent = document.getElementById('canvas-host-content');
  const $canvasClose = document.getElementById('canvas-host-close');

  let _panelPinned = false;
  let _currentPanel = null; // 'ai' | 'shell' | 'edit' | 'inspect' | 'actions' | 'data' | 'workflows' | 'miniapps' | 'extensions' | null
  let _canvasOpen = false;

  // ── Sidebar collapse ─────────────────────────────────────
  function _toggleSidebar() {
    $rightSidebar.classList.toggle('collapsed');
    const collapsed = $rightSidebar.classList.contains('collapsed');
    const svg = $toggle.querySelector('svg');
    if (svg) svg.innerHTML = collapsed
      ? '<polyline points="5 1 1 5 5 9"/>'
      : '<polyline points="1 1 5 5 1 9"/>';
  }

  // ── Popup panel ──────────────────────────────────────────
  function openPanel(id, title) {
    if (_currentPanel === id && !$popupPanel.classList.contains('hidden')) {
      closePanel();
      return;
    }
    _currentPanel = id;
    $popupTitle.textContent = title;
    $popupContent.innerHTML = '';
    $popupPanel.classList.remove('hidden');
    _updateActiveDot(id);
  }

  function closePanel() {
    if (_panelPinned) return;
    $popupPanel.classList.add('hidden');
    _currentPanel = null;
    _updateActiveDot(null);
  }

  function pinPanel() {
    _panelPinned = !_panelPinned;
    $popupPin.classList.toggle('active', _panelPinned);
  }

  function _updateActiveDot(id) {
    document.querySelectorAll('.rsidebar-dot').forEach(d => d.style.display = 'none');
    document.querySelectorAll('.rsidebar-btn').forEach(b => b.classList.remove('active'));
    if (id) {
      const dot = document.getElementById('rsidebar-dot-' + id);
      if (dot) dot.style.display = 'block';
      const btn = document.getElementById('rsidebar-' + id);
      if (btn) btn.classList.add('active');
    }
  }

  function isPanelOpen(id) {
    return _currentPanel === id && !$popupPanel.classList.contains('hidden');
  }

  // ── Canvas host ──────────────────────────────────────────
  function openCanvas(title, contentHtml) {
    _canvasOpen = true;
    $canvasTitle.textContent = title;
    $canvasContent.innerHTML = contentHtml;
    $canvasHost.classList.remove('hidden');
  }

  function closeCanvas() {
    _canvasOpen = false;
    $canvasHost.classList.add('hidden');
    $canvasContent.innerHTML = '';
  }

  function isCanvasOpen() { return _canvasOpen; }

  // ── Event wiring ─────────────────────────────────────────
  // NOTE: #right-sidebar-toggle click is handled by app.js init()
  // to avoid double-toggle conflicts. Only popup/canvas close wired here.
  $popupClose.addEventListener('click', closePanel);
  $popupPin.addEventListener('click', pinPanel);
  $canvasClose.addEventListener('click', closeCanvas);

  // ── Public API ───────────────────────────────────────────
  window.RightSidebar = {
    openPanel,
    closePanel,
    pinPanel,
    isPanelOpen,
    openCanvas,
    closeCanvas,
    isCanvasOpen,
    toggleSidebar: _toggleSidebar,
    isSidebarCollapsed: () => $rightSidebar.classList.contains('collapsed'),
  };
})();

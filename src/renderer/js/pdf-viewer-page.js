/**
 * PDF Viewer Page — In-browser PDF reader.
 *
 * Renders inside the surfboard://pdf internal page.
 * Uses pdfjs-dist (bundled in src/renderer/pdfjs/) for page rendering.
 *
 * Features:
 *   - Page-by-page navigation
 *   - Zoom in/out / fit-width / fit-page
 *   - Download button (saves to OS downloads)
 *   - Print button (opens native print dialog)
 *   - Page number indicator
 */
(function () {
  'use strict';

  const PDFJS_PATH = './pdfjs/pdf.mjs';

  let _pdfDoc = null;           // pdfjs PDFDocumentProxy
  let _currentPage = 1;
  let _numPages = 0;
  let _zoom = 1.0;
  let _cacheKey = null;
  let $container = null;
  let $canvas = null;
  let $ctx = null;
  let $pageNum = null;
  let $pageCount = null;
  let $zoomLevel = null;
  let _rendering = false;
  let _pendingRender = null;
  let _pdfjs = null;

  // ── Toolbar HTML ────────────────────────────────────────
  function toolbarHTML(cacheKey) {
    return `
      <div class="pdf-toolbar">
        <div class="pdf-toolbar-left">
          <button class="pdf-btn" data-pdf="prev" title="Previous Page (Page Up)">◀</button>
          <span class="pdf-page-info">
            Page <input type="number" class="pdf-page-input" value="1" min="1" /> of <span class="pdf-page-count">-</span>
          </span>
          <button class="pdf-btn" data-pdf="next" title="Next Page (Page Down)">▶</button>
        </div>
        <div class="pdf-toolbar-center">
          <button class="pdf-btn" data-pdf="zoom-out" title="Zoom Out">−</button>
          <span class="pdf-zoom-level">100%</span>
          <button class="pdf-btn" data-pdf="zoom-in" title="Zoom In">+</button>
          <button class="pdf-btn" data-pdf="fit-width" title="Fit Width">↔</button>
          <button class="pdf-btn" data-pdf="fit-page" title="Fit Page">⤡</button>
        </div>
        <div class="pdf-toolbar-right">
          <button class="pdf-btn" data-pdf="download" title="Download">⬇</button>
          <button class="pdf-btn" data-pdf="print" title="Print">🖨</button>
          <button class="pdf-btn" data-pdf="close" title="Close">✕</button>
        </div>
      </div>
    `;
  }

  // ── Page HTML ───────────────────────────────────────────
  function viewerHTML(cacheKey) {
    return `
      <div class="pdf-viewer">
        ${toolbarHTML(cacheKey)}
        <div class="pdf-canvas-container">
          <canvas class="pdf-canvas"></canvas>
          <div class="pdf-loading">Loading PDF…</div>
          <div class="pdf-error hidden">Failed to load PDF.</div>
        </div>
      </div>
    `;
  }

  // ── Init ────────────────────────────────────────────────
  function init(container, params) {
    const cacheKey = params?.id;
    if (!cacheKey) {
      container.innerHTML = '<div class="pdf-error">No PDF specified.</div>';
      return;
    }

    _cacheKey = cacheKey;
    $container = container;
    container.innerHTML = viewerHTML(cacheKey);

    $canvas = container.querySelector('.pdf-canvas');
    $ctx = $canvas.getContext('2d');

    // Make viewer focusable for keyboard events
    container.tabIndex = -1;
    container.focus({ preventScroll: true });
    $pageNum = container.querySelector('.pdf-page-input');
    $pageCount = container.querySelector('.pdf-page-count');
    $zoomLevel = container.querySelector('.pdf-zoom-level');

    // Bind toolbar events
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pdf]');
      if (!btn) return;
      const action = btn.dataset.pdf;
      switch (action) {
        case 'prev': _goToPage(_currentPage - 1); break;
        case 'next': _goToPage(_currentPage + 1); break;
        case 'zoom-in': _setZoom(_zoom * 1.25); break;
        case 'zoom-out': _setZoom(_zoom / 1.25); break;
        case 'fit-width': _fitWidth(); break;
        case 'fit-page': _fitPage(); break;
        case 'download': _download(); break;
        case 'print': _print(); break;
        case 'close': _close(); break;
      }
    });

    // Page input
    $pageNum.addEventListener('change', () => {
      const n = parseInt($pageNum.value, 10);
      if (n >= 1 && n <= _numPages) _goToPage(n);
    });

    // Keyboard shortcuts
    container.addEventListener('keydown', (e) => {
      if (e.key === 'PageUp' || (e.key === 'ArrowUp' && e.altKey)) {
        e.preventDefault(); _goToPage(_currentPage - 1);
      } else if (e.key === 'PageDown' || (e.key === 'ArrowDown' && e.altKey)) {
        e.preventDefault(); _goToPage(_currentPage + 1);
      }
    });

    // Load PDF
    _loadPdf(cacheKey);
  }

  // ── Load PDF ────────────────────────────────────────────
  async function _loadPdf(cacheKey) {
    const loadingEl = $container.querySelector('.pdf-loading');
    const errorEl = $container.querySelector('.pdf-error');
    loadingEl.classList.remove('hidden');

    try {
      // Load pdfjs-dist dynamically
      _pdfjs = await import(PDFJS_PATH);
      _pdfjs.GlobalWorkerOptions.workerSrc = './pdfjs/pdf.worker.min.mjs';

      // Fetch PDF data via IPC
      const result = await window.electronAPI.pdf.getData(cacheKey);
      if (!result || !result.buffer) throw new Error('No PDF data');

      // Convert renderer ArrayBuffer to Uint8Array for pdfjs
      const data = new Uint8Array(result.buffer.data || result.buffer);

      // Load PDF document
      const loadingTask = _pdfjs.getDocument({ data });
      _pdfDoc = await loadingTask.promise;
      _numPages = _pdfDoc.numPages;
      $pageCount.textContent = _numPages;
      $pageNum.max = _numPages;

      loadingEl.classList.add('hidden');

      // Render first page
      _fitWidth();
    } catch (err) {
      console.error('[PDF Viewer]', err);
      loadingEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
      errorEl.textContent = 'Failed to load PDF: ' + (err.message || 'Unknown error');
    }
  }

  // ── Render page ─────────────────────────────────────────
  async function _renderPage(pageNum) {
    if (!_pdfDoc || _rendering) {
      _pendingRender = pageNum;
      return;
    }

    _rendering = true;
    _pendingRender = null;

    try {
      const page = await _pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: _zoom });

      // Resize canvas to device pixels
      const devicePixelRatio = window.devicePixelRatio || 1;
      $canvas.width = viewport.width * devicePixelRatio;
      $canvas.height = viewport.height * devicePixelRatio;
      $canvas.style.width = viewport.width + 'px';
      $canvas.style.height = viewport.height + 'px';
      $ctx.scale(devicePixelRatio, devicePixelRatio);

      await page.render({
        canvasContext: $ctx,
        viewport,
      }).promise;

      _currentPage = pageNum;
      $pageNum.value = pageNum;
      $zoomLevel.textContent = Math.round(_zoom * 100) + '%';
    } catch (err) {
      console.error('[PDF Viewer] Render error:', err);
    }

    _rendering = false;
    if (_pendingRender !== null) {
      _renderPage(_pendingRender);
    }
  }

  // ── Navigation ──────────────────────────────────────────
  function _goToPage(n) {
    if (n < 1 || n > _numPages || n === _currentPage) return;
    _renderPage(n);
  }

  // ── Zoom ────────────────────────────────────────────────
  function _setZoom(scale) {
    _zoom = Math.max(0.25, Math.min(5, scale));
    _renderPage(_currentPage);
  }

  function _fitWidth() {
    if (!_pdfDoc || !$canvas) return;
    const containerEl = $container.querySelector('.pdf-canvas-container');
    const containerWidth = containerEl.clientWidth - 40; // padding
    // Get page 1's viewport at scale 1 to calculate fit
    const scale = containerWidth / 612; // ~612pt = US Letter width
    _zoom = Math.max(0.25, Math.min(5, scale));
    _renderPage(_currentPage);
  }

  function _fitPage() {
    if (!_pdfDoc || !$canvas) return;
    const containerEl = $container.querySelector('.pdf-canvas-container');
    const containerWidth = containerEl.clientWidth - 40;
    const containerHeight = containerEl.clientHeight - 40;
    const scaleX = containerWidth / 612;
    const scaleY = containerHeight / 792;
    _zoom = Math.max(0.25, Math.min(5, Math.min(scaleX, scaleY)));
    _renderPage(_currentPage);
  }

  // ── Actions ─────────────────────────────────────────────
  async function _download() {
    try {
      await window.electronAPI.pdf.download(_cacheKey);
    } catch (err) {
      console.error('[PDF Viewer] Download failed:', err);
    }
  }

  async function _print() {
    try {
      await window.electronAPI.pdf.print(_cacheKey);
    } catch (err) {
      console.error('[PDF Viewer] Print failed:', err);
    }
  }

  function _close() {
    const activeTab = window.PaperTM?.getActiveTabId?.();
    if (activeTab) {
      window.electronAPI.tabs.close(activeTab);
    }
  }

  // ── Cleanup ─────────────────────────────────────────────
  function destroy() {
    _pdfDoc = null;
    _currentPage = 1;
    _numPages = 0;
    _zoom = 1.0;
    _cacheKey = null;
    _pdfjs = null;
  }

  // ── Resize handler ──────────────────────────────────────
  function onResize() {
    // Optionally re-fit on container resize
  }

  // ── Public API ─────────────────────────────────────────
  window.PDFViewerPage = {
    init,
    destroy,
    onResize,
  };
})();

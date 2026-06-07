/**
 * DataPipeline — Browser-Native Feature Platform
 * Page scraping, table/row extraction, field mapping, transform.
 *
 * Usage:
 * DataPipeline.init({ root: document.getElementById('app') })
 * DataPipeline.extractTable({ root: document.body })
 * DataPipeline.mapFields(rows, { name: '0', price: '1' })
 * DataPipeline.transform(row, (r) => ({ name: r[0], value: Number(r[1]) }))
 */
(function () {
  'use strict';

  let _root = null;
  let _enabled = false;
  let _listeners = [];

  function _notify(type, detail) {
    _listeners.forEach((fn) => fn(type, detail));
  }

  // Text extraction from node (handles text nodes, ignores non-element nodes)
  function _toText(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1) return '';
    const text = Array.from(node.childNodes)
      .map(_toText)
      .join('');
    return text.trim();
  }

  // Query wrapper with error prevention
  function _query(el, sel) {
    if (!el) return null;
    try {
      return el.querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  // QueryAll with array conversion
  function _queryAll(el, sel) {
    if (!el) return [];
    try {
      return Array.from(el.querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }

  // Convert TR node to record array
  function _trToRecord(row) {
    if (!row || row.nodeName !== 'TR') return null;
    const cells = Array.from(row.children).filter(
      (cell) => cell.nodeName === 'TD' || cell.nodeName === 'TH'
    );
    if (!cells.length) return null;
    return cells.map((cell) => _toText(cell) || '');
  }

  // Convert TABLE node to { headers, rows }
  function _tableToData(tableEl) {
    const headers = _queryAll(tableEl, 'thead tr')
      .map(_trToRecord)
      .filter(Boolean)
      .pop() || [];
    const body = _queryAll(tableEl, 'tbody tr')
      .map(_trToRecord)
      .filter(Boolean);
    const rows = !body.length && _queryAll(tableEl, 'tr').length > 1
      ? _queryAll(tableEl, 'tr').map(_trToRecord).filter(Boolean).slice(1)
      : body;
    return { headers, rows };
  }

  // ====== Public API ======

  function init(deps) {
    _root = deps?.root || null;
  }

  function enable(overrideRoot) {
    if (overrideRoot) _root = overrideRoot;
    if (!_root) return false;
    if (_enabled) return true;
    try {
      if (window.TrustManager) window.TrustManager.require('data', 'scrape');
    } catch (err) {
      _notify('denied', { error: err.message });
      return false;
    }
    _enabled = true;
    _root.setAttribute('data-data-active', '');
    _notify('enabled', {});
    return true;
  }

  function disable() {
    if (!_enabled) return;
    _enabled = false;
    if (_root) _root.removeAttribute('data-data-active');
    _notify('disabled', {});
  }

  // ----- Scraping -----
  function extractTable(opts = {}) {
    if (!_enabled) return [];
    const target = opts.root || _root;
    if (!target) throw new Error('No root element');
    const tables = _queryAll(target, 'table');
    if (!tables.length) return [];
    const extracted = tables.slice(0, opts.limit || 1).map((tableEl) => ({
      element: tableEl,
      data: _tableToData(tableEl),
    }));
    _notify('extracted-tables', { count: extracted.length });
    return extracted;
  }

  function extractLinks(opts = {}) {
    if (!_enabled) return [];
    const target = opts.root || _root;
    if (!target) throw new Error('No root element');
    const links = _queryAll(target, 'a[href]').map((aEl) => ({
      text: _toText(aEl),
      href: aEl.getAttribute('href') || '',
      html: aEl.outerHTML,
      element: aEl,
    }));
    _notify('extracted-links', { count: links.length });
    return links;
  }

  function extractTextBlocks(opts = {}) {
    if (!_enabled) return [];
    const target = opts.root || _root;
    if (!target) throw new Error('No root element');
    const selectors = opts.selectors || [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'article', 'section', 'div.content',
      'li', 'td', 'th', 'span[data-text]',
    ];
    const results = [];
    selectors.forEach((sel) => {
      _queryAll(target, sel).forEach((el) => {
        const text = _toText(el);
        if (text) results.push({ selector: sel, text, element: el });
      });
    });
    _notify('extracted-textblocks', { count: results.length });
    return results;
  }

  // ----- Mapping -----
  function mapFields(source, config = {}) {
    if (!source) return [];
    const normalize = (item) => {
      const row = {};
      Object.keys(config).forEach((fieldKey) => {
        const spec = config[fieldKey];
        let val = null;
        try {
          if (typeof spec === 'number') {
            if (Array.isArray(item) && item[spec]) val = item[spec];
          } else if (typeof spec === 'string') {
            if (item.element) {
              val = _toText(_query(item.element, spec));
            } else if (item.text) {
              val = item.text;
            }
          } else if (typeof spec === 'function') {
            val = spec(item);
          }
        } catch (e) {
          _notify('map-error', { field: fieldKey, error: e.message });
        }
        row[fieldKey] = val;
      });
      return row;
    };
    return Array.isArray(source) ? source.map(normalize) : [normalize(source)];
  }

  // ----- ETL -----
  function transform(item, fn) {
    if (typeof fn !== 'function') return item;
    try {
      const result = fn(item);
      _notify('transformed', { success: true, item });
      return result;
    } catch (e) {
      _notify('transform-error', { error: e.message, item });
      return item;
    }
  }

  function transformRows(rows, fn) {
    if (!Array.isArray(rows)) throw new Error('transformRows input must be an array');
    return rows.map((row) => transform(row, fn));
  }

  function writeBack(url, payload = {}) {
    if (!_enabled || !_root) return Promise.reject(new Error('DataPipeline is not enabled'));
    _notify('writeback', { url, payload });
    // Stub implementation
    return Promise.resolve({
      status: 'simulated',
      url,
      payload,
      error: '\u263A simulate-only',
    });
  }

  // Module cleanup
  function reset() {
    disable();
    _root = null;
    _listeners = [];
  }

  // Event listening
  function onChange(fn) {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  }

  // Expose public API
  window.DataPipeline = {
    init,
    enable,
    disable,
    isEnabled: () => _enabled,
    onChange,
    reset,
    extractTable,
    extractLinks,
    extractTextBlocks,
    mapFields,
    transform,
    transformRows,
    writeBack,
  };
})();

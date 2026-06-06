/**
 * Inspector — Browser-Native Feature Platform
 * DOM querying, hover highlights, selection frames, spacing guides,
 * typography/accessibility overlays.
 *
 * Usage:
 *   Inspector.init({ root: document.getElementById('app') })
 *   Inspector.enable()
 *   Inspector.disable()
 *   Inspector.query('h2, h3') → [el, ...]
 *   Inspector.inspect(el) → { tag, id, classes, attrs, computed, box, typography, a11y }
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let _root = null;
  let _enabled = false;
  let _hoverEl = null;        // currently hovered element
  let _selectedEl = null;     // clicked/locked element
  let _hoverBox = null;       // hover highlight overlay
  let _selectedBox = null;    // selection frame overlay
  let _spacingGuides = [];    // spacing guide lines
  let _typographyOverlay = null;
  let _a11yOverlay = null;
  let _tooltip = null;        // element info tooltip
  let _listeners = [];
  let _showSpacing = true;
  let _showTypography = true;
  let _showA11y = true;

  // ── Helpers ────────────────────────────────────────────
  function _isOverlay(el) {
    return el && el.dataset && el.dataset.inspectorOverlay !== undefined;
  }

  function _notify(type, detail) {
    _listeners.forEach(fn => fn(type, detail));
  }

  function _escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Element Info ───────────────────────────────────────
  function _getBox(el) {
    if (!el || !el.getBoundingClientRect) return null;
    const rect = el.getBoundingClientRect();
    const rootRect = (_root && _root.getBoundingClientRect) ? _root.getBoundingClientRect() : { top: 0, left: 0 };
    return {
      top: rect.top - rootRect.top,
      left: rect.left - rootRect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right - rootRect.left,
      bottom: rect.bottom - rootRect.top,
    };
  }

  function _getComputed(el) {
    if (!window.getComputedStyle) return {};
    const cs = window.getComputedStyle(el);
    return {
      display: cs.display,
      position: cs.position,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign,
      padding: cs.padding,
      margin: cs.margin,
      border: cs.border,
      borderRadius: cs.borderRadius,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      overflow: cs.visibility,
    };
  }

  function _getTypography(el) {
    const cs = window.getComputedStyle ? window.getComputedStyle(el) : {};
    const tag = el.tagName.toLowerCase();
    const text = el.textContent || '';
    const isHeading = /^h[1-6]$/.test(tag);
    const isText = /^(p|span|a|li|td|th|label|figcaption|blockquote|pre|code|strong|em|b|i|u|small|mark|del|ins|sub|sup|caption|summary)$/.test(tag);
    return {
      tag,
      isHeading,
      isText,
      textLength: text.trim().length,
      wordCount: text.trim() ? text.trim().split(/\s+/).length : 0,
      fontSize: cs.fontSize || '',
      fontWeight: cs.fontWeight || '',
      fontFamily: cs.fontFamily || '',
      lineHeight: cs.lineHeight || '',
      textAlign: cs.textAlign || '',
      color: cs.color || '',
      backgroundColor: cs.backgroundColor || '',
      contrastRatio: _contrastRatio(cs.color, cs.backgroundColor),
    };
  }

  function _luminance(hexOrRgb) {
    if (!hexOrRgb) return 0;
    // Parse rgb(r,g,b) or hex
    let r, g, b;
    const rgbMatch = hexOrRgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      r = parseInt(rgbMatch[1]) / 255;
      g = parseInt(rgbMatch[2]) / 255;
      b = parseInt(rgbMatch[3]) / 255;
    } else if (hexOrRgb.startsWith('#')) {
      const h = hexOrRgb.slice(1);
      r = parseInt(h.substring(0, 2), 16) / 255;
      g = parseInt(h.substring(2, 4), 16) / 255;
      b = parseInt(h.substring(4, 6), 16) / 255;
    } else {
      return 0.5; // unknown, return mid
    }
    const chan = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  }

  function _contrastRatio(fg, bg) {
    try {
      const l1 = _luminance(fg);
      const l2 = _luminance(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return ((lighter + 0.05) / (darker + 0.05)).toFixed(1);
    } catch (e) { return '—'; }
  }

  function _getA11y(el) {
    const tag = el.tagName.toLowerCase();
    const attrs = el.attributes || [];
    const result = {
      role: el.getAttribute('role') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      ariaLabelledBy: el.getAttribute('aria-labelledby') || '',
      ariaDescribedBy: el.getAttribute('aria-describedby') || '',
      ariaHidden: el.getAttribute('aria-hidden') || '',
      tabIndex: el.getAttribute('tabindex') || '',
      title: el.getAttribute('title') || '',
      alt: el.getAttribute('alt') || '',
      lang: el.getAttribute('lang') || '',
      isInteractive: /^(a|button|input|select|textarea|details|summary)$/.test(tag) || el.getAttribute('tabindex') !== null,
      hasAlt: tag === 'img' ? !!el.getAttribute('alt') : null,
      hasLabel: false,
      issues: [],
    };

    // Check for common a11y issues
    if (tag === 'img' && !result.alt) result.issues.push('missing-alt');
    if (tag === 'a' && !el.textContent.trim() && !result.ariaLabel) result.issues.push('empty-link');
    if (tag === 'input' && !result.ariaLabel && !el.id) result.issues.push('unlabeled-input');
    if (result.ariaHidden === 'true') result.issues.push('aria-hidden');

    // Check if element has associated label
    if (el.id) {
      const root = _root || document.body;
      const label = root.querySelector('label[for="' + el.id + '"]');
      if (label) { result.hasLabel = true; result.issues = result.issues.filter(i => i !== 'unlabeled-input'); }
    }

    return result;
  }

  function inspect(el) {
    if (!el) return null;
    return {
      tag: el.tagName ? el.tagName.toLowerCase() : '',
      id: el.id || '',
      classes: Array.from(el.classList || []),
      attrs: Array.from(el.attributes || []).reduce((m, a) => { m[a.name] = a.value; return m; }, {}),
      computed: _getComputed(el),
      box: _getBox(el),
      typography: _getTypography(el),
      a11y: _getA11y(el),
    };
  }

  // ── DOM Query ──────────────────────────────────────────
  function query(selector) {
    const root = _root || document.body;
    if (!root) return [];
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  function queryAll(selector) { return query(selector); }

  // ── Overlays ───────────────────────────────────────────
  function _createOverlay(cls) {
    const el = document.createElement('div');
    el.className = cls;
    el.dataset.inspectorOverlay = '';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '8000';
    return el;
  }

  function _showHoverBox(el) {
    _hideHoverBox();
    if (!el || el === _root) return;
    const box = _getBox(el);
    if (!box) return;
    const overlay = _createOverlay('inspector-hover-box');
    overlay.style.top = box.top + 'px';
    overlay.style.left = box.left + 'px';
    overlay.style.width = box.width + 'px';
    overlay.style.height = box.height + 'px';
    _root.appendChild(overlay);
    _hoverBox = overlay;
  }

  function _hideHoverBox() {
    if (_hoverBox && _hoverBox.parentNode) _hoverBox.parentNode.removeChild(_hoverBox);
    _hoverBox = null;
  }

  function _showSelectedBox(el) {
    _hideSelectedBox();
    if (!el || el === _root) return;
    const box = _getBox(el);
    if (!box) return;
    const overlay = _createOverlay('inspector-selected-box');
    overlay.style.top = box.top + 'px';
    overlay.style.left = box.left + 'px';
    overlay.style.width = box.width + 'px';
    overlay.style.height = box.height + 'px';
    _root.appendChild(overlay);
    _selectedBox = overlay;
  }

  function _hideSelectedBox() {
    if (_selectedBox && _selectedBox.parentNode) _selectedBox.parentNode.removeChild(_selectedBox);
    _selectedBox = null;
  }

  // ── Spacing Guides ─────────────────────────────────────
  function _showSpacingGuides(el) {
    _hideSpacingGuides();
    if (!_showSpacing || !el || el === _root) return;
    const box = _getBox(el);
    if (!box) return;
    const cs = window.getComputedStyle ? window.getComputedStyle(el) : {};

    const marginTop = parseFloat(cs.marginTop) || 0;
    const marginRight = parseFloat(cs.marginRight) || 0;
    const marginBottom = parseFloat(cs.marginBottom) || 0;
    const marginLeft = parseFloat(cs.marginLeft) || 0;
    const paddingTop = parseFloat(cs.paddingTop) || 0;
    const paddingRight = parseFloat(cs.paddingRight) || 0;
    const paddingBottom = parseFloat(cs.paddingBottom) || 0;
    const paddingLeft = parseFloat(cs.paddingLeft) || 0;

    const guides = [];

    // Margin lines (dashed, outer)
    if (marginTop > 0) {
      guides.push({ x1: box.left, y1: box.top - marginTop, x2: box.right, y2: box.top - marginTop, label: 'margin-top: ' + marginTop + 'px', cls: 'inspector-guide-margin' });
    }
    if (marginBottom > 0) {
      guides.push({ x1: box.left, y1: box.bottom + marginBottom, x2: box.right, y2: box.bottom + marginBottom, label: 'margin-bottom: ' + marginBottom + 'px', cls: 'inspector-guide-margin' });
    }
    if (marginLeft > 0) {
      guides.push({ x1: box.left - marginLeft, y1: box.top, x2: box.left - marginLeft, y2: box.bottom, label: 'margin-left: ' + marginLeft + 'px', cls: 'inspector-guide-margin' });
    }
    if (marginRight > 0) {
      guides.push({ x1: box.right + marginRight, y1: box.top, x2: box.right + marginRight, y2: box.bottom, label: 'margin-right: ' + marginRight + 'px', cls: 'inspector-guide-margin' });
    }

    // Padding lines (dotted, inner)
    if (paddingTop > 0) {
      guides.push({ x1: box.left, y1: box.top + paddingTop, x2: box.right, y2: box.top + paddingTop, label: 'padding-top: ' + paddingTop + 'px', cls: 'inspector-guide-padding' });
    }
    if (paddingBottom > 0) {
      guides.push({ x1: box.left, y1: box.bottom - paddingBottom, x2: box.right, y2: box.bottom - paddingBottom, label: 'padding-bottom: ' + paddingBottom + 'px', cls: 'inspector-guide-padding' });
    }
    if (paddingLeft > 0) {
      guides.push({ x1: box.left + paddingLeft, y1: box.top, x2: box.left + paddingLeft, y2: box.bottom, label: 'padding-left: ' + paddingLeft + 'px', cls: 'inspector-guide-padding' });
    }
    if (paddingRight > 0) {
      guides.push({ x1: box.right - paddingRight, y1: box.top, x2: box.right - paddingRight, y2: box.bottom, label: 'padding-right: ' + paddingRight + 'px', cls: 'inspector-guide-padding' });
    }

    guides.forEach(g => {
      const line = _createOverlay('inspector-guide ' + g.cls);
      const isHoriz = g.y1 === g.y2;
      if (isHoriz) {
        line.style.top = g.y1 + 'px';
        line.style.left = Math.min(g.x1, g.x2) + 'px';
        line.style.width = Math.abs(g.x2 - g.x1) + 'px';
        line.style.height = '1px';
      } else {
        line.style.left = g.x1 + 'px';
        line.style.top = Math.min(g.y1, g.y2) + 'px';
        line.style.height = Math.abs(g.y2 - g.y1) + 'px';
        line.style.width = '1px';
      }
      _root.appendChild(line);
      _spacingGuides.push(line);

      // Label
      if (g.label) {
        const lbl = _createOverlay('inspector-guide-label');
        lbl.style.top = (isHoriz ? g.y1 - 14 : Math.min(g.y1, g.y2)) + 'px';
        lbl.style.left = (isHoriz ? Math.min(g.x1, g.x2) : g.x1 + 4) + 'px';
        lbl.textContent = g.label;
        _root.appendChild(lbl);
        _spacingGuides.push(lbl);
      }
    });
  }

  function _hideSpacingGuides() {
    _spacingGuides.forEach(g => { if (g.parentNode) g.parentNode.removeChild(g); });
    _spacingGuides = [];
  }

  // ── Typography Overlay ─────────────────────────────────
  function _showTypographyOverlay(el) {
    _hideTypographyOverlay();
    if (!_showTypography || !el || el === _root) return;
    const typo = _getTypography(el);
    if (!typo.isText && !typo.isHeading) return;
    const box = _getBox(el);
    if (!box) return;

    const overlay = _createOverlay('inspector-typography-overlay');
    overlay.style.top = (box.top - 20) + 'px';
    overlay.style.left = box.left + 'px';
    const info = [];
    if (typo.fontSize) info.push(typo.fontSize);
    if (typo.fontWeight && typo.fontWeight !== '400') info.push(typo.fontWeight);
    if (typo.lineHeight && typo.lineHeight !== 'normal') info.push('lh:' + typo.lineHeight);
    if (typo.textAlign && typo.textAlign !== 'start') info.push(typo.textAlign);
    overlay.textContent = info.join('  ');
    _root.appendChild(overlay);
    _typographyOverlay = overlay;
  }

  function _hideTypographyOverlay() {
    if (_typographyOverlay && _typographyOverlay.parentNode) _typographyOverlay.parentNode.removeChild(_typographyOverlay);
    _typographyOverlay = null;
  }

  // ── A11y Overlay ───────────────────────────────────────
  function _showA11yOverlay(el) {
    _hideA11yOverlay();
    if (!_showA11y || !el || el === _root) return;
    const a11y = _getA11y(el);
    if (!a11y.issues.length && !a11y.role && !a11y.ariaLabel) return;
    const box = _getBox(el);
    if (!box) return;

    const overlay = _createOverlay('inspector-a11y-overlay');
    overlay.style.top = (box.bottom + 2) + 'px';
    overlay.style.left = box.left + 'px';
    const parts = [];
    if (a11y.role) parts.push('role=' + a11y.role);
    if (a11y.ariaLabel) parts.push('label=' + a11y.ariaLabel.substring(0, 30));
    if (a11y.issues.length) parts.push('⚠ ' + a11y.issues.join(', '));
    overlay.textContent = parts.join('  ');
    _root.appendChild(overlay);
    _a11yOverlay = overlay;
  }

  function _hideA11yOverlay() {
    if (_a11yOverlay && _a11yOverlay.parentNode) _a11yOverlay.parentNode.removeChild(_a11yOverlay);
    _a11yOverlay = null;
  }

  // ── Tooltip ────────────────────────────────────────────
  function _showTooltip(el, e) {
    _hideTooltip();
    if (!el || el === _root) return;
    const box = _getBox(el);
    if (!box) return;
    const tag = el.tagName.toLowerCase();
    const id = el.id ? '#' + el.id : '';
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 3).join('.') : '';
    const cs = window.getComputedStyle ? window.getComputedStyle(el) : {};

    const tooltip = _createOverlay('inspector-tooltip');
    tooltip.style.pointerEvents = 'auto';
    tooltip.style.top = (box.top - 2) + 'px';
    tooltip.style.left = (box.right + 6) + 'px';

    let html = '<div class="inspector-tooltip-tag">&lt;' + _escHtml(tag) + _escHtml(id) + _escHtml(cls) + '&gt;</div>';
    html += '<div class="inspector-tooltip-size">' + Math.round(box.width) + ' × ' + Math.round(box.height) + '</div>';
    if (cs.fontSize) html += '<div class="inspector-tooltip-typo">' + _escHtml(cs.fontSize);
    if (cs.fontFamily) html += ' ' + _escHtml(cs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
    html += '</div>';
    if (cs.color) html += '<div class="inspector-tooltip-color"><span class="inspector-color-swatch" style="background:' + _escAttr(cs.color) + '"></span>' + _escHtml(cs.color) + '</div>';
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') html += '<div class="inspector-tooltip-color bg"><span class="inspector-color-swatch" style="background:' + _escAttr(cs.backgroundColor) + '"></span>' + _escHtml(cs.backgroundColor) + '</div>';

    tooltip.innerHTML = html;
    _root.appendChild(tooltip);
    _tooltip = tooltip;
  }

  function _hideTooltip() {
    if (_tooltip && _tooltip.parentNode) _tooltip.parentNode.removeChild(_tooltip);
    _tooltip = null;
  }

  // ── Event Handlers ─────────────────────────────────────
  function _onMouseMove(e) {
    if (!_enabled || !_root) return;
    const el = e.target;
    if (_isOverlay(el) || (el.closest && el.closest('[data-inspector-overlay]'))) return;
    if (el === _root) {
      _hideHoverBox();
      _hoverEl = null;
      return;
    }
    if (el !== _hoverEl) {
      _hoverEl = el;
      _showHoverBox(el);
      _showTooltip(el, e);
    }
  }

  function _onClick(e) {
    if (!_enabled || !_root) return;
    if (_isOverlay(e.target) || (e.target.closest && e.target.closest('[data-inspector-overlay]'))) return;
    const el = e.target;
    if (el === _root) {
      _selectedEl = null;
      _hideSelectedBox();
      _hideSpacingGuides();
      _hideTypographyOverlay();
      _hideA11yOverlay();
      _notify('deselect', {});
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    _selectedEl = el;
    _showSelectedBox(el);
    _showSpacingGuides(el);
    _showTypographyOverlay(el);
    _showA11yOverlay(el);
    _notify('select', { element: el, info: inspect(el) });
  }

  function _onKeyDown(e) {
    if (!_enabled) return;
    if (e.key === 'Escape') {
      if (_selectedEl) {
        _selectedEl = null;
        _hideSelectedBox();
        _hideSpacingGuides();
        _hideTypographyOverlay();
        _hideA11yOverlay();
        _notify('deselect', {});
      } else {
        disable();
      }
    }
  }

  // ── Style injection ────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('inspector-styles')) return;
    const style = document.createElement('style');
    style.id = 'inspector-styles';
    style.textContent = [
      '/* ── Inspector styles ─────────────────────────────── */',
      '.inspector-hover-box {',
      '  border: 1px solid rgba(96,165,250,0.6);',
      '  background: rgba(96,165,250,0.06);',
      '}',
      '.inspector-selected-box {',
      '  border: 2px solid var(--accent, #60a5fa);',
      '  background: rgba(96,165,250,0.04);',
      '}',
      '.inspector-guide-margin {',
      '  background: rgba(251,191,36,0.5);',
      '}',
      '.inspector-guide-padding {',
      '  background: rgba(52,211,153,0.5);',
      '}',
      '.inspector-guide-label {',
      '  font-size: 9px;',
      '  font-family: monospace;',
      '  color: rgba(251,191,36,0.9);',
      '  background: rgba(0,0,0,0.6);',
      '  padding: 1px 3px;',
      '  border-radius: 2px;',
      '  white-space: nowrap;',
      '  pointer-events: none;',
      '}',
      '.inspector-typography-overlay {',
      '  font-size: 9px;',
      '  font-family: monospace;',
      '  color: rgba(167,139,250,0.9);',
      '  background: rgba(0,0,0,0.5);',
      '  padding: 1px 4px;',
      '  border-radius: 2px;',
      '  white-space: nowrap;',
      '}',
      '.inspector-a11y-overlay {',
      '  font-size: 9px;',
      '  font-family: monospace;',
      '  color: rgba(251,146,60,0.9);',
      '  background: rgba(0,0,0,0.5);',
      '  padding: 1px 4px;',
      '  border-radius: 2px;',
      '  white-space: nowrap;',
      '}',
      '.inspector-tooltip {',
      '  background: var(--bg-elevated, #1c1c1f);',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 6px;',
      '  padding: 6px 8px;',
      '  font-size: 10px;',
      '  font-family: monospace;',
      '  color: var(--text, #d4d4d8);',
      '  box-shadow: 0 4px 12px rgba(0,0,0,0.3);',
      '  max-width: 280px;',
      '  pointer-events: none;',
      '  z-index: 8001;',
      '}',
      '.inspector-tooltip-tag {',
      '  color: var(--accent, #60a5fa);',
      '  font-weight: 600;',
      '  margin-bottom: 2px;',
      '}',
      '.inspector-tooltip-size {',
      '  color: var(--text-faint, #52525b);',
      '  margin-bottom: 2px;',
      '}',
      '.inspector-tooltip-typo {',
      '  color: var(--text-dim, #71717a);',
      '  margin-bottom: 2px;',
      '}',
      '.inspector-tooltip-color {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  color: var(--text-dim, #71717a);',
      '}',
      '.inspector-color-swatch {',
      '  display: inline-block;',
      '  width: 10px;',
      '  height: 10px;',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 2px;',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  try { _injectStyles(); } catch (e) { /* noop in non-browser */ }

  // ── Public API ─────────────────────────────────────────
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
        window.TrustManager.require('inspector', 'inspectDom');
      }
    } catch (err) {
      _notify('denied', { error: err.message });
      return false;
    }

    _enabled = true;
    _root.addEventListener('mousemove', _onMouseMove, true);
    _root.addEventListener('click', _onClick, true);
    document.addEventListener('keydown', _onKeyDown, true);
    _root.setAttribute('data-inspector-active', '');
    _notify('enabled', {});
    return true;
  }

  function disable() {
    if (!_enabled) return;
    _enabled = false;
    _hoverEl = null;
    _selectedEl = null;
    _hideHoverBox();
    _hideSelectedBox();
    _hideSpacingGuides();
    _hideTypographyOverlay();
    _hideA11yOverlay();
    _hideTooltip();
    _root.removeEventListener('mousemove', _onMouseMove, true);
    _root.removeEventListener('click', _onClick, true);
    document.removeEventListener('keydown', _onKeyDown, true);
    _root.removeAttribute('data-inspector-active');
    _root.querySelectorAll('[data-inspector-overlay]').forEach(el => el.parentNode.removeChild(el));
    _notify('disabled', {});
  }

  function isEnabled() { return _enabled; }
  function getSelected() { return _selectedEl; }
  function getHover() { return _hoverEl; }

  function toggleSpacing(on) {
    _showSpacing = on !== undefined ? !!on : !_showSpacing;
    if (_selectedEl) _showSpacingGuides(_selectedEl);
    return _showSpacing;
  }

  function toggleTypography(on) {
    _showTypography = on !== undefined ? !!on : !_showTypography;
    if (_selectedEl) _showTypographyOverlay(_selectedEl);
    return _showTypography;
  }

  function toggleA11y(on) {
    _showA11y = on !== undefined ? !!on : !_showA11y;
    if (_selectedEl) _showA11yOverlay(_selectedEl);
    return _showA11y;
  }

  function onChange(fn) {
    _listeners.push(fn);
    return function () { _listeners = _listeners.filter(l => l !== fn); };
  }

  function reset() {
    disable();
    _root = null;
    _listeners = [];
    _showSpacing = true;
    _showTypography = true;
    _showA11y = true;
  }

  window.Inspector = {
    init,
    enable,
    disable,
    isEnabled,
    getSelected,
    getHover,
    inspect,
    query,
    queryAll,
    toggleSpacing,
    toggleTypography,
    toggleA11y,
    onChange,
    reset,
  };
})();

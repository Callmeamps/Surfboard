# HTML-in-Canvas API Reference

## Overview

The HTML-in-Canvas API is a Chrome platform feature (origin trial Chrome 148-150) that renders real DOM content inside a `<canvas>` element while keeping it fully interactive, accessible, and integrated with browser features.

**Announcement:** [Introducing the HTML-in-Canvas API origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial) (Chrome for Developers Blog, May 19, 2026)

**Spec:** [HTML Standard — The canvas element: `drawElementImage`](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-drawelementimage)

## Purpose

The web has two rendering models:

| Model | Strengths | Weaknesses |
|-------|-----------|------------|
| **DOM** | Text layout, accessibility, find-in-page, extensions, form controls, copy/paste | Expensive for high-frame-rate rendering, no low-level pixel control |
| **Canvas** | 60fps rendering, pixel control, WebGL/WebGPU textures, effects | No text layout, no accessibility, no browser feature integration |

HTML-in-Canvas bridges both: **DOM content rendered through the canvas pipeline**, getting the best of both worlds.

## API Surface

### Canvas Setup

Add `layoutsubtree` to the `<canvas>` element. This tells the browser to track child elements for canvas rendering and expose them to accessibility trees.

```html
<canvas id="canvas" layoutsubtree>
  <div id="ui">
    <h2>Interactive Content</h2>
    <input type="text" placeholder="Type here...">
    <button>Submit</button>
  </div>
</canvas>
```

### Canvas Sizing

Size the canvas backing store to match the device pixel ratio to avoid blurriness:

```javascript
const observer = new ResizeObserver(([entry]) => {
  const dpc = entry.devicePixelContentBoxSize;
  canvas.width = dpc
    ? dpc[0].inlineSize
    : Math.round(entry.contentRect.width * window.devicePixelRatio);
  canvas.height = dpc
    ? dpc[0].blockSize
    : Math.round(entry.contentRect.height * window.devicePixelRatio);
});

const supportsDPC =
  typeof ResizeObserverEntry !== 'undefined' &&
  'devicePixelContentBoxSize' in ResizeObserverEntry.prototype;

observer.observe(canvas, supportsDPC ? { box: 'device-pixel-content-box' } : {});
```

### 2D Rendering: `drawElementImage()`

Renders a DOM element into the canvas 2D context. Returns a `DOMMatrix` for spatial sync.

```javascript
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');

canvas.onpaint = () => {
  ctx.reset();

  // Draw element at (x, y). Returns DOMMatrix.
  const transform = ctx.drawElementImage(ui, 0, 0);

  // Apply transform so browser maps clicks/hovers correctly
  ui.style.transform = transform.toString();
};
```

**Signature:**
```
DOMMatrix drawElementImage(element, dx, dy)
DOMMatrix drawElementImage(element, dx, dy, dw, dh)
DOMMatrix drawElementImage(element, sx, sy, sw, sh, dx, dy, dw, dh)
```

- `element` — Any DOM element to render
- `dx, dy` — Position in canvas
- `dw, dh` — Scaled size in canvas
- `sx, sy, sw, sh` — Source crop rectangle

### WebGL Rendering: `texElementImage2D()`

Renders a DOM element as a WebGL texture. Useful for 3D scenes with DOM-based UI.

```javascript
canvas.onpaint = () => {
  if (gl.texElementImage2D) {
    gl.texElementImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, element
    );
  }
};
```

For spatial sync with WebGL, use `element.getElementTransform(mvpMatrix)` to compute the CSS transform from the model-view-projection matrix.

### WebGPU Rendering: `copyElementImageToTexture()`

Renders a DOM element into a WebGPU texture.

```javascript
canvas.onpaint = () => {
  device.queue.copyElementImageToTexture(
    { source: element },
    { texture: targetTexture },
    [element.offsetWidth, element.offsetHeight]
  );
};
```

## Browser Feature Integration

Content rendered via HTML-in-Canvas retains full browser integration:

| Feature | Works? | Notes |
|---------|--------|-------|
| Text selection | ✅ | Highlight, copy, paste |
| Form controls | ✅ | Inputs, selects, textareas |
| Right-click context menu | ✅ | Native browser menu |
| Accessibility tree | ✅ | Screen readers, a11y tools |
| Find-in-page (Ctrl+F) | ✅ | Browser highlights matches in canvas |
| Browser extensions | ✅ | Extensions can read/modify content |
| DevTools inspection | ✅ | Inspect elements inside canvas |
| Text translation | ✅ | Built-in translate works |
| Dark mode | ✅ | `prefers-color-scheme` respected |
| Browser zoom | ✅ | Zoom scales canvas content |
| Autofill | ✅ | Password managers, address fill |
| Indexability | ✅ | Crawlers can read text content |
| AI agent interfaceable | ✅ | Agents can read and interact |

## Use Cases

### Canvas-Based Applications
Apps like Google Docs, Figma, or Miro that render their workspace to canvas can now embed real DOM UI components (toolbars, menus, dialogs) directly into the canvas — improving accessibility and reducing bundle size.

### 3D Scenes and Games
Marketing sites, WebXR experiences, and games can place fully interactive web UI into 3D scenes — a 3D book with real selectable text, an in-game terminal with copy/paste, HUD elements with form controls.

### Surfboard Canvas Pages
In Surfboard, canvas pages use this API to render interactive views (history, bookmarks, activity, agents, bash sessions) inside `<canvas>` elements. The DOM content stays interactive while the canvas layer provides rendering performance and visual effects.

## Availability

| Platform | Version | Status |
|----------|---------|--------|
| Chrome | 148+ | Origin trial |
| Chrome Canary | 149+ | Behind `chrome://flags/#canvas-draw-element` |
| Electron | 38+ (estimated) | Ships Chromium 148+ |
| Electron | 33.x (current) | **Not available** — Chromium 128 |

## Electron Version Constraint

**Current project:** Electron 33.4.11 (Chromium 132) — HTML-in-Canvas API is **not available**.

**Required:** Electron 38+ (Chromium 148+) for native API support.

### Upgrade Path

1. **Phase 7 implementation**: Build canvas pages using `<canvas layoutsubtree>` with DOM children rendered as normal HTML overlays (polyfill mode)
2. **Electron upgrade**: Bump `electron` dependency from `^33.0.0` to `^38.0.0` (or latest)
3. **Flag enable**: Add `chrome://flags/#canvas-draw-element` to Electron launch args
4. **Swap**: Replace polyfill rendering with native `ctx.drawElementImage()` calls

The polyfill path delivers the same visual design and DOM structure — the native API just routes rendering through the canvas pipeline, enabling effects and 3D transforms.

## Limitations (Chrome 148-150 Origin Trial)

- API is in early development — implementation details may change
- Only works in Chromium-based browsers
- Origin trial token required for production use (not needed for local/Electron apps)
- WebGL/WebGPU paths require manual transform computation for spatial sync
- Nested canvas elements inside canvas are not supported
- Some CSS properties may not render identically to standalone DOM

## Examples

### Basic Interactive Canvas Page

```html
<canvas id="history-page" layoutsubtree>
  <div class="canvas-page">
    <h2>Browsing History</h2>
    <input type="search" placeholder="Search history...">
    <ul class="history-list">
      <li><a href="https://example.com">Example Site</a> — 2:30 PM</li>
      <li><a href="https://github.com">GitHub</a>— 1:15 PM</li>
    </ul>
  </div>
</canvas>
```

```javascript
const canvas = document.getElementById('history-page');
const page = canvas.querySelector('.canvas-page');
const ctx = canvas.getContext('2d');

// Size canvas to match display
const resize = () => {
  const dpr = window.devicePixelRatio;
  canvas.width = canvas.offsetWidth * dpr;
  canvas.height = canvas.offsetHeight * dpr;
};
new ResizeObserver(resize).observe(canvas);
resize();

// Render DOM into canvas
canvas.onpaint = () => {
  ctx.reset();
  const transform = ctx.drawElementImage(page, 0, 0);
  page.style.transform = transform.toString();
};
```

### Canvas Page with Search

```javascript
const searchInput = page.querySelector('input[type="search"]');
const historyList = page.querySelector('.history-list');
const allItems = [...historyList.querySelectorAll('li')];

searchInput.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  allItems.forEach(li => {
    const text = li.textContent.toLowerCase();
    li.style.display = text.includes(q) ? '' : 'none';
  });
  // Trigger canvas repaint
  canvas.dispatchEvent(new Event('paint'));
});
```

## References

- [Chrome Blog: Introducing the HTML-in-Canvas API origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial)
- [HTML Standard — drawElementImage](https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-drawelementimage)
- [HTML Standard — texElementImage2D](https://html.spec.whatwg.org/multipage/canvas.html#dom-webgl2renderingcontext-texelementimage2d)
- [Chromium Bug Tracker: HTML-in-Canvas](https://bugs.chromium.org/p/chromium/issues/detail?id=40924448)

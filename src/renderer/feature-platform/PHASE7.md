# Phase 7 Plan — Right Sidebar, Vertical Island, Canvas Pages

## Vision

Transform the browser layout from a **left-sidebar + floating island** to a **dual-sidebar** design:

- **Left sidebar**: vertical tabs + minimap (keep existing, slim)
- **Right sidebar**: vertical island + popup webview panel for tools, extensions, settings, quick pages
- **Center**: webview content area
- **Canvas pages**: HTML-in-Canvas views for history, activity, bookmarks, agents, bash sessions

Uses the **HTML-in-Canvas API** (Chrome 148+ origin trial) that renders real DOM inside `<canvas>` while keeping content interactive, accessible, and hooked to browser features.

**Reference:** [`docs/html-in-canvas-api.md`](../../docs/html-in-canvas-api.md)

---

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────┐  ┌────────────────────────────────────┐  ┌──────────┐ │
│ │      │  │                                    │  │ ▲ AI     │ │
│ │ Tab  │  │                                    │  │ ▲ Shell  │ │
│ │ Tab  │  │         Webview Content            │  │ ▲ Edit   │ │
│ │ Tab  │  │                                    │  │ ▲ Inspect│ │
│ │  ··· │  │                                    │  │ ▲ Actions│ │
│ │      │  │                                    │  │ ▲ Data   │ │
│ │ Minimap  │                                    │  │ ▲ Workflw│ │
│ │      │  │                                    │  │ ▲ Miniapp│ │
│ └──────┘  └────────────────────────────────────┘  │ ┌──────┐ │ │
│                                                    │ │ Pop- │ │ │
│                                                    │ │ up   │ │ │
│                                                    │ │ Web- │ │ │
│                                                    │ │ view │ │ │
│                                                    │ └──────┘ │ │
│                                                    └──────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites: Electron Upgrade

**Must happen before or alongside WP-4 (Canvas Pages).**

Current: Electron 33.4.11 (Chromium 132) — HTML-in-Canvas API not available.
Target: Electron 38+ (Chromium 148+) — API available behind `canvas-draw-element` flag.

### Upgrade Steps

1. Update `package.json`: `"electron": "^38.0.0"` (or latest stable)
2. Run `npm install` to pull new Electron
3. Add flag to Electron launch in `package.json` start script:
   ```json
   "start": "electron . --no-sandbox --enable-features=CanvasDrawElement"
   ```
4. Verify Chromium version: `process.versions.chrome` should report 148+
5. Run full test suite — Electron upgrades can break IPC, webview, and session APIs
6. Check for breaking changes in Electron 34→38 release notes:
   - IPC handler signatures
   - Webview attributes and permissions
   - Session/partition APIs
   - `contextBridge` behavior

### Risks

| Risk | Mitigation |
|------|------------|
| IPC breaking changes | Run all 355 tests after upgrade; fix failures before proceeding |
| Webview behavior changes | Test tab creation, navigation, visibility toggling |
| Extension API changes | Test extension load/list/unload |
| Native module rebuilds | Rebuild any native deps with `electron-rebuild` |
| Performance regressions | Benchmark tab switch, canvas render before/after |

---

## Work Packages

### WP-1: Layout Restructure — Right Sidebar Shell

**Files**: `index.html`, `main.css`, `app.js`

- Add `#right-sidebar` element to `#app` flex container
- Move island from floating absolute → vertical column inside right sidebar
- Right sidebar is narrow (~48px for icons, expandable to ~320px for popup panel)
- Add collapse/expand toggle (mirrors left sidebar pattern)
- CSS: `--right-sidebar-w: 48px` collapsed, `--right-sidebar-expanded-w: 320px`
- Left sidebar stays at `--sidebar-w: 220px` (tabs + bookmarks)

### WP-2: Vertical Island

**Files**: `index.html`, `main.css`, `app.js`

- Convert `#island` from horizontal pill → vertical button stack
- Buttons: AI, Shell, Edit, Inspect, Actions, Data, Workflows, Miniapps
- Each button gets an icon + tooltip (no labels in collapsed state)
- Active mode gets `.active` highlight (accent color left border or glow)
- Click toggles the corresponding feature-platform module
- Keyboard shortcuts stay the same (Ctrl+Shift+E/I/A/R/M etc.)
- Mode badge shown as a small indicator dot on the active button

### WP-3: Popup Webview Panel

**Files**: `index.html`, `main.css`, `app.js`, new `js/right-sidebar.js`

- Panel slides out from right sidebar when a tool button is clicked
- Contains a `<webview>` element for loading internal pages or extension UIs
- Panel header: title + close button + pin button (keep open vs auto-close)
- Content sources:
  - **Extensions**: load extension popup pages
  - **Tools**: feature-platform module UIs (inspector details, workflow editor, data pipeline results)
  - **Quick settings**: compact settings panels
  - **Miniapps**: sandboxed app panels
- Panel is a single shared webview — switching tools swaps the URL
- CSS: slide-in animation, max-width 480px, resizable via drag handle

### WP-4: Canvas Pages (HTML-in-Canvas API)

**Files**: new `js/canvas-pages.js`, `index.html`, `main.css`

**Requires:** Electron 38+ upgrade (prerequisite above).

Canvas pages use the HTML-in-Canvas API. Each page is a `<canvas layoutsubtree>` with real DOM children rendered into it via `ctx.drawElementImage()`.

**API pattern:**
```html
<canvas id="history-canvas" layoutsubtree>
  <div class="canvas-page">
    <h2>Browsing History</h2>
    <input type="search" placeholder="Search...">
    <ul class="history-list">
      <li><a href="...">Example Site</a> — 2:30 PM</li>
    </ul>
  </div>
</canvas>
```

```javascript
const ctx = canvas.getContext('2d');
const page = canvas.querySelector('.canvas-page');

canvas.onpaint = () => {
  ctx.reset();
  const transform = ctx.drawElementImage(page, 0, 0);
  page.style.transform = transform.toString();
};
```

**Pages to build:**

| Page | Shortcut | Description |
|------|----------|-------------|
| History | Ctrl+Shift+H | Scrollable list grouped by day, favicons, search/filter |
| Activity | Ctrl+Shift+J | Timeline of browsing sessions, tab switches, nav events |
| Bookmarks | Ctrl+Shift+B | Visual grid/list with favicons, tags, search |
| Agents | Ctrl+Shift+G | AI agent sessions, status, last message preview |
| Bash Sessions | Ctrl+Shift+X | Terminal session history, reconnect to running sessions |

**Module API (IIFE pattern, consistent with feature-platform):**
```javascript
window.CanvasPages = {
  init,           // set up canvas container
  open(pageId),   // show a canvas page (history, activity, etc.)
  close(),        // hide current canvas page
  isOpen(),       // bool
  getCurrent(),   // current page id
  onChange(fn),   // subscribe to page changes
  reset(),        // cleanup for tests
};
```

**Canvas pages are shown as full-content-area overlays** — they replace the webview container when active, and the webview container reappears when closed.

### WP-5: Feature Platform — UI Wiring

**Files**: `app.js`, `index.html`, `main.css`

Wire each feature-platform module to its island button + keyboard shortcut:

| Module | Shortcut | Island Button | Popup Panel |
|--------|----------|---------------|-------------|
| EditorEngine | Ctrl+Shift+E | ✏️ Edit | Style panel in popup |
| Inspector | Ctrl+Shift+I | 🔍 Inspect | Element details in popup |
| ActionRegistry | Ctrl+Shift+A | ⚡ Actions | Command bar in popup |
| DataPipeline | Ctrl+Shift+D | 📊 Data | Scraped data table in popup |
| WorkflowEngine | Ctrl+Shift+R | 🔁 Workflows | Step ladder in popup |
| AIClient | (existing) | 🤖 AI | Inline results in popup |
| ModeManager | Ctrl+Shift+M | (cycle indicator) | — |

- Each button shows active state (module enabled = button highlighted)
- Clicking an active button disables the module
- Trust permissions auto-granted on first use via confirmation dialog in popup

### WP-6: Miniapps Host

**Files**: `feature-platform/miniapps/index.js`, `index.html`, `main.css`

- Implement the empty `miniapps/` module
- API: `Miniapps.register({ id, name, icon, url })`, `Miniapps.open(id)`, `Miniapps.close(id)`
- Renders inside the popup webview panel as an iframe or webview
- Sandboxed: no Node.js access, isolated session
- Default miniapps: Calculator, Notes, Todo (simple HTML pages)
- Shown in island as 🧩 button, opens miniapp launcher in popup panel

### WP-7: Polish & Integration

**Files**: all above + tests

- Smooth transitions for sidebar expand/collapse
- Persist right-sidebar state (collapsed/expanded, last active panel) via storage IPC
- Update keyboard shortcut help overlay to show all new shortcuts
- Update AGENTS.md with new architecture
- Tests for: right-sidebar module, canvas-pages module, miniapps module, updated app wiring
- Performance: canvas pages should render at 60fps, no jank on scroll

---

## File Changes Summary

| File | Change |
|------|--------|
| `package.json` | **Electron `^33.0.0` → `^38.0.0`**, add `--enable-features=CanvasDrawElement` flag |
| `index.html` | Add `#right-sidebar`, `#popup-panel`, `#canvas-host`; move island; add `<script>` tags |
| `main.css` | Right sidebar layout, vertical island, popup panel, canvas pages, all new components |
| `app.js` | Wire island buttons to feature-platform modules, popup panel management, canvas page hosting |
| `js/right-sidebar.js` | **NEW** — right sidebar state, popup webview management, panel switching |
| `js/canvas-pages.js` | **NEW** — HTML-in-Canvas page engine, page registry, 5 page types |
| `feature-platform/miniapps/index.js` | Implement from scratch (currently empty) |
| `docs/html-in-canvas-api.md` | **NEW** — API reference (already created) |
| `test/right-sidebar.test.js` | **NEW** — sidebar state, panel open/close, webview swap |
| `test/canvas-pages.test.js` | **NEW** — canvas page rendering, page navigation |
| `test/miniapps.test.js` | **NEW** — miniapp registration, open/close, sandboxing |

---

## Dependencies

```
Electron Upgrade (prerequisite for WP-4)
    │
WP-1 (layout) ──→ WP-2 (island) ──→ WP-5 (wiring)
                     │
                     ├──→ WP-3 (popup panel) ──→ WP-6 (miniapps)
                     │
                     └──→ WP-4 (canvas pages) [needs Electron 38+]

WP-7 (polish) depends on all of the above
```

## Suggested Order

1. **Electron Upgrade** — Bump to 38+, run full test suite, fix breakage
2. **WP-1** — Layout restructure (foundation)
3. **WP-2** — Vertical island (moves existing buttons)
4. **WP-3** — Popup panel (webview container)
5. **WP-5** — Wire feature-platform modules to island buttons
6. **WP-4** — Canvas pages (needs Electron 38+ from step 1)
7. **WP-6** — Miniapps host (uses popup panel from WP-3)
8. **WP-7** — Polish, tests, docs

---

## Open Questions

1. **Popup panel persistence**: Should the panel stay open when switching tabs, or close automatically?
2. **Miniapp sandboxing**: Should miniapps run in a separate webview partition for true isolation?
3. **Right sidebar on left-handed mode**: Should the right sidebar be movable to the left side?
4. **Canvas page transitions**: Slide, fade, or scale transitions between canvas pages?
5. **Electron 38 stability**: Is Electron 38 stable enough, or should we target Electron 39+?

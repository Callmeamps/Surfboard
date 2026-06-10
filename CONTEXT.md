# Surfboard — Domain Context

## What Is Surfboard

Surfboard is a riced Electron-based browser. Frameless window, vertical tab bar, collapsible sidebar, floating AI sidecar, browser shell, Chrome extension support.

## Core Concepts

### Browser Shell
Allowlisted host commands via terminal. Ctrl+Shift+S to toggle. Runs in sandboxed pty.

### AI Sidecar
Floating panel for model interaction. Context extraction, inline results, workflow generation from prompts.

### Feature Platform
Modular renderer-side system at `src/renderer/feature-platform/`:

| Module | Purpose |
|--------|---------|
| **modes/** | Browse/Inspect/Edit/Action/Run/Result state machine |
| **inspector/** | DOM querying, hover highlights, selection frames, overlays |
| **editor/** | ContentEditable, drag-drop, resize handles, undo/redo |
| **actions/** | Contextual action discovery, permission checks, execution |
| **workflows/** | Visual step ladder, trigger/condition/action, data mapping |
| **miniapps/** | Sandboxed panel/drawer/card rendering, postMessage bridge |
| **data/** | Page scraping, table extraction, field mapping, write-back |
| **ai/** | Model calls, context extraction, inline display |
| **trust/** | Permission/audit layer, approval flows, data safety |

### Canvas Pages
HTML-in-Canvas rendering via Electron 42+ `drawElementImage()`. Interactive DOM inside `<canvas>`. History, bookmarks, activity, agents, bash views.

### Multi-Profile
Per-profile isolation: bookmarks, history, settings, extensions, session partitions. Legacy `storage.json` auto-migrates to `profile-{id}.json`.

### Miniapps
Sandboxed iframe host. `sandbox: true`, strict CSP srcdoc, `MiniappSDK` postMessage bridge.

## Architecture

```
main process                              renderer
    │                                ┌── feature-platform/
    │                                │   ├── modes/
    │                                │   ├── inspector/
    │                                │   ├── editor/
    │                                │   ├── actions/
    │                                │   ├── workflows/
    │                                │   ├── miniapps/
    │                                │   ├── data/
    │                                │   ├── ai/
    │                                │   └── trust/
    └── IPC ── preload.js ────────► └── app.js
```

## Data Flow

- **Storage:** `storage.js` delegates to `profiles.js` — profile-scoped `profile-{id}.json`
- **IPC:** `ipc-handlers.js` exposes channels for tabs, storage, profiles, extensions, shell
- **Preload:** `preload.js` exposes `electronAPI` to renderer (tabs, storage, profiles, shell, extensions)

## Key Files

| Path | Role |
|------|------|
| `src/main/main.js` | Entry, window mgmt, profile init |
| `src/main/tab-manager.js` | Tab CRUD, active tab tracking |
| `src/main/tab-lifecycle.js` | Tab creation, navigation, close |
| `src/main/storage.js` | Profile-delegated data ops |
| `src/main/profiles.js` | Profile CRUD, session partitioning |
| `src/main/browser-shell.js` | Terminal shell process |
| `src/main/extension-loader.js` | Chrome extension loading |
| `src/main/ipc-handlers.js` | All IPC channel registration |
| `src/preload/preload.js` | electronAPI bridge |
| `src/renderer/js/app.js` | Renderer entry, init |
| `src/renderer/js/canvas-pages.js` | HTML-in-Canvas pages |
| `src/renderer/js/profiles.js` | Profile manager UI |
| `src/shared/constants.js` | Shared config (dims, shortcuts, paths) |

## Terminology

- **Sidecar** — Floating AI panel
- **Canvas Pages** — Interactive DOM rendered inside `<canvas>`
- **Miniapps** — Sandboxed third-party panels
- **Feature Platform** — Modular renderer subsystem
- **Shell** — Host terminal integration
- **Profile** — Isolated browsing context (bookmarks, history, settings, extensions)
- **Ricing** — Heavy UI customization (frameless, custom titlebar, vertical tabs)

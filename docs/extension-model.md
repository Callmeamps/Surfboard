# Extension Execution/Isolation Model

## Current Implementation

Extensions load into `session.defaultSession` via `session.defaultSession.loadExtension()` in `src/main/extension-loader.js`. IPC handlers (`src/main/ipc-handlers.js:214-227`) expose `extensions:load/list/unload` to the renderer via `contextBridge` in `src/preload/preload.js:78-82`. A `broadcastUpdate()` pushes extension state to all windows on `extensions:updated`.

## Options

### A) Direct (current) — extensions share session with browser

Extensions and web content share `session.defaultSession`. This is what Electron's API is designed for — `chrome.tabs`, `chrome.webRequest`, and content scripts only work when extensions are in the same session as the tabs they observe.

**Pros:** Works out of the box; full Electron extension API compatibility; simple.  
**Cons:** No isolation — a crashing/compromised extension shares cookie jar, storage, and network state; background pages run in the same process tree.

### B) Isolate — separate session per extension or group

Load extensions into `session.fromPartition('persist:extensions')` instead of `defaultSession`.

**Pros:** Separate cookie jar/storage; crash isolation via process boundary.  
**Cons:** **Breaks core extension APIs** — `chrome.tabs`, `chrome.webRequest`, and content scripts cannot cross session boundaries; Electron only supports extensions on persistent sessions (no `utilityProcess`-based isolation). Not viable for a functional extension system.

### C) Hybrid — use `electron-chrome-extensions` library

Use the [electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell) npm package (v4.x) which implements the full Chrome extension API surface on top of Electron's limited built-in support.

**Pros:** uBlock Origin, Dark Reader, etc. work; customizable tab/window/permission handling; active maintenance.  
**Cons:** Adds dependency (~30KB); extensions still share the session for tab/webRequest interaction; library is opinionated about architecture.

## Recommendation

**Direct** — stay on `session.defaultSession`. Electron's extension API fundamentally requires extensions and browser content to share a persistent session for tabs, webRequest, and content scripts to function. True process isolation would break these capabilities. Mitigate risk via: extension vetting before load, CSP on extension contexts, and monitoring for abuse via `chrome.management` events.

```
RECOMMENDATION: direct
REASONING: Electron's extension API requires extensions and browser tabs to share a persistent session for chrome.tabs, chrome.webRequest, and content scripts to function; process isolation breaks these cross-session capabilities.
```

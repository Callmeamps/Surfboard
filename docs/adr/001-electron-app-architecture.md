# ADR-001: Electron App Architecture

## Status

Accepted

## Context

Surfboard is a riced Electron browser with vertical tabs, sidebar, AI sidecar, browser shell, Chrome extensions, and a modular feature platform. Needs clear separation between main process (OS integration, window management, data) and renderer (UI, feature modules).

## Decision

Use standard Electron 3-process architecture:

- **Main process** (`src/main/`) — Window management, tab lifecycle, IPC handlers, storage, profiles, extension loading, browser shell
- **Preload** (`src/preload/`) — IPC bridge exposing `electronAPI` to renderer
- **Renderer** (`src/renderer/`) — UI logic, feature platform modules, styles

IPC is the only communication channel between main and renderer. No direct module imports across process boundaries.

## Consequences

**Positive:**
- Clear security boundary — renderer cannot access Node.js APIs directly
- Feature platform modules are renderer-only, no main process coupling
- Storage is profile-scoped and centralized in main process
- Extensions load in main process with full Chrome API access

**Negative:**
- IPC overhead for every data operation (mitigated by batching in storage.js)
- Preload must be updated for any new main process capability
- Feature platform modules cannot directly access file system or OS APIs

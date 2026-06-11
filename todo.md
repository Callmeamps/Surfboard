# Build Order — Next Session

## Priority 1 (ship next)

- [ ] Extension popup support — render extension popups in sidecar panel (bead riced-chromium-ohq)
  - [ ] IPC handler for extension popup URL + badge text
  - [ ] Preload method to get popup info
  - [ ] Sidecar panel: iframe-based popup renderer
  - [ ] Badge count display on extensions button
  - [ ] Tests for popup IPC + renderer

- [ ] Tab group coloring — color picker per group (bead riced-chromium-8xc)
  - [ ] Add `color` field to group schema in tab-manager
  - [ ] IPC handler for group color update
  - [ ] Color picker in group context menu
  - [ ] CSS: colored group header + left border on grouped tabs
  - [ ] Persist group color in session
  - [ ] Tests for group color operations

## Priority 2 (follow-up)

- [ ] Custom theme builder — create/edit/save themes (bead riced-chromium-4gz)
- [ ] Cloud providers — Replit + Gitpod device code flows (bead riced-chromium-9zu)
- [ ] SSH reconnection — auto-reconnect on network drop (bead riced-chromium-k85)

## Priority 3 (backlog)

- [ ] Shortcut menu dedup — unify data sources (bead riced-chromium-u0t)

## Session completed this round

- [x] Tab groups — drag-to-assign, collapse, session persistence (545 tests)
- [x] Cloud sessions — GitHub Codespaces OAuth, workspace CRUD (561 tests)

## Stats

- Tests: 561 passing, 31 suites
- Beads: 6 open, 0 blocked
- Last push: 01ba919

# riced-chromium — Project Sync

## Active

(none)

## Blocked

(none)

## Done

- [x] Git init + .gitignore (commit: def9e32)
- [x] Fix extension-loader.js broadcast — added broadcastUpdate fn (commit: edc6c5e)
- [x] Fix tab-lifecycle.js ID mismatch — registerWebContents + getWebContents (commit: edc6c5e)
- [x] Fix preload/IPC mismatch — added sidebar:state/save/load handlers (commit: edc6c5e)
- [x] Remove duplicate lifecycle import in ipc-handlers.js (commit: edc6c5e)
- [x] Add test infrastructure — Jest, 22 passing tests (commit: edc6c5e)

## Remaining

- AI backend integration (sendChat is placeholder)
- Extension loader testing
- Address bar / omnibox with search suggestions
- Persistent bookmark/history storage enhancements
- Settings page builder
- Multi-profile support

## Audit Follow-up (beads)

- [ ] Verify unused files — app.js, main.css, constants.js may be false positives (bead riced-chromium-1ol)
- [ ] Refactor app.js — 19 complex untested functions, MI: 64.1 (bead riced-chromium-klx)
- [ ] Extract tokenizeCommandLine in browser-shell.js — cognitive: 36 (bead riced-chromium-ao5)
- [ ] Add tests for tab-lifecycle.js hotspot (bead riced-chromium-d1a)

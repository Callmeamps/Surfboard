# Surfboard — Project Sync

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
- [x] Verify unused files — app.js/main.css false positives (HTML loaded), constants.js = dead code (bead riced-chromium-1ol)
- [x] Extract tokenizeCommandLine → 7 helpers, 37 tests pass (bead riced-chromium-ao5)
- [x] Add tab-lifecycle tests — 29 new tests, 66 total (bead riced-chromium-d1a)
- [x] Decide extension model — direct session (bead riced-chromium-sfk), see docs/extension-model.md
- [x] Infra cleanup — renamed to surfboard, CI added, dolt remote configured
- [x] 66 tests passing across 6 suites

## Remaining

- [ ] Refactor app.js — 19 complex untested functions, MI: 64.1, CRAP max: 342 (bead riced-chromium-klx)
- AI backend integration (sendChat is placeholder)
- Extension loader testing
- Address bar / omnibox with search suggestions
- Persistent bookmark/history storage enhancements
- Settings page builder
- Multi-profile support

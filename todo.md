# Surfboard — Project Sync

## Active

- [~] Fix TrustManager permissions at boot (bead riced-chromium-9ay)
- [ ] Add CanvasPages.close() method (bead riced-chromium-ra4)
- [ ] Fix keyboard shortcuts for feature-platform (bead riced-chromium-enq, blocked by 9ay)
- [ ] Fix miniapps ModeManager sync (bead riced-chromium-f0g)

## Blocked

- Keyboard shortcuts (bead riced-chromium-enq) blocked by TrustManager fix

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
- [x] Extract PaperTM module (papertm.js) — tab logic consolidated (beads ric-39o + ric-klx)
- [x] Ctrl+Tab / Ctrl+Shift+Tab cycling (PaperWM-style strip nav)
- [x] Wire AI backend — sendChat calls configured API (OpenAI/Anthropic/Ollama)
- [x] Extension loader IPC tests — 21 new tests, 87 total (bead riced-chromium-pc1)
- [x] Extract settings page module — src/renderer/js/settings.js (bead riced-chromium-8kq)
- [x] Address bar omnibox — fuzzy match + DDG/Brave API suggestions (bead riced-chromium-hi1)
- [x] Bookmark/history persistence UI — header, search, dialog, island button, import/export (bead riced-chromium-37i)
- [x] Electron 33→42 upgrade + extension API migration (commit 5c68df3)
- [x] E2E test: all buttons verified working with correct permissions

## Remaining

- Multi-profile support (deferred)

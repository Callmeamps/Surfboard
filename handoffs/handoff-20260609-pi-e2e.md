# Handoff 20260609 pi — E2E smoke test & extension fix

- Duration: ~45 min
- Message Count: ~30

## What was done

### Bug fix: Extension loading completely broken

**Root cause:** Electron 42 moved the extension API from `session.extensions.loadExtension()` to `session.loadExtension()` directly. The old code used `session.extensions.loadExtension()` which fails because `session.extensions` is `undefined` in Electron 42.

**Secondary issue:** `session.fromPartition()` was called at module load time (before `app.whenReady()`). In Electron 42, this returns a session object where `.extensions` is undefined. The fix lazily initializes the session.

**Fix:**
- `src/main/extension-loader.js`: Changed `extSession.extensions.loadExtension(path)` → `extSession.loadExtension(path)` and `extSession.extensions.unloadExtension(id)` → `extSession.removeExtension(id)`
- Made session initialization lazy via `getExtSession()` so it's only created inside `autoLoadExtensions()` which runs after `app.whenReady()`
- `test/extension-loader.test.js`: Updated mocks from `{ extensions: { loadExtension, unloadExtension } }` to direct `{ loadExtension, removeExtension }` on session objects

### E2E Smoke Test

Created comprehensive Playwright E2E smoke test (`test/e2e/smoke-test.mjs`) that verifies:

| Feature | Status |
|---|---|
| Right sidebar buttons (11/11) | ✓ All present |
| AI button → opens sidecar | ✓ Sidecar shown |
| Shell button → switches mode | ✓ Shell panel visible |
| Edit mode toggle | ✓ Toggle on/off |
| Inspect mode toggle | ✓ Toggle on/off |
| Actions mode toggle | ✓ Toggle on/off |
| Data mode toggle | ✓ Works |
| Workflows toggle | ✓ Works |
| Miniapps button | ✓ Works |
| Canvas: Ctrl+Shift+H (history) | ✓ Opens/closes |
| Canvas: Ctrl+Shift+X (bash) | ✓ Opens/closes |
| Canvas: Ctrl+Shift+B (bookmarks) | ✓ Opens/closes |
| Window controls (min/max/close) | ✓ All present |
| Feature platform modules (11/11) | ✓ All loaded |
| Extensions loaded (3) | ✓ Browser-Native, uBlock, Video Speed |
| Renderer errors | ✓ Zero |

### Unit tests
- All **397 tests** pass (22 suites)
- Extension-loader test coverage unchanged (25 tests, all pass)

## Repost status

- `main` is up to date with `origin/main`
- Commits pushed:
  - `2b1766b` — fix: session.loadExtension for Electron 42 API
  - `83541ba` — chore: mark E2E smoke test complete
- Beads pushed (`bd dolt push` succeeded)
- All uncommitted: only `handoffs/handoff-20260609-pi-203612.md`

## Open Issues (unchanged)

- `riced-chromium-omi` — P2 Canvas pages real data wiring
- `riced-chromium-xow` — P2 Miniapps sandboxing
- `riced-chromium-57t` — P3 Multi-profile support
- `riced-chromium-y2k` — P3 HTML-in-Canvas native rendering

## Gotchas

- **Electron 42 API change:** Extensions use `session.loadExtension()` not `session.extensions.loadExtension()`. Also `removeExtension()`, `getExtension()`, `getAllExtensions()` are direct session methods.
- **Session timing:** `session.fromPartition()` gets a valid session before `app.whenReady()`, but extension methods are undefined until the app is ready. Always create extension sessions lazily.
- **Extension background pages** appear as separate BrowserWindow in Playwright. When using `electronApp.firstWindow()`, you might get an extension page first. Check the title and iterate.
- **Screenshots in headless:** Need `setViewportSize()` before capturing because extension background pages have 0 width.

# Build Order — Full Test Suite

## Phase 1: Integration Tests (P0)

### 1.1 Tab Lifecycle + Groups (riced-chromium-kfq)
- [ ] Create tab in real Electron, verify DOM element appears
- [ ] Close tab, verify removal from DOM
- [ ] Switch tabs, verify active state updates
- [ ] Create group, verify group header appears
- [ ] Assign tab to group, verify visual grouping
- [ ] Collapse group, verify tabs hidden
- [ ] Set group color, verify CSS variable applied
- [ ] Remove tab from group, verify ungrouping
- [ ] Delete group, verify cleanup

### 1.2 Sidecar + Sidebar (riced-chromium-23v)
- [ ] Toggle sidebar expand/collapse
- [ ] Verify sidebar state persists across navigation
- [ ] Click AI button, verify sidecar opens
- [ ] Switch to Shell mode, verify panel changes
- [ ] Switch to Edit mode, verify editor activates
- [ ] Switch to Inspect mode, verify inspector activates
- [ ] Close sidecar, verify hidden state
- [ ] Verify mode buttons highlight correctly

## Phase 2: Integration Tests (P1)

### 2.1 Profiles + Bookmarks + History (riced-chromium-48m)
- [ ] Create new profile, verify switch
- [ ] Add bookmark in profile A, verify not visible in profile B
- [ ] Edit bookmark, verify changes persist
- [ ] Delete bookmark, verify removal
- [ ] Visit page, verify history entry created
- [ ] Search history, verify results
- [ ] Clear history, verify empty

### 2.2 Extensions + PDF + Downloads (riced-chromium-4yy)
- [ ] Load valid extension, verify listed
- [ ] Click extension popup, verify opens in sidecar
- [ ] Verify badge count updates
- [ ] Navigate to PDF URL, verify viewer opens
- [ ] Test PDF toolbar (prev/next page, zoom)
- [ ] Download PDF, verify file saved
- [ ] Trigger download, verify progress shown

## Phase 3: Integration Tests (P2)

### 3.1 Shell + Settings + Session (riced-chromium-k07)
- [ ] Toggle shell panel, verify opens
- [ ] Run allowed command, verify output
- [ ] Block disallowed command, verify error
- [ ] Change setting, verify saved to disk
- [ ] Close app, reopen, verify window bounds restored
- [ ] Verify tab order restored

### 3.2 Cloud + SSH (riced-chromium-43i)
- [ ] Initiate GitHub OAuth, verify device code flow
- [ ] List workspaces, verify display
- [ ] SSH connect, verify session opens
- [ ] SSH disconnect, verify cleanup
- [ ] Test auto-reconnect logic

## Phase 4: E2E Tests (P0)

### 4.1 Core Workflows (riced-chromium-s23)
- [ ] Tab workflow: create → navigate → bookmark → close
- [ ] Profile workflow: create → switch → verify isolation
- [ ] Extension workflow: load → popup → badge
- [ ] Feature platform: toggle all modes, verify UI
- [ ] Canvas pages: open history/bookmarks/bash via shortcuts

## Phase 5: E2E Tests (P2)

### 5.1 Cloud + PDF Workflows (riced-chromium-i1c)
- [ ] Cloud OAuth: authenticate → list → start workspace
- [ ] PDF: click link → render → download

## Phase 6: Crash Tests (P1)

### 6.1 Stress + Chaos + Failures (riced-chromium-8co)
- [ ] Tab stress: open 100+ tabs, rapid create/close
- [ ] Extension chaos: invalid manifest, missing files
- [ ] Network failure: offline, timeout, invalid cert
- [ ] Malformed URLs: javascript:, data:, file://, broken
- [ ] Storage corruption: delete JSON mid-write, partial writes
- [ ] Concurrent IPC: rapid bursts, out-of-order messages
- [ ] Profile edge cases: delete active, switch during write
- [ ] PDF malformed: not PDF, truncated, 0 bytes
- [ ] SSH disconnect: kill mid-command, invalid host
- [ ] Extension flood: 10k messages/sec

## Phase 7: Taste Tests (P1)

### 7.1 UX Quality Audit (riced-chromium-7cc)
- [ ] UI consistency: colors, spacing, typography
- [ ] Responsive layout: resize, collapse, narrow widths
- [ ] Dark mode: all components render correctly
- [ ] Empty states: no bookmarks/history/extensions
- [ ] Loading states: skeletons, spinners, progress
- [ ] Error states: network error, auth failure, permission denied
- [ ] Keyboard accessibility: tab order, focus visible, shortcuts
- [ ] Animation smoothness: sidecar, tab drag, mode transitions

## CI Config

- All tests run with `--runInBand` (sequential)
- Integration/E2E/crash tests require `xvfb-run` for Electron
- Taste tests use Playwright screenshots + assertions
- Results checked via `gh run list` + `gh run view <id>`

## Stats
- Beads: 10 created
- New test files: 30
- Current: 36 tests → Target: 66 tests

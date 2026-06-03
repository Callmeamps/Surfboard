# PaperTM — Scrollable-Strip Tab Manager

## Motivation

Conventional tab bars treat all tabs equally — same size, flat list. Many tabs = truncated titles, lost favicons, precise targeting needed.

PaperWM and Niri introduced **scrollable tiling**: windows arranged in an infinite strip. Opening a new window never resizes existing ones. You scroll the strip to navigate. The active window is the "current position" — fully visible. Others peek from the edges — enough to identify, not enough to clutter.

PaperTM applies this to browser tabs. The sidebar becomes a **scrollable vertical strip** of paper-like tab cards. Each tab is a page in the strip. Active tab is the focused page. Inactive tabs are compact peeks. Adding tabs never compresses existing ones.

Inspired by: [PaperWM](https://github.com/paperwm/PaperWM) (scrollable tiling for GNOME Shell), [Niri](https://github.com/niri-wm/niri) (scrollable-tiling Wayland compositor), and Android Recents (card stack with active prominence).

## Core Principles (from PaperWM/Niri)

| Principle | PaperWM/Niri | PaperTM |
|-----------|-------------|---------|
| **Infinite strip** | Windows in horizontal strip, scroll to see more | Tabs in vertical strip, scroll the sidebar |
| **No resize on add** | New window added to strip end, existing unchanged | New tab appends to strip, existing tabs stay their size |
| **Active is focused** | Active window at full size, centered | Active tab at full height, elevated, prominent |
| **Peek context** | Adjacent windows show partial width | Inactive tabs show partial height (28px peek) |
| **Smooth scroll** | Scroll to pan the strip | Scroll through tab stack naturally |
| **Stable layout** | Windows keep their size, only position changes | Tabs keep their dimensions, only active/inactive state toggles |

## Design Goals

1. **Scrollable strip, not deck** — Tabs feel like pages in a continuous strip, not cards in a stack
2. **Active tab is prominent** — Full height, elevated with shadow, readable title, visible controls
3. **Inactive tabs are peeks** — Compressed to 28px, showing favicon + short title. Enough to identify at a glance
4. **Paper physics** — Subtle cascade tilt (above active tilt forward, below tilt backward), smooth 300ms transitions
5. **No resize on tab create** — Adding a tab doesn't shrink existing ones. Active stays active-sized, inactive stay peek-sized
6. **Potato-first perf** — Animations use GPU-composited properties only (transform, opacity). No layout thrash
7. **Vertical bar preserved** — Sidebar remains the tab surface. No horizontal tab strip

## Visual Model

```
┌─ Surfboard Tab Strip ─────────────────────┐
│                                            │
│  ┌▸ Google ───────────────────────────────┐│  ← inactive (28px peek, tilt up)
│  │  🔍 search results                     ││
│  └────────────────────────────────────────┘│
│  ┌▸ GitHub ───────────────────────────────┐│  ← inactive (28px peek, tilt up)
│  │  PR #42                               ││
│  └════════════════════════════════════════┘│
│  ┌═ GitHub ═══════════════════════════════┐│  ← ACTIVE (36px, elevated, shadow)
│  ║  PR #42 — paper-style tab manager     ║│
│  ║  [✕]                                  ║│
│  ╚════════════════════════════════════════╝│
│  ┌▸ Reddit ───────────────────────────────┐│  ← inactive (28px peek, tilt down)
│  │  r/unixporn                            ││
│  └────────────────────────────────────────┘│
│  ┌▸ YouTube ──────────────────────────────┐│  ← inactive (28px peek, tilt down)
│  │  lofi hip hop                         ││
│  └────────────────────────────────────────┘│
│                                            │
│           [+ New Tab]                      │
└────────────────────────────────────────────┘
```

The strip scrolls naturally. When active tab is at the visual center of the strip, tabs above and below are compressed peeks. The active tab is the "current position" — like PaperWM's focused window.

### States

| State | Height | Opacity | Shadow | Tilt | Controls |
|-------|--------|---------|--------|------|----------|
| Active | 36px | 1.0 | Elevated (y: 2px, blur: 12px) | None (scale 1.02) | Close visible |
| Inactive | 28px | 0.55 | None | ±2deg rotateX (cascade) | Close hidden |
| Hover (inactive) | 28px | 0.85 | Slight | 0deg (flatten) | Close appears |

### Cascade Tilt

Tabs *above* active: `perspective(400px) rotateX(2deg)`, origin `bottom center`  
Tabs *below* active: `perspective(400px) rotateX(-2deg)`, origin `top center`  
Active tab: `scale(1.02)` — pops forward  

This creates the physical paper-strip feel. Like riffling through pages, the active page is lifted to the front.

## Interaction Model

| Action | Behavior |
|--------|----------|
| Click tab | Switch. Animate: old active compresses to peek (300ms), new active expands to full (300ms). Cascade tilt updates |
| Click close on inactive | Close tab. Strip contracts. Active shifts to adjacent if needed |
| Scroll in sidebar | Natural scroll through the strip. Active tab stays in viewport |
| Tab created | Appended to strip end. Becomes active. Strip scrolls to bottom |
| Tab closed | Strip collapses. Active tab reassigned |
| Scroll-to-switch | (Future) Aggressive scroll past threshold switches active tab — like PaperWM window navigation by scroll |

### Keyboard (PaperWM-inspired)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Tab` | Next tab in strip (cyclical) |
| `Ctrl+Shift+Tab` | Previous tab in strip |
| `Alt+<num>` | Jump to tab by position (1-indexed) |
| `Ctrl+W` | Close active tab |

## Technical Architecture

PaperTM logic extracted to `src/renderer/js/papertm.js` during rewrite. Phase 1 prototype kept it inline in `app.js` for rapid iteration.

### State

```js
{
  tabs: Map<id, TabData>,     // all open tabs
  activeId: string|null,      // currently active tab ID
  order: string[],            // visual order of tab IDs (for drag reorder)
}
```

### Render Pipeline

```
onTabsUpdated(data)
  → merge tab state (upsert tabs, remove stale, set activeId)
  → _renderTabs()           // build tab DOM, cascade z-index, data-stack-pos attrs
  → _renderWebviews()       // ensure <webview> elements exist for each tab
  → _showActiveWebview()    // show active webview, hide others
  → _updateNTP()            // show/hide new tab page
```

### DOM Structure Per Tab

```html
<div class="tab active" data-tab-id="xxx" data-stack-pos="active" style="z-index: 100">
  <img class="tab-favicon" src="..." width="16" height="16">
  <span class="tab-title">Page Title</span>
  <span class="tab-loader"></span>
  <button class="tab-close">✕</button>
</div>
```

### CSS Architecture

```
.tab                            → base: position relative, flex, transition all 0.3s cubic-bezier
.tab.active                     → active: full height 36px, z-index 100, shadow, scale(1.02)
.tab:not(.active)               → inactive: height 28px, opacity 0.55, no shadow
.tab[data-stack-pos="above"]    → above: rotateX(2deg), perspective
.tab[data-stack-pos="below"]    → below: rotateX(-2deg), perspective
.tab:not(.active):hover         → hover: opacity 0.85, flatten tilt, show close
```

All animations target `transform` and `opacity` — GPU-composited, no layout thrash.

### Key Difference from Conventional Tiling

PaperWM's insight: "opening a new window never causes existing windows to resize." PaperTM mirrors this:

- Adding a tab → appends at strip end, stays peek-sized
- Removing a tab → strip collapses, remaining tabs stay their size
- Only state transition is active↔inactive toggles

This prevents the janky "all tabs shrink when you open one" behavior of conventional tab bars with max-width constraints.

## Migration Path

### Phase 1 (Done ✅) — Prototype

- [x] Paper-strip CSS with active/inactive states
- [x] Z-index management in `_renderTabs()`
- [x] `data-stack-pos` attributes for cascade tilt
- [x] Smooth 300ms transitions on switch
- [x] 66 tests passing

### Phase 2 (Done ✅) — Rewrite

- [x] Extract PaperTM into `src/renderer/js/papertm.js` module
- [x] Consolidate `_renderTabs`, `_renderWebviews`, `_onTabsUpdated` into coherent pipeline
- [x] Add `Ctrl+Tab` / `Ctrl+Shift+Tab` cycling (PaperWM-style strip navigation)
- [x] Ensure "no resize on add" — adding a tab doesn't change existing tab sizes
- [x] Formalize PaperTM as exported API (`window.PaperTM`)
- [x] All 66+ existing tests pass
- [ ] Manual stress test: 50+ tabs with stable perf

### Phase 3 (Future) — Enhancements

- [ ] Drag to reorder tabs in strip
- [ ] Scroll-to-switch: aggressive scroll past threshold switches active tab
- [ ] Minimap: condensed overview of all tabs in strip (like PaperWM's minimap)
- [ ] Tab groups: nest related tabs in the strip

## Comparison

| Feature | Flat tab bar | PaperTM |
|---------|-------------|---------|
| Layout | Uniform list | Scrollable strip |
| Active prominence | None | Elevated, shadow, scale |
| Inactive visibility | Truncated title | 28px peek (favicon + short title) |
| New tab effect | All shrink | No resize — appends as peek |
| Visual depth | Flat | 3D cascade with tilt |
| Close button | Always visible | Hidden on inactive, hover to show |
| Many tabs | Each gets smaller | Peek stays 28px, active stays 36px |
| Physical metaphor | Spreadsheet rows | Paper strip / spool |

## References

- [PaperWM](https://github.com/paperwm/PaperWM) — Tiled scrollable window management for GNOME Shell
- [Niri](https://github.com/niri-wm/niri) — Scrollable-tiling Wayland compositor
- [PaperWM README](https://github.com/paperwm/PaperWM/blob/release/README.md) — Design philosophy
- Android Recents screen — Card stack with active prominence

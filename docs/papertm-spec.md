# PaperTM — Paper-Style Tab Manager

## Motivation

Conventional tab bars (horizontal or vertical) treat all tabs equally — same size, same shape, flat list. This breaks down with many tabs: titles truncate, favicons disappear, switching requires precise targeting.

PaperTM treats tabs as physical paper cards in a vertical stack. The active card is pulled to the front, fully visible and interactive. Inactive cards compress into peeks — enough to identify, not enough to clutter.

Inspired by PaperWM scrollable tiling and Niri's scrollable-workspace model, adapted for browser tabs in a vertical sidebar.

## Design Goals

1. **Active tab is prominent** — Elevated, full width, readable title, visible controls
2. **Inactive tabs are peeks** — Compressed to show favicon + short title, enough to identify at a glance
3. **Paper physics** — Shadows, slight tilt cascade, smooth transitions between states
4. **Scrollable stack** — Many tabs don't overflow the sidebar; the stack scrolls naturally
5. **Vertical bar preserved** — No horizontal tab strip. Sidebar remains the tab surface
6. **Potato-first perf** — Animations use GPU-composited properties only (transform, opacity)

## Visual Model

```
┌─ Surfboard Tab Stack ─────────────────────┐
│                                            │
│  ┌▸ Google         ───────────────────────┐│  ← inactive peek (compressed, tilted up)
│  │  🔍 search results                     ││
│  └────────────────────────────────────────┘│
│  ┌▸ GitHub         ───────────────────────┐│  ← inactive peek
│  │  PR #42                               ││
│  └════════════════════════════════════════┘│
│  ┌═ GitHub ─══════════════════════════════┐│  ← ACTIVE (full size, elevated, shadow)
│  ║  PR #42 — paper-style tab manager     ║│
│  ║  [✕]                                  ║│
│  ╚════════════════════════════════════════╝│
│  ┌▸ Reddit ───────────────────────────────┐│  ← inactive peek (compressed, tilted down)
│  │  r/unixporn                            ││
│  └────────────────────────────────────────┘│
│                                            │
│           [+ New Tab]                      │
└────────────────────────────────────────────┘
```

### States

| State | Height | Opacity | Shadow | Controls |
|-------|--------|---------|--------|----------|
| Active | 36px | 1.0 | Elevated | Close btn visible |
| Inactive | 28px | 0.55 | None | Close hidden, shows on hover |
| Hover (inactive) | 28px | 0.85 | Slight | Close appears |

### Cascade

Tabs above the active tab tilt forward (positive rotateX), tabs below tilt backward (negative rotateX). This creates a physical paper-stack feel. Transition between states is 300ms cubic-bezier.

## Interaction Model

| Action | Behavior |
|--------|----------|
| Click tab | Switch to tab. Animate: old active compresses, new active expands |
| Click close on inactive | Close tab. Stack collapses |
| Scroll in tab-list | Normal scroll through stack. No special handling |
| Tab created | New tab slides in at bottom, becomes active |
| Tab closed | Remaining tabs reflow, active shifts to adjacent |
| Reorder | (Future) Drag to reorder position in stack |

### Keyboard

- `Ctrl+Tab` / `Ctrl+Shift+Tab` — Cycle through stack (next/prev active)
- `Ctrl+<num>` — Jump to tab by position in stack (1-indexed)

## Technical Architecture

PaperTM logic lives in a dedicated module `src/renderer/js/papertm.js` (or integrated into app.js during initial prototype, then extracted during rewrite).

### State

```js
{
  tabs: Map<id, TabData>,    // all open tabs
  activeId: string|null,     // currently active tab ID
  order: string[],           // visual order of tab IDs (for drag reorder)
}
```

### Render Pipeline

```
onTabsUpdated(data)
  → update state (merge tabs, set activeId)
  → _renderTabs()      // build DOM, set z-indexes, data attrs
  → _renderWebviews()  // ensure webviews exist, show active
  → _updateNTP()       // new tab page state
```

### DOM Structure Per Tab

```html
<div class="tab active" data-tab-id="xxx" data-stack-pos="active" style="z-index: 100">
  <img class="tab-favicon" src="...">
  <span class="tab-title">Page Title</span>
  <span class="tab-loader"></span>
  <button class="tab-close">✕</button>
</div>
```

### CSS Architecture

- `.tab` — Base style, transition, position
- `.tab.active` — Active state
- `.tab[data-stack-pos="above"]` — Above active (tilt, z-index)
- `.tab[data-stack-pos="below"]` — Below active
- `.tab:not(.active):hover` — Hover on inactive

All animations use `transform` and `opacity` only — GPU composited, no layout thrash.

## Migration Path

### Phase 1 (Done ✅) — Prototype

- [x] Paper-stack CSS with active/inactive states
- [x] Z-index management in _renderTabs
- [x] data-stack-pos attributes for cascade
- [x] Smooth transitions

### Phase 2 (klx + riced-chromium-39o) — Rewrite

This document is the spec for the rewrite phase. Key work items:

- [ ] Extract tab state management into clean module
- [ ] Consolidate _renderTabs, _renderWebviews, _onTabsUpdated into coherent pipeline
- [ ] Add Ctrl+Tab / Ctrl+Shift+Tab cycling
- [ ] Add tab reorder (drag)
- [ ] Formalize PaperTM as exported API
- [ ] 100% of 66 existing tests pass
- [ ] Tab limit stress test (50+ tabs)

## Comparison

| Feature | Current (flat) | PaperTM |
|---------|---------------|---------|
| Tab height | 30px uniform | Active 36px, inactive 28px peek |
| Active visibility | Slightly brighter bg | Elevated shadow + scale + tilt |
| Visual depth | None | 3D cascade stack |
| Close button | Always visible | Hidden on inactive, shows on hover |
| Many tabs | All same size, scroll | Compressed peeks, active pops |
| Physical metaphor | Flat list | Paper stack |

# Browser-Native Feature Platform — Plan

## Core Modules (src/renderer/feature-platform/)

### modes/
**Mode Manager** — Track Browse/Inspect/Edit/Action/Run/Result states. Switching, entry points, exit handling.

### inspector/
**Element Inspector + Overlay Renderer** — DOM querying, hover highlights, selection frames, spacing guides, typography/accessibility overlays.

### editor/
**Edit Engine** — ContentEditable, drag-drop, resize handles, inline style manipulation, undo/redo.

### actions/
**Action Registry** — Contextual action discovery, permission checks, execution. Floating buttons, command bar, hotkey launcher.

### workflows/
**Workflow Engine** — Visual step ladder UI, trigger/condition/action execution, data mapping, preview, run/stop controls.

### miniapps/
**Mini-App Host** — Panel/drawer/inline card rendering, context binding, sandboxed execution.

### data/
**Data Pipeline** — Page scraping, table/row extraction, field mapping, transform, write-back to external systems.

### ai/
**AI Client** — Context extraction, model calls, inline result display, workflow generation from prompts.

### trust/
**Permission/Trust Layer** — Access control, approval flows, audit log, data safety checks.

## Architecture

```
main process                                  renderer
    │                                    ┌────feature-platform
    │                                    │    ├── modes
    │                                    │    ├── inspector
    │                                    │    ├── editor
    │                                    │    ├── actions
    │                                    │    ├── workflows
    │                                    │    ├── miniapps
    │                                    │    ├── data
    │                                    │    ├── ai
    │                                    │    └── trust
    └────IPC─────preload.js─────────────►└──app.js
```

## Phase Plan

| Phase | Week | Focus |
|-------|------|-------|
| 1 | 1-3 | Foundation: mode system, basic selection, permission framework |
| 2 | 4-7 | Core editing: inline text, drag/resize, style panel, undo/redo |
| 3 | 8-10 | Overlays: spacing, typography, accessibility, responsive |
| 4 | 11-13 | Actions: registry, detection, floating button, command bar |
| 5 | 14-17 | Automation: step ladder, field mapping, preview, error recovery |
| 6 | 18-20 | Data + AI: scraping, extraction, AI assistant, workflow gen |
| 7 | 21-24 | Polish: shared workflows, history, perf, onboarding, docs |

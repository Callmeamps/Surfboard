# Changelog

All notable changes to Surfboard are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.0] — 2026-06-03

### Features
- PaperTM Phase 3: drag-to-reorder tabs, scroll-to-switch, minimap overview
- Tab groups support for organizing related tabs
- Bookmark/history UI: dialog, search, import/export, date grouping
- Settings module extraction (`src/renderer/js/settings.js`)
- Address bar omnibox with fuzzy match + DDG/Brave API suggestions
- Extension loader IPC tests (21 new tests)
- Test suite: 87 → 124 tests across 10 suites

### Fixes
- Extension-loader broadcast fix
- Tab-lifecycle ID mismatch fix
- Preload/IPC handler mismatch fix

## [0.1.0] — 2026-05-30

### Features
- Frameless window with Linux Wayland support
- Vertical tab bar (PaperTM scrollable strip)
- Collapsible sidebar
- AI sidecar (OpenAI/Anthropic/Ollama)
- Browser shell with allowlisted commands
- Chrome extension support (Manifest V3)
- Ad/tracker blocking

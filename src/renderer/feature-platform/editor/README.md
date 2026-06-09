# EditEngine

Browser-Native Feature Platform — **Core Editing** module.

## Features

- **Inline contenteditable** — enables editing on text elements within a DOM root
- **Click-to-select** — click any element to select it, showing outline + handles
- **Drag-drop resize** — 8 resize handles (nw, n, ne, e, se, s, sw, w) on selected element
- **Style panel** — floating panel with inputs for color, background, font, spacing, border, opacity
- **Undo/Redo** — snapshot-based undo (Ctrl+Z) and redo (Ctrl+Shift+Z / Ctrl+Y), max 100 steps
- **Delete element** — Delete/Backspace removes selected element, or via panel button
- **Trust integration** — requires `editor::write` permission from TrustManager

## API

```js
// Initialize with a DOM root
EditorEngine.init({ root: document.getElementById('app') })

// Or pass root at enable time
EditorEngine.enable(document.getElementById('new-tab-page'))

// Toggle editing
EditorEngine.enable()
EditorEngine.disable()

// Query state
EditorEngine.isEnabled()
EditorEngine.getSelected()

// Undo / Redo
EditorEngine.undo()
EditorEngine.redo()
EditorEngine.canUndo()
EditorEngine.canRedo()

// Listen for events
EditorEngine.onChange((type, detail) => {
  // type: 'enabled', 'disabled', 'select', 'resize', 'delete',
  //       'mutation', 'denied', 'snapshot-applied'
})
```

## Keyboard Shortcuts (in edit mode)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Escape` | Deselect (or disable if nothing selected) |
| `Delete` / `Backspace` | Delete selected element |

## Integration with ModeManager

The app.js integration switches to EDIT mode when editor is enabled:

```js
EditorEngine.onChange((type) => {
  if (type === 'enabled') ModeManager.set(ModeManager.MODES.EDIT)
  if (type === 'disabled') ModeManager.set(ModeManager.MODES.BROWSE)
})
```

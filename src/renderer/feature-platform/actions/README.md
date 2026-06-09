# ActionRegistry — Browser-Native Feature Platform

Contextual action discovery, permission checks, execution. Floating buttons, command bar, hotkey launcher.

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `init({ root })` | `void` | Set action root element |
| `enable(root?)` | `bool` | Start action mode; requires `actions::execute` trust |
| `disable()` | `void` | Stop action mode, clear UI |
| `isEnabled()` | `bool` | Current state |
| `register(action)` | `bool` | Register an action descriptor |
| `unregister(id)` | `bool` | Remove an action |
| `get(id)` | `Action\|null` | Get action by ID |
| `getAll()` | `Action[]` | List all registered actions |
| `getByCategory(cat)` | `Action[]` | Filter by category |
| `registerContext(key, actionIds)` | `void` | Bind actions to context |
| `getContextActions(key)` | `Action[]` | Get actions for context |
| `detectContext(el)` | `string[]` | Auto-detect contexts for element |
| `getActionsForElement(el)` | `Action[]` | Get all matching actions for element |
| `execute(id, ctx)` | `bool` | Execute action by ID |
| `getLastExecuted()` | `Entry\|null` | Most recent execution |
| `getHistory(limit?)` | `Entry[]` | Recent execution history |
| `openCommandBar()` | `void` | Toggle command bar (Ctrl+Shift+P) |
| `onChange(fn)` | `unsubscribe` | Event listener |
| `reset()` | `void` | Full reset for tests |

## Action Descriptor

```js
{
  id: 'copy-text',
  label: 'Copy Text',
  icon: '📋',
  hotkey: 'Ctrl+Shift+C',
  category: 'clipboard',
  contexts: ['text'],
  enabled: (ctx) => true,          // optional
  permission: { module, action },  // optional trust gate
  execute: (ctx) => bool,          // required
}
```

## Contexts

Auto-detected from element tag/class: `link`, `image`, `input`, `media`, `heading`, `table`, `code`, `text`, `element`

## Events

| Type | Detail |
|------|--------|
| `enabled` | `{}` |
| `disabled` | `{}` |
| `registered` | `{ id, action }` |
| `unregistered` | `{ id }` |
| `executed` | `{ id, ts, context }` |
| `denied` | `{ id, error }` |
| `error` | `{ id, error }` |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Toggle command bar |
| `Escape` | Close command bar / context menu |
| Per-action hotkeys | Configured via `action.hotkey` |

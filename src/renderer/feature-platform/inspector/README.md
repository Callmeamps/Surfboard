# Inspector — Browser-Native Feature Platform

DOM querying, hover highlights, selection frames, spacing guides,
typography/accessibility overlays.

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `init({ root })` | `void` | Set inspection root element |
| `enable(root?)` | `bool` | Start inspecting; requires `inspector::inspectDom` trust |
| `disable()` | `void` | Stop inspecting, clear overlays |
| `isEnabled()` | `bool` | Current state |
| `getSelected()` | `Element\|null` | Currently selected (clicked) element |
| `getHover()` | `Element\|null` | Currently hovered element |
| `inspect(el)` | `Object` | Full element info: tag, id, classes, attrs, computed styles, box, typography, a11y |
| `query(selector)` | `Element[]` | QuerySelectorAll within root |
| `toggleSpacing(on?)` | `bool` | Toggle margin/padding guide lines |
| `toggleTypography(on?)` | `bool` | Toggle typography info overlay |
| `toggleA11y(on?)` | `bool` | Toggle accessibility info overlay |
| `onChange(fn)` | `unsubscribe` | Listen for `enabled`, `disabled`, `select`, `deselect`, `denied` events |
| `reset()` | `void` | Full reset for tests |

## Overlays

- **Hover box**: Blue border on mouseover
- **Selection frame**: Solid blue border on click
- **Spacing guides**: Amber (margin) and green (padding) lines with labels
- **Typography overlay**: Font size/weight/line-height above text elements
- **A11y overlay**: Role, aria labels, and issues below elements
- **Tooltip**: Tag name, dimensions, font info, color swatches

## Events

| Type | Detail |
|------|--------|
| `enabled` | `{}` |
| `disabled` | `{}` |
| `select` | `{ element, info }` |
| `deselect` | `{}` |
| `denied` | `{ error }` |

## ModeManager Integration

```js
Inspector.enable(root);
// Sets ModeManager to INSPECT on enable
// Returns to BROWSE on disable
```

## Trust Requirements

- `inspector::inspectDom` — required to enable inspection

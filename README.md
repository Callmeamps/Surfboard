# RicedChromium

A riced Electron-based browser with:
- Frameless window (Linux)
- Vertical tab bar
- Collapsible sidebar
- Floating AI sidecar
- Chrome extension support

## Quick Start

```bash
npm install
./setup-extensions.sh
npm run dev
```

## Extensions

Loads Chrome/Chromium extensions (Manifest V3) from:

```
~/.config/riced-chromium/extensions/
```

Use `./setup-extensions.sh` to symlink the included sample extension.

You can also manually:
1. Place unpacked extensions in `~/.config/riced-chromium/extensions/`
2. They auto-load on startup

## IPC

See `src/preload/preload.js` for full contract:

```javascript
window.electronAPI.extensions.load(path)
window.electronAPI.extensions.unload(id)
window.electronAPI.extensions.list()
window.electronAPI.extensions.onUpdated(callback)
```
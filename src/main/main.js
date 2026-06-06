const path = require('path');
const { app, BrowserWindow, session } = require('electron');
const windowManager = require('./window-manager');
const ipcHandlers = require('./ipc-handlers');
const tabManager = require('./tab-manager');

// ── Ad/tracker blocking (frustum culling for network) ─────
const _adBlockPatterns = [
  '*://*.ad.360yield.com/*',
  '*://*.pubmatic.com/*',
  '*://*.doubleclick.net/*',
  '*://*.googlesyndication.com/*',
  '*://*.google-analytics.com/*',
  '*://*.facebook.com/tr*',
  '*://*.ads.linkedin.com/*',
  '*://*.amazon-adsystem.com/*',
  '*://*.adsrvr.org/*',
  '*://*.adnxs.com/*',
  '*://*.rubiconproject.com/*',
  '*://*.openx.net/*',
  '*://*.criteo.com/*',
  '*://*.taboola.com/*',
  '*://*.outbrain.com/*',
  '*://*.moatads.com/*',
  '*://*.adsafeprotected.com/*',
  '*://*.scorecardresearch.com/*',
  '*://*.quantserve.com/*',
  '*://*.hotjar.com/*',
  '*://clarity.ms/*',
];

// ── Hot reload in dev mode ──────────────────────────────
if (process.argv.includes('--dev')) {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true,
    });
  } catch (_err) {
    console.warn('[main] electron-reloader not available, skipping hot reload');
  }
}

// ── Single instance lock ────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
  const win = windowManager.getWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// ── Linux: Wayland / X11 hints ─────────────────────────
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// ── Performance: limit renderer processes (like game LOD) ──
// Cap at 4: 1 active tab + 2 background + 1 spare
app.commandLine.appendSwitch('renderer-process-limit', '4');
// Disable features that burn CPU on weak GPUs
app.commandLine.appendSwitch('disable-features',
  'SpareRendererForSitePerProcess,CalculateNativeWinOcclusion'
);
// Reduce GPU memory pressure
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '256');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// ── Create the main window ──────────────────────────────
async function createWindow() {
  const preloadPath = path.join(__dirname, '..', 'preload', 'preload.js');

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#141416',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
    show: false,
  });

  windowManager.setWindow(win);

 // Load extensions BEFORE the renderer so content scripts inject on first navigation
 const extensionLoader = require('./extension-loader');
 await extensionLoader.autoLoadExtensions();

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.on('closed', () => {
    windowManager.setWindow(null);
  });

}

// ── Ad/tracker blocking via session webRequest ──────────
function installAdBlocker() {
  const ses = session.defaultSession;
  if (!ses) return;
  ses.webRequest.onBeforeRequest(
    { urls: _adBlockPatterns },
    (details, callback) => { callback({ cancel: true }); }
  );
}

// ── App lifecycle ───────────────────────────────────────
app.whenReady().then(async () => {
  installAdBlocker();
  ipcHandlers.register();
  await createWindow();

  // Create an initial blank tab
  tabManager.create('about:blank');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup if needed
});

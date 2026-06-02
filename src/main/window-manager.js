let mainWindow = null;

/**
 * Set the main BrowserWindow reference.
 * @param {import('electron').BrowserWindow|null} win
 */
function setWindow(win) {
 mainWindow = win;
}

/**
 * Get the main BrowserWindow instance.
 * @returns {import('electron').BrowserWindow|null}
 */
function getWindow() {
 return mainWindow;
}

/**
 * Minimize the main window.
 */
function minimize() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
}

/**
 * Maximize the main window.
 */
function maximize() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.maximize();
  }
}

/**
 * Unmaximize the main window.
 */
function unmaximize() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.unmaximize();
  }
}

/**
 * Toggle maximize / restore.
 */
function toggleMaximize() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
}

/**
 * Close the main window.
 */
function close() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
}

/**
 * Check if the main window is maximized.
 * @returns {boolean}
 */
function isMaximized() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isMaximized();
  }
  return false;
}

module.exports = {
  setWindow,
  getWindow,
  minimize,
  maximize,
  unmaximize,
  toggleMaximize,
  close,
  isMaximized,
};

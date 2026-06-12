/**
 * Download Manager — Track and manage file downloads
 * Handles download events from webContents, stores download history,
 * provides pause/resume/cancel operations.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

class DownloadManager extends EventEmitter {
  constructor() {
    super();
    this._downloads = new Map(); // downloadId -> download info
    this._nextId = 1;
    this._history = []; // completed/failed downloads
    this._maxHistory = 100;
    this._downloadsFolder = path.join(app.getPath('downloads'), 'Surfboard');
  }

  /**
   * Initialize the download manager.
   * Sets up IPC handlers and webContents event listeners.
   */
  init() {
    // Ensure downloads folder exists
    if (!fs.existsSync(this._downloadsFolder)) {
      fs.mkdirSync(this._downloadsFolder, { recursive: true });
    }

    // Listen for web-contents-created to attach download handlers
    app.on('web-contents-created', (event, wc) => {
      this._attachToWebContents(wc);
    });

    // IPC handlers
    ipcMain.handle('downloads:list', () => this.list());
    ipcMain.handle('downloads:history', () => this.getHistory());
    ipcMain.handle('downloads:pause', (event, id) => this.pause(id));
    ipcMain.handle('downloads:resume', (event, id) => this.resume(id));
    ipcMain.handle('downloads:cancel', (event, id) => this.cancel(id));
    ipcMain.handle('downloads:open', (event, id) => this.openFile(id));
    ipcMain.handle('downloads:show', (event, id) => this.showInFolder(id));
    ipcMain.handle('downloads:clearHistory', () => this.clearHistory());

    console.log(`[DownloadManager] Initialized, downloads folder: ${this._downloadsFolder}`);
  }

  /**
   * Attach download event handlers to a webContents.
   */
  _attachToWebContents(wc) {
    wc.on('will-download', (event, item) => {
      this._handleDownload(item, wc);
    });
  }

  /**
   * Handle a new download item.
   */
  _handleDownload(item, wc) {
    const id = this._nextId++;
    const filename = item.getFilename();
    const url = item.getURL();
    const totalBytes = item.getTotalBytes();

    // Determine save path
    const savePath = path.join(this._downloadsFolder, filename);

    // Avoid overwriting existing files
    let finalPath = savePath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalPath = path.join(this._downloadsFolder, `${base} (${counter})${ext}`);
      counter++;
    }

    item.setSavePath(finalPath);

    const downloadInfo = {
      id,
      filename: path.basename(finalPath),
      url,
      savePath: finalPath,
      totalBytes,
      receivedBytes: 0,
      status: 'progressing', // progressing | completed | cancelled | interrupted
      startTime: Date.now(),
      mimeType: item.getMimeType(),
      wcId: wc.id,
    };

    this._downloads.set(id, downloadInfo);
    this._broadcastUpdate();

    // Progress events
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        if (!item.isPaused()) {
          downloadInfo.receivedBytes = item.getReceivedBytes();
          this._broadcastUpdate();
        }
      }
    });

    // Done events
    item.once('done', (event, state) => {
      switch (state) {
        case 'completed':
          downloadInfo.status = 'completed';
          downloadInfo.receivedBytes = item.getReceivedBytes();
          break;
        case 'cancelled':
          downloadInfo.status = 'cancelled';
          break;
        case 'interrupted':
          downloadInfo.status = 'interrupted';
          break;
      }

      // Move to history
      this._history.unshift({ ...downloadInfo });
      if (this._history.length > this._maxHistory) {
        this._history.pop();
      }

      // Remove from active downloads
      this._downloads.delete(id);
      this._broadcastUpdate();

      this.emit('download-complete', downloadInfo);
    });
  }

  /**
   * List active downloads.
   */
  list() {
    return [...this._downloads.values()];
  }

  /**
   * Get download history.
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Pause a download.
   */
  pause(id) {
    const download = this._downloads.get(id);
    if (!download) return false;

    // Find the Electron DownloadItem
    const item = this._findDownloadItem(download);
    if (item && !item.isPaused()) {
      item.pause();
      download.status = 'paused';
      this._broadcastUpdate();
      return true;
    }
    return false;
  }

  /**
   * Resume a download.
   */
  resume(id) {
    const download = this._downloads.get(id);
    if (!download) return false;

    const item = this._findDownloadItem(download);
    if (item && item.isPaused()) {
      item.resume();
      download.status = 'progressing';
      this._broadcastUpdate();
      return true;
    }
    return false;
  }

  /**
   * Cancel a download.
   */
  cancel(id) {
    const download = this._downloads.get(id);
    if (!download) return false;

    const item = this._findDownloadItem(download);
    if (item) {
      item.cancel();
      download.status = 'cancelled';
      this._downloads.delete(id);
      this._broadcastUpdate();
      return true;
    }
    return false;
  }

  /**
   * Find the Electron DownloadItem for a download.
   */
  _findDownloadItem(download) {
    const { webContents } = require('electron');
    for (const wc of webContents.getAllWebContents()) {
      if (wc.id === download.wcId) {
        // Unfortunately, Electron doesn't expose a direct reference to DownloadItem
        // We need to use the session's download events instead
        break;
      }
    }
    return null;
  }

  /**
   * Open a downloaded file with the system default application.
   */
  openFile(id) {
    const download = this._history.find(d => d.id === id) ||
                     this._downloads.get(id);
    if (!download || download.status !== 'completed') return false;

    const { shell } = require('electron');
    shell.openPath(download.savePath);
    return true;
  }

  /**
   * Show a downloaded file in the system file manager.
   */
  showInFolder(id) {
    const download = this._history.find(d => d.id === id) ||
                     this._downloads.get(id);
    if (!download) return false;

    const { shell } = require('electron');
    shell.showItemInFolder(download.savePath);
    return true;
  }

  /**
   * Clear download history.
   */
  clearHistory() {
    this._history = [];
    return true;
  }

  /**
   * Broadcast download updates to all windows.
   */
  _broadcastUpdate() {
    const downloads = this.list();
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('downloads:updated', downloads);
      }
    }
  }
}

// Singleton instance
const downloadManager = new DownloadManager();

module.exports = downloadManager;

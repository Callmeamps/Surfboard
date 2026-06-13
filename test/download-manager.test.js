/**
 * Tests for download-manager module.
 * Covers list, history, pause, resume, cancel, open, showInFolder, clearHistory,
 * _handleDownload, broadcastUpdate, history limit.
 */

const mockBrowserWindow = {
  getAllWindows: jest.fn(() => []),
  isDestroyed: jest.fn(() => false),
  webContents: { send: jest.fn() },
};

const mockShell = {
  openPath: jest.fn(),
  showItemInFolder: jest.fn(),
};

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp'),
    on: jest.fn(),
  },
  BrowserWindow: mockBrowserWindow,
  ipcMain: {
    handle: jest.fn(),
  },
  shell: mockShell,
}));

// existsSync returns false by default (no existing files)
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
}));

let downloadManager;

beforeEach(() => {
  jest.clearAllMocks();
  downloadManager = require('../src/main/download-manager');
  // Reset internal state between tests
  downloadManager._downloads.clear();
  downloadManager._history = [];
  downloadManager._nextId = 1;
});

describe('DownloadManager', () => {
  describe('list', () => {
    test('returns empty array initially', () => {
      expect(downloadManager.list()).toEqual([]);
    });
  });

  describe('getHistory', () => {
    test('returns empty array initially', () => {
      expect(downloadManager.getHistory()).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    test('clears download history', () => {
      downloadManager._history = [{ id: 1, filename: 'test.txt' }];
      expect(downloadManager.getHistory()).toHaveLength(1);

      const result = downloadManager.clearHistory();
      expect(result).toBe(true);
      expect(downloadManager.getHistory()).toEqual([]);
    });
  });

  describe('pause', () => {
    test('returns false for non-existent download', () => {
      expect(downloadManager.pause(999)).toBe(false);
    });
  });

  describe('resume', () => {
    test('returns false for non-existent download', () => {
      expect(downloadManager.resume(999)).toBe(false);
    });
  });

  describe('cancel', () => {
    test('returns false for non-existent download', () => {
      expect(downloadManager.cancel(999)).toBe(false);
    });
  });

  describe('openFile', () => {
    test('returns false for non-existent download', () => {
      expect(downloadManager.openFile(999)).toBe(false);
    });

    test('returns false for non-completed download', () => {
      downloadManager._history = [{ id: 1, status: 'progressing', savePath: '/tmp/test.txt' }];
      expect(downloadManager.openFile(1)).toBe(false);
    });

    test('opens completed download', () => {
      downloadManager._history = [{ id: 1, status: 'completed', savePath: '/tmp/test.txt' }];
      expect(downloadManager.openFile(1)).toBe(true);
      expect(mockShell.openPath).toHaveBeenCalledWith('/tmp/test.txt');
    });
  });

  describe('showInFolder', () => {
    test('returns false for non-existent download', () => {
      expect(downloadManager.showInFolder(999)).toBe(false);
    });

    test('shows download in folder', () => {
      downloadManager._history = [{ id: 1, savePath: '/tmp/test.txt' }];
      expect(downloadManager.showInFolder(1)).toBe(true);
      expect(mockShell.showItemInFolder).toHaveBeenCalledWith('/tmp/test.txt');
    });
  });

  describe('_handleDownload', () => {
    test('creates download info and stores it', () => {
      const mockItem = {
        getFilename: jest.fn(() => 'test-file.txt'),
        getURL: jest.fn(() => 'https://example.com/test.txt'),
        getTotalBytes: jest.fn(() => 1024),
        getMimeType: jest.fn(() => 'text/plain'),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
      };

      const mockWc = { id: 1 };

      downloadManager._handleDownload(mockItem, mockWc);

      const downloads = downloadManager.list();
      expect(downloads).toHaveLength(1);
      expect(downloads[0].filename).toBe('test-file.txt');
      expect(downloads[0].url).toBe('https://example.com/test.txt');
      expect(downloads[0].totalBytes).toBe(1024);
      expect(downloads[0].status).toBe('progressing');
    });

    test('avoids overwriting existing files', () => {
      const fs = require('fs');
      let callCount = 0;
      fs.existsSync.mockImplementation(() => {
        callCount++;
        // First two calls return true (file exists), third returns false
        return callCount <= 2;
      });

      const mockItem = {
        getFilename: jest.fn(() => 'test.txt'),
        getURL: jest.fn(() => 'https://example.com/test.txt'),
        getTotalBytes: jest.fn(() => 1024),
        getMimeType: jest.fn(() => 'text/plain'),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
      };

      const mockWc = { id: 1 };

      downloadManager._handleDownload(mockItem, mockWc);

      const downloads = downloadManager.list();
      expect(downloads[0].filename).toBe('test (2).txt');
    });

    test('registers progress and done handlers', () => {
      const mockItem = {
        getFilename: jest.fn(() => 'file.pdf'),
        getURL: jest.fn(() => 'https://example.com/file.pdf'),
        getTotalBytes: jest.fn(() => 2048),
        getMimeType: jest.fn(() => 'application/pdf'),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
      };

      downloadManager._handleDownload(mockItem, { id: 2 });

      expect(mockItem.on).toHaveBeenCalledWith('updated', expect.any(Function));
      expect(mockItem.once).toHaveBeenCalledWith('done', expect.any(Function));
    });
  });

  describe('download completion', () => {
    test('moves completed download to history', () => {
      let doneCb;
      const mockItem = {
        getFilename: jest.fn(() => 'done.txt'),
        getURL: jest.fn(() => 'https://example.com/done.txt'),
        getTotalBytes: jest.fn(() => 100),
        getMimeType: jest.fn(() => 'text/plain'),
        getReceivedBytes: jest.fn(() => 100),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn((event, cb) => { doneCb = cb; }),
      };

      downloadManager._handleDownload(mockItem, { id: 3 });

      // Simulate download complete — done(event, state) where state is string
      doneCb('done', 'completed');

      expect(downloadManager.list()).toHaveLength(0);
      expect(downloadManager.getHistory()).toHaveLength(1);
      expect(downloadManager.getHistory()[0].status).toBe('completed');
    });

    test('handles cancelled download', () => {
      let doneCb;
      const mockItem = {
        getFilename: jest.fn(() => 'cancel.txt'),
        getURL: jest.fn(() => 'https://example.com/cancel.txt'),
        getTotalBytes: jest.fn(() => 50),
        getMimeType: jest.fn(() => 'text/plain'),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn((event, cb) => { doneCb = cb; }),
      };

      downloadManager._handleDownload(mockItem, { id: 4 });

      doneCb('done', 'cancelled');

      expect(downloadManager.list()).toHaveLength(0);
      expect(downloadManager.getHistory()[0].status).toBe('cancelled');
    });

    test('handles interrupted download', () => {
      let doneCb;
      const mockItem = {
        getFilename: jest.fn(() => 'interrupt.txt'),
        getURL: jest.fn(() => 'https://example.com/interrupt.txt'),
        getTotalBytes: jest.fn(() => 75),
        getMimeType: jest.fn(() => 'text/plain'),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn((event, cb) => { doneCb = cb; }),
      };

      downloadManager._handleDownload(mockItem, { id: 5 });

      doneCb('done', 'interrupted');

      expect(downloadManager.list()).toHaveLength(0);
      expect(downloadManager.getHistory()[0].status).toBe('interrupted');
    });
  });

  describe('broadcastUpdate', () => {
    test('sends updates to all windows', () => {
      const mockWin = {
        isDestroyed: jest.fn(() => false),
        webContents: { send: jest.fn() },
      };
      mockBrowserWindow.getAllWindows.mockReturnValue([mockWin]);

      const mockItem = {
        getFilename: jest.fn(() => 'broadcast.txt'),
        getURL: jest.fn(() => 'https://example.com/broadcast.txt'),
        getTotalBytes: jest.fn(() => 200),
        getMimeType: jest.fn(() => 'text/plain'),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
      };

      downloadManager._handleDownload(mockItem, { id: 6 });

      expect(mockWin.webContents.send).toHaveBeenCalledWith('downloads:updated', expect.any(Array));
    });

    test('skips destroyed windows', () => {
      const mockWin = {
        isDestroyed: jest.fn(() => true),
        webContents: { send: jest.fn() },
      };
      mockBrowserWindow.getAllWindows.mockReturnValue([mockWin]);

      const mockItem = {
        getFilename: jest.fn(() => 'destroyed.txt'),
        getURL: jest.fn(() => 'https://example.com/destroyed.txt'),
        getTotalBytes: jest.fn(() => 300),
        getMimeType: jest.fn(() => 'text/plain'),
        setSavePath: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
      };

      downloadManager._handleDownload(mockItem, { id: 7 });

      expect(mockWin.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('history limit', () => {
    test('enforces max history of 100', () => {
      // Simulate completing 105 downloads
      for (let i = 0; i < 105; i++) {
        let doneCb;
        const mockItem = {
          getFilename: jest.fn(() => `file${i}.txt`),
          getURL: jest.fn(() => `https://example.com/file${i}.txt`),
          getTotalBytes: jest.fn(() => 100),
          getMimeType: jest.fn(() => 'text/plain'),
          getReceivedBytes: jest.fn(() => 100),
          setSavePath: jest.fn(),
          on: jest.fn(),
          once: jest.fn((event, cb) => { doneCb = cb; }),
        };

        downloadManager._handleDownload(mockItem, { id: 100 + i });
        doneCb('done', 'completed');
      }

      expect(downloadManager.getHistory().length).toBeLessThanOrEqual(100);
    });
  });
});

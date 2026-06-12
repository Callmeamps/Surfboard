/**
 * Tests for download-manager module.
 * Covers list, history, pause, resume, cancel, open, showInFolder, clearHistory.
 */

// Mock Electron
const mockBrowserWindow = {
  getAllWindows: jest.fn(() => []),
  isDestroyed: jest.fn(() => false),
  webContents: { send: jest.fn() },
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
  shell: {
    openPath: jest.fn(),
    showItemInFolder: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

let downloadManager;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Re-mock
  jest.doMock('electron', () => ({
    app: {
      getPath: jest.fn(() => '/tmp'),
      on: jest.fn(),
    },
    BrowserWindow: {
      getAllWindows: jest.fn(() => []),
    },
    ipcMain: {
      handle: jest.fn(),
    },
    shell: {
      openPath: jest.fn(),
      showItemInFolder: jest.fn(),
    },
  }));

  jest.doMock('fs', () => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
  }));

  downloadManager = require('../src/main/download-manager');
});

// SKIPPED: OOMs on CI even in isolation (6GB heap, no feature-platform).
// Memory leak in test — needs investigation.
describe.skip('DownloadManager', () => {
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
      // Add a fake history entry
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
  });

  describe('showInFolder', () => {
    test('returns false for non-existent download', () => {
      expect(downloadManager.showInFolder(999)).toBe(false);
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
  });
});

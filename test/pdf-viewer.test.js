/**
 * PDF Viewer tests — Main process module
 */
const path = require('path');
const crypto = require('crypto');

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    getAppPath: () => '/app',
  },
  ipcMain: { handle: jest.fn() },
  BrowserWindow: {
    getFocusedWindow: jest.fn(() => null),
    getAllWindows: jest.fn(() => []),
  },
  dialog: {
    showSaveDialog: jest.fn(),
  },
  shell: {
    openPath: jest.fn(),
    openExternal: jest.fn(),
  },
  net: {
    request: jest.fn(),
  },
}));

const pdfViewer = require('../src/main/pdf-viewer');

describe('PDF Viewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isPdfUrl', () => {
    it('detects .pdf URLs', () => {
      expect(pdfViewer.isPdfUrl('https://example.com/doc.pdf')).toBe(true);
      expect(pdfViewer.isPdfUrl('https://example.com/file.PDF')).toBe(true);
    });

    it('detects PDF content-type in URL', () => {
      expect(pdfViewer.isPdfUrl('https://example.com/download?type=pdf&content-type=application%2Fpdf')).toBe(true);
    });

    it('returns false for non-PDF URLs', () => {
      expect(pdfViewer.isPdfUrl('https://example.com/doc.html')).toBe(false);
      expect(pdfViewer.isPdfUrl('https://example.com/image.png')).toBe(false);
      expect(pdfViewer.isPdfUrl(null)).toBe(false);
      expect(pdfViewer.isPdfUrl('')).toBe(false);
    });
  });

  describe('fetchPdf', () => {
    it('fetches PDF via net.request', async () => {
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
      };
      const mockResponse = {
        statusCode: 200,
        on: jest.fn(),
      };
      const { net } = require('electron');

      // Simulate net.request
      net.request.mockReturnValue(mockRequest);
      mockRequest.on.mockImplementation((event, handler) => {
        if (event === 'response') {
          setTimeout(() => handler(mockResponse), 10);
        }
        return mockRequest;
      });
      mockResponse.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('%PDF-1.4 test')), 10);
        }
        if (event === 'end') {
          setTimeout(handler, 20);
        }
        return mockResponse;
      });

      const result = await pdfViewer.fetchPdf('https://example.com/test.pdf');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('%PDF-1.4 test');
    });
  });

  describe('openPdf and getPdfData flow', () => {
    it('caches PDF and returns cacheKey', async () => {
      const pdfBytes = Buffer.from('%PDF-1.4 test content');
      const { net } = require('electron');

      // Mock successful fetch
      const mockRequest = {
        on: jest.fn(),
        end: jest.fn(),
      };
      const mockResponse = {
        statusCode: 200,
        on: jest.fn(),
      };

      net.request.mockReturnValue(mockRequest);
      mockRequest.on.mockImplementation((event, handler) => {
        if (event === 'response') {
          setTimeout(() => handler(mockResponse), 10);
        }
        return mockRequest;
      });
      mockResponse.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler(pdfBytes), 10);
        }
        if (event === 'end') {
          setTimeout(handler, 20);
        }
        return mockResponse;
      });

      const result = await pdfViewer.openPdf('https://example.com/test.pdf');
      expect(result.cacheKey).toBeDefined();

      // Retrieve cached data
      const data = pdfViewer.getPdfData(result.cacheKey);
      expect(data).toBeDefined();

      // Re-fetch same URL should use cache
      const result2 = await pdfViewer.openPdf('https://example.com/test.pdf');
      expect(result2.cacheKey).toBe(result.cacheKey);
    });

    it('returns null for unknown cacheKey', () => {
      expect(pdfViewer.getPdfData('nonexistent')).toBeNull();
    });

    it('returns Uint8Array from getPdfData', async () => {
      const pdfBytes = Buffer.from('%PDF-1.4 uint8 test');
      const { net } = require('electron');

      const mockRequest = { on: jest.fn(), end: jest.fn() };
      const mockResponse = { statusCode: 200, on: jest.fn() };

      net.request.mockReturnValue(mockRequest);
      mockRequest.on.mockImplementation((event, handler) => {
        if (event === 'response') setTimeout(() => handler(mockResponse), 10);
        return mockRequest;
      });
      mockResponse.on.mockImplementation((event, handler) => {
        if (event === 'data') setTimeout(() => handler(pdfBytes), 10);
        if (event === 'end') setTimeout(handler, 20);
        return mockResponse;
      });

      const { cacheKey } = await pdfViewer.openPdf('https://example.com/uint8.pdf');
      const data = pdfViewer.getPdfData(cacheKey);
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBe(pdfBytes.length);
    });
  });

  describe('cache eviction', () => {
    it('evicts oldest entry when cache is full (10 entries)', async () => {
      const { net } = require('electron');
      const mockRequest = { on: jest.fn(), end: jest.fn() };
      const mockResponse = { statusCode: 200, on: jest.fn() };

      net.request.mockReturnValue(mockRequest);
      mockRequest.on.mockImplementation((event, handler) => {
        if (event === 'response') setTimeout(() => handler(mockResponse), 0);
        return mockRequest;
      });
      mockResponse.on.mockImplementation((event, handler) => {
        if (event === 'data') setTimeout(() => handler(Buffer.from('%PDF')), 0);
        if (event === 'end') setTimeout(handler, 0);
        return mockResponse;
      });

      // Fill cache with 10 entries
      const keys = [];
      for (let i = 0; i < 10; i++) {
        const result = await pdfViewer.openPdf(`https://example.com/doc${i}.pdf`);
        keys.push(result.cacheKey);
      }

      // Add one more — should evict oldest
      const result = await pdfViewer.openPdf('https://example.com/overflow.pdf');
      expect(result.cacheKey).toBeDefined();
      expect(result.cacheKey).not.toBe(keys[0]);

      // Oldest should be gone
      expect(pdfViewer.getPdfData(keys[0])).toBeNull();
    });
  });
});

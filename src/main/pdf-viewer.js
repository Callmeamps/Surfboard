/**
 * PDF Viewer — Fetch, cache, and serve PDFs for in-browser viewing.
 *
 * Flow:
 *   1. Renderer requests pdf:open(url) via IPC
 *   2. Main process fetches PDF bytes, caches in memory
 *   3. Returns cache key to renderer
 *   4. Renderer opens surfboard://pdf?id=<key>
 *   5. PDF viewer page requests pdf:getData(id) for the ArrayBuffer
 *   6. pdfjs-dist in renderer renders pages to canvas
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// In-memory PDF cache: cacheKey → { url, timestamp, buffer }
const _cache = new Map();
const MAX_CACHE_AGE_MS = 10 * 60 * 1000; // 10 min
const MAX_CACHE_SIZE = 10;

function _cacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

function _findCachedByUrl(url) {
  for (const [key, entry] of _cache) {
    if (entry.url === url) return key;
  }
  return null;
}

function _cleanCache() {
  const now = Date.now();
  for (const [key, entry] of _cache) {
    if (now - entry.timestamp > MAX_CACHE_AGE_MS) {
      _cache.delete(key);
    }
  }
}

/**
 * Fetch PDF bytes from a URL.
 * Uses Electron's net.request for efficiency.
 */
async function fetchPdf(url) {
  return new Promise((resolve, reject) => {
    const { net } = require('electron');
    const request = net.request(url);

    request.on('response', (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode} fetching PDF`));
        } else {
          resolve(buffer);
        }
      });
    });

    request.on('error', (err) => reject(err));
    request.end();
  });
}

/**
 * Open a PDF URL for viewing.
 * Returns { cacheKey, filename } or throws.
 */
async function openPdf(url) {
  _cleanCache();

  // Check cache first
  const existingKey = _findCachedByUrl(url);
  if (existingKey) return { cacheKey: existingKey };

  const buffer = await fetchPdf(url);
  const key = _cacheKey(url);

  // Evict oldest if at capacity
  if (_cache.size >= MAX_CACHE_SIZE) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }

  _cache.set(key, {
    url,
    buffer,
    timestamp: Date.now(),
  });

  return { cacheKey: key };
}

/**
 * Get cached PDF data by cache key.
 */
function getPdfData(cacheKey) {
  const entry = _cache.get(cacheKey);
  if (!entry) return null;
  // Return as Uint8Array for transfer via IPC
  return new Uint8Array(entry.buffer.buffer, entry.buffer.byteOffset, entry.buffer.byteLength);
}

/**
 * Get PDF filename from URL.
 */
function getPdfFilename(url) {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname) || 'document.pdf';
    return base.endsWith('.pdf') ? base : base + '.pdf';
  } catch {
    return 'document.pdf';
  }
}

/**
 * Save a cached PDF to the downloads folder.
 */
async function savePdfToDownloads(cacheKey) {
  const entry = _cache.get(cacheKey);
  if (!entry) throw new Error('PDF not found in cache');

  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win, {
    defaultPath: getPdfFilename(entry.url),
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, entry.buffer);
    return result.filePath;
  }
  return null;
}

/**
 * Print a cached PDF.
 * Opens the OS print dialog via a hidden BrowserWindow.
 */
async function printPdf(cacheKey) {
  const entry = _cache.get(cacheKey);
  if (!entry) throw new Error('PDF not found in cache');

  // Write to temp file and open with system print dialog
  const tmpPath = path.join(app.getPath('temp'), `surfboard-pdf-${cacheKey}.pdf`);
  fs.writeFileSync(tmpPath, entry.buffer);

  // Open in system default viewer (user can print from there)
  shell.openPath(tmpPath);
  return { ok: true };
}

/**
 * Get the original URL for a cached PDF.
 */
function getPdfUrl(cacheKey) {
  const entry = _cache.get(cacheKey);
  return entry ? entry.url : null;
}

/**
 * Check if a URL likely points to a PDF.
 */
function isPdfUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.pdf') ||
    (lower.includes('pdf') && lower.includes('content-type=application'));
}

// ── IPC Registration ──────────────────────────────────────

function registerIpc() {
  ipcMain.handle('pdf:open', async (_event, url) => {
    try {
      const result = await openPdf(url);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('pdf:getData', (_event, cacheKey) => {
    const data = getPdfData(cacheKey);
    if (!data) return null;
    return { buffer: Buffer.from(data), url: getPdfUrl(cacheKey) };
  });

  ipcMain.handle('pdf:download', async (_event, cacheKey) => {
    try {
      const filePath = await savePdfToDownloads(cacheKey);
      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('pdf:print', async (_event, cacheKey) => {
    try {
      await printPdf(cacheKey);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerIpc, openPdf, getPdfData, isPdfUrl, fetchPdf };

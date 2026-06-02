const { session, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const DEFAULT_EXTENSIONS_DIR = path.join(
 process.env.HOME,
 '.config',
 'riced-chromium',
 'extensions'
);

// In-memory registry
let extensions = new Map();

/**
 * Read manifest.json from directory.
 * @param {string} dir
 * @returns {Promise<object|null>}
 */
async function readManifest(dir) {
 try {
 const manifestPath = path.join(dir, 'manifest.json');
 const content = await fs.readFile(manifestPath, 'utf8');
 return JSON.parse(content);
 } catch (err) {
 console.warn(`[Extension] Could not read manifest from ${dir}:`, err.message);
 return null;
 }
}

/**
 * Scan a directory for unpacked Chrome extensions (manifest.json).
 * @param {string} dir
 * @returns {Promise<string[]>} List of valid extension directories.
 */
async function scanExtensions(dir = DEFAULT_EXTENSIONS_DIR) {
 let entries;
 try {
 entries = await fs.readdir(dir, { withFileTypes: true });
 } catch (err) {
 if (err.code === 'ENOENT') {
 return [];
 }
 throw err;
 }

 const results = [];
 for (const entry of entries) {
 if (entry.isDirectory()) {
 const subdir = path.join(dir, entry.name);
 const manifest = await readManifest(subdir);
 if (manifest) {
 results.push(subdir);
 }
 }
 }
 return results;
}

/**
 * Load a single unpacked extension.
 * @param {string} extensionPath
 * @returns {Promise<object>} { success: boolean, error?: string, id?: string, name?: string }
 */
async function loadExtension(extensionPath) {
 try {
 const ext = await session.defaultSession.loadExtension(extensionPath, {
 allowFileAccess: false,
 });

 const manifest = await readManifest(extensionPath);
 const descriptor = {
 id: ext.id,
 name: ext.name || (manifest?.name || path.basename(extensionPath)),
 version: manifest?.version || '0.0.0',
 enabled: true,
 path: extensionPath,
 icon: '', // Could be set from manifest/icons
 };
 extensions.set(ext.id, descriptor);

 scheduleBroadcast();
 return { success: true, ...descriptor };
 } catch (err) {
 console.error('[Extension] Failed to load:', extensionPath, err);
 return { success: false, error: err.message };
 }
}

/**
 * Unload an extension by id.
 * @param {string} id
 * @returns {Promise<object>} { success: boolean, error?: string }
 */
async function unloadExtension(id) {
 const descriptor = extensions.get(id);
 if (!descriptor || !descriptor.enabled) {
 return { success: false, error: `Extension ${id} not found or already disabled` };
 }

 try {
 await session.defaultSession.removeExtension(id);
 descriptor.enabled = false;
 extensions.set(id, descriptor);
 scheduleBroadcast();
 return { success: true };
 } catch (err) {
 console.error('[Extension] Failed to unload:', id, err);
 return { success: false, error: err.message };
 }
}

/**
 * List loaded extensions.
 * @returns {object[]} Array of { id, name, version, enabled, path[, icon] }
 */
function listExtensions() {
 return [...extensions.values()].map(e => ({
 ...e,
 icon: e.icon || '',
 }));
}

/**
 * Get the default extensions directory.
 * @returns {string}
 */
function getDefaultExtensionsDir() {
 return DEFAULT_EXTENSIONS_DIR;
}

/**
 * Auto-scan default extensions directory on startup.
 */
async function autoLoadExtensions() {
 const dirs = await scanExtensions();
 for (const dir of dirs) {
 await loadExtension(dir);
 }
}

// Throttle broadcast to avoid floods
let broadcastTimeout = null;
function scheduleBroadcast() {
 if (broadcastTimeout) clearTimeout(broadcastTimeout);
 broadcastTimeout = setTimeout(() => {
 broadcastUpdate('extensions');
 broadcastTimeout = null;
 }, 100);
}

module.exports = {
 scanExtensions,
 loadExtension,
 unloadExtension,
 listExtensions,
 autoLoadExtensions,
 getDefaultExtensionsDir,
};

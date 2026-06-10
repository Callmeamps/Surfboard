const { session, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const SESSION_PARTITION = 'persist:riced-chromium';

/**
 * Lazily get the extension session.
 * Must be called after app.whenReady() — creating fromPartition before ready
 * yields a session object where extension methods are undefined.
 *
 * In Electron 42+ the new ses.extensions API is preferred over the deprecated
 * session.loadExtension / session.removeExtension / session.getAllExtensions.
 */
let _extSession = null;
let _extApi = null;
function getExtSession() {
	if (!_extSession) {
		_extSession = session.fromPartition(SESSION_PARTITION);
	}
	return _extSession;
}
function getExtApi() {
	if (!_extApi) {
		_extApi = getExtSession().extensions;
	}
	return _extApi;
}

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
		if (entry.isDirectory() || entry.isSymbolicLink()) {
			const subdir = path.join(dir, entry.name);
			try {
				const manifest = await readManifest(subdir);
				if (manifest) {
					results.push(subdir);
				}
			} catch (err) {
				// Skip broken symlinks (ELOOP, ENOENT) and permission errors
				console.warn(`[Extension] Skipping ${entry.name}:`, err.message);
			}
		}
	}
	return results;
}

/**
 * Load a single unpacked extension.
 * In Electron 42+ the preferred API is session.extensions.loadExtension
 * (the session.loadExtension method is deprecated).
 * @param {string} extensionPath
 * @returns {Promise<object>} { success: boolean, error?: string, id?: string, name?: string }
 */
async function loadExtension(extensionPath) {
	try {
		const extApi = getExtApi();
		const ext = await extApi.loadExtension(extensionPath, {
			allowFileAccess: false,
		});
		if (!ext) throw new Error('extensions.loadExtension returned null');
		const extension = ext.extension ?? ext;

		const manifest = await readManifest(extensionPath);
		const descriptor = {
			id: extension.id,
			name: extension.name || (manifest?.name || path.basename(extensionPath)),
			version: manifest?.version || '0.0.0',
			enabled: true,
			path: extensionPath,
			icon: '', // Could be set from manifest/icons
		};
		extensions.set(extension.id, descriptor);

		console.log(`[Extension] Loaded: ${descriptor.name} (${descriptor.id})`);
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
		const extApi = getExtApi();
		extApi.removeExtension(id);
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
	console.log(`[Extension] Found ${dirs.length} extension(s) in ${DEFAULT_EXTENSIONS_DIR}`);
	for (const dir of dirs) {
		await loadExtension(dir);
	}
	// Verify extensions are registered in the session
	try {
		const extApi = getExtApi();
		const sessionExts = extApi.getAllExtensions();
		console.log(`[Extension] Session reports ${sessionExts.length} loaded extension(s)`);
	} catch (err) {
		console.warn('[Extension] Could not verify session extensions:', err.message);
	}
}

// Throttle broadcast to avoid floods
let broadcastTimeout = null;
function scheduleBroadcast() {
	if (broadcastTimeout) clearTimeout(broadcastTimeout);
	broadcastTimeout = setTimeout(() => {
		broadcastUpdate();
		broadcastTimeout = null;
	}, 100);
}

function broadcastUpdate() {
	const exts = listExtensions();
	for (const win of BrowserWindow.getAllWindows()) {
		if (!win.isDestroyed()) {
			win.webContents.send('extensions:updated', exts);
		}
	}
}

module.exports = {
	scanExtensions,
	loadExtension,
	unloadExtension,
	listExtensions,
	autoLoadExtensions,
	getDefaultExtensionsDir,
	getExtSession,
	getExtApi,
};

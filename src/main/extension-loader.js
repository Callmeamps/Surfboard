const { session, BrowserWindow } = require('electron');
const fs = require('fs/promises');
const fssync = require('fs');
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
 * Resolve extension icon from manifest as a data URI.
 * Prefers 48px, falls back to 16px, 128px, then empty.
 * @param {object|null} manifest
 * @param {string} extDir
 * @returns {string} data:image/png;base64,... or ''
 */
function _resolveManifestIcon(manifest, extDir) {
	if (!manifest?.icons) return '';
	const sizes = [48, 16, 128, 32, 96, 256];
	for (const size of sizes) {
		const rel = manifest.icons[String(size)];
		if (!rel) continue;
		try {
			const iconPath = path.join(extDir, rel);
			const buf = fssync.readFileSync(iconPath);
			const ext = path.extname(rel).toLowerCase();
			const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
			return `data:${mime};base64,${buf.toString('base64')}`;
		} catch { /* skip missing icon */ }
	}
	return '';
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
		const icon = _resolveManifestIcon(manifest, extensionPath);
		const popup = manifest?.action?.default_popup || manifest?.browser_action?.default_popup || '';
		const options = manifest?.options_page || manifest?.options_ui?.page || '';
		const popupUrl = popup ? `chrome-extension://${extension.id}/${popup}` : '';
		const optionsUrl = options ? `chrome-extension://${extension.id}/${options}` : '';
		const descriptor = {
			id: extension.id,
			name: extension.name || (manifest?.name || path.basename(extensionPath)),
			version: manifest?.version || '0.0.0',
			enabled: true,
			path: extensionPath,
			icon,
			popupUrl,
			optionsUrl,
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
 * Register the web-contents-created listener early (before any BrowserWindow).
 * Actual injection happens when extensions are loaded.
 */
function initContentScriptInjection() {
	const { app } = require('electron');

	app.on('web-contents-created', (event, wc) => {
		wc.on('dom-ready', () => {
			_injectExtensionPolyfills(wc);
		});
		wc.on('did-navigate', (e, url) => {
			_injectContentScripts(wc, url);
		});
		wc.on('did-navigate-in-page', (e, url) => {
			_injectContentScripts(wc, url);
		});
	});
}

/**
 * Inject polyfills into extension background pages and popups.
 * Electron doesn't implement chrome.storage.sync, chrome.action, etc.
 */
function _injectExtensionPolyfills(wc) {
	const url = wc.getURL();
	if (!url?.startsWith('chrome-extension://')) return;

	const polyfill = `
		(function() {
			// chrome.storage.sync -> chrome.storage.local
			if (chrome.storage && !chrome.storage.sync) {
				chrome.storage.sync = chrome.storage.local;
			}
			// chrome.action -> chrome.browserAction (MV3 -> MV2)
			if (!chrome.action && chrome.browserAction) {
				chrome.action = chrome.browserAction;
			}
			// chrome.scripting.executeScript
			if (!chrome.scripting) {
				chrome.scripting = {
					executeScript(tabId, details) {
						return new Promise((resolve, reject) => {
							chrome.tabs.executeScript(tabId, details, (results) => {
								if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
								else resolve(results);
							});
						});
				}
			};
		}
	})();
	`;

	wc.executeJavaScript(polyfill).catch(() => {});
}

async function _injectContentScripts(wc, url) {
	if (!url || !/^https?:\/\//.test(url)) return;

	const extApi = getExtApi();
	const loadedExts = extApi.getAllExtensions();

	for (const ext of loadedExts) {
		const manifest = ext.manifest;
		if (!manifest?.content_scripts) continue;

		for (const cs of manifest.content_scripts) {
			const matches = cs.matches || [];
			const matched = matches.some(pattern => {
				if (pattern === '<all_urls>') return /^https?:\/\//.test(url);
				const re = new RegExp(
					'^' + pattern.replace(/\./g, '\.').replace(/\*/g, '.*') + '$'
				);
				return re.test(url);
			});

			if (!matched) continue;

			const bgWC = _findBackgroundPage();
			if (!bgWC) continue;

			try {
				const tabId = wc.id;
				for (const jsFile of cs.js || []) {
					await bgWC.executeJavaScript(
						`browser.tabs.executeScript(${tabId}, ${JSON.stringify({
							file: jsFile,
							allFrames: cs.all_frames || false,
							runAt: cs.run_at || 'document_idle',
						})})`
					);
				}
			} catch (err) {
				// Content script injection failed
			}
		}
	}
}

function _findBackgroundPage() {
	const { webContents } = require('electron');
	const allWC = webContents.getAllWebContents();
	for (const wc of allWC) {
		const url = wc.getURL();
		if (url.includes('chrome-extension://') && url.includes('background')) {
			return wc;
		}
	}
	return null;
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
	initContentScriptInjection,
};

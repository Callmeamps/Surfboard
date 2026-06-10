/**
 * Tests for extension-loader module.
 * Covers scanExtensions, loadExtension, unloadExtension,
 * broadcastUpdate, listExtensions, and autoLoadExtensions.
 */

// Mock Electron and dependencies before requiring the module
const mockLoadExtension = jest.fn();
const mockRemoveExtension = jest.fn();
const mockGetAllExtensions = jest.fn(() => []);
const mockReadFile = jest.fn();
const mockReaddir = jest.fn();
const mockJoin = jest.fn((...args) => args.join('/'));
const mockBasename = jest.fn((p) => p.split('/').pop());

const mockExtensionsApi = {
  loadExtension: mockLoadExtension,
  removeExtension: mockRemoveExtension,
  getAllExtensions: mockGetAllExtensions,
};

jest.mock('electron', () => ({
  session: {
    defaultSession: {
      extensions: mockExtensionsApi,
      webContents: { on: jest.fn() },
    },
    fromPartition: jest.fn(() => ({
      extensions: mockExtensionsApi,
      webContents: { on: jest.fn() },
    })),
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => []),
  },
  webContents: {
    getAllWebContents: jest.fn(() => []),
  },
}));

jest.mock('fs/promises', () => ({
  readFile: mockReadFile,
  readdir: mockReaddir,
}));

jest.mock('path', () => ({
  join: mockJoin,
  basename: mockBasename,
}));

// We need to control the internal `extensions` Map between tests.
// Since the module exports functions but not the Map, we reset modules
// to get a clean state each time.
let extensionLoader;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Re-mock after resetModules
  const freshMockExtensionsApi = {
    loadExtension: mockLoadExtension,
    removeExtension: mockRemoveExtension,
    getAllExtensions: mockGetAllExtensions,
  };

  jest.doMock('electron', () => ({
    session: {
      defaultSession: {
        extensions: freshMockExtensionsApi,
        webContents: { on: jest.fn() },
      },
      fromPartition: jest.fn(() => ({
        extensions: freshMockExtensionsApi,
        webContents: { on: jest.fn() },
      })),
    },
    BrowserWindow: {
      getAllWindows: jest.fn(() => []),
    },
    webContents: {
      getAllWebContents: jest.fn(() => []),
    },
  }));

  jest.doMock('fs/promises', () => ({
    readFile: mockReadFile,
    readdir: mockReaddir,
  }));

  jest.doMock('path', () => ({
    join: mockJoin,
    basename: mockBasename,
  }));

  extensionLoader = require('../src/main/extension-loader');
});

// ─── scanExtensions ────────────────────────────────────────────────

describe('scanExtensions', () => {
  test('returns empty array for empty directory', async () => {
    mockReaddir.mockResolvedValue([]);

    const result = await extensionLoader.scanExtensions('/fake/dir');

    expect(result).toEqual([]);
    expect(mockReaddir).toHaveBeenCalledWith('/fake/dir', { withFileTypes: true });
  });

  test('includes symlinked extension directories', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'linked-ext', isDirectory: () => false, isSymbolicLink: () => true },
    ]);
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Linked', version: '1.0' }));

    const result = await extensionLoader.scanExtensions('/fake/dir');

    expect(result).toEqual(['/fake/dir/linked-ext']);
  });

  test('returns directories that have valid manifest.json', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'ext-1', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'ext-2', isDirectory: () => true, isSymbolicLink: () => false },
    ]);
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Test', version: '1.0' }));

    const result = await extensionLoader.scanExtensions('/fake/dir');

    expect(result).toEqual(['/fake/dir/ext-1', '/fake/dir/ext-2']);
  });

  test('skips directories without manifest.json', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'valid-ext', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'invalid-ext', isDirectory: () => true, isSymbolicLink: () => false },
    ]);

    // First call succeeds, second fails (no manifest)
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify({ name: 'Valid', version: '1.0' }))
      .mockRejectedValueOnce(new Error('ENOENT'));

    const result = await extensionLoader.scanExtensions('/fake/dir');

    expect(result).toEqual(['/fake/dir/valid-ext']);
  });

  test('skips non-directory entries', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'some-file', isDirectory: () => false, isSymbolicLink: () => false },
      { name: 'ext-dir', isDirectory: () => true, isSymbolicLink: () => false },
    ]);
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Ext', version: '1.0' }));

    const result = await extensionLoader.scanExtensions('/fake/dir');

    expect(result).toEqual(['/fake/dir/ext-dir']);
  });

  test('includes symlinked extension directories', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'linked-ext', isDirectory: () => false, isSymbolicLink: () => true },
    ]);
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Linked', version: '1.0' }));

    const result = await extensionLoader.scanExtensions('/fake/dir');

    expect(result).toEqual(['/fake/dir/linked-ext']);
  });

  test('returns empty array when directory does not exist (ENOENT)', async () => {
    const enoentError = new Error('ENOENT');
    enoentError.code = 'ENOENT';
    mockReaddir.mockRejectedValue(enoentError);

    const result = await extensionLoader.scanExtensions('/nonexistent/dir');

    expect(result).toEqual([]);
  });

  test('propagates non-ENOENT errors', async () => {
    const permError = new Error('EACCES');
    permError.code = 'EACCES';
    mockReaddir.mockRejectedValue(permError);

    await expect(extensionLoader.scanExtensions('/restricted/dir')).rejects.toThrow('EACCES');
  });

  test('skips directories where readManifest throws (broken symlink / ELOOP)', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'good-ext', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'broken-link', isDirectory: () => true, isSymbolicLink: () => false },
    ]);
    // First call succeeds (good ext), second throws ELOOP
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify({ name: 'Good', version: '1.0' }))
      .mockRejectedValueOnce(Object.assign(new Error('ELOOP: too many levels of symbolic links'), { code: 'ELOOP' }));

    const result = await extensionLoader.scanExtensions('/fake/dir');
    expect(result).toEqual(['/fake/dir/good-ext']);
  });
});

// ─── loadExtension ─────────────────────────────────────────────────

describe('loadExtension', () => {
  test('successful load returns {success:true, id, name, version, enabled, path}', async () => {
    const extInfo = { id: 'abc123', name: 'My Extension' };
    mockLoadExtension.mockResolvedValue(extInfo);
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'My Extension', version: '2.1.0' }));

    const result = await extensionLoader.loadExtension('/fake/dir/my-ext');

    expect(result).toEqual({
      success: true,
      id: 'abc123',
      name: 'My Extension',
      version: '2.1.0',
      enabled: true,
      path: '/fake/dir/my-ext',
      icon: '',
    });
    expect(mockLoadExtension).toHaveBeenCalledWith('/fake/dir/my-ext', { allowFileAccess: false });
  });

  test('handles null return from extensions.loadExtension', async () => {
    mockLoadExtension.mockResolvedValue(null);

    const result = await extensionLoader.loadExtension('/fake/dir/null-ext');

    expect(result.success).toBe(false);
    expect(result.error).toBe('extensions.loadExtension returned null');
  });

  test('uses manifest name when ext.name is missing', async () => {
    const extInfo = { id: 'no-name-id', name: '' };
    mockLoadExtension.mockResolvedValue({ extension: extInfo });
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'From Manifest', version: '0.5.0' }));

    const result = await extensionLoader.loadExtension('/fake/dir/no-name');

    expect(result.name).toBe('From Manifest');
  });

  test('falls back to directory basename when both ext.name and manifest.name are missing', async () => {
    const extInfo = { id: 'fallback-id', name: '' };
    mockLoadExtension.mockResolvedValue({ extension: extInfo });
    mockReadFile.mockResolvedValue(JSON.stringify({ version: '1.0' }));

    const result = await extensionLoader.loadExtension('/fake/dir/fallback-ext');

    expect(result.name).toBe('fallback-ext');
  });

  test('failed load returns {success:false, error}', async () => {
    mockLoadExtension.mockRejectedValue(new Error('Invalid extension'));

    const result = await extensionLoader.loadExtension('/fake/dir/bad-ext');

    expect(result).toEqual({
      success: false,
      error: 'Invalid extension',
    });
  });
});

// ─── unloadExtension ───────────────────────────────────────────────

describe('unloadExtension', () => {
  test('successful unload returns {success:true}', async () => {
    // First load an extension
    mockLoadExtension.mockResolvedValue({ extension: { id: 'ext-1', name: 'Test' } });
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Test', version: '1.0' }));
    await extensionLoader.loadExtension('/fake/dir/ext-1');

    mockRemoveExtension.mockReturnValue(undefined);

    const result = await extensionLoader.unloadExtension('ext-1');

    expect(result).toEqual({ success: true });
    expect(mockRemoveExtension).toHaveBeenCalledWith('ext-1');
  });

  test('unload nonexistent extension returns error', async () => {
    const result = await extensionLoader.unloadExtension('nonexistent-id');

    expect(result).toEqual({
      success: false,
      error: 'Extension nonexistent-id not found or already disabled',
    });
  });

  test('unload already-disabled extension returns error', async () => {
    // Load then unload
    mockLoadExtension.mockResolvedValue({ extension: { id: 'ext-2', name: 'Test' } });
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Test', version: '1.0' }));
    await extensionLoader.loadExtension('/fake/dir/ext-2');

    mockRemoveExtension.mockReturnValue(undefined);
    await extensionLoader.unloadExtension('ext-2');

    // Second unload should fail
    const result = await extensionLoader.unloadExtension('ext-2');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found or already disabled/);
  });
});

// ─── listExtensions ────────────────────────────────────────────────

describe('listExtensions', () => {
  test('returns empty array when no extensions loaded', () => {
    const result = extensionLoader.listExtensions();
    expect(result).toEqual([]);
  });

  test('returns array of extension descriptors after loading', async () => {
    mockLoadExtension.mockResolvedValue({ extension: { id: 'ext-a', name: 'Alpha' } });
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Alpha', version: '1.0' }));
    await extensionLoader.loadExtension('/fake/dir/alpha');

    const result = extensionLoader.listExtensions();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'ext-a',
      name: 'Alpha',
      version: '1.0',
      enabled: true,
      path: '/fake/dir/alpha',
    });
  });
});

// ─── broadcastUpdate ───────────────────────────────────────────────

describe('broadcastUpdate', () => {
  test('sends extensions:updated to all windows', async () => {
    const windowSend = jest.fn();
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows.mockReturnValue([
      { isDestroyed: () => false, webContents: { send: windowSend } },
    ]);

    // Load an extension so listExtensions returns data
    mockLoadExtension.mockResolvedValue({ extension: { id: 'ext-b', name: 'Beta' } });
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Beta', version: '3.0' }));
    await extensionLoader.loadExtension('/fake/dir/beta');

    // broadcastUpdate is called via scheduleBroadcast (debounced 100ms).
    // We need to wait for the timeout.
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(windowSend).toHaveBeenCalledWith(
      'extensions:updated',
      expect.arrayContaining([
        expect.objectContaining({ id: 'ext-b', name: 'Beta' }),
      ])
    );
  });

  test('does not send to destroyed windows', async () => {
    const windowSend = jest.fn();
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: { send: windowSend } },
    ]);

    mockLoadExtension.mockResolvedValue({ extension: { id: 'ext-c', name: 'Gamma' } });
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Gamma', version: '1.0' }));
    await extensionLoader.loadExtension('/fake/dir/gamma');

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(windowSend).not.toHaveBeenCalled();
  });
});

// ─── autoLoadExtensions ────────────────────────────────────────────

describe('autoLoadExtensions', () => {
  test('scans default dir and loads all valid extensions', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'ext-x', isDirectory: () => true, isSymbolicLink: () => false },
      { name: 'ext-y', isDirectory: () => true, isSymbolicLink: () => false },
    ]);
    mockReadFile.mockResolvedValue(JSON.stringify({ name: 'Auto', version: '1.0' }));
    mockLoadExtension.mockResolvedValue({ extension: { id: 'auto-1', name: 'Auto' } });

    await extensionLoader.autoLoadExtensions();

    // scanExtensions found 2 dirs, loadExtension called for each
    expect(mockLoadExtension).toHaveBeenCalledTimes(2);
  });

  test('does nothing when default dir is empty', async () => {
    mockReaddir.mockResolvedValue([]);

    await extensionLoader.autoLoadExtensions();

    expect(mockLoadExtension).not.toHaveBeenCalled();
  });

  test('does nothing when default dir does not exist', async () => {
    const enoentError = new Error('ENOENT');
    enoentError.code = 'ENOENT';
    mockReaddir.mockRejectedValue(enoentError);

    await extensionLoader.autoLoadExtensions();

    expect(mockLoadExtension).not.toHaveBeenCalled();
  });
});

// ─── getDefaultExtensionsDir ───────────────────────────────────────

describe('getDefaultExtensionsDir', () => {
  test('returns path under HOME', () => {
    const dir = extensionLoader.getDefaultExtensionsDir();
    expect(dir).toContain('.config');
    expect(dir).toContain('riced-chromium');
    expect(dir).toContain('extensions');
  });
});

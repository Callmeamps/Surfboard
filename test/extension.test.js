/* ── Browser-Native Feature Platform — Extension Test ──
   Phase 1: Basic smoke test for extension loading and functionality
*/

const fs = require('fs');
const path = require('path');

const EXTENSION_DIR = path.join(process.env.HOME, '.config', 'riced-chromium', 'extensions');
const BNP_DIR = path.join(EXTENSION_DIR, 'browser-native-platform');

describe('Browser-Native Feature Platform Extension', () => {
  test('extension should load and initialize', () => {
    // Check if extension directory exists
    expect(fs.existsSync(BNP_DIR)).toBe(true);

    // Check manifest.json
    const manifestPath = path.join(BNP_DIR, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toBe('Browser-Native Feature Platform');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.manifest_version).toBe(3);

    // Check core files exist
    expect(fs.existsSync(path.join(BNP_DIR, 'scripts/background.js'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'scripts/content.js'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'styles/overlay.css'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'popup/popup.html'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'popup/popup.js'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'popup/popup.css'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'icons/icon16.svg'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'icons/icon48.svg'))).toBe(true);
    expect(fs.existsSync(path.join(BNP_DIR, 'icons/icon128.svg'))).toBe(true);
  });

  test('popup should be accessible', () => {
    // Test popup.html content
    const popupHtml = fs.readFileSync(path.join(BNP_DIR, 'popup/popup.html'), 'utf8');
    expect(popupHtml).toContain('Feature Platform');
    expect(popupHtml).toContain('Switch Mode');
    expect(popupHtml).toContain('Permissions');
    expect(popupHtml).toContain('Current Mode');

    // Test popup.js is valid JS (can be parsed)
    expect(() => {
      new Function(fs.readFileSync(path.join(BNP_DIR, 'popup/popup.js'), 'utf8'));
    }).not.toThrow();

    // Test popup.css is valid CSS
    const popupCss = fs.readFileSync(path.join(BNP_DIR, 'popup/popup.css'), 'utf8');
    expect(popupCss).toContain('.popup-container');
    expect(popupCss).toContain('--bg-primary');
    expect(popupCss).toContain('--text-primary');
  });

  test('content script should handle mode switching', () => {
    // Test content.js structure
    const contentJs = fs.readFileSync(path.join(BNP_DIR, 'scripts/content.js'), 'utf8');

    // Test valid JS
    expect(() => {
      new Function(contentJs);
    }).not.toThrow();

    // Check for key functions
    expect(contentJs).toContain('activateMode');
    expect(contentJs).toContain('deactivateMode');
    expect(contentJs).toContain('elementPath');
    expect(contentJs).toContain('onInspectMove');
    expect(contentJs).toContain('onInspectClick');
    expect(contentJs).toContain('onEditClick');
    expect(contentJs).toContain('onActionClick');

    // Check for mode handling
    expect(contentJs).toContain('fp:mode-changed');
    expect(contentJs).toContain('Browse');
    expect(contentJs).toContain('Inspect');
    expect(contentJs).toContain('Edit');
    expect(contentJs).toContain('Action');
  });

  test('background script should handle permissions', () => {
    // Test background.js structure
    const backgroundJs = fs.readFileSync(path.join(BNP_DIR, 'scripts/background.js'), 'utf8');

    // Test valid JS
    expect(() => {
      new Function(backgroundJs);
    }).not.toThrow();

    // Check for key functions
    expect(backgroundJs).toContain('setMode');
    expect(backgroundJs).toContain('getPermissions');
    expect(backgroundJs).toContain('grantPermission');
    expect(backgroundJs).toContain('revokePermission');
    expect(backgroundJs).toContain('checkPermission');
    expect(backgroundJs).toContain('broadcastMode');

    // Check for modes (single-quoted in source)
    expect(backgroundJs).toContain("'browse'");
    expect(backgroundJs).toContain("'inspect'");
    expect(backgroundJs).toContain("'edit'");
    expect(backgroundJs).toContain("'action'");

    // Check for message handlers
    expect(backgroundJs).toContain('fp:get-state');
    expect(backgroundJs).toContain('fp:set-mode');
    expect(backgroundJs).toContain('fp:element-selected');
    expect(backgroundJs).toContain('fp:get-permissions');
    expect(backgroundJs).toContain('fp:grant-permission');
  });

  test('extension should have proper manifest structure', () => {
    const manifestPath = path.join(BNP_DIR, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Required manifest fields
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Browser-Native Feature Platform');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.description).toBe(
      'Inspect, edit, automate, and embed tools directly in the browsing experience. Phase 1: mode switching, element selection, hover highlights, permission framework.'
    );

    // Content script
    expect(manifest.content_scripts).toBeDefined();
    expect(manifest.content_scripts.length).toBe(1);
    expect(manifest.content_scripts[0].matches).toContain('http://*/*');
    expect(manifest.content_scripts[0].matches).toContain('https://*/*');
    expect(manifest.content_scripts[0].js).toContain('scripts/content.js');
    expect(manifest.content_scripts[0].css).toContain('styles/overlay.css');

    // Background service worker
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBe('scripts/background.js');

    // Action/popup
    expect(manifest.action).toBeDefined();
    expect(manifest.action.default_popup).toBe('popup/popup.html');

    // Permissions
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('contextMenus');

    // Commands
    expect(manifest.commands).toBeDefined();
    expect(manifest.commands['toggle-browse-mode']).toBeDefined();
    expect(manifest.commands['toggle-inspect-mode']).toBeDefined();
    expect(manifest.commands['toggle-edit-mode']).toBeDefined();
    expect(manifest.commands['toggle-action-mode']).toBeDefined();
  });

  test('extension files should be accessible and valid', () => {
    // Check all core files exist and are readable
    const files = [
      'manifest.json',
      'scripts/background.js',
      'scripts/content.js',
      'styles/overlay.css',
      'popup/popup.html',
      'popup/popup.js',
      'popup/popup.css',
      'icons/icon16.svg',
      'icons/icon48.svg',
      'icons/icon128.svg',
    ];

    files.forEach(file => {
      const filePath = path.join(BNP_DIR, file);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8').length).toBeGreaterThan(0);
    });
  });

  test('setup script should install extension correctly', () => {
    // browser-native-platform is copied (not symlinked) to avoid circular refs
    // video-speed-controller is symlinked with absolute path
    const copiedExtensions = ['browser-native-platform'];
    const symlinkedExtensions = ['video-speed-controller'];

    copiedExtensions.forEach(ext => {
      const dirPath = path.join(EXTENSION_DIR, ext);
      expect(fs.existsSync(dirPath)).toBe(true);
      const stats = fs.lstatSync(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    symlinkedExtensions.forEach(ext => {
      const linkPath = path.join(EXTENSION_DIR, ext);
      expect(fs.existsSync(linkPath)).toBe(true);
      const stats = fs.lstatSync(linkPath);
      expect(stats.isSymbolicLink()).toBe(true);
      const target = fs.readlinkSync(linkPath);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

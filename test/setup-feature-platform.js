// Jest setup: load feature-platform modules into JSDOM before tests
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = {
  body: { classList: { contains: () => false, add: () => {}, remove: () => {}, forEach: () => {} } },
  readyState: 'complete',
};

// Load the IIFE scripts as eval (they write to window)
const modesSrc = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/feature-platform/modes/index.js'), 'utf8');
const trustSrc = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/feature-platform/trust/index.js'), 'utf8');
const editorSrc = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/feature-platform/editor/index.js'), 'utf8');
const inspectorSrc = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/feature-platform/inspector/index.js'), 'utf8');

eval(modesSrc);
eval(trustSrc);
eval(editorSrc);
eval(inspectorSrc);

// Pre-initialize for tests so one-shot flags are locked in
window.ModeManager?.init?.();
window.TrustManager?.registerDefaults?.([]);
/**
 * Miniapps module tests — no DOM dependencies
 */
describe('Miniapps', () => {
  beforeEach(() => {
    // Reset
    delete window.Miniapps;

    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    eval(src);
  });

  test('Miniapps is exposed on window', () => {
    expect(window.Miniapps).toBeDefined();
    expect(typeof window.Miniapps.register).toBe('function');
    expect(typeof window.Miniapps.open).toBe('function');
    expect(typeof window.Miniapps.getList).toBe('function');
    expect(typeof window.Miniapps.reset).toBe('function');
  });

  test('default miniapps are registered after init', () => {
    const list = window.Miniapps.getList();
    expect(list.length).toBe(3);
    const ids = list.map(a => a.id);
    expect(ids).toContain('calculator');
    expect(ids).toContain('notes');
    expect(ids).toContain('todo');
  });

  test('register adds a miniapp', () => {
    window.Miniapps.reset();
    window.Miniapps.register({ id: 'custom', name: 'Custom App', icon: '🔧' });
    const list = window.Miniapps.getList();
    expect(list.length).toBe(4); // 3 defaults + custom
  });

  test('register with no id is rejected', () => {
    window.Miniapps.reset();
    const before = window.Miniapps.getList().length;
    window.Miniapps.register(null);
    window.Miniapps.register({});
    expect(window.Miniapps.getList().length).toBe(before);
  });

  test('isActive returns correct state', () => {
    window.Miniapps.reset();
    expect(window.Miniapps.isActive('calculator')).toBe(false);
    window.Miniapps.open('calculator');
    expect(window.Miniapps.isActive('calculator')).toBe(true);
  });

  test('close clears active state', () => {
    window.Miniapps.open('calculator');
    expect(window.Miniapps.isActive('calculator')).toBe(true);
    window.Miniapps.close();
    expect(window.Miniapps.isActive('calculator')).toBe(false);
  });

  test('reset clears all and re-registers defaults', () => {
    window.Miniapps.register({ id: 'extra', name: 'Extra' });
    expect(window.Miniapps.getList().length).toBeGreaterThan(3);
    window.Miniapps.reset();
    expect(window.Miniapps.getList().length).toBe(3);
  });

  test('calculator miniapp has render function that returns HTML', () => {
    const list = window.Miniapps.getList();
    const calc = list.find(a => a.id === 'calculator');
    expect(calc).toBeDefined();
    expect(typeof calc.render).toBe('function');
    const html = calc.render();
    expect(html).toContain('calc-display');
    expect(html).toContain('calc-grid');
  });

  test('notes miniapp has render function that returns HTML', () => {
    const list = window.Miniapps.getList();
    const notes = list.find(a => a.id === 'notes');
    expect(notes).toBeDefined();
    expect(typeof notes.render).toBe('function');
    const html = notes.render();
    expect(html).toContain('notes-area');
  });

  test('todo miniapp has render function that returns HTML', () => {
    const list = window.Miniapps.getList();
    const todo = list.find(a => a.id === 'todo');
    expect(todo).toBeDefined();
    expect(typeof todo.render).toBe('function');
    const html = todo.render();
    expect(html).toContain('todo-input');
    expect(html).toContain('todo-list');
  });
});

describe('Miniapps — sandbox API', () => {
  beforeEach(() => {
    delete window.Miniapps;
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    eval(src);
  });

  test('sendTo function is exposed', () => {
    expect(typeof window.Miniapps.sendTo).toBe('function');
  });

  test('register supports sandbox flag', () => {
    window.Miniapps.register({
      id: 'sandboxed-app',
      name: 'Sandboxed',
      sandbox: true,
      render() { return '<div>Hello</div>'; },
    });
    const app = window.Miniapps.getList().find(a => a.id === 'sandboxed-app');
    expect(app).toBeDefined();
    expect(app.sandbox).toBe(true);
  });

  test('sandbox srcdoc contains strict CSP', () => {
    // Read the source to verify CSP string is present
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    // The CSP blocks eval, inline scripts from external origins, network access
    expect(src).toContain("default-src 'none'");
    expect(src).toContain("script-src 'unsafe-inline'");
    expect(src).toContain("connect-src 'none'");
    expect(src).toContain("object-src 'none'");
    expect(src).toContain("frame-src 'none'");
  });

  test('sandbox iframe uses allow-scripts only (no allow-same-origin)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    // Should have sandbox="allow-scripts" but NOT allow-same-origin
    expect(src).toContain('sandbox="allow-scripts"');
    // Check only lines that set the sandbox attribute (not comments)
    const sandboxLines = src.split('\n').filter(l => l.includes('sandbox=') && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    sandboxLines.forEach(line => {
      expect(line).not.toContain('allow-same-origin');
    });
  });

  test('sandbox srcdoc includes MiniappSDK postMessage bridge', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    expect(src).toContain('MiniappSDK');
    expect(src).toContain("parent.postMessage");
    expect(src).toContain("'__ready'");
  });

  test('message event listener is registered', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    // Verify the module listens for message events
    expect(src).toContain("window.addEventListener('message'");
  });

  test('reset clears sandbox state', () => {
    window.Miniapps.register({
      id: 'test-sandbox',
      name: 'Test',
      sandbox: true,
      render() { return '<p>test</p>'; },
    });
    window.Miniapps.reset();
    const list = window.Miniapps.getList();
    expect(list.find(a => a.id === 'test-sandbox')).toBeUndefined();
  });
});

describe('Miniapps — todo XSS prevention', () => {
  beforeEach(() => {
    delete window.Miniapps;
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    eval(src);
  });

  test('todo render does not use innerHTML with user input in source', () => {
    // The source should use textContent for user-supplied todo text,
    // not innerHTML with template literals containing user input
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src/renderer/feature-platform/miniapps/index.js'), 'utf8'
    );
    // Find the todo wiring section and verify it uses textContent
    const todoSection = src.slice(src.indexOf('id === \'todo\''));
    expect(todoSection).toContain('span.textContent');
    // Should NOT have the old innerHTML pattern with user input
    expect(todoSection).not.toContain('li.innerHTML');
  });

  test('todo render creates DOM elements safely', () => {
    // Verify the render function returns safe static HTML
    const list = window.Miniapps.getList();
    const todo = list.find(a => a.id === 'todo');
    const html = todo.render();
    // No dynamic user content in the render output
    expect(html).not.toContain('${');
    expect(html).toContain('todo-input');
    expect(html).toContain('todo-list');
  });
});

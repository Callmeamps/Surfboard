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

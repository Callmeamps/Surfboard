/**
 * WorkflowEngine tests
 * Covers: init/enable/disable, trust gating, step registration, workflow CRUD,
 * execution engine, run/stop, preview, events.
 */
describe('WorkflowEngine', () => {
  beforeEach(() => {
    window.WorkflowEngine?.reset?.();
    window.TrustManager?.registerDefaults?.([{ module: 'workflows', action: 'execute' }]);
  });

  afterEach(() => {
    window.WorkflowEngine?.reset?.();
  });

  // ── Init & Enable / Disable ────────────────────────────
  test('isEnabled returns false by default', () => {
    expect(window.WorkflowEngine.isEnabled()).toBe(false);
  });

  test('enable() with no root returns false', () => {
    expect(window.WorkflowEngine.enable()).toBe(false);
    expect(window.WorkflowEngine.isEnabled()).toBe(false);
  });

  test('enable() with root returns true', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.WorkflowEngine.enable(root)).toBe(true);
    expect(window.WorkflowEngine.isEnabled()).toBe(true);
    window.WorkflowEngine.disable();
  });

  test('disable() sets enabled to false', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    window.WorkflowEngine.disable();
    expect(window.WorkflowEngine.isEnabled()).toBe(false);
  });

  test('enable() requires workflows::execute permission', () => {
    window.TrustManager?.reset?.();
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    expect(window.WorkflowEngine.enable(root)).toBe(false);
    expect(window.WorkflowEngine.isEnabled()).toBe(false);
  });

  test('init() sets root for later enable()', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.init({ root });
    expect(window.WorkflowEngine.enable()).toBe(true);
    window.WorkflowEngine.disable();
  });

  test('enable() sets data-workflows-active on root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    expect(root.getAttribute('data-workflows-active')).toBe('');
    window.WorkflowEngine.disable();
  });

  test('disable() removes data-workflows-active from root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    window.WorkflowEngine.disable();
    expect(root.getAttribute('data-workflows-active')).toBe(null);
  });

  // ── Step Registration ──────────────────────────────────
  test('registerStep() adds step and returns true', () => {
    const result = window.WorkflowEngine.registerStep({
      id: 'test-step',
      type: 'action',
      label: 'Test Step',
    });
    expect(result).toBe(true);
    expect(window.WorkflowEngine.getStep('test-step')).not.toBeNull();
  });

  test('registerStep() returns false for missing id', () => {
    expect(window.WorkflowEngine.registerStep({ type: 'action' })).toBe(false);
  });

  test('unregisterStep() removes step and returns true', () => {
    window.WorkflowEngine.registerStep({ id: 'rem-step', type: 'action', label: 'Remove' });
    expect(window.WorkflowEngine.unregisterStep('rem-step')).toBe(true);
    expect(window.WorkflowEngine.getStep('rem-step')).toBeNull();
  });

  test('unregisterStep() returns false for missing id', () => {
    expect(window.WorkflowEngine.unregisterStep('nonexistent')).toBe(false);
  });

  test('getAllSteps() returns all registered steps', () => {
    window.WorkflowEngine.registerStep({ id: 's1', type: 'action', label: 'S1' });
    window.WorkflowEngine.registerStep({ id: 's2', type: 'data', label: 'S2' });
    expect(window.WorkflowEngine.getAllSteps().length).toBe(2);
  });

  // ── Workflow CRUD ──────────────────────────────────────
  test('createWorkflow() returns workflow with generated id', () => {
    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Test Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'st1' },
        { type: 'action', label: 'Do', id: 'st2' },
      ],
    });
    expect(wf).not.toBeNull();
    expect(wf.name).toBe('Test Flow');
    expect(wf.steps.length).toBe(2);
    expect(wf.id).toBeDefined();
  });

  test('createWorkflow() returns null for missing name', () => {
    expect(window.WorkflowEngine.createWorkflow({ steps: [] })).toBeNull();
  });

  test('createWorkflow() uses provided id', () => {
    const wf = window.WorkflowEngine.createWorkflow({
      id: 'custom-id',
      name: 'Custom',
      steps: [],
    });
    expect(wf.id).toBe('custom-id');
  });

  test('updateWorkflow() patches fields', () => {
    const wf = window.WorkflowEngine.createWorkflow({ name: 'Original', steps: [] });
    const updated = window.WorkflowEngine.updateWorkflow(wf.id, { name: 'Updated' });
    expect(updated).not.toBeNull();
    expect(updated.name).toBe('Updated');
  });

  test('updateWorkflow() returns null for missing id', () => {
    expect(window.WorkflowEngine.updateWorkflow('nonexistent', {})).toBeNull();
  });

  test('deleteWorkflow() removes workflow', () => {
    const wf = window.WorkflowEngine.createWorkflow({ name: 'ToDelete', steps: [] });
    expect(window.WorkflowEngine.deleteWorkflow(wf.id)).toBe(true);
    expect(window.WorkflowEngine.getWorkflow(wf.id)).toBeNull();
  });

  test('deleteWorkflow() returns false for missing id', () => {
    expect(window.WorkflowEngine.deleteWorkflow('nonexistent')).toBe(false);
  });

  test('getAllWorkflows() returns all workflows', () => {
    window.WorkflowEngine.createWorkflow({ name: 'W1', steps: [] });
    window.WorkflowEngine.createWorkflow({ name: 'W2', steps: [] });
    expect(window.WorkflowEngine.getAllWorkflows().length).toBe(2);
  });

  // ── Preview ────────────────────────────────────────────
  test('preview() returns workflow structure', () => {
    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Preview Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'pr1' },
        { type: 'action', label: 'Click', id: 'pr2', actionId: 'click' },
        { type: 'data', label: 'Extract', id: 'pr3', extract: 'h1', bind: 'title' },
      ],
    });
    const p = window.WorkflowEngine.preview(wf.id);
    expect(p).not.toBeNull();
    expect(p.name).toBe('Preview Flow');
    expect(p.stepCount).toBe(3);
    expect(p.steps[0].type).toBe('trigger');
    expect(p.steps[1].hasHandler).toBe(true);
    expect(p.dataKeys).toContain('title');
  });

  test('preview() returns null for missing workflow', () => {
    expect(window.WorkflowEngine.preview('nonexistent')).toBeNull();
  });

  // ── Execution ──────────────────────────────────────────
  test('run() executes trigger step successfully', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Trigger Only',
      steps: [{ type: 'trigger', label: 'Start', id: 'tr1' }],
    });

    const result = await window.WorkflowEngine.run(wf.id);
    expect(result).toBe(true);
    expect(window.WorkflowEngine.isRunning()).toBe(false);
    window.WorkflowEngine.disable();
  });

  test('run() executes action with handler', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    let actionCalled = false;
    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Action Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'tr2' },
        { type: 'action', label: 'Custom', id: 'ac1', handler: () => { actionCalled = true; return 'done'; } },
      ],
    });

    const result = await window.WorkflowEngine.run(wf.id);
    expect(result).toBe(true);
    expect(actionCalled).toBe(true);
    window.WorkflowEngine.disable();
  });

  test('run() executes condition step', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Condition Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'tr3' },
        { type: 'condition', label: 'Check', id: 'cn1', condition: () => true },
        { type: 'action', label: 'After', id: 'ac2', handler: () => 'ok' },
      ],
    });

    const result = await window.WorkflowEngine.run(wf.id);
    expect(result).toBe(true);
    window.WorkflowEngine.disable();
  });

  test('run() skips steps after false condition', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    let afterCalled = false;
    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Skip Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'tr4' },
        { type: 'condition', label: 'Check', id: 'cn2', condition: () => false },
        { type: 'action', label: 'After', id: 'ac3', handler: () => { afterCalled = true; return 'ok'; } },
      ],
    });

    const result = await window.WorkflowEngine.run(wf.id);
    // Condition returns false, so subsequent step is skipped
    // Workflow still completes (condition itself is marked skipped)
    expect(result).toBe(true);
    expect(afterCalled).toBe(false);
    window.WorkflowEngine.disable();
  });

  test('run() executes delay step', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Delay Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'tr5' },
        { type: 'delay', label: 'Wait', id: 'dl1', duration: 50 },
      ],
    });

    const result = await window.WorkflowEngine.run(wf.id);
    expect(result).toBe(true);
    window.WorkflowEngine.disable();
  });

  test('run() returns false for missing workflow', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    const result = await window.WorkflowEngine.run('nonexistent');
    expect(result).toBe(false);
    window.WorkflowEngine.disable();
  });

  test('run() returns false when already running', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Long Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'tr6' },
        { type: 'delay', label: 'Wait', id: 'dl2', duration: 5000 },
      ],
    });

    // Start running
    window.WorkflowEngine.run(wf.id);
    // Try to run another
    const wf2 = window.WorkflowEngine.createWorkflow({
      name: 'Other Flow',
      steps: [{ type: 'trigger', label: 'Start', id: 'tr7' }],
    });
    const result = await window.WorkflowEngine.run(wf2.id);
    expect(result).toBe(false);
    window.WorkflowEngine.stop();
    window.WorkflowEngine.disable();
  });

  test('run() handles step errors', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Error Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'tr8' },
        { type: 'action', label: 'Fail', id: 'ac4', handler: () => { throw new Error('step failed'); } },
      ],
    });

    const result = await window.WorkflowEngine.run(wf.id);
    expect(result).toBe(false);
    expect(window.WorkflowEngine.isRunning()).toBe(false);
    window.WorkflowEngine.disable();
  });

  test('stop() halts running workflow', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Stop Flow',
      steps: [
        { type: 'trigger', label: 'Start', id: 'tr9' },
        { type: 'delay', label: 'Long Wait', id: 'dl3', duration: 10000 },
        { type: 'action', label: 'Never', id: 'ac5', handler: () => 'nope' },
      ],
    });

    const runPromise = window.WorkflowEngine.run(wf.id);
    // Stop immediately
    const stopped = window.WorkflowEngine.stop();
    expect(stopped).toBe(true);
    expect(window.WorkflowEngine.isRunning()).toBe(false);
    await runPromise; // let it finish cleanup
    window.WorkflowEngine.disable();
  });

  test('stop() returns false when nothing running', () => {
    expect(window.WorkflowEngine.stop()).toBe(false);
  });

  test('isRunning() returns false by default', () => {
    expect(window.WorkflowEngine.isRunning()).toBe(false);
  });

  test('getRunningId() returns null when not running', () => {
    expect(window.WorkflowEngine.getRunningId()).toBeNull();
  });

  test('getRunState() returns null when not running', () => {
    expect(window.WorkflowEngine.getRunState()).toBeNull();
  });

  // ── Panel ──────────────────────────────────────────────
  test('enable() creates workflow panel in DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    const panel = root.querySelector('.workflow-panel');
    expect(panel).not.toBeNull();
    window.WorkflowEngine.disable();
  });

  test('disable() removes panel from DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    window.WorkflowEngine.disable();
    expect(root.querySelector('.workflow-panel')).toBeNull();
  });

  test('panel has new workflow button', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    const btn = root.querySelector('.workflow-toolbar .workflow-btn');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('New Workflow');
    window.WorkflowEngine.disable();
  });

  // ── Events ─────────────────────────────────────────────
  test('onChange fires on enable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let fired = null;
    window.WorkflowEngine.onChange((type) => { fired = type; });
    window.WorkflowEngine.enable(root);
    expect(fired).toBe('enabled');
    window.WorkflowEngine.disable();
  });

  test('onChange fires on disable', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    let fired = null;
    window.WorkflowEngine.onChange((type) => { fired = type; });
    window.WorkflowEngine.disable();
    expect(fired).toBe('disabled');
  });

  test('onChange fires workflow-created', () => {
    let fired = null;
    window.WorkflowEngine.onChange((type, detail) => { fired = { type, detail }; });
    const wf = window.WorkflowEngine.createWorkflow({ name: 'Ev', steps: [] });
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('workflow-created');
    expect(fired.detail.id).toBe(wf.id);
  });

  test('onChange fires workflow-deleted', () => {
    const wf = window.WorkflowEngine.createWorkflow({ name: 'Del', steps: [] });
    let fired = null;
    window.WorkflowEngine.onChange((type) => { fired = type; });
    window.WorkflowEngine.deleteWorkflow(wf.id);
    expect(fired).toBe('workflow-deleted');
  });

  test('onChange fires workflow-started and workflow-completed', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const events = [];
    window.WorkflowEngine.onChange((type) => { events.push(type); });

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Ev Flow',
      steps: [{ type: 'trigger', label: 'Start', id: 'ev1' }],
    });

    await window.WorkflowEngine.run(wf.id);
    expect(events).toContain('workflow-started');
    expect(events).toContain('workflow-completed');
    window.WorkflowEngine.disable();
  });

  test('onChange fires step-started and step-completed', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const events = [];
    window.WorkflowEngine.onChange((type) => { events.push(type); });

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Step Events',
      steps: [
        { type: 'trigger', label: 'Start', id: 'sev1' },
        { type: 'action', label: 'Act', id: 'sev2', handler: () => 'ok' },
      ],
    });

    await window.WorkflowEngine.run(wf.id);
    expect(events).toContain('step-started');
    expect(events).toContain('step-completed');
    window.WorkflowEngine.disable();
  });

  test('onChange fires workflow-stopped', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);

    const events = [];
    window.WorkflowEngine.onChange((type) => { events.push(type); });

    const wf = window.WorkflowEngine.createWorkflow({
      name: 'Stop Events',
      steps: [
        { type: 'trigger', label: 'Start', id: 'stp1' },
        { type: 'delay', label: 'Wait', id: 'stp2', duration: 10000 },
      ],
    });

    window.WorkflowEngine.run(wf.id);
    window.WorkflowEngine.stop();
    expect(events).toContain('workflow-stopped');
    window.WorkflowEngine.disable();
  });

  test('onChange fires denied event when permission missing', () => {
    window.TrustManager?.reset?.();
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let fired = null;
    window.WorkflowEngine.onChange((type, detail) => { fired = { type, detail }; });
    window.WorkflowEngine.enable(root);
    expect(fired).not.toBeNull();
    expect(fired.type).toBe('denied');
  });

  test('onChange returns unsubscribe function', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    let count = 0;
    const unsub = window.WorkflowEngine.onChange(() => { count++; });
    window.WorkflowEngine.enable(root);
    const afterEnable = count;
    expect(afterEnable).toBeGreaterThan(0);
    unsub();
    window.WorkflowEngine.disable();
    expect(count).toBe(afterEnable);
  });

  // ── Reset ──────────────────────────────────────────────
  test('reset() clears all state', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    window.WorkflowEngine.createWorkflow({ name: 'R1', steps: [] });
    window.WorkflowEngine.reset();
    expect(window.WorkflowEngine.isEnabled()).toBe(false);
    expect(window.WorkflowEngine.getAllWorkflows().length).toBe(0);
    expect(window.WorkflowEngine.getAllSteps().length).toBe(0);
  });

  // ── Overlay cleanup on disable ─────────────────────────
  test('disable() removes all overlays from DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    expect(root.querySelectorAll('[data-workflow-overlay]').length).toBeGreaterThan(0);
    window.WorkflowEngine.disable();
    expect(root.querySelectorAll('[data-workflow-overlay]').length).toBe(0);
  });

  // ── Default Steps ──────────────────────────────────────
  test('enable() registers default step templates', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>hello</p>';
    window.WorkflowEngine.enable(root);
    const steps = window.WorkflowEngine.getAllSteps();
    expect(steps.length).toBeGreaterThan(0);
    const ids = steps.map(s => s.id);
    expect(ids).toContain('click');
    expect(ids).toContain('type-text');
    expect(ids).toContain('wait');
    expect(ids).toContain('extract-text');
    expect(ids).toContain('check-exists');
    window.WorkflowEngine.disable();
  });
});

/**
 * AIClient tests
 * Covers: init/enable/disable, context extraction, completion, workflow gen,
 * inline results, trust gating.
 */
describe('AIClient', () => {
  let root;
  beforeEach(() => {
    window.AIClient?.reset?.();
    window.TrustManager?.reset?.();
    window.TrustManager?.registerDefaults?.([{ module: 'ai', action: 'complete' }]);
    root = document.createElement('div');
    root.id = 'app';
    root.innerHTML = '<article id="page"><h2>Data</h2><p>Contextal data.</p></article>';
    document.body.innerHTML = '';
    document.body.appendChild(root);
    window.AIClient.init({ root });
  });

  afterEach(() => {
    window.AIClient?.reset?.();
  });

  // ── Init & Enable / Disable ─────────────────────────────
  test('enable() with no root returns false', () => {
    window.AIClient?.init?.({ root: null });
    expect(window.AIClient.enable()).toBe(false);
  });

  test('enable() with root returns true', () => {
    expect(window.AIClient.enable()).toBe(true);
    expect(root.hasAttribute('data-ai-active')).toBe(true);
  });

  test('disable() removes attribute', () => {
    window.AIClient.enable();
    window.AIClient.disable();
    expect(root.hasAttribute('data-ai-active')).toBe(false);
  });

  test('isEnabled reflects state', () => {
    expect(window.AIClient.isEnabled()).toBe(false);
    window.AIClient.enable();
    expect(window.AIClient.isEnabled()).toBe(true);
  });

  // ── Context ─────────────────────────────────────────────
  test('extractContext returns metadata', () => {
    window.AIClient.enable();
    const ctx = window.AIClient.extractContext({
      element: root.querySelector('article'),
      includeText: true
    });
    expect(ctx.tagName).toBe('article');
    expect(ctx.text).toContain('Data');
  });

  test('extractContext returns empty when disabled', () => {
    const ctx = window.AIClient.extractContext({ element: root });
    expect(Object.keys(ctx)).toEqual([]);
  });

  // ── Model ────────────────────────────────────────────────
  test('complete() resolves with fake completion', async () => {
    window.AIClient.enable();
    const result = await window.AIClient.complete({ prompt: 'Summarize page' });
    expect(result.status).toBe('simulated');
    expect(result.model).toMatch(/simulated/);
    expect(Array.isArray(result.completions)).toBe(true);
    expect(result.completions[0].text).toMatch(/Summarize/);
  });

  test('complete() rejects without prompt', async () => {
    window.AIClient.enable();
    try {
    await window.AIClient.complete({});
    throw new Error('should have rejected');
  } catch (e) {
    expect(e.message).toBe('Prompt must be a string');
  };
  });

  // ── Workflow ──────────────────────────────────────────────
  test('generateWorkflowFromPrompt returns workflow', async () => {
    window.AIClient.enable();
    const wf = await window.AIClient.generateWorkflowFromPrompt({
      prompt: 'Schedule meeting',
      actionType: 'schedule',
      actionName: 'Schedule',
      contextIds: ['calendar'],
    });
    expect(wf.name).toMatch(/Generated from prompt/);
    expect(wf.steps.length).toBeGreaterThanOrEqual(1);
    expect(wf.context).toEqual(['calendar']);
  });

  test('generateWorkflowFromPrompt resolves null for empty prompt', async () => {
    window.AIClient.enable();
    const wf = await window.AIClient.generateWorkflowFromPrompt({});
    expect(wf).toBeNull();
  });

  // ── Inline UI ─────────────────────────────────────────────
  test('inlineResult renders text in overlay', () => {
    window.AIClient.enable();
    const host = window.AIClient.inlineResult({ text: 'Hello world' });
    const body = root.querySelector('.ai-inline-body');
    expect(body?.textContent).toBe('Hello world');
    expect(host).not.toBeNull();
  });

  test('inlineResult renders json when json option provided', () => {
    window.AIClient.enable();
    window.AIClient.inlineResult({ json: { ok: true, count: 3 } });
    const body = root.querySelector('.ai-inline-body');
    expect(body?.textContent).toContain('"ok"');
  });
});

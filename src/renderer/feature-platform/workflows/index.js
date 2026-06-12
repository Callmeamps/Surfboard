/**
 * WorkflowEngine — Browser-Native Feature Platform
 * Visual step ladder UI, trigger/condition/action execution, data mapping,
 * preview, run/stop controls.
 *
 * Usage:
 *   WorkflowEngine.init({ root: document.getElementById('app') })
 *   WorkflowEngine.registerStep({ id: 'navigate', type: 'action', ... })
 *   WorkflowEngine.createWorkflow({ name: 'My Flow', steps: [...] })
 *   WorkflowEngine.run(workflowId)
 *   WorkflowEngine.enable()
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────
  let _root = null;
  let _enabled = false;
  let _workflows = new Map();   // id → workflow descriptor
  let _steps = new Map();       // id → step template
  let _running = null;          // currently running workflow id
  let _runState = null;         // { workflowId, stepIndex, data, status, results }
  let _listeners = [];
  let _panel = null;            // workflow panel DOM
  let _ladder = null;           // step ladder DOM

  // ── Helpers ────────────────────────────────────────────
  function _notify(type, detail) {
    _listeners.forEach(fn => fn(type, detail));
  }

  function _isWorkflowOverlay(el) {
    return el && el.dataset && el.dataset.workflowOverlay !== undefined;
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _escAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function _uid() { return 'wf-' + Math.random().toString(36).substring(2, 10); }

  // ── Step Types ─────────────────────────────────────────
  const STEP_TYPES = {
    TRIGGER: 'trigger',
    ACTION: 'action',
    CONDITION: 'condition',
    DATA: 'data',
    DELAY: 'delay',
    LOOP: 'loop',
  };

  // ── Step Registration ──────────────────────────────────
  function registerStep(step) {
    if (!step || !step.id) return false;
    _steps.set(step.id, { ...step });
    _notify('step-registered', { id: step.id });
    return true;
  }

  function unregisterStep(id) {
    if (!_steps.has(id)) return false;
    _steps.delete(id);
    _notify('step-unregistered', { id });
    return true;
  }

  function getStep(id) { return _steps.get(id) || null; }
  function getAllSteps() { return Array.from(_steps.values()); }

  // ── Workflow CRUD ──────────────────────────────────────
  // ── Persistence helpers ────────────────────────────────
  function _persistSave(wf) {
    try {
      const api = window.electronAPI?.storage?.workflows;
      if (!api) return;
      const existing = _persistIds.has(wf.id);
      if (existing) {
        api.update(wf.id, { name: wf.name, description: wf.description, steps: wf.steps });
      } else {
        api.add({ id: wf.id, name: wf.name, description: wf.description, steps: wf.steps, createdAt: wf.createdAt });
        _persistIds.add(wf.id);
      }
    } catch (err) {
      console.error('[WorkflowEngine] persist save failed:', err);
    }
  }

  function _persistRemove(id) {
    try {
      const api = window.electronAPI?.storage?.workflows;
      if (!api) return;
      api.remove(id);
      _persistIds.delete(id);
    } catch (err) {
      console.error('[WorkflowEngine] persist remove failed:', err);
    }
  }

  let _persistIds = new Set();

  async function _loadFromStorage() {
    try {
      const api = window.electronAPI?.storage?.workflows;
      if (!api) return;
      const list = await api.list();
      if (!Array.isArray(list)) return;
      for (const wf of list) {
        if (wf && wf.id && wf.name) {
          _workflows.set(wf.id, { ...wf });
          _persistIds.add(wf.id);
        }
      }
    } catch (err) {
      console.error('[WorkflowEngine] load from storage failed:', err);
    }
  }

  function createWorkflow(desc) {
    if (!desc || !desc.name) return null;
    const id = desc.id || _uid();
    const wf = {
      id,
      name: desc.name,
      description: desc.description || '',
      steps: (desc.steps || []).map(s => ({
        ...s,
        id: s.id || _uid(),
        status: 'pending',
        output: null,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    _workflows.set(id, wf);
    _persistSave(wf);
    _notify('workflow-created', { id, workflow: wf });
    return wf;
  }

  function updateWorkflow(id, patch) {
    const wf = _workflows.get(id);
    if (!wf) return null;
    Object.assign(wf, patch, { updatedAt: Date.now() });
    _persistSave(wf);
    _notify('workflow-updated', { id, workflow: wf });
    return wf;
  }

  function deleteWorkflow(id) {
    if (!_workflows.has(id)) return false;
    _workflows.delete(id);
    _persistRemove(id);
    _notify('workflow-deleted', { id });
    return true;
  }

  function getWorkflow(id) { return _workflows.get(id) || null; }
  function getAllWorkflows() { return Array.from(_workflows.values()); }

  // ── Step Ladder UI ─────────────────────────────────────
  function _renderStepLadder() {
    if (!_ladder) return;
    _ladder.innerHTML = '';

    const workflows = getAllWorkflows();
    if (!workflows.length) {
      _ladder.innerHTML = '<div class="workflow-empty">No workflows. Create one to get started.</div>';
      return;
    }

    workflows.forEach(wf => {
      const wfEl = document.createElement('div');
      wfEl.className = 'workflow-item';
      wfEl.dataset.workflowId = wf.id;

      // Header
      const header = document.createElement('div');
      header.className = 'workflow-header';
      header.innerHTML =
        '<span class="workflow-name">' + _escHtml(wf.name) + '</span>' +
        '<span class="workflow-step-count">' + wf.steps.length + ' steps</span>';
      wfEl.appendChild(header);

      // Step ladder
      const ladder = document.createElement('div');
      ladder.className = 'workflow-ladder';

      wf.steps.forEach((step, i) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'workflow-step' + (step.status === 'running' ? ' running' : '') +
          (step.status === 'done' ? ' done' : '') +
          (step.status === 'error' ? ' error' : '') +
          (step.status === 'skipped' ? ' skipped' : '');
        stepEl.dataset.stepId = step.id;

        const icon = step.type === 'trigger' ? '⚡' :
                     step.type === 'condition' ? '❓' :
                     step.type === 'data' ? '📊' :
                     step.type === 'delay' ? '⏱' :
                     step.type === 'loop' ? '🔁' : '▶';

        stepEl.innerHTML =
          '<span class="workflow-step-icon">' + icon + '</span>' +
          '<span class="workflow-step-label">' + _escHtml(step.label || step.id) + '</span>' +
          (step.status === 'done' ? '<span class="workflow-step-status">✓</span>' :
           step.status === 'error' ? '<span class="workflow-step-status">✗</span>' :
           step.status === 'running' ? '<span class="workflow-step-status">●</span>' : '');

        // Connector line
        if (i < wf.steps.length - 1) {
          const connector = document.createElement('div');
          connector.className = 'workflow-connector';
          stepEl.appendChild(connector);
        }

        stepEl.addEventListener('click', () => {
          _notify('step-selected', { workflowId: wf.id, stepId: step.id, step });
        });

        ladder.appendChild(stepEl);
      });

      wfEl.appendChild(ladder);

      // Controls
      const controls = document.createElement('div');
      controls.className = 'workflow-controls';

      const runBtn = document.createElement('button');
      runBtn.className = 'workflow-btn workflow-btn-run';
      runBtn.textContent = _running === wf.id ? 'Running...' : 'Run';
      runBtn.disabled = _running === wf.id;
      runBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        run(wf.id);
      });

      const stopBtn = document.createElement('button');
      stopBtn.className = 'workflow-btn workflow-btn-stop';
      stopBtn.textContent = 'Stop';
      stopBtn.disabled = _running !== wf.id;
      stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stop();
      });

      const editBtn = document.createElement('button');
      editBtn.className = 'workflow-btn workflow-btn-edit';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _notify('workflow-edit', { id: wf.id });
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'workflow-btn workflow-btn-delete';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteWorkflow(wf.id);
        _renderStepLadder();
      });

      controls.appendChild(runBtn);
      controls.appendChild(stopBtn);
      controls.appendChild(editBtn);
      controls.appendChild(delBtn);
      wfEl.appendChild(controls);

      _ladder.appendChild(wfEl);
    });
  }

  // ── Panel ──────────────────────────────────────────────
  function _showPanel() {
    _hidePanel();
    if (!_root) return;

    const panel = document.createElement('div');
    panel.className = 'workflow-panel';
    panel.dataset.workflowOverlay = '';

    const header = document.createElement('div');
    header.className = 'workflow-panel-header';
    header.innerHTML =
      '<span class="workflow-panel-title">Workflows</span>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'workflow-panel-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => { disable(); });
    header.appendChild(closeBtn);

    const ladder = document.createElement('div');
    ladder.className = 'workflow-ladder-container';

    const toolbar = document.createElement('div');
    toolbar.className = 'workflow-toolbar';
    const newBtn = document.createElement('button');
    newBtn.className = 'workflow-btn';
    newBtn.textContent = '+ New Workflow';
    newBtn.addEventListener('click', () => {
      const wf = createWorkflow({
        name: 'New Workflow',
        steps: [
          { type: 'trigger', label: 'Start', id: _uid() },
          { type: 'action', label: 'Do something', id: _uid() },
        ],
      });
      _renderStepLadder();
      _notify('workflow-edit', { id: wf.id });
    });
    toolbar.appendChild(newBtn);

    // Run state display
    const runState = document.createElement('div');
    runState.className = 'workflow-run-state';
    runState.style.display = 'none';

    panel.appendChild(header);
    panel.appendChild(toolbar);
    panel.appendChild(runState);
    panel.appendChild(ladder);

    _root.appendChild(panel);
    _panel = panel;
    _ladder = ladder;
    _renderStepLadder();
  }

  function _hidePanel() {
    if (_panel && _panel.parentNode) _panel.parentNode.removeChild(_panel);
    _panel = null;
    _ladder = null;
  }

  function _updateRunState() {
    if (!_panel) return;
    const runState = _panel.querySelector('.workflow-run-state');
    if (!runState) return;
    if (!_runState) {
      runState.style.display = 'none';
      return;
    }
    runState.style.display = 'block';
    const wf = _workflows.get(_runState.workflowId);
    const stepLabel = wf && wf.steps[_runState.stepIndex]
      ? (wf.steps[_runState.stepIndex].label || wf.steps[_runState.stepIndex].id)
      : '—';
    runState.innerHTML =
      '<div class="workflow-run-info">' +
      '<span class="workflow-run-name">' + _escHtml(wf ? wf.name : 'Unknown') + '</span>' +
      '<span class="workflow-run-status workflow-run-status-' + _runState.status + '">' +
        _runState.status + '</span></div>' +
      '<div class="workflow-run-progress">Step ' + (_runState.stepIndex + 1) + ' of ' +
        (wf ? wf.steps.length : '?') + ': ' + _escHtml(stepLabel) + '</div>';
  }

  // ── Execution Engine ───────────────────────────────────
  async function run(workflowId) {
    const wf = _workflows.get(workflowId);
    if (!wf) return false;
    if (_running) return false;

    // Trust gate
    try {
      if (window.TrustManager) {
        window.TrustManager.require('workflows', 'execute');
      }
    } catch (err) {
      _notify('denied', { id: workflowId, error: err.message });
      return false;
    }

    _running = workflowId;
    _runState = {
      workflowId,
      stepIndex: 0,
      data: {},
      status: 'running',
      results: [],
      startedAt: Date.now(),
    };

    // Reset step statuses
    wf.steps.forEach(s => { s.status = 'pending'; s.output = null; });
    _renderStepLadder();
    _updateRunState();
    _notify('workflow-started', { id: workflowId });

    try {
      for (let i = 0; i < wf.steps.length; i++) {
        if (_running !== workflowId) break; // stopped
        _runState.stepIndex = i;
        const step = wf.steps[i];
        step.status = 'running';
        _renderStepLadder();
        _updateRunState();
        _notify('step-started', { workflowId, stepIndex: i, step });

        try {
          const result = await _executeStep(step, _runState);
          if (result === false && step.type === 'condition') {
            step.status = 'skipped';
            _notify('step-skipped', { workflowId, stepIndex: i, step });
            // Skip remaining steps
            for (let j = i + 1; j < wf.steps.length; j++) {
              wf.steps[j].status = 'skipped';
            }
            _renderStepLadder();
            break;
          } else {
            step.status = 'done';
            step.output = result;
            _runState.results.push({ stepIndex: i, result });
            _notify('step-completed', { workflowId, stepIndex: i, step, result });
          }
        } catch (err) {
          step.status = 'error';
          step.output = err.message;
          _runState.status = 'error';
          _runState.error = err.message;
          _renderStepLadder();
          _updateRunState();
          _notify('step-error', { workflowId, stepIndex: i, step, error: err.message });
          _running = null;
          return false;
        }

        _renderStepLadder();
        _updateRunState();
      }

      if (_running === workflowId) {
        _runState.status = 'completed';
        _runState.completedAt = Date.now();
        _running = null;
        _renderStepLadder();
        _updateRunState();
        _notify('workflow-completed', { id: workflowId, results: _runState.results });
        return true;
      }
    } catch (err) {
      _runState.status = 'error';
      _runState.error = err.message;
      _running = null;
      _renderStepLadder();
      _updateRunState();
      _notify('workflow-error', { id: workflowId, error: err.message });
      return false;
    }

    return false;
  }

  async function _executeStep(step, runState) {
    switch (step.type) {
      case 'trigger':
        // Triggers are entry points — just mark as done
        return { triggered: true, ts: Date.now() };

      case 'action':
        if (step.actionId && window.ActionRegistry) {
          return window.ActionRegistry.execute(step.actionId, {
            workflowId: runState.workflowId,
            stepId: step.id,
            data: runState.data,
          });
        }
        if (step.handler) {
          return await step.handler(runState);
        }
        return true;

      case 'condition':
        if (step.condition) {
          return !!step.condition(runState);
        }
        return true;

      case 'data': {
        // Data mapping: extract from source, store in runState
        if (step.extract && window.Inspector) {
          const elements = window.Inspector.query(step.extract);
          const values = elements.map(el => {
            if (step.field === 'text') return el.textContent;
            if (step.field === 'html') return el.innerHTML;
            return el.getAttribute(step.field) || el.textContent;
          });
          if (step.bind) {
            runState.data[step.bind] = step.multiple ? values : values[0];
          }
          return values;
        }
        if (step.handler) {
          return await step.handler(runState);
        }
        return runState.data;
      }

      case 'delay':
        await new Promise(r => setTimeout(r, step.duration || 1000));
        return { delayed: step.duration || 1000 };

      case 'loop': {
        const items = runState.data[step.source] || [];
        const results = [];
        for (let i = 0; i < items.length; i++) {
          runState.data[step.as || 'item'] = items[i];
          runState.data[(step.as || 'item') + '_index'] = i;
          if (step.body) {
            const r = await _executeStep(step.body, runState);
            results.push(r);
          }
        }
        return results;
      }

      default:
        return true;
    }
  }

  function stop() {
    if (!_running) return false;
    const id = _running;
    _running = null;
    if (_runState) {
      _runState.status = 'stopped';
      _runState.stoppedAt = Date.now();
    }
    _renderStepLadder();
    _updateRunState();
    _notify('workflow-stopped', { id });
    return true;
  }

  function isRunning() { return _running !== null; }
  function getRunningId() { return _running; }
  function getRunState() { return _runState ? { ..._runState } : null; }

  // ── Preview ────────────────────────────────────────────
  function preview(workflowId) {
    const wf = _workflows.get(workflowId);
    if (!wf) return null;
    return {
      id: wf.id,
      name: wf.name,
      stepCount: wf.steps.length,
      steps: wf.steps.map(s => ({
        id: s.id,
        type: s.type,
        label: s.label || s.id,
        hasHandler: !!(s.handler || s.actionId || s.condition || s.extract),
      })),
      dataKeys: _extractDataKeys(wf),
    };
  }

  function _extractDataKeys(wf) {
    const keys = new Set();
    wf.steps.forEach(s => {
      if (s.bind) keys.add(s.bind);
      if (s.source) keys.add(s.source);
      if (s.as) keys.add(s.as);
    });
    return Array.from(keys);
  }

  // ── Default Steps ──────────────────────────────────────
  function _registerDefaultSteps() {
    registerStep({
      id: 'click',
      type: 'action',
      label: 'Click Element',
      icon: '👆',
      description: 'Click on a matching element',
    });

    registerStep({
      id: 'type-text',
      type: 'action',
      label: 'Type Text',
      icon: '⌨️',
      description: 'Type text into an input',
    });

    registerStep({
      id: 'wait',
      type: 'delay',
      label: 'Wait',
      icon: '⏱',
      description: 'Pause execution',
    });

    registerStep({
      id: 'extract-text',
      type: 'data',
      label: 'Extract Text',
      icon: '📊',
      description: 'Extract text from elements',
    });

    registerStep({
      id: 'check-exists',
      type: 'condition',
      label: 'Check Exists',
      icon: '❓',
      description: 'Check if element exists',
    });
  }

  // ── Style injection ────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('workflows-styles')) return;
    const style = document.createElement('style');
    style.id = 'workflows-styles';
    style.textContent = [
      '/* ── WorkflowEngine styles ─────────────────────────── */',
      '.workflow-panel {',
      '  position: fixed;',
      '  top: 0;',
      '  right: 0;',
      '  width: 360px;',
      '  max-width: 90vw;',
      '  height: 100vh;',
      '  background: var(--bg-elevated, #1c1c1f);',
      '  border-left: 1px solid var(--border, #2a2a30);',
      '  box-shadow: -8px 0 32px rgba(0,0,0,0.4);',
      '  z-index: 6000;',
      '  display: flex;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '}',
      '.workflow-panel-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  padding: 12px 16px;',
      '  border-bottom: 1px solid var(--border, #2a2a30);',
      '  flex-shrink: 0;',
      '}',
      '.workflow-panel-title {',
      '  font-size: 14px;',
      '  font-weight: 700;',
      '  color: var(--text, #d4d4d8);',
      '}',
      '.workflow-panel-close {',
      '  background: none;',
      '  border: none;',
      '  color: var(--text-dim, #71717a);',
      '  font-size: 16px;',
      '  cursor: pointer;',
      '  padding: 4px 8px;',
      '  border-radius: 4px;',
      '}',
      '.workflow-panel-close:hover {',
      '  background: var(--border, #2a2a30);',
      '  color: var(--text, #d4d4d8);',
      '}',
      '.workflow-toolbar {',
      '  padding: 8px 16px;',
      '  border-bottom: 1px solid var(--border, #2a2a30);',
      '  flex-shrink: 0;',
      '}',
      '.workflow-run-state {',
      '  padding: 10px 16px;',
      '  border-bottom: 1px solid var(--border, #2a2a30);',
      '  background: rgba(96,165,250,0.05);',
      '  flex-shrink: 0;',
      '}',
      '.workflow-run-info {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  margin-bottom: 4px;',
      '}',
      '.workflow-run-name {',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  color: var(--text, #d4d4d8);',
      '}',
      '.workflow-run-status {',
      '  font-size: 10px;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.5px;',
      '  padding: 1px 6px;',
      '  border-radius: 3px;',
      '  font-weight: 600;',
      '}',
      '.workflow-run-status-running {',
      '  background: rgba(96,165,250,0.2);',
      '  color: var(--accent, #60a5fa);',
      '}',
      '.workflow-run-status-completed {',
      '  background: rgba(52,211,153,0.2);',
      '  color: #34d399;',
      '}',
      '.workflow-run-status-error {',
      '  background: rgba(239,68,68,0.2);',
      '  color: #ef4444;',
      '}',
      '.workflow-run-status-stopped {',
      '  background: rgba(251,191,36,0.2);',
      '  color: #fbbf24;',
      '}',
      '.workflow-run-progress {',
      '  font-size: 11px;',
      '  color: var(--text-dim, #71717a);',
      '}',
      '.workflow-ladder-container {',
      '  flex: 1;',
      '  overflow-y: auto;',
      '  padding: 12px;',
      '}',
      '.workflow-empty {',
      '  text-align: center;',
      '  color: var(--text-faint, #52525b);',
      '  font-size: 13px;',
      '  padding: 40px 20px;',
      '}',
      '.workflow-item {',
      '  margin-bottom: 16px;',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 8px;',
      '  overflow: hidden;',
      '}',
      '.workflow-header {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  padding: 10px 12px;',
      '  background: rgba(255,255,255,0.02);',
      '  border-bottom: 1px solid var(--border, #2a2a30);',
      '}',
      '.workflow-name {',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  color: var(--text, #d4d4d8);',
      '}',
      '.workflow-step-count {',
      '  font-size: 10px;',
      '  color: var(--text-faint, #52525b);',
      '}',
      '.workflow-ladder {',
      '  padding: 8px 12px;',
      '}',
      '.workflow-step {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 6px 8px;',
      '  border-radius: 4px;',
      '  cursor: pointer;',
      '  position: relative;',
      '  font-size: 12px;',
      '  color: var(--text-dim, #71717a);',
      '}',
      '.workflow-step:hover {',
      '  background: rgba(255,255,255,0.04);',
      '}',
      '.workflow-step.running {',
      '  color: var(--accent, #60a5fa);',
      '  background: rgba(96,165,250,0.08);',
      '}',
      '.workflow-step.done {',
      '  color: #34d399;',
      '}',
      '.workflow-step.error {',
      '  color: #ef4444;',
      '  background: rgba(239,68,68,0.08);',
      '}',
      '.workflow-step.skipped {',
      '  opacity: 0.5;',
      '}',
      '.workflow-step-icon {',
      '  font-size: 14px;',
      '  width: 18px;',
      '  text-align: center;',
      '  flex-shrink: 0;',
      '}',
      '.workflow-step-label {',
      '  flex: 1;',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '}',
      '.workflow-step-status {',
      '  font-size: 11px;',
      '  flex-shrink: 0;',
      '}',
      '.workflow-connector {',
      '  position: absolute;',
      '  left: 16px;',
      '  bottom: -6px;',
      '  width: 2px;',
      '  height: 12px;',
      '  background: var(--border, #2a2a30);',
      '}',
      '.workflow-controls {',
      '  display: flex;',
      '  gap: 6px;',
      '  padding: 8px 12px;',
      '  border-top: 1px solid var(--border, #2a2a30);',
      '}',
      '.workflow-btn {',
      '  padding: 4px 10px;',
      '  border: 1px solid var(--border, #2a2a30);',
      '  border-radius: 4px;',
      '  background: transparent;',
      '  color: var(--text-dim, #71717a);',
      '  font-size: 11px;',
      '  cursor: pointer;',
      '  font-family: inherit;',
      '}',
      '.workflow-btn:hover {',
      '  background: rgba(255,255,255,0.06);',
      '  color: var(--text, #d4d4d8);',
      '}',
      '.workflow-btn:disabled {',
      '  opacity: 0.4;',
      '  cursor: not-allowed;',
      '}',
      '.workflow-btn-run {',
      '  color: #34d399;',
      '  border-color: rgba(52,211,153,0.3);',
      '}',
      '.workflow-btn-stop {',
      '  color: #ef4444;',
      '  border-color: rgba(239,68,68,0.3);',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  try { _injectStyles(); } catch (e) { /* noop in non-browser */ }

  // ── Public API ─────────────────────────────────────────
  function init(deps) {
    _root = deps?.root || null;
    _loadFromStorage();
  }

  function enable(overrideRoot) {
    if (overrideRoot) _root = overrideRoot;
    if (!_root) return false;
    if (_enabled) return true;

    // Trust gate
    try {
      if (window.TrustManager) {
        window.TrustManager.require('workflows', 'execute');
      }
    } catch (err) {
      _notify('denied', { error: err.message });
      return false;
    }

    _enabled = true;
    _registerDefaultSteps();
    _showPanel();
    _root.setAttribute('data-workflows-active', '');
    _notify('enabled', {});
    return true;
  }

  function disable() {
    if (!_enabled) return;
    _enabled = false;
    stop();
    _hidePanel();
    _root.removeAttribute('data-workflows-active');
    _root.querySelectorAll('[data-workflow-overlay]').forEach(el => el.parentNode.removeChild(el));
    _notify('disabled', {});
  }

  function isEnabled() { return _enabled; }

  function onChange(fn) {
    _listeners.push(fn);
    return function () { _listeners = _listeners.filter(l => l !== fn); };
  }

  function reset() {
    disable();
    _workflows = new Map();
    _steps = new Map();
    _persistIds = new Set();
    _running = null;
    _runState = null;
    _root = null;
    _listeners = [];
  }

  window.WorkflowEngine = {
    init,
    enable,
    disable,
    isEnabled,
    registerStep,
    unregisterStep,
    getStep,
    getAllSteps,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    getWorkflow,
    getAllWorkflows,
    run,
    stop,
    isRunning,
    getRunningId,
    getRunState,
    preview,
    onChange,
    reset,
  };
})();

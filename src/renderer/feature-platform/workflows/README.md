# WorkflowEngine — Browser-Native Feature Platform

Visual step ladder UI, trigger/condition/action execution, data mapping, preview, run/stop controls.

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `init({ root })` | `void` | Set workflow root element |
| `enable(root?)` | `bool` | Show workflow panel; requires `workflows::execute` trust |
| `disable()` | `void` | Hide panel, stop running workflow |
| `isEnabled()` | `bool` | Current state |
| `registerStep(step)` | `bool` | Register a step template |
| `unregisterStep(id)` | `bool` | Remove a step template |
| `getStep(id)` | `Step\|null` | Get step by ID |
| `getAllSteps()` | `Step[]` | List all step templates |
| `createWorkflow(desc)` | `Workflow` | Create a new workflow |
| `updateWorkflow(id, patch)` | `Workflow\|null` | Update workflow fields |
| `deleteWorkflow(id)` | `bool` | Remove a workflow |
| `getWorkflow(id)` | `Workflow\|null` | Get workflow by ID |
| `getAllWorkflows()` | `Workflow[]` | List all workflows |
| `run(id)` | `bool` | Execute a workflow |
| `stop()` | `bool` | Stop running workflow |
| `isRunning()` | `bool` | Is a workflow executing? |
| `getRunningId()` | `string\|null` | Currently running workflow ID |
| `getRunState()` | `Object\|null` | Current execution state |
| `preview(id)` | `Object\|null` | Preview workflow structure |
| `onChange(fn)` | `unsubscribe` | Event listener |
| `reset()` | `void` | Full reset for tests |

## Step Types

| Type | Description |
|------|-------------|
| `trigger` | Entry point (auto-completes) |
| `action` | Execute an action (via ActionRegistry or handler) |
| `condition` | Evaluate condition, skip if false |
| `data` | Extract data from page elements (via Inspector) |
| `delay` | Pause execution (ms) |
| `loop` | Iterate over data array |

## Events

| Type | Detail |
|------|--------|
| `enabled` / `disabled` | `{}` |
| `workflow-created` | `{ id, workflow }` |
| `workflow-updated` | `{ id, workflow }` |
| `workflow-deleted` | `{ id }` |
| `workflow-started` | `{ id }` |
| `workflow-completed` | `{ id, results }` |
| `workflow-stopped` | `{ id }` |
| `workflow-error` | `{ id, error }` |
| `step-started` | `{ workflowId, stepIndex, step }` |
| `step-completed` | `{ workflowId, stepIndex, step, result }` |
| `step-error` | `{ workflowId, stepIndex, step, error }` |
| `step-skipped` | `{ workflowId, stepIndex, step }` |
| `denied` | `{ error }` |

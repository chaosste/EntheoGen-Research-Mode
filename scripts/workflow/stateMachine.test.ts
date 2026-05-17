import {
  applyWorkflowTransition,
  assertWorkflowTransition,
  validateWorkflowTransition,
  type WorkflowRecord,
  type WorkflowState
} from './stateMachine';

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertThrows = (fn: () => void, message: string): void => {
  let didThrow = false;
  try {
    fn();
  } catch {
    didThrow = true;
  }
  assert(didThrow, message);
};

const allowedTransitions: Array<[WorkflowState, WorkflowState]> = [
  ['submitted', 'structured'],
  ['submitted', 'published'],
  ['structured', 'curator_review'],
  ['structured', 'safety_review'],
  ['curator_review', 'safety_review'],
  ['safety_review', 'approved'],
  ['approved', 'published'],
  ['published', 'archived'],
  ['blocked', 'curator_review']
];

const forbiddenTransitions: Array<[WorkflowState, WorkflowState]> = [
  ['submitted', 'submitted'],
  ['published', 'published']
];

for (const [from, to] of allowedTransitions) {
  const decision = validateWorkflowTransition(from, to);
  assert(decision.allowed, `expected allowed transition to pass: ${from} -> ${to}`);
}

for (const [from, to] of forbiddenTransitions) {
  const decision = validateWorkflowTransition(from, to);
  assert(!decision.allowed, `expected forbidden transition to fail: ${from} -> ${to}`);
}

assertThrows(
  () => {
    assertWorkflowTransition('submitted', 'submitted');
  },
  'no-op transition should throw'
);

const initialRecord: WorkflowRecord = {
  id: 'workflow-record-1',
  state: 'submitted',
  transition_history: []
};

const structured = applyWorkflowTransition(initialRecord, 'structured', {
  actor: 'codex-test'
});
assert(structured.state === 'structured', 'apply transition should update state');
assert(structured.transition_history.length === 1, 'transition history should append on valid transition');

assertThrows(
  () => {
    applyWorkflowTransition(structured, 'structured', {
      actor: 'codex-test'
    });
  },
  'apply transition should block no-op transitions'
);

console.log('Workflow state machine tests passed.');

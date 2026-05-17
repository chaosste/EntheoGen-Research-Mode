import {
  applyWorkflowTransition,
  validateWorkflowTransition,
  type WorkflowRecord,
  type WorkflowState
} from './stateMachine';

export interface InteractionUpdateWorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  actor: string;
  at: string;
  note?: string;
}

export interface InteractionUpdateWorkflowData {
  state: WorkflowState;
  transition_history: InteractionUpdateWorkflowTransition[];
}

export interface InteractionUpdateRecord {
  update_id: string;
  status?: string;
  workflow?: InteractionUpdateWorkflowData;
  [key: string]: unknown;
}

const VALID_STATES = new Set<WorkflowState>([
  'submitted',
  'structured',
  'curator_review',
  'safety_review',
  'approved',
  'published',
  'archived',
  'blocked'
]);

function isWorkflowState(value: unknown): value is WorkflowState {
  return typeof value === 'string' && VALID_STATES.has(value as WorkflowState);
}

function normalizeTransitionHistory(value: unknown): InteractionUpdateWorkflowTransition[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is InteractionUpdateWorkflowTransition => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Record<string, unknown>;
      return (
        isWorkflowState(candidate.from) &&
        isWorkflowState(candidate.to) &&
        typeof candidate.actor === 'string' &&
        typeof candidate.at === 'string' &&
        (candidate.note === undefined || typeof candidate.note === 'string')
      );
    })
    .map((entry) => ({ ...entry }));
}

function assertValidTransitionHistory(
  updateId: string,
  state: WorkflowState,
  transitionHistory: InteractionUpdateWorkflowTransition[]
): void {
  if (transitionHistory.length === 0) {
    if (state !== 'submitted') {
      throw new Error(
        `Invalid workflow for ${updateId}: non-submitted state (${state}) must include transition history.`
      );
    }
    return;
  }

  for (let i = 0; i < transitionHistory.length; i += 1) {
    const transition = transitionHistory[i];
    const decision = validateWorkflowTransition(transition.from, transition.to);
    if (!decision.allowed) {
      throw new Error(
        `Invalid workflow history for ${updateId} at step ${i + 1}: ${decision.reason ?? `${transition.from} -> ${transition.to}`}`
      );
    }

    if (i === 0 && transition.from !== 'submitted') {
      throw new Error(
        `Invalid workflow history for ${updateId}: first transition must start at submitted (got ${transition.from}).`
      );
    }

    if (i > 0) {
      const previous = transitionHistory[i - 1];
      if (previous.to !== transition.from) {
        throw new Error(
          `Invalid workflow history for ${updateId}: step ${i} ends at ${previous.to} but step ${i + 1} starts at ${transition.from}.`
        );
      }
    }
  }

  const last = transitionHistory[transitionHistory.length - 1];
  if (last.to !== state) {
    throw new Error(
      `Invalid workflow for ${updateId}: current state (${state}) does not match history tail (${last.to}).`
    );
  }
}

export function resolveInteractionUpdateWorkflow(record: InteractionUpdateRecord): InteractionUpdateWorkflowData {
  const explicit = record.workflow;
  if (explicit && typeof explicit === 'object') {
    const candidate = explicit as unknown as Record<string, unknown>;
    if (!isWorkflowState(candidate.state)) {
      throw new Error(`Unsupported explicit workflow state for ${record.update_id}: ${String(candidate.state)}`);
    }

    if (candidate.transition_history !== undefined && !Array.isArray(candidate.transition_history)) {
      throw new Error(`Invalid workflow transition_history for ${record.update_id}: expected array.`);
    }

    const transitionHistory = normalizeTransitionHistory(candidate.transition_history);
    if (Array.isArray(candidate.transition_history) && transitionHistory.length !== candidate.transition_history.length) {
      throw new Error(`Invalid workflow transition_history entry for ${record.update_id}: malformed transition object detected.`);
    }

    assertValidTransitionHistory(record.update_id, candidate.state, transitionHistory);
    return {
      state: candidate.state,
      transition_history: transitionHistory
    };
  }

  // Legacy proposals only had status=proposed; map them into the governed workflow.
  if (record.status === 'proposed' || record.status === undefined) {
    return {
      state: 'submitted',
      transition_history: []
    };
  }

  throw new Error(`Unsupported legacy update status for ${record.update_id}: ${String(record.status)}`);
}

interface TransitionContext {
  actor: string;
  at?: string;
  note?: string;
}

export function transitionInteractionUpdateRecord(
  record: InteractionUpdateRecord,
  to: WorkflowState,
  context: TransitionContext
): InteractionUpdateRecord {
  const workflow = resolveInteractionUpdateWorkflow(record);

  const baseRecord: WorkflowRecord = {
    id: record.update_id,
    state: workflow.state,
    transition_history: workflow.transition_history
  };

  const nextWorkflow = applyWorkflowTransition(baseRecord, to, context);

  return {
    ...record,
    workflow: {
      state: nextWorkflow.state,
      transition_history: nextWorkflow.transition_history
    }
  };
}

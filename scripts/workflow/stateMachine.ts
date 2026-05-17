export const WORKFLOW_STATES = [
  'submitted',
  'structured',
  'curator_review',
  'safety_review',
  'approved',
  'published',
  'archived',
  'blocked'
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

type AllowedTransitions = Record<WorkflowState, readonly WorkflowState[]>;

const ANY_STATE = WORKFLOW_STATES;

const ALLOWED_TRANSITIONS: AllowedTransitions = {
  submitted: ANY_STATE,
  structured: ANY_STATE,
  curator_review: ANY_STATE,
  safety_review: ANY_STATE,
  approved: ANY_STATE,
  published: ANY_STATE,
  archived: ANY_STATE,
  blocked: ANY_STATE
};

export interface WorkflowTransitionValidation {
  allowed: boolean;
  reason?: string;
}

export interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  actor: string;
  at: string;
  note?: string;
}

export interface WorkflowRecord {
  id: string;
  state: WorkflowState;
  transition_history: WorkflowTransition[];
}

interface TransitionContext {
  actor: string;
  at?: string;
  note?: string;
}

export function getAllowedTransitions(state: WorkflowState): readonly WorkflowState[] {
  return ALLOWED_TRANSITIONS[state];
}

export function validateWorkflowTransition(from: WorkflowState, to: WorkflowState): WorkflowTransitionValidation {
  if (from === to) {
    return {
      allowed: false,
      reason: `No-op transition is not allowed (${from} -> ${to}).`
    };
  }

  const allowedTargets = getAllowedTransitions(from);
  if (!allowedTargets.includes(to)) {
    return {
      allowed: false,
      reason: `Transition ${from} -> ${to} is not allowed by workflow policy.`
    };
  }

  return { allowed: true };
}

export function assertWorkflowTransition(from: WorkflowState, to: WorkflowState): void {
  const decision = validateWorkflowTransition(from, to);
  if (!decision.allowed) {
    throw new Error(decision.reason ?? `Invalid workflow transition (${from} -> ${to}).`);
  }
}

export function applyWorkflowTransition(
  record: WorkflowRecord,
  to: WorkflowState,
  context: TransitionContext
): WorkflowRecord {
  assertWorkflowTransition(record.state, to);

  const transition: WorkflowTransition = {
    from: record.state,
    to,
    actor: context.actor,
    at: context.at ?? new Date().toISOString(),
    note: context.note
  };

  return {
    ...record,
    state: to,
    transition_history: [...record.transition_history, transition]
  };
}

import type {
  ConfidenceLevel,
  EvidenceSupportType,
  EvidenceTierV2,
  InteractionCodeV2,
  MechanismCategoryV2
} from './interactionSchemaV2';

export const EVIDENCE_STATUSES = [
  'not_reviewed',
  'no_data',
  'limited_data',
  'conflicting_evidence',
  'mechanistic_inference',
  'supported'
] as const;

export type EvidenceStatusV2 = (typeof EVIDENCE_STATUSES)[number];

export const REVIEW_STATES = [
  'unreviewed',
  'machine_inferred',
  'human_reviewed',
  'requires_review',
  'needs_verification'
] as const;

export type ReviewStateV2 = (typeof REVIEW_STATES)[number];

export const VALIDATION_SEVERITIES = ['critical', 'warning', 'info'] as const;

export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number];

export const VALIDATION_FLAG_SEVERITY: Record<string, ValidationSeverity> = {
  missing_mechanism: 'critical',
  mechanism_category_unknown: 'critical',
  missing_evidence_tier: 'critical',
  unknown_classification: 'critical',
  duplicate_active_pair: 'critical',
  invalid_schema: 'critical',
  non_self_unknown: 'critical',
  missing_timing: 'warning',
  source_gap: 'warning',
  no_direct_evidence: 'warning',
  conflicting_evidence: 'warning',
  aggregate_node_used: 'warning',
  risk_score_ambiguous: 'warning',
  low_confidence: 'info',
  theoretical_interaction: 'info',
  inferred_mechanism_added: 'info',
  machine_inferred: 'info',
  needs_human_review: 'info',
  provisional_secondary: 'info',
  needs_verification: 'info',
  upgrade_candidate: 'info',
  missing_source: 'warning',
  source_gap_unresolved: 'warning',
  override_applied: 'info'
};

export interface EvidenceEpistemicInput {
  provenanceSource?: string;
  sourceRefs: string[];
  supportType: EvidenceSupportType;
  evidenceTier: EvidenceTierV2;
  confidence?: ConfidenceLevel;
  code?: InteractionCodeV2;
  reviewed?: boolean;
  summary?: string;
  fieldNotes?: string;
  evidenceGaps?: string;
  mechanism?: string | null;
  explicitDeterministic?: boolean;
  isTheoretical?: boolean;
  isConflicting?: boolean;
  isGeneratedPlaceholder?: boolean;
  deprecated?: boolean;
}

const hasConflictCue = (value?: string | null): boolean => {
  if (!value) return false;
  return /conflict|conflicting|contradict|contradictory|discordant|inconsistent|mixed evidence|mixed signals|disagree|disagreement/i.test(
    value
  );
};

export const inferReviewState = (input: EvidenceEpistemicInput): ReviewStateV2 => {
  if (input.isGeneratedPlaceholder || input.provenanceSource === 'generated_unknown' || input.sourceRefs.includes('source_gap')) {
    return 'unreviewed';
  }

  if (input.isConflicting || hasConflictCue(input.summary) || hasConflictCue(input.fieldNotes) || hasConflictCue(input.evidenceGaps)) {
    return 'requires_review';
  }

  if (input.explicitDeterministic || input.provenanceSource === 'deterministic_mapping_table') {
    return 'human_reviewed';
  }

  if (input.isTheoretical || input.provenanceSource === 'mechanistic_inference' || input.provenanceSource === 'heuristic_fallback') {
    return 'machine_inferred';
  }

  if (input.provenanceSource === 'decomposition') {
    return input.deprecated ? 'requires_review' : 'machine_inferred';
  }

  if (input.reviewed) {
    return 'human_reviewed';
  }

  return 'requires_review';
};

export const inferEvidenceStatus = (
  input: EvidenceEpistemicInput & { reviewState?: ReviewStateV2 }
): EvidenceStatusV2 => {
  if (input.isConflicting || hasConflictCue(input.summary) || hasConflictCue(input.fieldNotes) || hasConflictCue(input.evidenceGaps)) {
    return 'conflicting_evidence';
  }

  if (input.isGeneratedPlaceholder || input.provenanceSource === 'generated_unknown' || input.sourceRefs.includes('source_gap')) {
    return 'not_reviewed';
  }

  if (input.reviewState === 'unreviewed') {
    return 'not_reviewed';
  }

  if (input.isTheoretical || input.evidenceTier === 'theoretical' || input.supportType === 'mechanistic' || input.provenanceSource === 'mechanistic_inference') {
    return 'mechanistic_inference';
  }

  if (input.reviewState === 'machine_inferred' || input.provenanceSource === 'heuristic_fallback') {
    return 'mechanistic_inference';
  }

  if (input.provenanceSource === 'deterministic_mapping_table' || input.supportType === 'direct') {
    return 'supported';
  }

  if (input.reviewed && input.supportType === 'none') {
    return 'no_data';
  }

  if (input.supportType === 'indirect' || input.supportType === 'field_observation' || input.supportType === 'traditional_context' || input.supportType === 'extrapolated') {
    return 'limited_data';
  }

  return 'not_reviewed';
};

export const groupValidationFlags = (flags: string[]) => {
  const grouped = {
    critical: [] as string[],
    warning: [] as string[],
    info: [] as string[]
  };

  for (const flag of flags) {
    const severity = VALIDATION_FLAG_SEVERITY[flag];
    if (severity === 'critical') grouped.critical.push(flag);
    else if (severity === 'warning') grouped.warning.push(flag);
    else grouped.info.push(flag);
  }

  return grouped;
};

export const isConflictingEvidenceText = hasConflictCue;

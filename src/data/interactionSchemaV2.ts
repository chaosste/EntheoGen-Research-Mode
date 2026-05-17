export const INTERACTION_CODES_V2 = [
  'SELF',
  'UNKNOWN',
  'INFERRED',
  'THEORETICAL',
  'DETERMINISTIC',
  'LOW',
  'LOW_MOD',
  'CAUTION',
  'UNSAFE',
  'DANGEROUS'
] as const;

export type InteractionCodeV2 = (typeof INTERACTION_CODES_V2)[number];

export const INTERACTION_STATUSES = [
  'confirmed',
  'inferred',
  'low_confidence',
  'missing_evidence',
  'unknown',
  'not_applicable'
] as const;

export type InteractionStatus = (typeof INTERACTION_STATUSES)[number];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'none', 'not_applicable'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const MECHANISM_CATEGORIES_V2 = [
  'serotonergic_toxicity',
  'maoi_potentiation',
  'serotonergic_modulation',
  'mao_inhibition',
  'nmda_antagonism',
  'psychedelic_intensification',
  'sympathomimetic_load',
  'cardiovascular_load',
  'hemodynamic_interaction',
  'hemodynamic_modulation',
  'qt_or_arrhythmia_risk',
  'qt_prolongation',
  'cns_depression',
  'pharmacodynamic_cns_depression',
  'dopaminergic_modulation',
  'respiratory_depression',
  'seizure_threshold',
  'seizure_threshold_lowering',
  'noradrenergic_suppression',
  'anticholinergic_delirium',
  'dopaminergic_load',
  'glutamatergic_dissociation',
  'glutamate_modulation',
  'gabaergic_modulation',
  '5ht_receptor_agonism',
  'cyp_inhibition',
  'metabolic_interaction',
  'dehydration_or_electrolyte_risk',
  'psychiatric_destabilization',
  'ion_channel_modulation',
  'operational_or_behavioral_risk',
  'unknown'
] as const;

export type MechanismCategoryV2 = (typeof MECHANISM_CATEGORIES_V2)[number];

export const EVIDENCE_TIERS_V2 = [
  'direct_human_data',
  'clinical_guideline',
  'case_report_or_series',
  'observational_report',
  'mechanistic_inference',
  'theoretical',
  'low',
  'field_consensus',
  'traditional_use_precedent',
  'source_gap',
  'not_applicable'
] as const;

export type EvidenceTierV2 = (typeof EVIDENCE_TIERS_V2)[number];

export const EVIDENCE_STATUSES_V2 = [
  'not_reviewed',
  'no_data',
  'limited_data',
  'conflicting_evidence',
  'mechanistic_inference',
  'supported',
  'provisional_secondary'
] as const;

export type EvidenceStatusV2 = (typeof EVIDENCE_STATUSES_V2)[number];

export const EVIDENCE_SUPPORT_TYPES = [
  'direct',
  'indirect',
  'mechanistic',
  'field_observation',
  'traditional_context',
  'extrapolated',
  'direct_literature',
  'class_level_literature',
  'mechanistic_literature',
  'adjacent_domain_literature',
  'provisional_gap_fill',
  'ai_synthesis',
  'none'
] as const;

export type EvidenceSupportType = (typeof EVIDENCE_SUPPORT_TYPES)[number];

export const EVIDENCE_STRENGTHS_V2 = ['strong', 'moderate', 'weak', 'theoretical', 'none'] as const;

export type EvidenceStrengthV2 = (typeof EVIDENCE_STRENGTHS_V2)[number];

export const SOURCE_MATCH_TYPES_V2 = [
  'direct_pair',
  'single_agent',
  'drug_class',
  'mechanism',
  'adjacent_domain',
  'source_gap',
  'provisional_gap_fill',
  'ai_synthesis'
] as const;

export type SourceMatchTypeV2 = (typeof SOURCE_MATCH_TYPES_V2)[number];

export const DERIVATION_TYPES = [
  'explicit_source',
  'curated_inference',
  'decomposition',
  'fallback_rule',
  'generated_unknown',
  'self_pair'
] as const;

export type DerivationType = (typeof DERIVATION_TYPES)[number];

export const SOURCE_KINDS = [
  'primary_source',
  'secondary_source',
  'field_guidance',
  'internal_research_update',
  'ai_synthesis',
  'generated_placeholder',
  'none'
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const VALIDATION_FLAGS_V2 = [
  'missing_mechanism',
  'missing_timing',
  'missing_evidence_tier',
  'missing_source',
  'low_confidence',
  'unknown_classification',
  'mechanism_category_unknown',
  'override_applied',
  'source_gap',
  'no_direct_evidence',
  'conflicting_evidence',
  'aggregate_node_used',
  'risk_score_ambiguous',
  'duplicate_active_pair',
  'invalid_schema',
  'non_self_unknown',
  'theoretical_interaction',
  'inferred_mechanism_added',
  'machine_inferred',
  'needs_human_review',
  'source_gap_unresolved',
  'provisional_secondary',
  'needs_verification',
  'upgrade_candidate'
] as const;

export type ValidationFlagV2 = (typeof VALIDATION_FLAGS_V2)[number];

export const REVIEW_STATES_V2 = [
  'unreviewed',
  'machine_inferred',
  'human_reviewed',
  'requires_review',
  'needs_verification'
] as const;

export type ReviewStateV2 = (typeof REVIEW_STATES_V2)[number];

export const VALIDATION_SEVERITIES_V2 = ['critical', 'warning', 'info'] as const;

export type ValidationSeverityV2 = (typeof VALIDATION_SEVERITIES_V2)[number];

export interface SourceClaimRefV2 {
  id?: string;
  source_id: string;
  claim_id?: string;
  title?: string;
  authors?: string[];
  year?: number;
  source_type?: SourceKind;
  match_type?: SourceMatchTypeV2;
  relevance_score?: number;
  evidence_strength?: EvidenceStrengthV2;
  confidence?: ConfidenceLevel;
  review_state?: ReviewStateV2;
  requires_verification?: boolean;
  notes?: string;
  claim_excerpt?: string;
  support_type?: EvidenceSupportType;
}

export interface InteractionClassificationV2 {
  code: InteractionCodeV2;
  status: InteractionStatus;
  confidence: ConfidenceLevel;
  risk_score: number | null;
  label?: string;
  risk_assessment?: {
    level: 'undetermined' | 'provisional_low' | 'provisional_moderate' | 'low' | 'moderate' | 'high';
    rationale?: string;
  };
}

export interface EvidenceProfileV2 {
  tier: EvidenceTierV2;
  support_type: EvidenceSupportType;
  evidence_strength?: EvidenceStrengthV2;
  source_refs: SourceClaimRefV2[];
  status?: EvidenceStatusV2;
  review_state?: ReviewStateV2;
  review_notes?: string | null;
  evidence_gaps?: string | null;
}

export interface ProvenanceV2 {
  derivation_type: DerivationType;
  source?: 'deterministic_mapping_table' | 'heuristic_fallback' | 'self_pair' | 'decomposition' | 'mechanistic_inference' | 'provisional_gap_fill';
  confidence_tier?: 'high' | 'medium' | 'low';
  method?: string;
  source_linking_method?: string;
  source_linking_confidence?: 'high' | 'medium' | 'low';
  requires_verification?: boolean;
  rationale?: string;
  parent_node?: string;
  parent_nodes?: string[];
  deprecated?: boolean;
  origin_value_v1?: string;
  migrated_from_v1: true;
  migration_version: 'v1_to_v2';
  migrated_at: string;
}

export interface OverrideMetadataV2 {
  applied: boolean;
  override_id?: string;
  reason?: string;
}

export interface AuditMetadataV2 {
  validation_flags: ValidationFlagV2[];
  review_status: 'human_reviewed' | 'needs_review';
  validation_notes?: string[];
}

export interface ValidationFlagsBySeverityV2 {
  critical: ValidationFlagV2[];
  warning: ValidationFlagV2[];
  info: ValidationFlagV2[];
}

export interface ValidationMetadataV2 {
  flags: ValidationFlagsBySeverityV2;
}

export interface SourceV2 {
  id: string;
  title: string;
  source_type: SourceKind;
  reliability: 'unknown';
  fingerprint?: string;
}

export interface SubstanceV2 {
  id: string;
  name: string;
  class?: string;
  mechanism_tag?: string;
  notes?: string;
  deprecated?: boolean;
  superseded_by?: string[];
}

export interface InteractionPairV2 {
  key: string;
  substances: [string, string];
  classification: InteractionClassificationV2;
  clinical_summary: {
    headline: string;
    mechanism?: string | null;
    timing_guidance?: string | null;
    field_notes?: string | null;
  };
  mechanism: {
    primary_category: MechanismCategoryV2;
    categories: MechanismCategoryV2[];
  };
  evidence: EvidenceProfileV2;
  source_text?: string;
  source_fingerprint?: string;
  provenance: ProvenanceV2;
  override_metadata: OverrideMetadataV2;
  audit: AuditMetadataV2;
  validation?: ValidationMetadataV2;
}

export interface InteractionDatasetV2 {
  schema_version: 'v2';
  generated_at: string;
  substances: SubstanceV2[];
  pairs: InteractionPairV2[];
  sources: SourceV2[];
}

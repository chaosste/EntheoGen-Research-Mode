import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapDrugDatasetFromRepo } from './bootstrapDrugDatasetFromRepo';
import { LEGEND, classifyMechanismCategory, getDRUGS, resolveInteraction } from '../src/data/drugData';
import { isAggregateNodeId, splitAggregateNode, splitAggregatePair } from '../src/data/aggregateNodeDecomposition';
import {
  ConfidenceLevel,
  DerivationType,
  EvidenceSupportType,
  EvidenceTierV2,
  InteractionCodeV2,
  InteractionDatasetV2,
  InteractionStatus,
  MechanismCategoryV2,
  SourceKind,
  ValidationFlagV2,
  MECHANISM_CATEGORIES_V2,
  type ValidationFlagsBySeverityV2,
  type InteractionPairV2
} from '../src/data/interactionSchemaV2';
import {
  groupValidationFlags,
  inferEvidenceStatus,
  inferReviewState,
  isConflictingEvidenceText
} from '../src/data/evidenceEpistemics';
import { linkSourceRefsForPair } from '../src/data/sourceLinking';

interface InteractionPairV1 {
  substance_a_id: string;
  substance_b_id: string;
  pair_key: string;
  origin: string;
  interaction_code: string;
  interaction_label: string;
  risk_scale: number;
  summary: string;
  confidence: string | null;
  mechanism: string | null;
  mechanism_category: string | null;
  timing: string | null;
  evidence_gaps: string | null;
  evidence_tier: string | null;
  field_notes: string | null;
  sources: string;
  source_refs: string[];
  source_fingerprint: string;
  rationale?: string;
}

interface DrugRow {
  id: string;
  name: string;
  class?: string;
  mechanismTag?: string;
  notes?: string;
  deprecated?: boolean;
  supersededBy?: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pairsV1Path = path.join(root, 'src/exports/interaction_pairs.json');
const outputPath = path.join(root, 'src/data/interaction_pairs.json');

const codeMap: Record<string, InteractionCodeV2> = {
  SELF: 'SELF',
  UNK: 'UNKNOWN',
  UNKNOWN: 'UNKNOWN',
  INFERRED: 'INFERRED',
  THEORETICAL: 'THEORETICAL',
  DETERMINISTIC: 'DETERMINISTIC',
  LOW: 'LOW',
  LOW_MOD: 'LOW_MOD',
  CAU: 'CAUTION',
  CAUTION: 'CAUTION',
  UNS: 'UNSAFE',
  UNSAFE: 'UNSAFE',
  DAN: 'DANGEROUS',
  DANGEROUS: 'DANGEROUS'
};

const derivationMap: Record<string, DerivationType> = {
  self: 'self_pair',
  explicit: 'explicit_source',
  fallback: 'fallback_rule',
  unknown: 'generated_unknown'
};

const riskByCode: Record<string, number | null> = {
  SELF: -1,
  UNKNOWN: 0,
  INFERRED: null,
  THEORETICAL: 2,
  LOW: 1,
  LOW_MOD: 2,
  CAUTION: 3,
  UNSAFE: 4,
  DANGEROUS: 5
};

const evidenceTierRules: Array<[RegExp, EvidenceTierV2]> = [
  [/direct|trial|randomized|controlled human|human data/i, 'direct_human_data'],
  [/guideline|consensus guideline|toxicology guidelines/i, 'clinical_guideline'],
  [/case report|case series|toxicology case/i, 'case_report_or_series'],
  [/observational|survey|registry|report analysis/i, 'observational_report'],
  [/mechanistic|pharmacology|extrapolat/i, 'mechanistic_inference'],
  [/field guidance|field consensus|retreat protocols|retreat guidance/i, 'field_consensus'],
  [/traditional|ethnographic|precedent/i, 'traditional_use_precedent'],
  [/source-gap|source gap|decidable-by-case-data/i, 'source_gap']
];

const mechanismKeywordRules: Array<{ category: MechanismCategoryV2; patterns: RegExp[] }> = [
  { category: 'maoi_potentiation', patterns: [/\bmao\b/i, /\bmaoi\b/i, /harmala/i, /harmine/i, /harmaline/i] },
  { category: 'serotonergic_toxicity', patterns: [/serotonin syndrome/i, /serotonergic crisis/i, /\bssri\b/i, /\bsnri\b/i, /5-ht/i] },
  { category: 'cardiovascular_load', patterns: [/blood pressure/i, /heart rate/i, /cardiovascular/i, /tachycardia/i, /hypertension/i] },
  { category: 'hemodynamic_interaction', patterns: [/hemodynamic/i, /blood pressure/i, /heart rate/i] },
  { category: 'sympathomimetic_load', patterns: [/stimulant/i, /amphetamine/i, /cocaine/i, /methylphenidate/i, /catecholamine/i] },
  { category: 'seizure_threshold', patterns: [/seizure/i, /seizure threshold/i, /lithium/i, /bupropion/i] },
  { category: 'anticholinergic_delirium', patterns: [/anticholinergic/i, /atropine/i, /scopolamine/i, /hyoscyamine/i, /delirium/i] },
  { category: 'glutamatergic_dissociation', patterns: [/dissociation/i] },
  { category: 'glutamate_modulation', patterns: [/\bnmda\b/i, /glutamate modulation/i, /ketamine/i] },
  { category: 'gabaergic_modulation', patterns: [/benzodiazepine/i, /\bgaba\b/i] },
  { category: 'dehydration_or_electrolyte_risk', patterns: [/dehydration/i, /electrolyte/i, /vomiting/i, /diarrhea/i, /purge/i] },
  { category: 'psychiatric_destabilization', patterns: [/panic/i, /psychosis/i, /mania/i, /destabilization/i] },
  { category: 'pharmacodynamic_cns_depression', patterns: [/cns depressant/i, /sedation/i, /respiratory depression/i] },
  { category: 'noradrenergic_suppression', patterns: [/alpha-2/i, /alpha 2/i, /sympathetic outflow/i] },
  { category: 'ion_channel_modulation', patterns: [/ion channel/i, /sodium-channel/i, /sodium channel/i] },
  {
    category: 'operational_or_behavioral_risk',
    patterns: [/falls/i, /aspiration/i, /behavioral disorganization/i, /operational risk/i]
  }
];

const mechanismCategorySet = new Set<MechanismCategoryV2>(MECHANISM_CATEGORIES_V2);

const classicPsychedelicIds = new Set([
  'ayahuasca',
  'psilocybin',
  'nn_dmt',
  'five_meo_dmt',
  'mescaline_peyote',
  'yopo',
  'lsd'
]);

const serotonergicPartnerIds = new Set([
  'ssri',
  'snri',
  'tricyclic_ad',
  'maoi_pharma',
  'atypical_ad',
  'serotonergic_opioids',
  'mdma',
  'two_c_x',
  'dox',
  'nbome_series',
  'mdma_2cx_dox_nbome'
]);

const hemodynamicPartnerIds = new Set([
  'antihypertensives',
  'beta_blockers',
  'beta_blockers_ccb',
  'calcium_channel_blockers',
  'clonidine',
  'clonidine_guanfacine',
  'guanfacine'
]);
const stimulantPartnerIds = new Set([
  'amphetamine_stims',
  'methylphenidate',
  'cocaine',
  'ndri_bupropion',
  'mdma',
  'two_c_x',
  'dox',
  'nbome_series',
  'mdma_2cx_dox_nbome'
]);

const seededSourceIds = [
  'alcohol_org_mushrooms_alcohol',
  'alma_2026',
  'avenues_shrooms_alcohol_risks',
  'ayahuasca_pharmacological_interaction_pmc',
  'beta_blockers_statpearls',
  'blossom_cannabis_psychedelic_survey',
  'cannabis_psychedelic_experience_escholarship',
  'cannabis_psychedelic_experience_pmc',
  'cannabis_psychedelic_experience_pubmed',
  'cardiovascular_safety_psychedelic_medicine_2023',
  'choosingtherapy_psilocybin_alcohol',
  'halman_2024',
  'classic_psychedelics_aud_systematic_review_pmc',
  'classic_psychedelics_aud_systematic_review_pubmed',
  'entheogen_2026',
  'frontiers_low_dose_psilocybin_ketamine_motivation',
  'healthline_mushrooms_cannabis_interaction',
  'human_heart_hallucinogenic_drugs_2024',
  'ketamine_maoi_augmentation_safety_pubmed',
  'ketamine_maoi_concurrent_use_pmc',
  'ketamine_norepinephrine_pmc',
  'ketamine_psychiatric_medication_interactions_ijnp',
  'ketamine_serotonergic_psychedelics_common_mechanisms_ijnp',
  'ketamine_serotonergic_psychedelics_common_mechanisms_pmc',
  'leafwell_lsd_weed',
  'lucy_in_the_sky_with_ketamine_pmc',
  'malcolm_2023',
  'muse_lsd_marijuana_risks',
  'not_available',
  'overview_psilocybin_lsd_mdma_ketamine_2025',
  'psilocybin_clinicians_guide_interactions',
  'psilocybin_ketamine_neurotransmitters_pmc',
  'psilocybin_ssri_interaction_chart',
  'psychiatric_times_cannabis_psychedelics_memory',
  'recovered_psilocybin_other_drugs',
  'source_gap',
  'whitesands_shrooms_alcohol_risks'
] as const;

const deriveMechanismCategoriesFromPair = (a: string, b: string, textCategories: string[]): MechanismCategoryV2[] => {
  const ids = [a, b];
  const normalizedTextCategories = textCategories
    .map((category) => (mechanismCategorySet.has(category as MechanismCategoryV2) ? (category as MechanismCategoryV2) : null))
    .filter((category): category is MechanismCategoryV2 => Boolean(category));
  if (normalizedTextCategories.length) {
    return normalizedTextCategories;
  }

  if (ids.includes('salvia') && ids.some((id) => classicPsychedelicIds.has(id))) {
    return ['operational_or_behavioral_risk', 'psychiatric_destabilization'];
  }

  if (ids.includes('ayahuasca') && ids.includes('five_meo_dmt')) {
    return ['maoi_potentiation', 'serotonergic_toxicity', 'psychedelic_intensification'];
  }

  if (ids.filter((id) => classicPsychedelicIds.has(id)).length > 1) {
    return ['psychedelic_intensification', 'serotonergic_toxicity'];
  }

  if (ids.some((id) => classicPsychedelicIds.has(id)) && ids.some((id) => serotonergicPartnerIds.has(id))) {
    return ['serotonergic_toxicity', 'psychedelic_intensification', 'cardiovascular_load'];
  }

  if (ids.some((id) => classicPsychedelicIds.has(id)) && ids.some((id) => stimulantPartnerIds.has(id))) {
    return ['sympathomimetic_load', 'cardiovascular_load', 'psychiatric_destabilization'];
  }

  if (ids.some((id) => classicPsychedelicIds.has(id)) && ids.some((id) => hemodynamicPartnerIds.has(id))) {
    return ['hemodynamic_interaction', 'cardiovascular_load'];
  }

  if (ids.some((id) => classicPsychedelicIds.has(id)) && ids.some((id) => id === 'ketamine')) {
    return ['glutamate_modulation', 'psychedelic_intensification', 'operational_or_behavioral_risk'];
  }

  return ['psychiatric_destabilization', 'operational_or_behavioral_risk'];
};

const titleFromSourceId = (sourceId: string): string =>
  sourceId
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

const canonicalPairKey = (a: string, b: string): string => [a, b].sort().join('|');

const toEvidenceTier = (value: string | null): EvidenceTierV2 => {
  if (!value) return 'not_applicable';
  if (value === 'theoretical' || value === 'low') return value;
  for (const [regex, mapped] of evidenceTierRules) {
    if (regex.test(value)) return mapped;
  }
  return 'mechanistic_inference';
};

const toSupportType = (tier: EvidenceTierV2): EvidenceSupportType => {
  if (tier === 'direct_human_data' || tier === 'clinical_guideline') return 'direct';
  if (tier === 'case_report_or_series' || tier === 'observational_report') return 'indirect';
  if (tier === 'mechanistic_inference' || tier === 'theoretical' || tier === 'low') return 'mechanistic';
  if (tier === 'field_consensus') return 'field_observation';
  if (tier === 'traditional_use_precedent') return 'traditional_context';
  if (tier === 'source_gap') return 'none';
  return 'none';
};

const toStatus = (code: InteractionCodeV2, confidence: ConfidenceLevel, origin: DerivationType, evidenceTier: EvidenceTierV2): InteractionStatus => {
  if (code === 'SELF') return 'not_applicable';
  if (code === 'INFERRED') return 'inferred';
  if (code === 'UNKNOWN') return 'unknown';
  if (confidence === 'low') return 'low_confidence';
  if (evidenceTier === 'source_gap' || evidenceTier === 'not_applicable') return 'missing_evidence';
  if (origin === 'explicit_source') return 'confirmed';
  return 'inferred';
};

const toConfidence = (value: string | null): ConfidenceLevel => {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  if (value === 'n/a') return 'not_applicable';
  return 'none';
};

const inferMechanismCategories = (input: string): MechanismCategoryV2[] => {
  const matches = new Set<MechanismCategoryV2>();
  for (const rule of mechanismKeywordRules) {
    if (rule.patterns.some((pattern) => pattern.test(input))) {
      matches.add(rule.category);
    }
  }
  return matches.size ? Array.from(matches) : ['unknown'];
};

const toSourceKind = (sourceId: string): SourceKind => {
  if (sourceId === 'source_gap') return 'generated_placeholder';
  if (sourceId.includes('research_update')) return 'internal_research_update';
  if (sourceId.includes('guidance') || sourceId.includes('consensus')) return 'field_guidance';
  if (sourceId.includes('interaction') || sourceId.includes('pdf') || sourceId.includes('study')) return 'primary_source';
  return 'secondary_source';
};

const deriveReviewNotes = (params: {
  evidenceStatus: string;
  reviewState: string;
  provenanceSource: string;
  sourceRefIds: string[];
  summary: string;
  fieldNotes?: string | null;
  evidenceGaps?: string | null;
  code: InteractionCodeV2;
}): string => {
  if (params.evidenceStatus === 'not_reviewed') {
    return params.provenanceSource === 'generated_unknown' || params.sourceRefIds.includes('source_gap')
      ? 'Generated placeholder or source gap; not yet reviewed.'
      : 'Record has not been curated yet.';
  }

  if (params.evidenceStatus === 'no_data') {
    return 'Reviewed record with no usable direct or indirect evidence.';
  }

  if (params.evidenceStatus === 'conflicting_evidence') {
    return 'Evidence summaries indicate disagreement or mixed findings.';
  }

  if (params.evidenceStatus === 'mechanistic_inference' || params.code === 'THEORETICAL') {
    return 'Mechanistic inference without direct clinical evidence.';
  }

  if (params.evidenceStatus === 'supported') {
    return 'Direct or high-confidence evidence supports this interaction.';
  }

  if (params.reviewState === 'requires_review') {
    return 'Ambiguous evidence requires human review.';
  }

  if (params.summary || params.fieldNotes || params.evidenceGaps) {
    return 'Epistemic state inferred from existing record metadata.';
  }

  return 'Epistemic state assigned from migration heuristics.';
};

const run = async (): Promise<void> => {
  bootstrapDrugDatasetFromRepo();
  const raw = await readFile(pairsV1Path, 'utf8');
  const pairsV1 = JSON.parse(raw) as InteractionPairV1[];

  const aggregateNodeIds = ['clonidine_guanfacine', 'beta_blockers_ccb'] as const;
  const aggregateChildIds = aggregateNodeIds.flatMap((id) => splitAggregateNode(id));
  const allIds = Array.from(
    new Set([
      ...getDRUGS().map((row) => row.id),
      ...pairsV1.flatMap((row) => [row.substance_a_id, row.substance_b_id]),
      ...aggregateChildIds
    ])
  ).sort();
  const drugById = new Map(getDRUGS().map((row) => [row.id, row] as const));

  const substances = allIds.map((id) => {
    const drug = drugById.get(id);
    return {
      id,
      name: drug?.name ?? id,
      class: drug?.class,
      mechanism_tag: drug?.mechanismTag,
      notes: drug?.notes,
      deprecated: drug?.deprecated,
      superseded_by: drug?.supersededBy
    };
  });

  const sourceFingerprintById = new Map<string, string>();
  const discoveredSources = new Set<string>(seededSourceIds);
  const pairRecords: InteractionPairV2[] = [];
  const seenActivePairKeys = new Set<string>();

  const registerSources = (row: InteractionPairV1, sourceRefIds: string[]) => {
    for (const sourceId of sourceRefIds) {
      discoveredSources.add(sourceId);
      if (!sourceFingerprintById.has(sourceId) && row.source_fingerprint) {
        sourceFingerprintById.set(sourceId, row.source_fingerprint);
      }
    }
  };

  const buildPairRecord = (
    row: InteractionPairV1,
    substanceA: string,
    substanceB: string,
    options: {
      provenanceSource?: InteractionPairV2['provenance']['source'];
      provenanceMethod?: string;
      parentNode?: string;
      parentNodes?: string[];
      deprecated?: boolean;
    } = {}
  ): InteractionPairV2 => {
    const key = canonicalPairKey(substanceA, substanceB);
    const resolved = resolveInteraction(substanceA, substanceB);
    const evidence = resolved.evidence;
    const confidence = toConfidence(evidence.confidence);
    let evidenceTier = toEvidenceTier(evidence.evidenceTier ?? row.evidence_tier);
    let code: InteractionCodeV2 =
      evidence.code === 'SELF'
        ? 'SELF'
        : evidence.code === 'INFERRED'
          ? 'INFERRED'
          : evidence.code === 'THEORETICAL'
            ? 'THEORETICAL'
            : (codeMap[evidence.code] ?? 'UNKNOWN');
    if (code === 'UNKNOWN' && substanceA !== substanceB) {
      code = 'INFERRED';
    }
    if (code === 'THEORETICAL') {
      evidenceTier = 'theoretical';
    } else if (code === 'INFERRED' && evidenceTier === 'not_applicable') {
      evidenceTier = 'mechanistic_inference';
    }
    const mechanismScanText = [
      evidence.mechanism,
      evidence.summary,
      evidence.evidenceTier,
      evidence.fieldNotes,
      evidence.riskAssessment?.rationale,
      evidence.provenance?.rationale
    ]
      .filter(Boolean)
      .join('\n');
    const inferredCategories = Array.from(
      new Set(
        deriveMechanismCategoriesFromPair(
          substanceA,
          substanceB,
          [
            ...(evidence.mechanismCategory ? [evidence.mechanismCategory] : []),
            ...(evidence.mechanismCategories ?? []),
            ...inferMechanismCategories(mechanismScanText)
          ]
        )
      )
    );
    const cleanedCategories = inferredCategories.filter((category) => category !== 'unknown');
    if (!cleanedCategories.length && code !== 'SELF') {
      cleanedCategories.push(code === 'THEORETICAL' ? 'psychiatric_destabilization' : 'psychiatric_destabilization');
    }
    const primaryCategory = cleanedCategories[0] ?? 'unknown';
    const sourceRefIds = (row.source_refs ?? []).filter(Boolean);
    const existingSourceRefs = sourceRefIds.map((source_id) => ({ source_id }));

    registerSources(row, sourceRefIds.length ? sourceRefIds : ['source_gap']);

    const inferredOrTheoreticalSource =
      code === 'INFERRED'
        ? 'heuristic_fallback'
        : code === 'THEORETICAL'
          ? 'mechanistic_inference'
          : undefined;
    const provenanceSource =
      options.provenanceSource ??
      inferredOrTheoreticalSource ??
      evidence.provenance?.source ??
      (resolved.origin === 'self'
        ? 'self_pair'
        : code === 'THEORETICAL'
          ? 'mechanistic_inference'
          : resolved.origin === 'explicit'
            ? 'deterministic_mapping_table'
            : 'heuristic_fallback');
    const provenanceSourceText = provenanceSource as string;
    const provenanceConfidenceTier =
      evidence.provenance?.confidenceTier ??
      (resolved.origin === 'self'
        ? 'low'
        : confidence === 'high'
          ? 'high'
          : confidence === 'medium'
            ? 'medium'
            : 'low');
    const derivationType: DerivationType =
      options.provenanceSource === 'decomposition'
        ? 'decomposition'
        : resolved.origin === 'self'
          ? 'self_pair'
          : code === 'INFERRED'
            ? 'fallback_rule'
          : code === 'THEORETICAL'
            ? 'curated_inference'
            : resolved.origin === 'explicit'
              ? 'explicit_source'
              : 'fallback_rule';
    const status = toStatus(code, confidence, derivationType, evidenceTier);
    const riskScore =
      code === 'SELF'
        ? -1
        : code === 'INFERRED'
          ? null
          : code === 'DETERMINISTIC'
            ? evidence.riskAssessment?.level === 'high'
              ? 8
              : 5
          : code === 'THEORETICAL'
            ? 2
            : (riskByCode[code] ?? null);

    const validationFlags = new Set<ValidationFlagV2>();
    if (code !== 'SELF') {
      if (!evidence.timing && !row.timing) validationFlags.add('missing_timing');
      if (!sourceRefIds.length) validationFlags.add('missing_source');
      if (confidence === 'low') validationFlags.add('low_confidence');
      if (sourceRefIds.includes('source_gap')) {
        validationFlags.add('source_gap');
        validationFlags.add('source_gap_unresolved');
      }
      if (code === 'THEORETICAL') validationFlags.add('theoretical_interaction');
      if (code === 'INFERRED') validationFlags.add('inferred_mechanism_added');
    }
    if (options.deprecated) validationFlags.add('override_applied');

    const sourceRefs = existingSourceRefs.map((ref) => ({
      ...ref,
      support_type: toSupportType(evidenceTier)
    }));
    const isGeneratedPlaceholder = provenanceSourceText === 'generated_unknown' || sourceRefIds.includes('source_gap');
    const conflictingEvidence =
      isConflictingEvidenceText(evidence.summary) ||
      isConflictingEvidenceText(evidence.fieldNotes) ||
      isConflictingEvidenceText(evidence.evidenceGaps) ||
      isConflictingEvidenceText(row.rationale) ||
      isConflictingEvidenceText(row.sources);
    const reviewState = inferReviewState({
      provenanceSource,
      sourceRefs: sourceRefIds,
      supportType: toSupportType(evidenceTier),
      evidenceTier,
      confidence,
      code,
      reviewed:
        !isGeneratedPlaceholder &&
        provenanceSourceText !== 'generated_unknown' &&
        provenanceSource !== 'self_pair',
      summary: evidence.summary,
      fieldNotes: evidence.fieldNotes,
      evidenceGaps: evidence.evidenceGaps,
      mechanism: evidence.mechanism ?? row.mechanism,
      explicitDeterministic: provenanceSource === 'deterministic_mapping_table' || derivationType === 'explicit_source',
      isTheoretical: code === 'THEORETICAL' || evidenceTier === 'theoretical' || provenanceSource === 'mechanistic_inference',
      isConflicting: conflictingEvidence,
      isGeneratedPlaceholder,
      deprecated: options.deprecated
    });
    const evidenceStatus = inferEvidenceStatus({
      provenanceSource: provenanceSourceText,
      sourceRefs: sourceRefIds,
      supportType: toSupportType(evidenceTier),
      evidenceTier,
      confidence,
      code,
      reviewed: reviewState !== 'unreviewed',
      reviewState,
      summary: evidence.summary,
      fieldNotes: evidence.fieldNotes,
      evidenceGaps: evidence.evidenceGaps,
      mechanism: evidence.mechanism ?? row.mechanism,
      explicitDeterministic: provenanceSource === 'deterministic_mapping_table' || derivationType === 'explicit_source',
      isTheoretical: code === 'THEORETICAL' || evidenceTier === 'theoretical' || provenanceSource === 'mechanistic_inference',
      isConflicting: conflictingEvidence,
      isGeneratedPlaceholder,
      deprecated: options.deprecated
    });
    const reviewNotes = deriveReviewNotes({
      evidenceStatus,
      reviewState,
      provenanceSource: provenanceSourceText,
      sourceRefIds,
      summary: evidence.summary,
      fieldNotes: evidence.fieldNotes,
      evidenceGaps: evidence.evidenceGaps,
      code
    });
    const groupedValidation = groupValidationFlags(Array.from(validationFlags)) as ValidationFlagsBySeverityV2;
    const auditReviewStatus: 'human_reviewed' | 'needs_review' =
      reviewState === 'human_reviewed' ? 'human_reviewed' : 'needs_review';

    return {
      key,
      substances: [substanceA, substanceB] as [string, string],
      classification: {
        code,
        status,
        confidence,
        risk_score: riskScore,
        label:
          code === 'SELF'
            ? LEGEND.SELF.label
            : evidence.label ?? row.interaction_label ?? (code === 'THEORETICAL' ? LEGEND.THEORETICAL.label : undefined),
        risk_assessment: evidence.riskAssessment
      },
      clinical_summary: {
        headline: evidence.summary,
        mechanism: evidence.mechanism ?? row.mechanism,
        timing_guidance: evidence.timing ?? row.timing,
        field_notes: evidence.fieldNotes ?? row.field_notes
      },
      mechanism: {
        primary_category: primaryCategory,
        categories: Array.from(new Set(cleanedCategories.length ? cleanedCategories : inferredCategories)) as MechanismCategoryV2[]
      },
      evidence: {
        tier: evidenceTier,
        support_type: toSupportType(evidenceTier),
        source_refs: sourceRefs,
        status: evidenceStatus,
        review_state: reviewState,
        review_notes: reviewNotes,
        evidence_gaps: evidence.evidenceGaps ?? row.evidence_gaps
      },
      source_text: row.sources ?? evidence.sources,
      source_fingerprint: row.source_fingerprint,
      provenance: {
        derivation_type: derivationType,
        origin_value_v1: row.origin,
        source: provenanceSource,
        confidence_tier: provenanceConfidenceTier,
        method: options.provenanceMethod ?? evidence.provenance?.method,
        rationale: evidence.provenance?.rationale ?? row.rationale,
        parent_node: options.parentNode,
        parent_nodes: options.parentNodes,
        deprecated: options.deprecated ? true : undefined,
        migrated_from_v1: true as const,
        migration_version: 'v1_to_v2' as const,
        migrated_at: new Date().toISOString()
      },
      override_metadata: {
        applied: false
      },
      audit: {
        validation_flags: Array.from(validationFlags),
        review_status: auditReviewStatus
      },
      validation: {
        flags: groupedValidation
      }
    };
  };

  const pushPairRecord = (record: InteractionPairV2, active: boolean) => {
    if (active) {
      if (seenActivePairKeys.has(record.key)) return;
      seenActivePairKeys.add(record.key);
    }
    pairRecords.push(record);
  };

  for (const row of pairsV1) {
    const aggregateIds = [row.substance_a_id, row.substance_b_id].filter(isAggregateNodeId);
    const isAggregateRow = aggregateIds.length > 0;

    if (isAggregateRow) {
      const originalRecord = buildPairRecord(row, row.substance_a_id, row.substance_b_id, {
        provenanceSource: 'decomposition',
        provenanceMethod: 'aggregate_node_split_v1',
        parentNode: aggregateIds.length === 1 ? aggregateIds[0] : undefined,
        parentNodes: aggregateIds.length > 1 ? aggregateIds : undefined,
        deprecated: true
      });
      pushPairRecord(originalRecord, false);

      const expandedPairs =
        row.substance_a_id === row.substance_b_id && isAggregateNodeId(row.substance_a_id)
          ? splitAggregateNode(row.substance_a_id).map((id) => [id, id] as [string, string])
          : splitAggregatePair(row.substance_a_id, row.substance_b_id);
      for (const [left, right] of expandedPairs) {
        const childAggregateIds = [left, right].filter(isAggregateNodeId);
        const childRecord = buildPairRecord(row, left, right, {
          provenanceSource: 'decomposition',
          provenanceMethod: 'aggregate_node_split_v1',
          parentNode: childAggregateIds.length === 1 ? childAggregateIds[0] : undefined,
          parentNodes: childAggregateIds.length > 1 ? childAggregateIds : aggregateIds,
          deprecated: false
        });
        pushPairRecord(childRecord, true);
      }
      continue;
    }

    const activeRecord = buildPairRecord(row, row.substance_a_id, row.substance_b_id);
    pushPairRecord(activeRecord, true);
  }

  // Preserve source text fallback semantics by adding source IDs parsed from source text when refs are absent.
  for (const pair of pairRecords) {
    if (!pair.evidence.source_refs.length && pair.source_text) {
      const tokens = pair.source_text
        .split(/[;,]/)
        .map((token) => token.trim())
        .filter(Boolean);
      for (const token of tokens) {
        const fallbackId = token
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        if (!fallbackId) continue;
        pair.evidence.source_refs.push({ source_id: fallbackId, support_type: pair.evidence.support_type });
        discoveredSources.add(fallbackId);
      }
    }
  }

  const sources = Array.from(discoveredSources)
    .sort()
    .map((id) => ({
      id,
      title: titleFromSourceId(id),
      source_type: toSourceKind(id),
      reliability: 'unknown' as const,
      fingerprint: sourceFingerprintById.get(id)
    }));

  const sourceLibrary = sources;
  for (const pair of pairRecords) {
    const linkedSources = linkSourceRefsForPair({
      substanceA: pair.substances[0],
      substanceB: pair.substances[1],
      mechanismCategories: pair.mechanism.categories,
      code: pair.classification.code,
      reviewState: pair.evidence.review_state,
      sourceText: pair.source_text,
      existingSourceRefs: pair.evidence.source_refs,
      sourceLibrary
    });

    pair.evidence.source_refs = linkedSources.sourceRefs;
    pair.evidence.support_type = linkedSources.supportType;
    pair.evidence.evidence_strength = linkedSources.evidenceStrength;
    pair.evidence.status = linkedSources.evidenceStatus;
    pair.provenance.source_linking_method = linkedSources.sourceLinkingMethod;
    pair.provenance.source_linking_confidence = linkedSources.sourceLinkingConfidence;
    if (!linkedSources.unresolved && pair.evidence.review_state === 'unreviewed') {
      pair.evidence.review_state = 'machine_inferred';
      pair.evidence.review_notes = pair.evidence.review_notes ?? 'Source-linked from the existing curated library.';
    }

    const validationFlags = new Set(pair.audit.validation_flags);
    validationFlags.delete('missing_source');
    validationFlags.delete('source_gap');
    validationFlags.delete('source_gap_unresolved');
    if (linkedSources.unresolved) {
      validationFlags.add('source_gap');
      validationFlags.add('source_gap_unresolved');
    }
    pair.audit.validation_flags = Array.from(validationFlags);
    pair.audit.review_status = pair.evidence.review_state === 'human_reviewed' ? 'human_reviewed' : 'needs_review';
    pair.validation = {
      flags: groupValidationFlags(pair.audit.validation_flags) as ValidationFlagsBySeverityV2
    };
  }

  const dataset: InteractionDatasetV2 = {
    schema_version: 'v2',
    generated_at: new Date().toISOString(),
    substances,
    pairs: pairRecords,
    sources
  };

  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  console.log(`Migrated ${pairRecords.length} interactions to ${path.relative(root, outputPath)}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

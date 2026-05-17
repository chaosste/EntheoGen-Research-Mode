import { getAppDatasetRegistry } from './datasetRegistry';
import type {
  EvidenceStatusV2,
  EvidenceStrengthV2,
  EvidenceSupportType,
  InteractionCodeV2,
  SourceClaimRefV2,
  SourceMatchTypeV2,
  SourceV2
} from './interactionSchemaV2';

export interface SourceLinkingContext {
  substanceA: string;
  substanceB: string;
  mechanismCategories: string[];
  code: InteractionCodeV2;
  reviewState?: 'unreviewed' | 'machine_inferred' | 'human_reviewed' | 'requires_review' | 'needs_verification';
  sourceText?: string | null;
  existingSourceRefs: SourceClaimRefV2[];
  sourceLibrary: SourceV2[];
}

export interface SourceLinkingResult {
  sourceRefs: SourceClaimRefV2[];
  matchType: SourceMatchTypeV2;
  evidenceStrength: EvidenceStrengthV2;
  supportType: EvidenceSupportType;
  evidenceStatus: EvidenceStatusV2;
  sourceLinkingConfidence: 'high' | 'medium' | 'low';
  sourceLinkingMethod: 'source_linking_pipeline_v1';
  unresolved: boolean;
}

const PLACEHOLDER_SOURCE_IDS = new Set(['source_gap', 'not_available']);

const CLASSIC_PSYCHEDELICS = new Set(['ayahuasca', 'psilocybin', 'nn_dmt', 'five_meo_dmt', 'mescaline_peyote', 'yopo', 'lsd']);
const SEDATIVE_OR_MEDICATION_CLASSES = new Set([
  'ssri',
  'snri',
  'tricyclic_ad',
  'maoi_pharma',
  'atypical_ad',
  'ndri_bupropion',
  'amphetamine_stims',
  'methylphenidate',
  'cocaine',
  'mdma',
  'two_c_x',
  'dox',
  'nbome_series',
  'mdma_2cx_dox_nbome',
  'serotonergic_opioids',
  'antipsychotics',
  'antihypertensives',
  'benzodiazepines',
  'lithium',
  'lamotrigine',
  'clonidine',
  'guanfacine',
  'beta_blockers',
  'calcium_channel_blockers',
  'ketamine'
]);

const normalize = (value?: string | null): string => (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

const hasAny = (set: Set<string>, values: string[]): boolean => values.some((value) => set.has(value));

const sourceById = (sources: SourceV2[]): Map<string, SourceV2> => new Map(sources.map((source) => [source.id, source] as const));

const pairContext = (substanceA: string, substanceB: string) => {
  const drugById = getAppDatasetRegistry().drugById;
  const a = drugById.get(substanceA);
  const b = drugById.get(substanceB);
  const ids = [substanceA, substanceB];
  const classes = [a?.class, b?.class].filter(Boolean).map((value) => normalize(value));
  const mechanisms = [a?.mechanismTag, b?.mechanismTag].filter(Boolean).map((value) => normalize(value));
  const notes = [a?.notes, b?.notes].filter(Boolean).map((value) => normalize(value));
  const tokens = new Set([
    ...ids.map((id) => normalize(id)),
    ...classes,
    ...mechanisms,
    ...notes,
    ...ids.flatMap((id) => {
      const drug = drugById.get(id);
      return drug
        ? [normalize(drug.name), normalize(drug.class), normalize(drug.mechanismTag), normalize(drug.notes)]
        : [];
    })
  ]);
  const isClassicPsychedelic = hasAny(new Set(ids), [...CLASSIC_PSYCHEDELICS]);
  const isAyahuasca = ids.includes('ayahuasca');
  const isPsilocybin = ids.includes('psilocybin');
  const isKetamine = ids.includes('ketamine');
  const isCannabis = ids.includes('cannabis');
  const isCardio = hasAny(new Set(ids), [
    'beta_blockers',
    'calcium_channel_blockers',
    'clonidine',
    'guanfacine',
    'antihypertensives'
  ]);
  const isSedativeOrMed = hasAny(new Set(ids), [...SEDATIVE_OR_MEDICATION_CLASSES]);

  return {
    a,
    b,
    ids,
    classes,
    mechanisms,
    notes,
    tokens,
    isClassicPsychedelic,
    isAyahuasca,
    isPsilocybin,
    isKetamine,
    isCannabis,
    isCardio,
    isSedativeOrMed
  };
};

const buildRef = (
  source: SourceV2,
  matchType: SourceMatchTypeV2,
  evidenceStrength: EvidenceStrengthV2,
  relevanceScore: number,
  notes: string
): SourceClaimRefV2 => ({
  id: source.id,
  source_id: source.id,
  title: source.title,
  source_type: source.source_type,
  match_type: matchType,
  relevance_score: relevanceScore,
  evidence_strength: evidenceStrength,
  notes,
  support_type:
    matchType === 'direct_pair'
      ? 'direct_literature'
      : matchType === 'single_agent'
        ? 'class_level_literature'
        : matchType === 'drug_class'
          ? 'class_level_literature'
          : matchType === 'mechanism'
            ? 'mechanistic_literature'
            : matchType === 'adjacent_domain'
              ? 'adjacent_domain_literature'
              : 'none'
});

const evidenceStrengthForMatch = (matchType: SourceMatchTypeV2, sourceId: string): EvidenceStrengthV2 => {
  if (matchType === 'source_gap') return 'none';
  if (sourceId === 'psilocybin_ssri_interaction_chart') return 'strong';
  if (matchType === 'direct_pair') return 'moderate';
  if (matchType === 'single_agent') return 'moderate';
  if (matchType === 'drug_class') return 'weak';
  if (matchType === 'mechanism') return 'theoretical';
  return 'weak';
};

const relevanceScoreForMatch = (matchType: SourceMatchTypeV2, sourceId: string): number => {
  if (sourceId === 'psilocybin_ssri_interaction_chart') return 0.99;
  if (matchType === 'direct_pair') return 0.94;
  if (matchType === 'single_agent') return 0.8;
  if (matchType === 'drug_class') return 0.68;
  if (matchType === 'mechanism') return 0.52;
  if (matchType === 'adjacent_domain') return 0.34;
  return 0;
};

const classifyDirectOrClassSource = (sourceId: string, ctx: ReturnType<typeof pairContext>): SourceMatchTypeV2 | null => {
  if (sourceId === 'source_gap' || sourceId === 'not_available') return null;

  if (sourceId === 'psilocybin_ssri_interaction_chart' && ctx.isPsilocybin && ctx.ids.includes('ssri')) {
    return 'direct_pair';
  }
  if (sourceId === 'healthline_mushrooms_cannabis_interaction' && ctx.isPsilocybin && ctx.isCannabis) {
    return 'direct_pair';
  }
  if (sourceId === 'choosingtherapy_psilocybin_alcohol' && ctx.isPsilocybin && ctx.ids.includes('alcohol')) {
    return 'direct_pair';
  }
  if (sourceId === 'avenues_shrooms_alcohol_risks' && ctx.isPsilocybin && ctx.ids.includes('alcohol')) {
    return 'direct_pair';
  }
  if (sourceId === 'alcohol_org_mushrooms_alcohol' && ctx.isPsilocybin && ctx.ids.includes('alcohol')) {
    return 'direct_pair';
  }
  if (sourceId === 'alma_ayahuasca_medication_interactions_2025' && ctx.isAyahuasca && ctx.isSedativeOrMed) {
    return 'direct_pair';
  }
  if (sourceId === 'malcolm_ayahuasca_drug_interaction_2022' && ctx.isAyahuasca) {
    return 'direct_pair';
  }
  if (sourceId === 'ayahuasca_pharmacological_interaction_pmc' && ctx.isAyahuasca) {
    return 'direct_pair';
  }
  if (sourceId === 'ketamine_psychiatric_medication_interactions_ijnp' && ctx.isKetamine && ctx.isSedativeOrMed) {
    return 'direct_pair';
  }
  if (sourceId === 'ketamine_maoi_concurrent_use_pmc' && ctx.isKetamine && ctx.ids.includes('maoi_pharma')) {
    return 'direct_pair';
  }
  if (sourceId === 'ketamine_maoi_augmentation_safety_pubmed' && ctx.isKetamine && ctx.ids.includes('maoi_pharma')) {
    return 'direct_pair';
  }
  if (sourceId === 'cannabis_psychedelic_experience_pubmed' && ctx.isCannabis) {
    return 'direct_pair';
  }
  if (sourceId === 'cannabis_psychedelic_experience_pmc' && ctx.isCannabis) {
    return 'direct_pair';
  }
  if (sourceId === 'cannabis_psychedelic_experience_escholarship' && ctx.isCannabis) {
    return 'direct_pair';
  }

  if (sourceId === 'beta_blockers_statpearls' && ctx.ids.includes('beta_blockers')) {
    return 'single_agent';
  }
  if (sourceId === 'psilocybin_clinicians_guide_interactions' && ctx.isPsilocybin) {
    return 'single_agent';
  }

  if (sourceId === 'classic_psychedelic_ddi_review_2024' && ctx.isClassicPsychedelic) {
    return 'drug_class';
  }
  if (
    (sourceId === 'classic_psychedelics_aud_systematic_review_pmc' ||
      sourceId === 'classic_psychedelics_aud_systematic_review_pubmed') &&
    ctx.isClassicPsychedelic
  ) {
    return 'drug_class';
  }
  if (sourceId === 'recovered_psilocybin_other_drugs' && ctx.isPsilocybin) {
    return 'drug_class';
  }
  if (sourceId === 'psilocybin_clinicians_guide_interactions' && ctx.isPsilocybin) {
    return 'drug_class';
  }

  if (sourceId === 'cardiovascular_safety_psychedelic_medicine_2023' && (ctx.isCardio || ctx.isClassicPsychedelic || ctx.isKetamine)) {
    return 'mechanism';
  }
  if (sourceId === 'human_heart_hallucinogenic_drugs_2024' && (ctx.isCardio || ctx.isClassicPsychedelic || ctx.isKetamine)) {
    return 'mechanism';
  }
  if (sourceId === 'ketamine_norepinephrine_pmc' && ctx.isKetamine) {
    return 'mechanism';
  }
  if (
    sourceId === 'ketamine_serotonergic_psychedelics_common_mechanisms_pmc' ||
    sourceId === 'ketamine_serotonergic_psychedelics_common_mechanisms_ijnp'
  ) {
    return ctx.isKetamine && ctx.isClassicPsychedelic ? 'mechanism' : null;
  }
  if (sourceId === 'frontiers_low_dose_psilocybin_ketamine_motivation' && ctx.isKetamine) {
    return 'adjacent_domain';
  }

  if (
    sourceId === 'overview_psilocybin_lsd_mdma_ketamine_2025' ||
    sourceId === 'entheogen_interactions_research_update' ||
    sourceId === 'psychiatric_times_cannabis_psychedelics_memory' ||
    sourceId === 'blossom_cannabis_psychedelic_survey' ||
    sourceId === 'leafwell_lsd_weed' ||
    sourceId === 'muse_lsd_marijuana_risks' ||
    sourceId === 'healthline_mushrooms_cannabis_interaction'
  ) {
    return 'adjacent_domain';
  }

  return null;
};

const chooseFallbackSource = (ctx: ReturnType<typeof pairContext>): { sourceId: string; matchType: SourceMatchTypeV2 } => {
  if (ctx.isAyahuasca) {
    return {
      sourceId: ctx.isSedativeOrMed ? 'alma_ayahuasca_medication_interactions_2025' : 'ayahuasca_pharmacological_interaction_pmc',
      matchType: 'direct_pair'
    };
  }

  if (ctx.isPsilocybin) {
    if (ctx.ids.includes('ssri')) return { sourceId: 'psilocybin_ssri_interaction_chart', matchType: 'direct_pair' };
    if (ctx.isCannabis) return { sourceId: 'healthline_mushrooms_cannabis_interaction', matchType: 'direct_pair' };
    if (ctx.ids.includes('alcohol')) return { sourceId: 'choosingtherapy_psilocybin_alcohol', matchType: 'direct_pair' };
    if (ctx.ids.includes('ketamine')) return { sourceId: 'frontiers_low_dose_psilocybin_ketamine_motivation', matchType: 'adjacent_domain' };
    if (ctx.isSedativeOrMed) return { sourceId: 'psilocybin_clinicians_guide_interactions', matchType: 'single_agent' };
    return { sourceId: 'classic_psychedelic_ddi_review_2024', matchType: 'drug_class' };
  }

  if (ctx.isKetamine) {
    if (ctx.ids.includes('maoi_pharma') || ctx.isAyahuasca) {
      return { sourceId: 'ketamine_maoi_concurrent_use_pmc', matchType: 'direct_pair' };
    }
    if (ctx.isSedativeOrMed) {
      return { sourceId: 'ketamine_psychiatric_medication_interactions_ijnp', matchType: 'direct_pair' };
    }
    if (ctx.isClassicPsychedelic) {
      return { sourceId: 'ketamine_serotonergic_psychedelics_common_mechanisms_pmc', matchType: 'mechanism' };
    }
    return { sourceId: 'lucy_in_the_sky_with_ketamine_pmc', matchType: 'adjacent_domain' };
  }

  if (ctx.isCannabis) {
    if (ctx.isClassicPsychedelic) return { sourceId: 'cannabis_psychedelic_experience_pubmed', matchType: 'direct_pair' };
    return { sourceId: 'psychiatric_times_cannabis_psychedelics_memory', matchType: 'adjacent_domain' };
  }

  if (ctx.isCardio) {
    if (ctx.ids.includes('beta_blockers')) return { sourceId: 'beta_blockers_statpearls', matchType: 'single_agent' };
    return { sourceId: 'human_heart_hallucinogenic_drugs_2024', matchType: 'mechanism' };
  }

  if (ctx.isClassicPsychedelic) {
    if (ctx.ids.includes('alcohol')) return { sourceId: 'classic_psychedelics_aud_systematic_review_pmc', matchType: 'drug_class' };
    if (ctx.isSedativeOrMed) return { sourceId: 'classic_psychedelic_ddi_review_2024', matchType: 'drug_class' };
    return { sourceId: 'overview_psilocybin_lsd_mdma_ketamine_2025', matchType: 'adjacent_domain' };
  }

  return { sourceId: 'entheogen_interactions_research_update', matchType: 'adjacent_domain' };
};

const evidenceStatusFromMatch = (
  matchType: SourceMatchTypeV2,
  strength: EvidenceStrengthV2,
  reviewState?: SourceLinkingContext['reviewState']
): EvidenceStatusV2 => {
  if (matchType === 'source_gap') {
    return reviewState === 'unreviewed' ? 'not_reviewed' : 'no_data';
  }
  if (matchType === 'direct_pair') return strength === 'weak' ? 'limited_data' : 'supported';
  if (matchType === 'single_agent' || matchType === 'drug_class') return 'limited_data';
  if (matchType === 'mechanism' || matchType === 'adjacent_domain') return 'mechanistic_inference';
  return 'not_reviewed';
};

const linkingConfidenceFor = (matchType: SourceMatchTypeV2, strength: EvidenceStrengthV2): 'high' | 'medium' | 'low' => {
  if (matchType === 'direct_pair' && (strength === 'strong' || strength === 'moderate')) return 'high';
  if (matchType === 'direct_pair' && strength === 'weak') return 'medium';
  if (matchType === 'single_agent' || matchType === 'drug_class') return 'medium';
  if (matchType === 'mechanism') return 'medium';
  return 'low';
};

const unresolvedPlaceholderRef = (sourceByIdMap: Map<string, SourceV2>): SourceClaimRefV2 => {
  const source = sourceByIdMap.get('source_gap');
  return {
    id: 'source_gap',
    source_id: 'source_gap',
    title: source?.title ?? 'Source Gap',
    source_type: source?.source_type,
    match_type: 'source_gap',
    relevance_score: 0,
    evidence_strength: 'none',
    notes: 'No relevant source matched the existing curated library.',
    support_type: 'none'
  };
};

export const linkSourceRefsForPair = (context: SourceLinkingContext): SourceLinkingResult => {
  const sourceIndex = sourceById(context.sourceLibrary);
  const ctx = pairContext(context.substanceA, context.substanceB);
  const candidateRefs = context.existingSourceRefs
    .filter((ref) => !PLACEHOLDER_SOURCE_IDS.has(ref.source_id))
    .map((ref) => {
      const source = sourceIndex.get(ref.source_id);
      if (!source) return null;
      const matchType = classifyDirectOrClassSource(source.id, ctx);
      if (!matchType) return null;
      const evidenceStrength = evidenceStrengthForMatch(matchType, source.id);
      return buildRef(
        source,
        matchType,
        evidenceStrength,
        relevanceScoreForMatch(matchType, source.id),
        `Preserved curated source ${source.id} and enriched with source-link metadata.`
      );
    })
    .filter((ref): ref is SourceClaimRefV2 => Boolean(ref));

  if (candidateRefs.length > 0) {
    const [primary] = candidateRefs;
    return {
      sourceRefs: candidateRefs,
      matchType: primary.match_type ?? 'adjacent_domain',
      evidenceStrength: primary.evidence_strength ?? 'weak',
      supportType: primary.support_type ?? 'adjacent_domain_literature',
      evidenceStatus: evidenceStatusFromMatch(primary.match_type ?? 'adjacent_domain', primary.evidence_strength ?? 'weak', context.reviewState),
      sourceLinkingConfidence: linkingConfidenceFor(primary.match_type ?? 'adjacent_domain', primary.evidence_strength ?? 'weak'),
      sourceLinkingMethod: 'source_linking_pipeline_v1',
      unresolved: false
    };
  }

  const fallback = chooseFallbackSource(ctx);
  const fallbackSource = sourceIndex.get(fallback.sourceId);
  if (fallbackSource) {
    const evidenceStrength = evidenceStrengthForMatch(fallback.matchType, fallback.sourceId);
    const ref = buildRef(
      fallbackSource,
      fallback.matchType,
      evidenceStrength,
      relevanceScoreForMatch(fallback.matchType, fallback.sourceId),
      `Matched via ${fallback.matchType} source-linking from existing source library.`
    );
    return {
      sourceRefs: [ref],
      matchType: fallback.matchType,
      evidenceStrength,
      supportType: ref.support_type ?? 'none',
      evidenceStatus: evidenceStatusFromMatch(fallback.matchType, evidenceStrength, context.reviewState),
      sourceLinkingConfidence: linkingConfidenceFor(fallback.matchType, evidenceStrength),
      sourceLinkingMethod: 'source_linking_pipeline_v1',
      unresolved: false
    };
  }

  const unresolved = unresolvedPlaceholderRef(sourceIndex);
  return {
    sourceRefs: [unresolved],
    matchType: 'source_gap',
    evidenceStrength: 'none',
    supportType: 'none',
    evidenceStatus: evidenceStatusFromMatch('source_gap', 'none', context.reviewState),
    sourceLinkingConfidence: 'low',
    sourceLinkingMethod: 'source_linking_pipeline_v1',
    unresolved: true
  };
};

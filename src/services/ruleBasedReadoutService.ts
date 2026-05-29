import type { MechanismCategory } from '../data/drugData';
import type { PairCoverageMeta } from '../data/interactionDataset';

export type EvidenceContext = {
  riskScale?: number;
  confidence?: string;
  evidenceTier?: string | null;
  mechanism?: string;
  mechanismCategory?: MechanismCategory;
  mechanismCategoryDisplayLabel?: string;
  mechanismCategoryTags?: string[];
  practicalGuidance?: string;
  timing?: string;
  evidenceGaps?: string;
  fieldNotes?: string;
  isEvidenceBacked?: boolean;
  citationLabels?: string[];
  sourceIds?: string[];
  sourceTitles?: string[];
  chunkRefs?: string[];
  coverage?: PairCoverageMeta;
  evidenceExcerpts?: string;
};

const RISK_ACTIONS: Record<number, string> = {
  5: "Avoid this combination. If recently combined and symptoms appear, seek urgent medical help.",
  4: "Treat as high risk. Avoid outside specialist clinical supervision.",
  3: "Use caution. Risk is meaningful and context-dependent.",
  2: "Low acute physiologic risk, but effect profile may change substantially.",
  1: "Lower-risk profile in current evidence scope, not risk-free.",
  0: "No clear classification in current dataset; treat as unknown.",
  [-1]: "Same entity selected."
};

const SPECIAL_PAIR_NOTES: Record<string, string> = {
  "Ayahuasca|SSRIs":
    "Consensus note: this is treated as contraindicated because MAOI + serotonergic antidepressant combinations can raise risk of serotonin toxicity.",
  "Ayahuasca|SNRIs":
    "Consensus note: MAOI + SNRI combinations are generally treated as contraindicated/high risk in harm-reduction protocols.",
  "Ayahuasca|Pharmaceutical MAOIs":
    "Consensus note: combining MAOI-containing ayahuasca with pharmaceutical MAOIs is considered dangerous.",
  "Ayahuasca|5-MeO-DMT":
    "Consensus note: this pair is explicitly flagged dangerous in the loaded ceremonial dataset."
};

const pairLabel = (a: string, b: string) => [a, b].sort().join("|");

const normalizeConfidence = (value?: string): string | null => {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const nonBlank = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const nonEmptyList = (values?: string[]): string[] =>
  Array.isArray(values) ? values.map((value) => value.trim()).filter(Boolean) : [];

const MECHANISM_FAMILY_TEXT: Partial<Record<MechanismCategory, string>> = {
  serotonergic: 'serotonergic interaction pattern',
  serotonergic_toxicity: 'serotonergic toxicity interaction pattern',
  maoi: 'MAOI-mediated interaction pattern',
  maoi_potentiation: 'MAOI potentiation interaction pattern',
  qt_prolongation: 'QT / rhythm-load interaction pattern',
  qt_or_arrhythmia_risk: 'QT or arrhythmia risk interaction pattern',
  sympathomimetic: 'sympathomimetic interaction pattern',
  sympathomimetic_load: 'sympathomimetic load interaction pattern',
  cns_depressant: 'CNS-depressant interaction pattern',
  pharmacodynamic_cns_depression: 'pharmacodynamic CNS-depression pattern',
  anticholinergic: 'anticholinergic interaction pattern',
  anticholinergic_delirium: 'anticholinergic delirium interaction pattern',
  dopaminergic: 'dopaminergic interaction pattern',
  dopaminergic_load: 'dopaminergic load interaction pattern',
  glutamatergic: 'glutamatergic interaction pattern',
  glutamatergic_dissociation: 'glutamatergic dissociation interaction pattern',
  glutamate_modulation: 'glutamate-modulation interaction pattern',
  gabaergic: 'GABAergic interaction pattern',
  gabaergic_modulation: 'GABAergic modulation interaction pattern',
  stimulant_stack: 'stacked stimulant-load interaction pattern',
  psychedelic_potentiation: 'psychedelic potentiation pattern',
  psychedelic_intensification: 'psychedelic intensification pattern',
  cardiovascular_load: 'cardiovascular-load interaction pattern',
  hemodynamic_interaction: 'hemodynamic interaction pattern',
  psychiatric_destabilization: 'psychiatric destabilization interaction pattern',
  noradrenergic_suppression: 'noradrenergic suppression pattern',
  adrenergic_rebound: 'adrenergic rebound interaction pattern',
  rebound_hypertension: 'rebound hypertension interaction pattern',
  ion_channel_modulation: 'ion-channel modulation pattern',
  seizure_threshold: 'seizure threshold interaction pattern',
  respiratory_depression: 'respiratory depression interaction pattern',
  dehydration_or_electrolyte_risk: 'dehydration or electrolyte risk interaction pattern',
  operational_or_behavioral_risk: 'operational or behavioral risk interaction pattern'
};

const resolveMechanismFamily = (context?: EvidenceContext): string | undefined => {
  if (context?.mechanismCategory) {
    const mapped = MECHANISM_FAMILY_TEXT[context.mechanismCategory];
    if (mapped) return mapped;
  }
  const displayLabel = context?.mechanismCategoryDisplayLabel?.trim();
  if (displayLabel && displayLabel !== 'Unknown' && displayLabel !== 'Same substance / not an interaction') {
    return `${displayLabel.toLowerCase()} interaction pattern`;
  }
  return undefined;
};

const formatChunkSummary = (
  chunkRefs: string[],
  coverage?: PairCoverageMeta
): string | null => {
  if (chunkRefs.length === 0) return null;

  if (coverage && coverage.exact_chunk_count + coverage.class_level_chunk_count > 0) {
    const exactCount = coverage.exact_chunk_count;
    const classCount = coverage.class_level_chunk_count;
    if (exactCount > 0 && classCount > 0) {
      return `Linked chunks: ${chunkRefs.length} total (${exactCount} pair-specific mention${exactCount === 1 ? '' : 's'}, ${classCount} class-level mechanism/context)`;
    }
    if (exactCount > 0) {
      return `Linked chunks: ${chunkRefs.length} total (${exactCount} pair-specific)`;
    }
    return `Linked chunks: ${chunkRefs.length} total (${classCount} class-level mechanism/context)`;
  }

  const chunkSample = chunkRefs.slice(0, 3).join('; ');
  return `Linked chunks: ${chunkRefs.length}${chunkSample ? ` (sample: ${chunkSample})` : ''}`;
};

const includesSubstanceName = (text: string, substanceName: string): boolean =>
  text.toLowerCase().includes(substanceName.toLowerCase());

const withExplicitSubject = (
  text: string,
  subject: string,
  counterpart?: string
): string => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (includesSubstanceName(trimmed, subject)) {
    return trimmed;
  }

  const startsWithListed = /^listed as\s+/i.test(trimmed);
  const startsWithContraindicated = /^contraindicated\b/i.test(trimmed);
  if (startsWithListed || startsWithContraindicated) {
    const normalized = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    return `${subject} is ${normalized}`;
  }

  if (counterpart && includesSubstanceName(trimmed, counterpart)) {
    return `${subject}: ${trimmed}`;
  }

  return trimmed;
};

const formatLabeledParagraph = (label: string, value: string): string =>
  `**${label}:**\n\n${value}`;

export async function getInteractionExplanation(
  drug1: string,
  drug2: string,
  interactionLabel: string,
  interactionDescription: string,
  context?: EvidenceContext
) {
  const riskScale = context?.riskScale ?? 0;
  const action = RISK_ACTIONS[riskScale] ?? RISK_ACTIONS[0];
  const special = SPECIAL_PAIR_NOTES[pairLabel(drug1, drug2)];
  const mechanism = context?.mechanism;
  const confidence = normalizeConfidence(context?.confidence);
  const evidenceTier = nonBlank(context?.evidenceTier ?? undefined);
  const practicalGuidance = context?.practicalGuidance;
  const timing = context?.timing;
  const evidenceGaps = context?.evidenceGaps;
  const fieldNotes = context?.fieldNotes;
  const citationText = context?.citationLabels?.join('; ');
  const sourceIds = nonEmptyList(context?.sourceIds);
  const sourceTitles = nonEmptyList(context?.sourceTitles);
  const chunkRefs = nonEmptyList(context?.chunkRefs);
  const mechanismFamily = resolveMechanismFamily(context);
  const mechanismTags = nonEmptyList(context?.mechanismCategoryTags);
  const chunkSummary = formatChunkSummary(chunkRefs, context?.coverage);
  const coreInterpretation = withExplicitSubject(interactionDescription, drug2, drug1);
  const clarifiedFieldNotes = fieldNotes
    ? withExplicitSubject(fieldNotes, drug2, drug1)
    : undefined;
  const hasEvidenceDetail = !!(
    confidence ||
    evidenceTier ||
    sourceIds.length ||
    sourceTitles.length ||
    chunkRefs.length
  );

  const primaryFacts = [
    `### Source-linked interaction readout`,
    formatLabeledParagraph('Classification', interactionLabel),
    formatLabeledParagraph('Core interpretation', coreInterpretation),
    formatLabeledParagraph('Action posture', action),
    special ? formatLabeledParagraph('Specific consensus note', special) : "",
    confidence ? formatLabeledParagraph('Confidence tag', confidence) : "",
    Number.isFinite(riskScale) && riskScale >= 0 ? formatLabeledParagraph('Risk scale', `${riskScale} / 5`) : "",
  ].filter(Boolean).join('\n\n');

  const evidenceDetails = hasEvidenceDetail
    ? [
      `#### Dataset evidence detail`,
      evidenceTier ? `Tier: ${evidenceTier}` : "",
      sourceIds.length ? `Source IDs (${sourceIds.length}): ${sourceIds.join('; ')}` : "",
      chunkSummary ?? ""
    ].filter(Boolean).join('\n\n')
    : "";

  const sections = [
    primaryFacts,
    mechanism ? `#### Mechanism of concern\n${mechanism}` : "",
    mechanismFamily ? formatLabeledParagraph('Mechanism family', `${mechanismFamily}.`) : "",
    mechanismTags.length ? formatLabeledParagraph('Mechanism tags', mechanismTags.join('; ')) : "",
    context?.isEvidenceBacked && citationText
      ? formatLabeledParagraph('Source status', `Evidence-backed ${citationText}`)
      : formatLabeledParagraph('Source status', 'Source gap'),
    hasEvidenceDetail
      ? evidenceDetails
      : "",
    context?.evidenceExcerpts ?? "",
    practicalGuidance ? `#### Practical guidance\n${practicalGuidance}` : "",
    timing ? `#### Timing / spacing\n${timing}` : "",
    clarifiedFieldNotes ? `#### Field notes\n${clarifiedFieldNotes}` : "",
    evidenceGaps ? `#### Remaining uncertainty\n${evidenceGaps}` : ""
  ].filter(Boolean);

  return sections.join("\n\n");
}

export async function getDrugSummary(
  drug1Name: string,
  drug2Name?: string,
  context?: EvidenceContext
) {
  if (drug2Name) {
    const riskScale = context?.riskScale ?? 0;
    const action = RISK_ACTIONS[riskScale] ?? RISK_ACTIONS[0];
    const special = SPECIAL_PAIR_NOTES[pairLabel(drug1Name, drug2Name)];
    const practicalGuidance = context?.practicalGuidance;
    const timing = context?.timing;
    const fieldNotes = context?.fieldNotes;
    const evidenceGaps = context?.evidenceGaps;
    const citationText = context?.citationLabels?.join('; ');
    const mechanismFamily = resolveMechanismFamily(context);
    const sourceStatusText = context?.isEvidenceBacked && citationText
      ? `Evidence-backed ${citationText}.`
      : 'Source gap';

    const clarifiedFieldNotes = fieldNotes
      ? withExplicitSubject(fieldNotes, drug2Name, drug1Name)
      : undefined;

    return [
      `### Combined-effects estimate (rule-based)`,
      `This section is generated from curated interaction rules, not free-form AI prediction.`,
      formatLabeledParagraph('Pair', `${drug1Name} + ${drug2Name}`),
      formatLabeledParagraph('Risk posture', action),
      special ? formatLabeledParagraph('Consensus note', special) : "",
      mechanismFamily ? formatLabeledParagraph('Mechanism family', `${mechanismFamily}.`) : "",
      formatLabeledParagraph('Source status', sourceStatusText),
      practicalGuidance ? `### Operational guidance\n${practicalGuidance}` : "",
      timing ? `### Timing / washout\n${timing}` : "",
      clarifiedFieldNotes ? `### Field-use note\n${clarifiedFieldNotes}` : "",
      evidenceGaps ? `### What remains uncertain\n${evidenceGaps}` : "",
      `### Why this is limited`,
      `Subjective psychoactive effects vary by dose, route, physiology, medications, and context. This tool intentionally does not claim precise personal effect prediction.`,
      `### Safety boundary`,
      `This is educational harm-reduction information, not medical advice.`
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    `### Substance context`,
    `Selected item: **${drug1Name}**`,
    ``,
    `Use the interaction panel to check risk posture against a second substance or medication class.`,
    ``,
    `### Safety boundary`,
    `This is educational harm-reduction information, not medical advice.`
  ].join("\n");
}

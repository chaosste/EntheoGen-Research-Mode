import type { MechanismCategory } from '../data/drugData';

type EvidenceContext = {
  confidence?: string;
  riskScale?: number;
  mechanism?: string;
  mechanismCategory?: MechanismCategory;
  practicalGuidance?: string;
  timing?: string;
  evidenceGaps?: string;
  evidenceTier?: string;
  fieldNotes?: string;
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

const MECHANISM_FAMILY_TEXT: Partial<Record<MechanismCategory, string>> = {
  serotonergic: 'serotonergic interaction pattern',
  maoi: 'MAOI-mediated interaction pattern',
  qt_prolongation: 'QT / rhythm-load interaction pattern',
  sympathomimetic: 'sympathomimetic interaction pattern',
  cns_depressant: 'CNS-depressant interaction pattern',
  pharmacodynamic_cns_depression: 'pharmacodynamic CNS-depression pattern',
  anticholinergic: 'anticholinergic interaction pattern',
  dopaminergic: 'dopaminergic interaction pattern',
  glutamatergic: 'glutamatergic interaction pattern',
  glutamate_modulation: 'glutamate-modulation interaction pattern',
  gabaergic: 'GABAergic interaction pattern',
  stimulant_stack: 'stacked stimulant-load interaction pattern',
  psychedelic_potentiation: 'psychedelic potentiation pattern',
  cardiovascular_load: 'cardiovascular-load interaction pattern',
  hemodynamic_interaction: 'hemodynamic interaction pattern',
  noradrenergic_suppression: 'noradrenergic suppression pattern',
  ion_channel_modulation: 'ion-channel modulation pattern'
};

export async function getInteractionExplanation(
  drug1: string,
  drug2: string,
  interactionLabel: string,
  interactionDescription: string,
  context?: EvidenceContext
) {
  const riskScale = context?.riskScale ?? 0;
  const confidence = context?.confidence ?? "low";
  const action = RISK_ACTIONS[riskScale] ?? RISK_ACTIONS[0];
  const special = SPECIAL_PAIR_NOTES[pairLabel(drug1, drug2)];
  const mechanism = context?.mechanism;
  const practicalGuidance = context?.practicalGuidance;
  const timing = context?.timing;
  const evidenceGaps = context?.evidenceGaps;
  const evidenceTier = context?.evidenceTier;
  const fieldNotes = context?.fieldNotes;
  const mechanismFamily = context?.mechanismCategory
    ? MECHANISM_FAMILY_TEXT[context.mechanismCategory]
    : undefined;

  const lines = [
    `### Evidence-based interaction readout`,
    `**Classification:** ${interactionLabel}`,
    `**Core interpretation:** ${interactionDescription}`,
    ``,
    `**Action posture:** ${action}`,
    special ? `**Specific consensus note:** ${special}` : "",
    ``,
    `**Evidence confidence:** ${confidence.toUpperCase()}`,
    evidenceTier ? `**Evidence tier:** ${evidenceTier}` : "",
    mechanismFamily ? `**Mechanism family:** ${mechanismFamily}.` : "",
    mechanism ? `#### Mechanism of concern\n${mechanism}` : "",
    practicalGuidance ? `#### Practical guidance\n${practicalGuidance}` : "",
    timing ? `#### Timing / spacing\n${timing}` : "",
    fieldNotes ? `#### Lower-evidence field notes\n${fieldNotes}` : "",
    evidenceGaps ? `#### Remaining uncertainty\n${evidenceGaps}` : ""
  ].filter(Boolean);

  return lines.join("\n");
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
    const evidenceTier = context?.evidenceTier;
    const mechanismFamily = context?.mechanismCategory
      ? MECHANISM_FAMILY_TEXT[context.mechanismCategory]
      : undefined;

    return [
      `### Combined-effects estimate (rule-based)`,
      `This section is generated from curated interaction rules, not free-form AI prediction.`,
      ``,
      `**Pair:** ${drug1Name} + ${drug2Name}`,
      `**Risk posture:** ${action}`,
      special ? `**Consensus note:** ${special}` : "",
      evidenceTier ? `**Evidence tier:** ${evidenceTier}` : "",
      mechanismFamily ? `**Mechanism family:** ${mechanismFamily}.` : "",
      ``,
      practicalGuidance ? `### Operational guidance\n${practicalGuidance}` : "",
      timing ? `### Timing / washout\n${timing}` : "",
      fieldNotes ? `### Field-use note\n${fieldNotes}` : "",
      evidenceGaps ? `### What remains uncertain\n${evidenceGaps}` : "",
      `### Why this is limited`,
      `Subjective psychoactive effects vary by dose, route, physiology, medications, and context. This tool intentionally does not claim precise personal effect prediction.`,
      ``,
      `### Safety boundary`,
      `This is educational harm-reduction information, not medical advice.`
    ]
      .filter(Boolean)
      .join("\n");
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

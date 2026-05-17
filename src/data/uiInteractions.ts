import type { InteractionPair } from './interactionDataset';
import { getAppDatasetRegistry } from './datasetRegistry';
import type { MechanismCategory } from './drugData';

export interface UIInteraction {
  /** Stable UI id for this pair (canonical pair key). */
  id: string;
  /** Friendly display name for the first selected substance. */
  substanceA: string;
  /** Friendly display name for the second selected substance. */
  substanceB: string;
  /**
   * Numeric risk score for ordering/weighting.
   * This is nullable when the source row has no reliable numeric score.
   */
  riskScore: number | null;
  /** Canonical risk code used for internal UI branching (e.g. SELF, CAU, DAN, UNK). */
  riskLabel: string;
  /** Human-facing risk text; always friendly and never blank. */
  riskDisplayLabel: string;
  /**
   * Canonical mechanism enum/category for logic/filtering.
   * Prefer this for machine comparisons.
   */
  mechanismCategory: MechanismCategory | 'unknown';
  /**
   * Human-facing mechanism text.
   * Prefer this for rendering; do not render raw mechanismCategory directly.
   */
  mechanismDisplayLabel: string;
  /**
   * Human-facing confidence text (e.g. High/Medium/Low/Unknown).
   * Already normalized for display.
   */
  confidenceLabel: string;
  /** True when A and B are the same substance (non-interaction row). */
  isSelfPair: boolean;
  /** Secondary note text for UI readouts; falls back to headline when missing. */
  notes: string;
  /** Primary interaction headline/summary text. */
  headline: string;
  /**
   * Original source row (old or new shape) preserved for export/debug paths.
   * Raw fields are legacy/optional and should not drive normal UI rendering.
   */
  raw: Record<string, unknown> | null;
}

const UNKNOWN_DISPLAY = 'Unknown';
const SELF_DISPLAY = 'Same substance / not an interaction';

const RISK_DISPLAY_LABELS: Record<string, string> = {
  LOW: 'Low risk',
  LOW_MOD: 'Low risk, effect modulation',
  CAU: 'Caution / moderate risk',
  UNS: 'Unsafe / high risk',
  DAN: 'Dangerous / contraindicated',
  UNK: 'Unknown / insufficient data',
  INFERRED: 'Mechanistic inference',
  THEORETICAL: 'Theoretical interaction',
  DETERMINISTIC: 'Established interaction mapping',
  SELF: SELF_DISPLAY
};

const MECHANISM_DISPLAY_LABELS: Partial<Record<MechanismCategory, string>> = {
  serotonergic: 'Serotonergic',
  serotonergic_toxicity: 'Serotonergic toxicity',
  maoi: 'MAOI-mediated',
  maoi_potentiation: 'MAOI potentiation',
  qt_prolongation: 'QT prolongation',
  qt_or_arrhythmia_risk: 'QT or arrhythmia risk',
  sympathomimetic: 'Sympathomimetic',
  sympathomimetic_load: 'Sympathomimetic load',
  cns_depressant: 'CNS depressant',
  pharmacodynamic_cns_depression: 'Pharmacodynamic CNS depression',
  cardiovascular_load: 'Cardiovascular load',
  hemodynamic_interaction: 'Hemodynamic interaction',
  anticholinergic: 'Anticholinergic',
  anticholinergic_delirium: 'Anticholinergic delirium',
  dopaminergic: 'Dopaminergic',
  dopaminergic_load: 'Dopaminergic load',
  glutamatergic: 'Glutamatergic',
  glutamatergic_dissociation: 'Glutamatergic dissociation',
  glutamate_modulation: 'Glutamate modulation',
  gabaergic: 'GABAergic',
  gabaergic_modulation: 'GABAergic modulation',
  stimulant_stack: 'Stimulant stack',
  psychedelic_potentiation: 'Psychedelic potentiation',
  psychedelic_intensification: 'Psychedelic intensification',
  seizure_threshold: 'Seizure threshold',
  noradrenergic_suppression: 'Noradrenergic suppression',
  adrenergic_rebound: 'Adrenergic rebound',
  rebound_hypertension: 'Rebound hypertension',
  additive_hypotension: 'Additive hypotension',
  respiratory_depression: 'Respiratory depression',
  dehydration_or_electrolyte_risk: 'Dehydration or electrolyte risk',
  psychiatric_destabilization: 'Psychiatric destabilization',
  ion_channel_modulation: 'Ion-channel modulation',
  operational_or_behavioral_risk: 'Operational or behavioral risk'
};

const asNonBlank = (value?: string | null, fallback = UNKNOWN_DISPLAY): string => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'unknown' || normalized === 'null' || normalized === 'not_applicable' || normalized === 'n/a') {
    return fallback;
  }
  return value!.trim();
};

const toConfidenceLabel = (value?: string | null): string => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'n/a' || normalized === 'unknown' || normalized === 'not_applicable') {
    return UNKNOWN_DISPLAY;
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const toMechanismCategory = (value?: string | null): MechanismCategory | 'unknown' => {
  const cleaned = asNonBlank(value, 'unknown').toLowerCase();
  return (cleaned as MechanismCategory | 'unknown');
};

const canonicalPairKey = (a: string, b: string) => [a, b].sort().join('|');

type NewShapeRow = {
  key?: string;
  substances?: [string, string] | string[];
  classification?: {
    code?: string | null;
    label?: string | null;
    risk_score?: number | null;
    confidence?: string | null;
  };
  mechanism?: {
    primary_category?: string | null;
  };
  clinical_summary?: {
    headline?: string | null;
    field_notes?: string | null;
  };
};

type NormalizableRow = Partial<InteractionPair> & NewShapeRow;

const coerceIds = (row: NormalizableRow): [string, string] => {
  const oldA = typeof row.substance_a_id === 'string' ? row.substance_a_id : '';
  const oldB = typeof row.substance_b_id === 'string' ? row.substance_b_id : '';
  if (oldA && oldB) {
    return [oldA, oldB];
  }

  const substances = Array.isArray(row.substances) ? row.substances : [];
  const newA = typeof substances[0] === 'string' ? substances[0] : '';
  const newB = typeof substances[1] === 'string' ? substances[1] : '';
  return [newA || UNKNOWN_DISPLAY.toLowerCase(), newB || UNKNOWN_DISPLAY.toLowerCase()];
};

const coercePairKey = (row: NormalizableRow, a: string, b: string): string => {
  if (typeof row.pair_key === 'string' && row.pair_key.trim()) {
    return row.pair_key;
  }
  if (typeof row.key === 'string' && row.key.trim()) {
    return row.key;
  }
  return canonicalPairKey(a, b);
};

const coerceRiskScore = (row: NormalizableRow, isSelfPair: boolean): number | null => {
  if (isSelfPair) return -1;
  const score = typeof row.risk_scale === 'number'
    ? row.risk_scale
    : (typeof row.classification?.risk_score === 'number' ? row.classification.risk_score : null);
  return Number.isFinite(score) ? score : null;
};

const warnIfBlankDisplayContract = (interaction: UIInteraction) => {
  const isDev =
    typeof process !== 'undefined' &&
    typeof process.env !== 'undefined' &&
    process.env.NODE_ENV !== 'production';
  if (!isDev) return;

  const requiredDisplayFields: Array<keyof UIInteraction> = [
    'substanceA',
    'substanceB',
    'riskDisplayLabel',
    'mechanismDisplayLabel',
    'confidenceLabel',
    'headline',
    'notes'
  ];

  const blanks = requiredDisplayFields.filter((field) => {
    const value = interaction[field];
    return typeof value === 'string' && value.trim().length === 0;
  });

  if (blanks.length > 0) {
    console.warn(
      `[uiInteractions] Blank display fields detected (${blanks.join(', ')}) for interaction id="${interaction.id}".`,
      interaction
    );
  }
};

export function normalizeInteraction(row: NormalizableRow): UIInteraction {
  const { drugNameById, interactionRowByKey } = getAppDatasetRegistry();
  const [substanceAId, substanceBId] = coerceIds(row);
  const substanceA = drugNameById.get(substanceAId) ?? substanceAId;
  const substanceB = drugNameById.get(substanceBId) ?? substanceBId;
  const normalizedCode = asNonBlank(
    (row.interaction_code as string | undefined) ?? row.classification?.code,
    'UNK'
  );
  const isSelfPair = substanceAId === substanceBId || normalizedCode === 'SELF';
  const mechanismCategory = isSelfPair
    ? 'unknown'
    : toMechanismCategory((row.mechanism_category as string | undefined) ?? row.mechanism?.primary_category);
  const riskLabel = isSelfPair ? 'SELF' : normalizedCode;
  const riskDisplayLabel = isSelfPair
    ? SELF_DISPLAY
    : asNonBlank(
      RISK_DISPLAY_LABELS[riskLabel] ??
      (row.interaction_label as string | undefined) ??
      row.classification?.label,
      RISK_DISPLAY_LABELS.UNK
    );

  const mechanismDisplayLabel = isSelfPair
    ? SELF_DISPLAY
    : asNonBlank(MECHANISM_DISPLAY_LABELS[mechanismCategory as MechanismCategory], UNKNOWN_DISPLAY);

  const headline = isSelfPair
    ? SELF_DISPLAY
    : asNonBlank((row.summary as string | undefined) ?? row.clinical_summary?.headline, UNKNOWN_DISPLAY);
  const notes = asNonBlank((row.field_notes as string | undefined) ?? row.clinical_summary?.field_notes, headline);

  const normalized: UIInteraction = {
    id: coercePairKey(row, substanceAId, substanceBId),
    substanceA,
    substanceB,
    riskScore: coerceRiskScore(row, isSelfPair),
    riskLabel,
    riskDisplayLabel,
    mechanismCategory,
    mechanismDisplayLabel,
    confidenceLabel: isSelfPair
      ? UNKNOWN_DISPLAY
      : toConfidenceLabel((row.confidence as string | undefined) ?? row.classification?.confidence),
    isSelfPair,
    notes,
    headline,
    raw: row as Record<string, unknown>
  };

  warnIfBlankDisplayContract(normalized);
  return normalized;
}

export function getUIInteraction(substanceAId: string, substanceBId: string): UIInteraction {
  const { drugNameById, interactionRowByKey } = getAppDatasetRegistry();
  const pairKey = canonicalPairKey(substanceAId, substanceBId);
  const row = interactionRowByKey.get(pairKey);
  if (row) {
    return normalizeInteraction(row);
  }

  if (substanceAId === substanceBId) {
    return {
      id: pairKey,
      substanceA: drugNameById.get(substanceAId) ?? substanceAId,
      substanceB: drugNameById.get(substanceBId) ?? substanceBId,
      riskScore: -1,
      riskLabel: 'SELF',
      riskDisplayLabel: SELF_DISPLAY,
      mechanismCategory: 'unknown',
      mechanismDisplayLabel: SELF_DISPLAY,
      confidenceLabel: UNKNOWN_DISPLAY,
      isSelfPair: true,
      notes: SELF_DISPLAY,
      headline: SELF_DISPLAY,
      raw: null
    };
  }

  return {
    id: pairKey,
    substanceA: drugNameById.get(substanceAId) ?? substanceAId,
    substanceB: drugNameById.get(substanceBId) ?? substanceBId,
    riskScore: null,
    riskLabel: 'UNK',
    riskDisplayLabel: RISK_DISPLAY_LABELS.UNK,
    mechanismCategory: 'unknown',
    mechanismDisplayLabel: UNKNOWN_DISPLAY,
    confidenceLabel: UNKNOWN_DISPLAY,
    isSelfPair: false,
    notes: UNKNOWN_DISPLAY,
    headline: UNKNOWN_DISPLAY,
    raw: null
  };
}

export function getAllUIInteractions(): UIInteraction[] {
  return getAppDatasetRegistry().interactionPairs.map((row) => normalizeInteraction(row));
}

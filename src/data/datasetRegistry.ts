import type { Drug, InteractionEvidence } from './drugData';
import type { InteractionPair, RuleOrigin } from './interactionDataset';

type RichSubstance = {
  id: string;
  name: string;
  class: string;
  mechanism_tag?: string;
  mechanismTag?: string;
  notes: string;
  deprecated?: boolean;
  supersededBy?: string[];
};

type RichInteractionPair = {
  key: string;
  substances: [string, string] | string[];
  classification: {
    code: InteractionPair['interaction_code'];
    status?: string;
    confidence?: string;
    risk_score: number | null;
    label?: string;
  };
  clinical_summary?: {
    headline?: string | null;
    mechanism?: string | null;
    timing_guidance?: string | null;
    field_notes?: string | null;
  };
  mechanism?: {
    primary_category?: string | null;
  };
  evidence?: {
    tier?: string | null;
    source_refs?: Array<string | { source_id?: string | null }>;
    evidence_gaps?: string | null;
  };
  source_text?: string | null;
  source_fingerprint?: string;
  provenance?: {
    origin_value_v1?: RuleOrigin;
  };
};

export type RichInteractionDataset = {
  substances: RichSubstance[];
  pairs: RichInteractionPair[];
};

export type AppDatasetRegistry = {
  drugs: Drug[];
  interactionPairs: InteractionPair[];
  drugById: Map<string, Drug>;
  drugNameById: Map<string, string>;
  datasetInteractionRules: Record<string, InteractionEvidence>;
  interactionRowByKey: Map<string, InteractionPair>;
};

let registry: AppDatasetRegistry | null = null;

function buildDatasetInteractionRules(pairs: InteractionPair[]): Record<string, InteractionEvidence> {
  return Object.fromEntries(
    pairs.map((pair) => [
      pair.pair_key,
      {
        code: pair.interaction_code,
        summary: pair.summary,
        confidence: pair.confidence,
        sources: pair.sources,
        mechanism: pair.mechanism ?? undefined,
        timing: pair.timing ?? undefined,
        evidenceGaps: pair.evidence_gaps ?? undefined,
        evidenceTier: pair.evidence_tier ?? undefined,
        fieldNotes: pair.field_notes ?? undefined
      } satisfies InteractionEvidence
    ])
  );
}

const normalizeSourceRefs = (refs?: RichInteractionPair['evidence']['source_refs']): string[] => {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((ref) => (typeof ref === 'string' ? ref : ref.source_id ?? ''))
    .map((sourceId) => sourceId.trim())
    .filter(Boolean);
};

const normalizeDrug = (drug: RichSubstance): Drug => ({
  id: drug.id,
  name: drug.name,
  class: drug.class,
  mechanismTag: drug.mechanismTag ?? drug.mechanism_tag ?? '',
  notes: drug.notes,
  deprecated: drug.deprecated,
  supersededBy: drug.supersededBy
});

const normalizeInteractionPair = (pair: RichInteractionPair): InteractionPair => {
  const substanceA = pair.substances[0] ?? '';
  const substanceB = pair.substances[1] ?? '';
  const code = pair.classification.code;
  return {
    substance_a_id: substanceA,
    substance_b_id: substanceB,
    pair_key: pair.key,
    origin: pair.provenance?.origin_value_v1 ?? (code === 'SELF' ? 'self' : 'unknown'),
    interaction_code: code,
    interaction_label: pair.classification.label ?? code,
    risk_scale: pair.classification.risk_score ?? 0,
    summary: pair.clinical_summary?.headline ?? '',
    confidence: pair.classification.confidence ?? '',
    mechanism: pair.clinical_summary?.mechanism ?? null,
    mechanism_category: pair.mechanism?.primary_category ?? 'unknown',
    timing: pair.clinical_summary?.timing_guidance ?? null,
    evidence_gaps: pair.evidence?.evidence_gaps ?? null,
    evidence_tier: pair.evidence?.tier ?? null,
    field_notes: pair.clinical_summary?.field_notes ?? null,
    sources: pair.source_text ?? '',
    source_refs: normalizeSourceRefs(pair.evidence?.source_refs),
    source_fingerprint: pair.source_fingerprint ?? ''
  };
};

export function registerAppDataset(drugs: Drug[], interactionPairs: InteractionPair[]): void {
  const drugById = new Map(drugs.map((d) => [d.id, d] as const));
  const drugNameById = new Map(drugs.map((d) => [d.id, d.name] as const));
  const interactionRowByKey = new Map(interactionPairs.map((row) => [row.pair_key, row] as const));
  const datasetInteractionRules = buildDatasetInteractionRules(interactionPairs);
  registry = {
    drugs,
    interactionPairs,
    drugById,
    drugNameById,
    datasetInteractionRules,
    interactionRowByKey
  };
}

export function registerRichInteractionDataset(dataset: RichInteractionDataset): void {
  registerAppDataset(
    dataset.substances.map(normalizeDrug),
    dataset.pairs.map(normalizeInteractionPair)
  );
}

export function getAppDatasetRegistry(): AppDatasetRegistry {
  if (!registry) {
    throw new Error(
      '[datasetRegistry] App dataset is not registered. Load /dataset/* first or call registerAppDataset from a bootstrap script.'
    );
  }
  return registry;
}

export function isAppDatasetRegistered(): boolean {
  return registry !== null;
}

export function clearAppDatasetRegistry(): void {
  registry = null;
}

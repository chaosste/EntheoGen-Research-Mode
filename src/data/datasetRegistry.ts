import type { Drug, InteractionEvidence } from './drugData';
import type { InteractionPair } from './interactionDataset';

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

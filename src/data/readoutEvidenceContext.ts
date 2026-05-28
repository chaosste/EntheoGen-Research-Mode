import type { MechanismCategory } from './drugData';
import type { ChunkExcerptIndex } from './chunkExcerpts';
import { formatEvidenceExcerptsMarkdown } from './chunkExcerpts';
import type { InteractionPair } from './interactionDataset';
import type { UIInteraction } from './uiInteractions';
import type { EvidenceContext } from '../services/ruleBasedReadoutService';
import { LEGEND } from './drugData';

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const riskScaleForInteraction = (row: InteractionPair | null | undefined, interaction: UIInteraction): number => {
  if (typeof row?.risk_scale === 'number' && Number.isFinite(row.risk_scale)) {
    return row.risk_scale;
  }
  if (typeof interaction.riskScore === 'number' && Number.isFinite(interaction.riskScore)) {
    return interaction.riskScore;
  }
  return LEGEND[interaction.riskLabel]?.riskScale ?? 0;
};

export function buildReadoutEvidenceContext(
  interaction: UIInteraction,
  row: InteractionPair | null | undefined,
  chunkExcerptIndex?: ChunkExcerptIndex
): EvidenceContext {
  const sourceIds = row?.source_refs?.length
    ? asStringArray(row.source_refs)
    : interaction.sourceIds;
  const sourceTitles = asStringArray(row?.source_titles);
  const chunkRefs = asStringArray(row?.chunk_refs);
  const exactChunkIds = row?.coverage?.exact_chunk_ids ?? [];
  const classLevelChunkIds = chunkRefs.filter((chunkId) => !exactChunkIds.includes(chunkId));

  const evidenceExcerpts = chunkExcerptIndex
    ? formatEvidenceExcerptsMarkdown({
      exactChunkIds,
      classLevelChunkIds,
      index: chunkExcerptIndex
    }) ?? undefined
    : undefined;

  return {
    riskScale: riskScaleForInteraction(row, interaction),
    mechanism: row?.mechanism ?? undefined,
    mechanismCategory: interaction.mechanismCategory === 'unknown'
      ? undefined
      : interaction.mechanismCategory as MechanismCategory,
    mechanismCategoryDisplayLabel: interaction.mechanismDisplayLabel,
    mechanismCategoryTags: interaction.mechanismCategoryTags,
    timing: row?.timing ?? undefined,
    evidenceGaps: row?.evidence_gaps ?? undefined,
    confidence: row?.confidence ?? undefined,
    evidenceTier: row?.evidence_tier ?? null,
    fieldNotes: row?.field_notes ?? undefined,
    isEvidenceBacked: interaction.isEvidenceBacked,
    citationLabels: interaction.citationLabels,
    sourceIds,
    sourceTitles,
    chunkRefs,
    coverage: row?.coverage,
    evidenceExcerpts
  };
}

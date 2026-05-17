import type { UIInteraction } from './uiInteractions';

export type ResearchModeFilters = {
  showLowConfidence: boolean;
  showInferredOrTheoretical: boolean;
  showEvidenceGaps: boolean;
};

const includesText = (value: string, token: string) => value.toLowerCase().includes(token.toLowerCase());
const nonBlank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function hasActiveResearchModeFilters(filters: ResearchModeFilters): boolean {
  return filters.showLowConfidence || filters.showInferredOrTheoretical || filters.showEvidenceGaps;
}

export function filterInteractionsForResearchMode(
  interactions: UIInteraction[],
  filters: ResearchModeFilters
): UIInteraction[] {
  if (!hasActiveResearchModeFilters(filters)) {
    return [];
  }

  return interactions.filter((interaction) => {
    if (interaction.isSelfPair) return false;

    const raw = interaction.raw ?? {};

    if (filters.showLowConfidence) {
      const hasLowConfidence =
        includesText(interaction.confidenceLabel, 'low') ||
        includesText(interaction.confidenceLabel, 'unknown') ||
        includesText(String(raw.confidence ?? ''), 'low') ||
        includesText(String(raw.confidence ?? ''), 'n/a');
      if (!hasLowConfidence) return false;
    }

    if (filters.showInferredOrTheoretical) {
      const hasInferredOrTheoretical =
        interaction.riskLabel === 'INFERRED' ||
        interaction.riskLabel === 'THEORETICAL' ||
        includesText(interaction.riskDisplayLabel, 'inference') ||
        includesText(interaction.riskDisplayLabel, 'theoretical') ||
        raw.origin === 'fallback';
      if (!hasInferredOrTheoretical) return false;
    }

    if (filters.showEvidenceGaps) {
      const hasEvidenceGap =
        nonBlank(raw.evidence_gaps) ||
        includesText(String(raw.sources ?? ''), 'source-gap') ||
        includesText(String(raw.evidence_tier ?? ''), 'mechanistic') ||
        includesText(String(raw.evidence_tier ?? ''), 'theoretical');
      if (!hasEvidenceGap) return false;
    }

    return true;
  });
}

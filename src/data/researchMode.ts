import type { UIInteraction } from './uiInteractions';

export type ResearchModeFilters = {
  showSourceGaps: boolean;
  showInferredOrTheoretical: boolean;
  showSourceLinked: boolean;
};

const includesText = (value: string, token: string) => value.toLowerCase().includes(token.toLowerCase());

export function hasActiveResearchModeFilters(filters: ResearchModeFilters): boolean {
  return filters.showSourceGaps || filters.showInferredOrTheoretical || filters.showSourceLinked;
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

    if (filters.showSourceGaps) {
      const hasSourceGap =
        !interaction.isEvidenceBacked ||
        includesText(String(raw.sources ?? ''), 'source-gap') ||
        includesText(String(raw.sources ?? ''), 'source_gap');
      if (!hasSourceGap) return false;
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

    if (filters.showSourceLinked) {
      if (!interaction.isEvidenceBacked) return false;
    }

    return true;
  });
}

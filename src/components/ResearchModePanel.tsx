import React from 'react';
import type { ResearchModeFilters } from '../data/researchMode';

interface ResearchModePanelProps {
  filters: ResearchModeFilters;
  onChange: (next: ResearchModeFilters) => void;
}

const TOGGLE_META: Array<{
  key: keyof ResearchModeFilters;
  label: string;
  help: string;
}> = [
  {
    key: 'showLowConfidence',
    label: 'Show Low Confidence',
    help: 'Show interactions with low or unknown confidence ratings.'
  },
  {
    key: 'showInferredOrTheoretical',
    label: 'Show Inferred / Theoretical',
    help: 'Show interactions driven by class-level inference rather than direct pair evidence.'
  },
  {
    key: 'showEvidenceGaps',
    label: 'Show Evidence Gaps',
    help: 'Show interactions with explicit uncertainty notes, source gaps, or mechanistic-only evidence.'
  }
];

export default function ResearchModePanel({ filters, onChange }: ResearchModePanelProps) {
  return (
    <section className="glass-panel rounded-[2rem] p-6 sm:p-8 mt-20">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-[0.08em] text-white/95">
          Research Mode
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Highlight relative knowledge gaps: low confidence, inferred classifications, and evidence-gap notes.
        </p>
      </div>

      <div className="grid gap-4">
        {TOGGLE_META.map((item) => (
          <label
            key={item.key}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer hover:bg-white/10 transition-colors"
          >
            <input
              type="checkbox"
              checked={filters[item.key]}
              onChange={(event) =>
                onChange({
                  ...filters,
                  [item.key]: event.target.checked
                })
              }
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20 accent-emerald-400"
            />
            <span>
              <span className="block text-sm font-semibold text-white/95">{item.label}</span>
              <span className="block text-xs text-[var(--text-muted)] mt-1">{item.help}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

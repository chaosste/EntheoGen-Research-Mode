import assert from 'node:assert/strict';
import { buildChunkExcerptRecord, formatEvidenceExcerptsMarkdown } from '../src/data/chunkExcerpts';
import { buildReadoutEvidenceContext } from '../src/data/readoutEvidenceContext';
import { registerAppDataset } from '../src/data/datasetRegistry';
import { normalizeInteraction } from '../src/data/uiInteractions';
import type { InteractionPair } from '../src/data/interactionDataset';

const ayahuascaCocaineRow: InteractionPair = {
  substance_a_id: 'ayahuasca',
  substance_b_id: 'cocaine',
  pair_key: 'ayahuasca|cocaine',
  origin: 'explicit',
  interaction_code: 'DAN',
  interaction_label: 'Dangerous / Contraindicated',
  risk_scale: 5,
  summary: 'Listed as contraindicated with ayahuasca.',
  confidence: 'high',
  mechanism: 'Cocaine blocks monoamine reuptake.',
  mechanism_category: 'sympathomimetic_load',
  mechanism_categories: [
    'sympathomimetic_load',
    'serotonergic_toxicity',
    'maoi_potentiation'
  ],
  coverage: {
    exact_chunk_count: 1,
    class_level_chunk_count: 2,
    exact_chunk_ids: ['ruffell_2023::chunk::exact']
  },
  timing: null,
  evidence_gaps: null,
  evidence_tier: null,
  field_notes: null,
  sources: 'beta-0-1-snapshot',
  source_refs: ['malcolm_2023', 'ruffell_2020'],
  source_titles: ['Malcolm title', 'Ruffell 2020 title'],
  chunk_refs: ['ruffell_2023::chunk::exact', 'malcolm_2023::chunk::class'],
  source_fingerprint: 'test'
};

registerAppDataset([], [ayahuascaCocaineRow]);

const interaction = normalizeInteraction(ayahuascaCocaineRow);
assert.deepStrictEqual(interaction.mechanismCategoryTags, [
  'Sympathomimetic load',
  'Serotonergic toxicity',
  'MAOI potentiation'
]);

const excerptIndex = {
  'ruffell_2023::chunk::exact': buildChunkExcerptRecord({
    chunk_id: 'ruffell_2023::chunk::exact',
    source_id: 'ruffell_2023',
    source_title: 'Ayahuasca review',
    year: 2023,
    chunk_text: 'reducing relapse rates from methamphetamine, cocaine, and alcohol.'
  }),
  'malcolm_2023::chunk::class': buildChunkExcerptRecord({
    chunk_id: 'malcolm_2023::chunk::class',
    source_id: 'malcolm_2023',
    source_title: 'Ayahuasca interactions',
    year: 2023,
    chunk_text: 'Serotonin Syndrome and Hypertensive Crisis with MAO-A inhibition.'
  })
};

const context = buildReadoutEvidenceContext(interaction, ayahuascaCocaineRow, excerptIndex);
assert.equal(context.riskScale, 5);
assert.match(context.evidenceExcerpts ?? '', /Pair-specific \(1\):/);
assert.match(context.evidenceExcerpts ?? '', /Class-level mechanism context/);
assert.match(context.evidenceExcerpts ?? '', /cocaine, and alcohol/);

const markdown = formatEvidenceExcerptsMarkdown({
  exactChunkIds: ['ruffell_2023::chunk::exact'],
  classLevelChunkIds: ['malcolm_2023::chunk::class'],
  index: excerptIndex
});
assert.match(markdown ?? '', /Evidence linkage note:/);

console.log('readout enrichment checks passed');

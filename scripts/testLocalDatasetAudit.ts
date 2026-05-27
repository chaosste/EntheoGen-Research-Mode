import {
  buildLowUnknownConfidenceAudit,
  renderLowUnknownConfidenceMarkdown
} from './localDatasetAudit';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const audit = await buildLowUnknownConfidenceAudit();
const markdown = renderLowUnknownConfidenceMarkdown(audit);

const criticalPair = audit.rows.find((row) => row.pair_key === 'atypical_ad|dox');

assert(criticalPair !== undefined, 'expected atypical_ad|dox to be included');
assert(criticalPair?.pair_key === 'atypical_ad|dox', 'expected pipe-delimited pair_key to be preserved');
assert(criticalPair?.confidence === 'low', 'expected atypical_ad|dox to be low confidence');
assert(criticalPair?.linked_chunk_count === 0, 'expected no linked citation chunks');
assert(
  criticalPair?.citation_status === 'no linked citation chunk in this bundle',
  'expected beta-only empty chunk refs to be described as no linked citation chunk in this bundle'
);

assert(audit.counts.totalRows > 0, 'expected dataset rows');
assert(audit.counts.totalNonSelfRows > 0, 'expected non-self rows');
assert(audit.counts.lowConfidenceRows > 0, 'expected low confidence rows');
assert(audit.counts.lowUnknownRows === audit.rows.length, 'rows should match low/unknown count');
assert(
  audit.counts.linkedChunkLowUnknownRows + audit.counts.noLinkedChunkLowUnknownRows === audit.counts.lowUnknownRows,
  'linked and unlinked chunk counts should partition low/unknown rows'
);
assert(
  audit.groups.linkedCitationChunks.length + audit.groups.noLinkedCitationChunks.length === audit.rows.length,
  'group partitions should cover all low/unknown rows'
);

assert(markdown.includes('# Local Dataset Audit: Low/Unknown Confidence'), 'expected markdown title');
assert(markdown.includes('| atypical_ad\\|dox |'), 'expected markdown to render pipe-delimited pair key safely');
assert(markdown.includes('src/data/interaction_pairs.json'), 'expected evidence path in markdown');

console.log('Local dataset audit tests passed.');

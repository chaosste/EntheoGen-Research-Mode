import assert from 'node:assert/strict';
import {
  recordConflict,
  recordDuplicateSignal,
  type DuplicateSignal,
  type ReviewConflict
} from './consolidateJsonUpdates';

const reportTracking: {
  conflicts_detected: string[];
  review_conflicts: ReviewConflict[];
  duplicate_signals: DuplicateSignal[];
  duplicate_signal_counts: {
    existing_pair_matches: number;
    source_ref_duplicates_suppressed: number;
    citation_duplicates_suppressed: number;
    claim_duplicates_suppressed: number;
  };
} = {
  conflicts_detected: [] as string[],
  review_conflicts: [],
  duplicate_signals: [],
  duplicate_signal_counts: {
    existing_pair_matches: 0,
    source_ref_duplicates_suppressed: 0,
    citation_duplicates_suppressed: 0,
    claim_duplicates_suppressed: 0
  }
};

recordConflict(reportTracking, 'cannot_insert:updates.json:ayahuasca|mdma:unknown_substance', {
  category: 'candidate_insert_blocked',
  reason_code: 'unknown_substance',
  message: 'Candidate references unknown substances.',
  severity: 'warning',
  update_file: 'updates.json',
  pair_key: 'ayahuasca|mdma',
  suggested_review_action: 'Map substances before merging.'
});

assert.strictEqual(reportTracking.conflicts_detected.length, 1);
assert.strictEqual(reportTracking.conflicts_detected[0], 'cannot_insert:updates.json:ayahuasca|mdma:unknown_substance');
assert.strictEqual(reportTracking.review_conflicts.length, 1);
assert.strictEqual(reportTracking.review_conflicts[0].auto_resolution_applied, false);

recordDuplicateSignal(reportTracking, {
  signal: 'existing_pair_match',
  detail: 'Candidate matched canonical pair.',
  update_file: 'updates.json',
  pair_key: 'ayahuasca|mdma',
  source_id: 'test_source'
});

recordDuplicateSignal(reportTracking, {
  signal: 'claim_deduplicated',
  detail: 'Duplicate claim suppressed.',
  update_file: 'claims/pending/example.claims.json',
  source_id: 'test_source'
});

assert.strictEqual(reportTracking.duplicate_signals.length, 2);
assert.strictEqual(reportTracking.duplicate_signal_counts.existing_pair_matches, 1);
assert.strictEqual(reportTracking.duplicate_signal_counts.claim_duplicates_suppressed, 1);
assert.strictEqual(reportTracking.duplicate_signal_counts.citation_duplicates_suppressed, 0);

console.log('consolidation reporting assertions passed');

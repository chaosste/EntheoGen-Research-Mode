import path from 'node:path';
import { canonicalPairKey, readJson, slugify, type ClaimPackage, type ClaimRecord } from './kb-utils';

type AuditStats = {
  filesAudited: number;
  claimsAudited: number;
  byReviewState: Record<string, number>;
  byCitationCount: {
    zero: number;
    one: number;
    two_or_more: number;
  };
  supportsPairs: {
    present: number;
    missing: number;
  };
  eligibleForReview: number;
  ineligibleReasons: Record<string, number>;
};

const normalizePairToken = (value: string): string => slugify(value).trim();

const normalizeSupportsPairs = (claim: ClaimRecord): [string, string][] => {
  const pairs = claim.supports_pairs ?? [];
  const normalized: [string, string][] = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const a = normalizePairToken(String(pair[0] ?? ''));
    const b = normalizePairToken(String(pair[1] ?? ''));
    if (!a || !b) continue;
    const [p1, p2] = canonicalPairKey(a, b).split('|');
    if (p1 && p2) normalized.push([p1, p2]);
  }
  return normalized;
};

const citationCount = (claim: ClaimRecord): number => {
  const cited = claim.provenance?.cited_sources;
  return Array.isArray(cited) ? cited.length : 0;
};

const hasStableClaimId = (claim: ClaimRecord): boolean => typeof claim.claim_id === 'string' && claim.claim_id.trim().length >= 8;

const run = async (): Promise<void> => {
  const kbRoot = process.env.KB_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge-base');
  const pendingDir = process.env.KB_PENDING_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'pending');
  const fs = await import('node:fs/promises');
  const entries = await fs.readdir(pendingDir, { withFileTypes: true }).catch(() => []);

  const stats: AuditStats = {
    filesAudited: 0,
    claimsAudited: 0,
    byReviewState: {},
    byCitationCount: { zero: 0, one: 0, two_or_more: 0 },
    supportsPairs: { present: 0, missing: 0 },
    eligibleForReview: 0,
    ineligibleReasons: {}
  };

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.claims.json')) continue;
    stats.filesAudited += 1;
    const packagePath = path.join(pendingDir, entry.name);
    const pkg = await readJson<ClaimPackage>(packagePath);
    for (const claim of pkg.claims) {
      stats.claimsAudited += 1;
      stats.byReviewState[claim.review_state] = (stats.byReviewState[claim.review_state] ?? 0) + 1;

      const cCount = citationCount(claim);
      if (cCount === 0) stats.byCitationCount.zero += 1;
      else if (cCount === 1) stats.byCitationCount.one += 1;
      else stats.byCitationCount.two_or_more += 1;

      const normalizedPairs = normalizeSupportsPairs(claim);
      if (normalizedPairs.length > 0) stats.supportsPairs.present += 1;
      else stats.supportsPairs.missing += 1;

      const reasons: string[] = [];
      if (!hasStableClaimId(claim)) reasons.push('missing_stable_claim_id');
      if (cCount < 1) reasons.push('missing_citation_or_source');
      if (normalizedPairs.length < 1) reasons.push('missing_normalized_supports_pair');
      if (claim.review_state === 'rejected') reasons.push('already_rejected');

      if (reasons.length === 0) {
        stats.eligibleForReview += 1;
      } else {
        for (const reason of reasons) {
          stats.ineligibleReasons[reason] = (stats.ineligibleReasons[reason] ?? 0) + 1;
        }
      }
    }
  }

  console.log(JSON.stringify(stats, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

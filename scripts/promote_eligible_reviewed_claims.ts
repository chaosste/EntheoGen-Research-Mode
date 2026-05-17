import path from 'node:path';
import { canonicalPairKey, readJson, slugify, writeJson, type ClaimPackage, type ClaimRecord } from './kb-utils';

type PromoteSummary = {
  filesAudited: number;
  claimsAudited: number;
  eligibleClaims: number;
  promotedClaims: number;
  reviewedFilesWritten: number;
  skippedByReason: Record<string, number>;
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

const eligibleForPromotion = (claim: ClaimRecord): { eligible: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  if (claim.review_state !== 'human_reviewed') reasons.push('not_human_reviewed');
  if (!hasStableClaimId(claim)) reasons.push('missing_stable_claim_id');
  if (citationCount(claim) < 1) reasons.push('missing_citation_or_source');
  if (normalizeSupportsPairs(claim).length < 1) reasons.push('missing_normalized_supports_pair');
  if (claim.review_state === 'rejected') reasons.push('already_rejected');
  return { eligible: reasons.length === 0, reasons };
};

const dedupeClaims = (claims: ClaimRecord[]): ClaimRecord[] => {
  const seen = new Set<string>();
  const out: ClaimRecord[] = [];
  for (const claim of claims) {
    const key = `${claim.claim_id}|${claim.source_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(claim);
  }
  return out;
};

const run = async (): Promise<void> => {
  const kbRoot = process.env.KB_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge-base');
  const pendingDir = process.env.KB_PENDING_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'pending');
  const reviewedDir = process.env.KB_REVIEWED_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'reviewed');
  const fs = await import('node:fs/promises');
  await fs.mkdir(reviewedDir, { recursive: true });
  const entries = await fs.readdir(pendingDir, { withFileTypes: true }).catch(() => []);

  const summary: PromoteSummary = {
    filesAudited: 0,
    claimsAudited: 0,
    eligibleClaims: 0,
    promotedClaims: 0,
    reviewedFilesWritten: 0,
    skippedByReason: {}
  };

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.claims.json')) continue;
    summary.filesAudited += 1;
    const pendingPath = path.join(pendingDir, entry.name);
    const reviewedPath = path.join(reviewedDir, entry.name);
    const pendingPkg = await readJson<ClaimPackage>(pendingPath);
    const reviewedPkg = await readJson<ClaimPackage>(reviewedPath).catch(() => ({
      source_id: pendingPkg.source_id,
      source_path: pendingPkg.source_path,
      source_metadata: pendingPkg.source_metadata,
      claims: []
    }));

    const promotable: ClaimRecord[] = [];
    for (const claim of pendingPkg.claims) {
      summary.claimsAudited += 1;
      const evalResult = eligibleForPromotion(claim);
      if (evalResult.eligible) {
        summary.eligibleClaims += 1;
        promotable.push({
          ...claim,
          supports_pairs: normalizeSupportsPairs(claim)
        });
      } else {
        for (const reason of evalResult.reasons) {
          summary.skippedByReason[reason] = (summary.skippedByReason[reason] ?? 0) + 1;
        }
      }
    }

    if (promotable.length === 0) continue;
    const merged = dedupeClaims([...(reviewedPkg.claims ?? []), ...promotable]);
    const beforeCount = (reviewedPkg.claims ?? []).length;
    const promotedNow = Math.max(0, merged.length - beforeCount);
    if (promotedNow > 0) {
      summary.promotedClaims += promotedNow;
      summary.reviewedFilesWritten += 1;
      await writeJson(reviewedPath, {
        ...reviewedPkg,
        source_id: pendingPkg.source_id,
        source_path: pendingPkg.source_path,
        source_metadata: pendingPkg.source_metadata,
        claims: merged
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

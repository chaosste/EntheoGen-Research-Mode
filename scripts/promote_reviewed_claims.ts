import path from 'node:path';
import { unlink } from 'node:fs/promises';
import {
  ensureDir,
  loadSchema,
  readJson,
  validateSchemaSubset,
  writeJson,
  type ClaimPackage,
  type ClaimRecord
} from './kb-utils';

const validateClaimRecord = (claim: ClaimRecord, claimSchema: Record<string, unknown>): string[] => {
  const schemaIssues = validateSchemaSubset(claimSchema, claim, `$.claims`);
  const customIssues: string[] = [];
  if (claim.review_state === 'human_reviewed') {
    if (!claim.evidence_strength) customIssues.push('human_reviewed claims must include evidence_strength');
    if (!claim.confidence) customIssues.push('human_reviewed claims must include confidence');
  }
  return [...schemaIssues.map((issue) => `${issue.path}: ${issue.message}`), ...customIssues];
};

const run = async (): Promise<void> => {
  const kbRoot = process.env.KB_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge-base');
  const pendingDir = process.env.KB_PENDING_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'pending');
  const reviewedDir = process.env.KB_REVIEWED_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'reviewed');
  const rejectedDir = process.env.KB_REJECTED_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'rejected');
  const claimSchemaPath = process.env.KB_CLAIM_SCHEMA_PATH ?? path.join(kbRoot, 'schemas', 'claim.schema.json');

  await ensureDir(reviewedDir);
  await ensureDir(rejectedDir);

  const claimSchema = await loadSchema(claimSchemaPath);
  const entries = await (await import('node:fs/promises')).readdir(pendingDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.claims.json')) continue;
    const pendingPath = path.join(pendingDir, entry.name);
    const packageRecord = await readJson<ClaimPackage>(pendingPath);

    const humanReviewed: ClaimRecord[] = [];
    const rejected: ClaimRecord[] = [];
    const remaining: ClaimRecord[] = [];

    for (const claim of packageRecord.claims) {
      const issues = validateClaimRecord(claim, claimSchema);
      if (issues.length > 0) {
        throw new Error(`claim validation failed for ${claim.claim_id}:\n${issues.join('\n')}`);
      }
      if (claim.review_state === 'human_reviewed') {
        humanReviewed.push(claim);
      } else if (claim.review_state === 'rejected') {
        rejected.push(claim);
      } else {
        remaining.push(claim);
      }
    }

    if (humanReviewed.length > 0) {
      await writeJson(path.join(reviewedDir, entry.name), {
        ...packageRecord,
        claims: humanReviewed
      });
    }
    if (rejected.length > 0) {
      await writeJson(path.join(rejectedDir, entry.name), {
        ...packageRecord,
        claims: rejected
      });
    }
    if (remaining.length > 0) {
      await writeJson(pendingPath, {
        ...packageRecord,
        claims: remaining
      });
    } else {
      await unlink(pendingPath).catch(() => undefined);
    }
  }

  console.log('Promoted reviewed claims');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

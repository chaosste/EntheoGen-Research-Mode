import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import {
  ensureDir,
  getKnowledgeBasePaths,
  loadSchema,
  readJson,
  validateSchemaSubset,
  type ClaimPackage,
  type ClaimRecord,
  type SourceManifestEntry
} from './kb-utils';
import type { InteractionDatasetV2 } from '../src/data/interactionSchemaV2';

const loadClaimPackages = async (dirPath: string): Promise<Array<{ file: string; packageRecord: ClaimPackage }>> => {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const packages: Array<{ file: string; packageRecord: ClaimPackage }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.claims.json')) continue;
    packages.push({ file: entry.name, packageRecord: await readJson<ClaimPackage>(path.join(dirPath, entry.name)) });
  }
  return packages;
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

const validateClaim = (claim: ClaimRecord, claimSchema: Record<string, unknown>): string[] => {
  const issues = validateSchemaSubset(claimSchema, claim, `$.claim`);
  if (claim.source_id === 'alma_ayahuasca_interactions_dataset') {
    if (!claim.source_specific?.derivation) {
      issues.push({ path: '$.claim.source_specific.derivation', message: 'Alma claims must include source_specific.derivation' });
    }
  }
  return issues.map((issue) => `${issue.path}: ${issue.message}`);
};

const run = async (): Promise<void> => {
  const kbPaths = getKnowledgeBasePaths();
  const kbRoot = kbPaths.root;
  const indexesDir = kbPaths.indexesDir;
  const pendingDir = kbPaths.pendingDir;
  const reviewedDir = kbPaths.reviewedDir;
  const rejectedDir = kbPaths.rejectedDir;
  const sourceManifestPath = kbPaths.sourceManifestPath;
  const claimSchemaPath = kbPaths.claimSchemaPath;
  const sourceSchemaPath = kbPaths.sourceSchemaPath;
  const datasetPath = kbPaths.datasetPath;

  await ensureDir(indexesDir);

  const sourceSchema = await loadSchema(sourceSchemaPath);
  const claimSchema = await loadSchema(claimSchemaPath);
  const manifest = await readJson<{ version: string; sources: SourceManifestEntry[] }>(sourceManifestPath);
  const dataset = await readJson<InteractionDatasetV2>(datasetPath);

  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceTypeById = new Map(manifest.sources.map((source) => [source.source_id, source.source_type] as const));

  for (const [index, source] of manifest.sources.entries()) {
    errors.push(...validateSchemaSubset(sourceSchema, source, `$.sources[${index}]`).map((issue) => `${issue.path}: ${issue.message}`));
    for (const fileRef of source.file_refs ?? []) {
      const filePath = path.join(kbRoot, fileRef);
      if (!(await fileExists(filePath))) {
        errors.push(`missing source file referenced by ${source.source_id}: ${fileRef}`);
      }
    }
  }

  const sourceIds = new Set(manifest.sources.map((source) => source.source_id));
  for (const folder of [pendingDir, reviewedDir, rejectedDir]) {
    const packages = await loadClaimPackages(folder);
    for (const { file, packageRecord } of packages) {
      for (const claim of packageRecord.claims) {
        errors.push(...validateClaim(claim, claimSchema));
        const sourceType = sourceTypeById.get(claim.source_id);
        const isPerplexityClaim =
          claim.provenance?.source_type === 'ai_synthesis' ||
          sourceType === 'ai_synthesis' ||
          claim.source_id.startsWith('perplexity_');

        if (isPerplexityClaim) {
          if (claim.clinical_actionability === 'contraindicated') {
            errors.push(`Perplexity claim may not auto-promote to contraindicated: ${claim.claim_id}`);
          }
        }

        if (!sourceIds.has(claim.source_id)) {
          errors.push(`unknown source_id in claim ${claim.claim_id}: ${claim.source_id}`);
        }
      }
    }
  }

  const datasetSourceIds = new Set(dataset.sources.map((source) => source.id));
  for (const pair of dataset.pairs) {
    if (pair.classification.code === 'SELF') continue;
    for (const ref of pair.evidence.source_refs) {
      if (!datasetSourceIds.has(ref.source_id)) {
        errors.push(`dataset source ref ${ref.source_id} is missing from dataset.sources in ${pair.key}`);
      }
    }
    const aiRefs = pair.evidence.source_refs.filter((ref) => ref.match_type === 'ai_synthesis' || ref.source_type === 'ai_synthesis');
    const onlyAiRefs = aiRefs.length > 0 && aiRefs.length === pair.evidence.source_refs.length;
    if (onlyAiRefs && pair.classification.code === 'DETERMINISTIC') {
      errors.push(`Perplexity-only evidence may not produce deterministic classification in ${pair.key}`);
    }
    if (onlyAiRefs && pair.evidence.status === 'supported') {
      errors.push(`Perplexity-only evidence may not be marked supported in ${pair.key}`);
    }
    if (aiRefs.length > 0 && pair.evidence.support_type !== 'ai_synthesis' && onlyAiRefs) {
      errors.push(`Perplexity-only evidence must retain ai_synthesis support type in ${pair.key}`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }
    for (const warning of warnings) {
      console.warn(`WARN: ${warning}`);
    }
    console.error(`KB validation failed with ${errors.length} error(s)`);
    process.exitCode = 1;
    return;
  }

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`);
  }
  console.log(`KB validation complete. errors=0 warnings=${warnings.length}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

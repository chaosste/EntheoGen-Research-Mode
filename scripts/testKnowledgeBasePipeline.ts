import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  readJson,
  validateSchemaSubset,
  writeJson,
  type ClaimRecord,
  type SourceManifestEntry
} from './kb-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sourceSchema = JSON.parse(await readFile(path.join(root, 'knowledge-base/schemas/source.schema.json'), 'utf8')) as Record<string, unknown>;
const claimSchema = JSON.parse(await readFile(path.join(root, 'knowledge-base/schemas/claim.schema.json'), 'utf8')) as Record<string, unknown>;

const assertValid = (issues: ReturnType<typeof validateSchemaSubset>) => {
  assert.strictEqual(issues.length, 0, issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
};

const debugLog = '/tmp/entheogen-kb-test.log';
writeFileSync(debugLog, '', 'utf8');

const stage = (message: string): void => {
  const line = `[kb-test] ${message}\n`;
  appendFileSync(debugLog, line, 'utf8');
  console.log(line.trimEnd());
};

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'entheogen-kb-'));
const kbSourcesDir = path.join(tempRoot, 'sources');
const kbIndexesDir = path.join(tempRoot, 'indexes');
const kbExtractedDir = path.join(tempRoot, 'extracted');
const kbSchemasDir = path.join(tempRoot, 'schemas');
const pendingDir = path.join(kbExtractedDir, 'claims', 'pending');
const reviewedDir = path.join(kbExtractedDir, 'claims', 'reviewed');
const rejectedDir = path.join(kbExtractedDir, 'claims', 'rejected');
const datasetPath = path.join(tempRoot, 'dataset.json');
const manifestPath = path.join(kbIndexesDir, 'source_manifest.json');
const tagsPath = path.join(kbIndexesDir, 'source_tags.json');
const citationPath = path.join(kbIndexesDir, 'citation_registry.json');

mkdirSync(path.join(kbSourcesDir, 'pharmacology-reference'), { recursive: true });
mkdirSync(kbSchemasDir, { recursive: true });
mkdirSync(pendingDir, { recursive: true });
mkdirSync(reviewedDir, { recursive: true });
mkdirSync(rejectedDir, { recursive: true });

const sourceFile = (relativePath: string, content: string) => {
  const fullPath = path.join(kbSourcesDir, relativePath);
  writeFileSync(fullPath, content, 'utf8');
};

await writeJson(path.join(kbSchemasDir, 'source.schema.json'), sourceSchema);
await writeJson(path.join(kbSchemasDir, 'claim.schema.json'), claimSchema);

const runScript = (script: string, env: Record<string, string>) => {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/.bin/tsx'), script], {
    cwd: root,
    env: {
      ...process.env,
      ...env
    },
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    appendFileSync(
      debugLog,
      `[kb-test] ${script} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}\nerror:\n${result.error?.message ?? ''}\n`,
      'utf8'
    );
  }
  assert.strictEqual(
    result.status,
    0,
    `${script} failed:\n${result.stdout}\n${result.stderr}\n${result.error?.message ?? ''}`
  );
};

const cloneSource = `---
source_id: clonidine_beta_blocker_source
title: Clonidine plus beta-blocker note
source_type: pharmacology_reference
authority_level: high
evidence_domain: pharmacological
entities: ["clonidine", "beta_blockers"]
supports_pairs: [["clonidine", "beta_blockers"]]
citation: Example Pharmacology Note
url_or_path: sources/pharmacology-reference/clonidine-beta-blocker.md
notes: Rule-based extraction fixture.
---
Clonidine withdrawal can cause sympathetic rebound.
Avoid abrupt discontinuation when beta-blockade is present.
`;

const existingSource = `---
source_id: existing_source
title: Existing stronger source
source_type: pharmacology_reference
authority_level: high
evidence_domain: pharmacological
entities: ["clonidine", "beta_blockers"]
supports_pairs: [["clonidine", "beta_blockers"]]
citation: Existing Source Citation
url_or_path: sources/pharmacology-reference/existing-source.md
notes: Seed source for overwrite test.
---
This source mentions blood pressure monitoring and interaction caution.
`;

const selfSource = `---
source_id: self_source
title: Self pairing note
source_type: pharmacology_reference
authority_level: medium
evidence_domain: pharmacological
entities: ["lsd"]
citation: Self Pair Source
url_or_path: sources/pharmacology-reference/self-source.md
notes: Self pair fixture.
---
Monitor for sedation and caution when combining.
`;

await writeJson(manifestPath, { version: 'kb_v1', sources: [] });
await writeJson(tagsPath, { version: 'kb_v1', source_tags: [] });
await writeJson(citationPath, { version: 'kb_v1', citations: [] });

sourceFile('pharmacology-reference/clonidine-beta-blocker.md', cloneSource);
sourceFile('pharmacology-reference/existing-source.md', existingSource);
sourceFile('pharmacology-reference/self-source.md', selfSource);

const goodSource: SourceManifestEntry = {
  source_id: 'source_1',
  title: 'Example source',
  source_type: 'pharmacology_reference',
  authority_level: 'high',
  evidence_domain: 'pharmacological',
  year: 2024,
  authors: ['Example Author'],
  citation: 'Example Author (2024)',
  url_or_path: 'sources/pharmacology-reference/example-source.md',
  file_refs: ['sources/pharmacology-reference/example-source.md'],
  review_state: 'validated',
  notes: 'Schema test fixture'
};

assertValid(validateSchemaSubset(sourceSchema, goodSource));
stage('source schema ok');

const goodClaim: ClaimRecord = {
  claim_id: 'claim_1',
  source_id: 'source_1',
  claim: 'This pair requires monitoring.',
  claim_type: 'guidance',
  entities: ['clonidine', 'beta_blockers'],
  mechanism: 'Additive cardiovascular effects',
  evidence_strength: 'weak',
  confidence: 'low',
  supports_pairs: [['clonidine', 'beta_blockers']],
  clinical_actionability: 'monitor',
  review_state: 'human_reviewed',
  notes: 'Schema test fixture'
};

assertValid(validateSchemaSubset(claimSchema, goodClaim));
stage('claim schema ok');

const invalidClaim = {
  claim_id: 'claim_bad',
  source_id: 'source_1',
  claim: '',
  claim_type: 'guidance',
  entities: [],
  review_state: 'human_reviewed'
} as unknown as ClaimRecord;
assert.ok(validateSchemaSubset(claimSchema, invalidClaim).length > 0, 'invalid claim should fail schema validation');
stage('invalid claim rejected');

stage('extract start');
runScript('scripts/extract_claims.ts', {
  KB_ROOT: tempRoot,
  KB_SOURCES_DIR: kbSourcesDir,
  KB_INDEXES_DIR: kbIndexesDir,
  KB_EXTRACTED_DIR: kbExtractedDir,
  KB_PENDING_DIR: pendingDir,
  KB_REVIEWED_DIR: reviewedDir,
  KB_REJECTED_DIR: rejectedDir,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_SOURCE_TAGS_PATH: tagsPath,
  KB_CITATION_REGISTRY_PATH: citationPath
});
stage('extract ok');

const extractedPackage = await readJson<{ source_id: string; claims: ClaimRecord[] }>(path.join(pendingDir, 'clonidine_beta_blocker_source.claims.json'));
assert.ok(extractedPackage.claims.length > 0, 'extraction should produce pending claims');
assert.strictEqual(extractedPackage.claims[0].review_state, 'machine_extracted');
assert.strictEqual(extractedPackage.claims[0].confidence, 'low');

const mixedPackage = {
  source_id: 'clonidine_beta_blocker_source',
  source_path: 'sources/pharmacology-reference/clonidine-beta-blocker.md',
  source_metadata: { source_id: 'clonidine_beta_blocker_source', title: 'Clonidine plus beta-blocker note' },
  claims: [
    {
      claim_id: 'claim_reviewed',
      source_id: 'clonidine_beta_blocker_source',
      claim: 'Clonidine plus beta-blockers should be monitored carefully.',
      claim_type: 'guidance',
      entities: ['clonidine', 'beta_blockers'],
      supports_pairs: [['clonidine', 'beta_blockers']],
      evidence_strength: 'moderate',
      confidence: 'medium',
      clinical_actionability: 'monitor',
      review_state: 'human_reviewed',
      notes: 'Reviewed fixture'
    },
    {
      claim_id: 'claim_rejected',
      source_id: 'clonidine_beta_blocker_source',
      claim: 'This should not be accepted.',
      claim_type: 'risk',
      entities: ['clonidine', 'beta_blockers'],
      review_state: 'rejected',
      notes: 'Rejected fixture'
    },
    {
      claim_id: 'claim_pending',
      source_id: 'clonidine_beta_blocker_source',
      claim: 'Continue monitoring.',
      claim_type: 'guidance',
      entities: ['clonidine', 'beta_blockers'],
      review_state: 'machine_extracted',
      notes: 'Pending fixture'
    }
  ]
};
await writeJson(path.join(pendingDir, 'manual-mixed.claims.json'), mixedPackage);

stage('promote start');
runScript('scripts/promote_reviewed_claims.ts', {
  KB_ROOT: tempRoot,
  KB_INDEXES_DIR: kbIndexesDir,
  KB_PENDING_DIR: pendingDir,
  KB_REVIEWED_DIR: reviewedDir,
  KB_REJECTED_DIR: rejectedDir,
  KB_CLAIM_SCHEMA_PATH: path.join(root, 'knowledge-base/schemas/claim.schema.json')
});
stage('promote ok');

const promotedReviewed = await readJson<{ claims: ClaimRecord[] }>(path.join(reviewedDir, 'manual-mixed.claims.json'));
const promotedRejected = await readJson<{ claims: ClaimRecord[] }>(path.join(rejectedDir, 'manual-mixed.claims.json'));
const promotedPending = await readJson<{ claims: ClaimRecord[] }>(path.join(pendingDir, 'manual-mixed.claims.json'));
assert.strictEqual(promotedReviewed.claims.length, 1);
assert.strictEqual(promotedReviewed.claims[0].review_state, 'human_reviewed');
assert.strictEqual(promotedRejected.claims.length, 1);
assert.strictEqual(promotedRejected.claims[0].review_state, 'rejected');
assert.strictEqual(promotedPending.claims.length, 1);
assert.strictEqual(promotedPending.claims[0].review_state, 'machine_extracted');

await writeJson(path.join(reviewedDir, 'existing.reviewed.claims.json'), {
  source_id: 'existing_source',
  source_path: 'sources/pharmacology-reference/existing-source.md',
  source_metadata: { source_id: 'existing_source', title: 'Existing stronger source' },
  claims: [
    {
      claim_id: 'existing_claim',
      source_id: 'existing_source',
      claim: 'Clonidine plus beta-blockers warrants caution.',
      claim_type: 'guidance',
      entities: ['clonidine', 'beta_blockers'],
      supports_pairs: [['clonidine', 'beta_blockers']],
      evidence_strength: 'weak',
      confidence: 'low',
      clinical_actionability: 'caution',
      review_state: 'human_reviewed',
      notes: 'Weaker than existing dataset source'
    }
  ]
});

await writeJson(path.join(reviewedDir, 'self.reviewed.claims.json'), {
  source_id: 'self_source',
  source_path: 'sources/pharmacology-reference/self-source.md',
  source_metadata: { source_id: 'self_source', title: 'Self pairing note' },
  claims: [
    {
      claim_id: 'self_claim',
      source_id: 'self_source',
      claim: 'Self reference should not map to a self pair.',
      claim_type: 'guidance',
      entities: ['lsd'],
      supports_pairs: [['lsd', 'lsd']],
      evidence_strength: 'weak',
      confidence: 'low',
      clinical_actionability: 'monitor',
      review_state: 'human_reviewed',
      notes: 'Self-pair fixture'
    }
  ]
});

stage('link start');
await writeJson(path.join(datasetPath), {
  schema_version: 'v2',
  generated_at: new Date().toISOString(),
  substances: [
    { id: 'clonidine', name: 'Clonidine' },
    { id: 'beta_blockers', name: 'Beta Blockers' },
    { id: 'lsd', name: 'LSD' }
  ],
  pairs: [
    {
      key: 'beta_blockers|clonidine',
      substances: ['clonidine', 'beta_blockers'],
      classification: { code: 'DETERMINISTIC', status: 'confirmed', confidence: 'high', risk_score: 8, label: 'Established clinically significant interaction' },
      clinical_summary: { headline: 'Seed pair', mechanism: 'Seed mechanism' },
      mechanism: { primary_category: 'rebound_hypertension', categories: ['rebound_hypertension', 'hemodynamic_interaction'] },
      evidence: {
        tier: 'direct_human_data',
        support_type: 'direct',
        source_refs: [
          {
            source_id: 'existing_source',
            claim_id: 'seed-strong',
            match_type: 'direct_pair',
            evidence_strength: 'strong',
            review_state: 'human_reviewed'
          }
        ],
        status: 'supported',
        review_state: 'human_reviewed',
        review_notes: 'Seed strong source'
      },
      provenance: {
        derivation_type: 'explicit_source',
        source: 'deterministic_mapping_table',
        confidence_tier: 'high',
        migrated_from_v1: true,
        migration_version: 'v1_to_v2',
        migrated_at: new Date().toISOString()
      },
      override_metadata: { applied: false },
      audit: { validation_flags: [], review_status: 'human_reviewed' }
    },
    {
      key: 'lsd|lsd',
      substances: ['lsd', 'lsd'],
      classification: { code: 'SELF', status: 'not_applicable', confidence: 'n/a', risk_score: -1, label: 'Same Entity / N-A' },
      clinical_summary: { headline: 'Self pair', mechanism: 'None' },
      mechanism: { primary_category: 'psychiatric_destabilization', categories: ['psychiatric_destabilization'] },
      evidence: {
        tier: 'not_applicable',
        support_type: 'none',
        source_refs: [],
        status: 'not_reviewed',
        review_state: 'unreviewed',
        review_notes: 'SELF pair'
      },
      provenance: {
        derivation_type: 'self_pair',
        source: 'self_pair',
        confidence_tier: 'low',
        migrated_from_v1: true,
        migration_version: 'v1_to_v2',
        migrated_at: new Date().toISOString()
      },
      override_metadata: { applied: false },
      audit: { validation_flags: [], review_status: 'needs_review' }
    }
  ],
  sources: []
});

runScript('scripts/link_claims_to_interactions.ts', {
  KB_ROOT: tempRoot,
  KB_INDEXES_DIR: kbIndexesDir,
  KB_REVIEWED_DIR: reviewedDir,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_DATASET_PATH: datasetPath
});
stage('link ok');

const linkedDataset = await readJson<any>(datasetPath);
const linkedPair = linkedDataset.pairs.find((pair: any) => pair.key === 'beta_blockers|clonidine');
assert.ok(linkedPair, 'linked pair should exist');
assert.ok(
  linkedPair.evidence.source_refs.some((ref: any) => ref.claim_id === 'claim_reviewed' && ref.source_id === 'clonidine_beta_blocker_source'),
  'reviewed claim should be linked to the matching non-SELF pair'
);
assert.strictEqual(
  linkedPair.evidence.source_refs.filter((ref: any) => ref.source_id === 'existing_source').length,
  1,
  'strong existing evidence should not be overwritten or duplicated by weaker evidence'
);
assert.strictEqual(
  linkedPair.evidence.source_refs.find((ref: any) => ref.source_id === 'existing_source')?.evidence_strength,
  'strong'
);

const selfPair = linkedDataset.pairs.find((pair: any) => pair.key === 'lsd|lsd');
assert.ok(selfPair, 'self pair should exist');
assert.strictEqual(selfPair.evidence.source_refs.length, 0, 'SELF interaction should not receive linked claims');

stage('validate start');
runScript('scripts/validateKnowledgeBase.ts', {
  KB_ROOT: tempRoot,
  KB_INDEXES_DIR: kbIndexesDir,
  KB_PENDING_DIR: pendingDir,
  KB_REVIEWED_DIR: reviewedDir,
  KB_REJECTED_DIR: rejectedDir,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_DATASET_PATH: datasetPath
});
stage('validate ok');

rmSync(tempRoot, { recursive: true, force: true });
console.log('knowledge-base pipeline checks passed');

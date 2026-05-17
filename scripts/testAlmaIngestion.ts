import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readJson, writeJson, type ClaimRecord } from './kb-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const runScript = (script: string, env: Record<string, string>) => {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/.bin/tsx'), script], {
    cwd: root,
    env: {
      ...process.env,
      ...env
    },
    encoding: 'utf8'
  });
  assert.strictEqual(
    result.status,
    0,
    `${script} failed:\n${result.stdout}\n${result.stderr}\n${result.error?.message ?? ''}`
  );
};

const stage = (message: string): void => {
  console.log(`[alma-test] ${message}`);
};

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'entheogen-alma-'));
const kbSourcesDir = path.join(tempRoot, 'sources', 'expert-guidelines');
const kbIndexesDir = path.join(tempRoot, 'indexes');
const kbExtractedDir = path.join(tempRoot, 'extracted');
const pendingDir = path.join(kbExtractedDir, 'claims', 'pending');
const reviewedDir = path.join(kbExtractedDir, 'claims', 'reviewed');
const rejectedDir = path.join(kbExtractedDir, 'claims', 'rejected');
const reportDir = path.join(tempRoot, 'reports');
const datasetPath = path.join(tempRoot, 'dataset.json');
const manifestPath = path.join(kbIndexesDir, 'source_manifest.json');
const tagsPath = path.join(kbIndexesDir, 'source_tags.json');
const citationPath = path.join(kbIndexesDir, 'citation_registry.json');
const almaSourcePath = path.join(kbSourcesDir, 'alma_ayahuasca_interactions_dataset.md');

mkdirSync(kbSourcesDir, { recursive: true });
mkdirSync(pendingDir, { recursive: true });
mkdirSync(reviewedDir, { recursive: true });
mkdirSync(rejectedDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });
stage('fixture setup');

const sourceBody = `---
source_id: alma_ayahuasca_interactions_dataset
title: Alma Healing Center Ayahuasca and Medication Interactions
source_type: expert_dataset
authority_level: low
evidence_domain: aggregated_clinical
review_state: extracted
source_pdf_path: /Users/stephenbeale/Desktop/Alma-Healing-Centre-Ayahuasca-and-medication-interactions.pdf
---

MEDICATION                          INTERACTION                      OTHER INFORMATION
Sertraline [Zoloft]                Minor                            The risk or severity of serotonin syndrome can be increased.
Sertraline [Zoloft]                Major                            Using sertraline with MAOIs can increase risk.
Acorus Calamus Root                No interactions
Moclobemide                         Moderate / Major                Reversible MAOI proxy.
`;
writeFileSync(almaSourcePath, sourceBody, 'utf8');

await writeJson(manifestPath, { version: 'kb_v1', sources: [] });
await writeJson(tagsPath, { version: 'kb_v1', source_tags: [] });
await writeJson(citationPath, { version: 'kb_v1', citations: [] });

await writeJson(datasetPath, {
  schema_version: 'v2',
  generated_at: new Date().toISOString(),
  substances: [
    { id: 'ayahuasca', name: 'Ayahuasca' },
    { id: 'sertraline', name: 'Sertraline' },
    { id: 'moclobemide', name: 'Moclobemide' },
    { id: 'acorus_calamus_root', name: 'Acorus Calamus Root' }
  ],
  pairs: [
    {
      key: 'ayahuasca|sertraline',
      substances: ['ayahuasca', 'sertraline'],
      classification: { code: 'DETERMINISTIC', status: 'confirmed', confidence: 'high', risk_score: 9, label: 'Established serotonergic interaction' },
      clinical_summary: { headline: 'Seed pair', mechanism: 'Seed mechanism' },
      mechanism: { primary_category: 'serotonergic_toxicity', categories: ['serotonergic_toxicity'] },
      evidence: {
        tier: 'direct_human_data',
        support_type: 'direct',
        source_refs: [],
        status: 'supported',
        review_state: 'human_reviewed',
        review_notes: 'Seed high risk'
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
    }
  ],
  sources: []
});

runScript('scripts/ingest_alma_interactions.ts', {
  KB_ROOT: tempRoot,
  KB_ALMA_SOURCE_PATH: almaSourcePath,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_SOURCE_TAGS_PATH: tagsPath,
  KB_CITATION_REGISTRY_PATH: citationPath,
  KB_PENDING_DIR: pendingDir,
  KB_DATASET_PATH: datasetPath,
  KB_ALMA_REPORT_PATH: path.join(reportDir, 'alma_ingestion_report.json'),
  KB_SOURCE_SCHEMA_PATH: path.join(root, 'knowledge-base/schemas/source.schema.json'),
  KB_CLAIM_SCHEMA_PATH: path.join(root, 'knowledge-base/schemas/claim.schema.json')
});
stage('ingest ok');

const pendingPackage = await readJson<{ claims: ClaimRecord[] }>(path.join(pendingDir, 'alma_ayahuasca_interactions_dataset.claims.json'));
assert.ok(pendingPackage.claims.length >= 4, 'expected Alma ingestion to generate multiple claims');
stage('pending package ok');

const sertralineMinor = pendingPackage.claims.find((claim) => claim.source_specific?.severity_label === 'Minor');
assert.ok(sertralineMinor, 'minor sertraline claim should exist');
assert.ok(sertralineMinor?.entities.includes('SSRIs'), 'sertraline should infer SSRI class');
assert.ok(sertralineMinor?.source_specific?.aliases?.includes('Zoloft'), 'bracketed brand alias should be preserved');
assert.strictEqual(sertralineMinor?.confidence, 'low');
assert.strictEqual(sertralineMinor?.evidence_strength, 'weak');
assert.strictEqual(sertralineMinor?.clinical_actionability, 'monitor');

const moclobemide = pendingPackage.claims.find((claim) => claim.source_specific?.severity_label === 'Moderate / Major');
assert.ok(moclobemide, 'moderate-major claim should exist');
assert.strictEqual(moclobemide?.clinical_actionability, 'avoid');
assert.ok(moclobemide?.source_specific?.derivation, 'Alma claims need source_specific.derivation');

const noInteraction = pendingPackage.claims.find((claim) => claim.source_specific?.severity_label === 'No interactions');
assert.ok(noInteraction, 'no interaction claim should exist');
assert.strictEqual(noInteraction?.claim_type, 'guidance');
assert.strictEqual(noInteraction?.clinical_actionability, 'none');

const report = await readJson<any>(path.join(reportDir, 'alma_ingestion_report.json'));
assert.ok(report.duplicate_medication_entries.some((entry: any) => entry.normalized_medication_name === 'sertraline'), 'duplicate sertraline rows should be reported');
assert.ok(report.entries_conflicting_with_existing_dataset.length > 0, 'expected a conflict against the seeded deterministic pair');
assert.ok(report.entries_suggesting_new_interaction_pairs.length > 0, 'expected new pair suggestions');
stage('report ok');

runScript('scripts/validateKnowledgeBase.ts', {
  KB_ROOT: tempRoot,
  KB_INDEXES_DIR: kbIndexesDir,
  KB_PENDING_DIR: pendingDir,
  KB_REVIEWED_DIR: reviewedDir,
  KB_REJECTED_DIR: rejectedDir,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_DATASET_PATH: datasetPath,
  KB_SOURCE_SCHEMA_PATH: path.join(root, 'knowledge-base/schemas/source.schema.json'),
  KB_CLAIM_SCHEMA_PATH: path.join(root, 'knowledge-base/schemas/claim.schema.json')
});
stage('validate ok');

const reviewedCopy = {
  ...pendingPackage,
  claims: pendingPackage.claims
    .filter((claim) => claim.source_specific?.severity_label === 'Minor')
    .slice(0, 1)
    .map((claim) => ({
      ...claim,
      review_state: 'human_reviewed' as const
    }))
};
await writeJson(path.join(reviewedDir, 'alma.reviewed.claims.json'), reviewedCopy);

runScript('scripts/link_claims_to_interactions.ts', {
  KB_ROOT: tempRoot,
  KB_REVIEWED_DIR: reviewedDir,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_DATASET_PATH: datasetPath
});
stage('link ok');

const linkedDataset = await readJson<any>(datasetPath);
const linkedPair = linkedDataset.pairs.find((pair: any) => pair.key === 'ayahuasca|sertraline');
assert.ok(linkedPair, 'seeded pair should exist');
assert.strictEqual(linkedPair.classification.code, 'DETERMINISTIC', 'Alma evidence must not downgrade or reclassify the pair');
assert.ok(linkedPair.evidence.source_refs.some((ref: any) => ref.source_id === 'alma_ayahuasca_interactions_dataset'), 'reviewed Alma claim should link as a source ref');

stage('complete');
console.log('Alma ingestion checks passed');

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readJson, writeJson, type ClaimRecord } from './kb-utils';
import { extractPerplexityClaimsDetailed, extractPerplexityCitations } from './perplexity-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const perplexitySourceId = 'perplexity_ayahuasca_interactions_synthesis_2026';

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

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'entheogen-perplexity-'));
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
const perplexitySourcePath = path.join(kbSourcesDir, `${perplexitySourceId}.md`);

mkdirSync(kbSourcesDir, { recursive: true });
mkdirSync(pendingDir, { recursive: true });
mkdirSync(reviewedDir, { recursive: true });
mkdirSync(rejectedDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

writeFileSync(
  perplexitySourcePath,
  `# Ayahuasca Interaction Synthesis

## Metadata
- source_id: ${perplexitySourceId}
- source_type: ai_synthesis
- authority_level: low
- evidence_domain: aggregated_clinical
- year: 2026
- authors: Perplexity research synthesis
- citation: Perplexity research synthesis, generated/retrieved 2026-04-25

---

## Key Claims
### Claim 1
- claim: Ayahuasca with sertraline may increase serotonin syndrome risk.
- type: contraindication
- entities: [ayahuasca, sertraline, SSRIs]
- confidence: low
- evidence_strength: theoretical
- citation: [Halman et al. 2023](https://example.com/halman) doi:10.1234/example.doi

### Claim 2
- claim: Harmala alkaloids inhibit MAO-A and can potentiate serotonergic signaling.
- type: mechanism
- entities: [ayahuasca, harmala alkaloids, MAO-A]
- confidence: low
- evidence_strength: theoretical

### Claim 3
- claim: Moclobemide-like MAOI potentiation may increase blood pressure risk when combined with serotonergic drugs.
- type: interaction
- entities: [moclobemide, MAOI, serotonergic drugs]
- confidence: low
- evidence_strength: theoretical
`,
  'utf8'
);

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
    { id: 'clonidine', name: 'Clonidine' }
  ],
  pairs: [
    {
      key: 'ayahuasca|sertraline',
      substances: ['ayahuasca', 'sertraline'],
      classification: { code: 'THEORETICAL', status: 'inferred', confidence: 'low', risk_score: null, label: 'Theoretical serotonergic interaction' },
      clinical_summary: { headline: 'Seed pair', mechanism: 'Seed mechanism' },
      mechanism: { primary_category: 'serotonergic_toxicity', categories: ['serotonergic_toxicity', 'hemodynamic_interaction'] },
      evidence: {
        tier: 'theoretical',
        support_type: 'mechanistic',
        source_refs: [],
        status: 'not_reviewed',
        review_state: 'unreviewed',
        review_notes: 'Seed pair'
      },
      provenance: {
        derivation_type: 'curated_inference',
        source: 'heuristic_fallback',
        confidence_tier: 'low',
        requires_verification: true,
        migrated_from_v1: true,
        migration_version: 'v1_to_v2',
        migrated_at: new Date().toISOString()
      },
      override_metadata: { applied: false },
      audit: { validation_flags: [], review_status: 'needs_review' }
    },
    {
      key: 'ayahuasca|clonidine',
      substances: ['ayahuasca', 'clonidine'],
      classification: { code: 'THEORETICAL', status: 'inferred', confidence: 'low', risk_score: null, label: 'Theoretical cardiovascular interaction' },
      clinical_summary: { headline: 'Existing strong source', mechanism: 'Existing strong source' },
      mechanism: { primary_category: 'hemodynamic_interaction', categories: ['hemodynamic_interaction', 'noradrenergic_suppression'] },
      evidence: {
        tier: 'theoretical',
        support_type: 'mechanistic',
        source_refs: [
          {
            source_id: 'existing_strong_source',
            claim_id: 'seed-strong',
            match_type: 'direct_pair',
            evidence_strength: 'strong',
            confidence: 'high',
            review_state: 'human_reviewed',
            notes: 'Seed strong source'
          }
        ],
        status: 'limited_data',
        review_state: 'human_reviewed',
        review_notes: 'Seed strong source'
      },
      provenance: {
        derivation_type: 'curated_inference',
        source: 'heuristic_fallback',
        confidence_tier: 'low',
        migrated_from_v1: true,
        migration_version: 'v1_to_v2',
        migrated_at: new Date().toISOString()
      },
      override_metadata: { applied: false },
      audit: { validation_flags: [], review_status: 'needs_review' }
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
  sources: [
    {
      id: 'existing_strong_source',
      title: 'Existing strong source',
      source_type: 'primary_source',
      reliability: 'unknown',
      fingerprint: 'seeded-existing-strong-source'
    }
  ]
});

const structuredMarkdown = `# Perplexity Example

## Key Claims

### Claim 1
- claim: Combining ayahuasca with SSRIs may increase risk of serotonin syndrome.
- type: contraindication
- entities: [ayahuasca, SSRIs]
- confidence: low
- evidence_strength: theoretical
- citation: [Halman et al. 2023](https://example.com/halman) doi:10.1234/example.doi

### Claim 2
- claim: It is not considered primary or authoritative evidence.
- type: guidance
- entities: [this source]
- confidence: low
- evidence_strength: theoretical

### Claim 3
- claim: Harmala alkaloids inhibit MAO-A and increase oral DMT bioavailability.
- type: mechanism
- entities: [harmine, harmaline, DMT, MAOI]
- confidence: low
- evidence_strength: theoretical
`;

const structuredResult = extractPerplexityClaimsDetailed('perplexity_structured_test_2025', 'Perplexity Example', structuredMarkdown);
assert.strictEqual(structuredResult.claims.length, 2, 'structured claims should be preferred and meta claims rejected');
assert.ok(structuredResult.rejected.some((entry) => entry.reason.includes('lacks pharmacological claim signal')));
assert.ok(structuredResult.claims.some((claim) => claim.claim.includes('SSRIs')));
assert.ok(structuredResult.claims.some((claim) => claim.claim.includes('Harmala alkaloids')));
assert.ok((structuredResult.claims[0].provenance.cited_sources ?? []).length > 0, 'structured claim citations should be attached');
assert.ok(!structuredResult.claims.some((claim) => claim.claim.includes('primary or authoritative evidence')));

const citationMarkdown = `### Claim 1
- claim: Combining ayahuasca with SSRIs may increase risk of serotonin syndrome.
- type: contraindication
- entities: [ayahuasca, SSRIs]
- citation: [Halman et al. 2023](https://example.com/halman) doi:10.1234/example.doi

### References
Halman et al. (2023) https://example.com/halman
`;
const citations = extractPerplexityCitations(citationMarkdown);
assert.strictEqual(citations.length, 2, 'should deduplicate repeated citations');
assert.ok(citations.some((citation) => citation.url === 'https://example.com/halman'));
assert.ok(citations.some((citation) => citation.doi === '10.1234/example.doi'));

runScript('scripts/ingest_perplexity_research.ts', {
  KB_ROOT: tempRoot,
  KB_SOURCES_DIR: path.join(tempRoot, 'sources'),
  KB_INDEXES_DIR: kbIndexesDir,
  KB_EXTRACTED_DIR: kbExtractedDir,
  KB_PENDING_DIR: pendingDir,
  KB_REVIEWED_DIR: reviewedDir,
  KB_REJECTED_DIR: rejectedDir,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_SOURCE_TAGS_PATH: tagsPath,
  KB_CITATION_REGISTRY_PATH: citationPath,
  KB_DATASET_PATH: datasetPath,
  KB_PERPLEXITY_REPORT_PATH: path.join(reportDir, 'perplexity_ingestion_report.json'),
  KB_SOURCE_SCHEMA_PATH: path.join(root, 'knowledge-base/schemas/source.schema.json'),
  KB_CLAIM_SCHEMA_PATH: path.join(root, 'knowledge-base/schemas/claim.schema.json')
});

const pendingClaimsFilename = `${perplexitySourceId}.claims.json`;
const pendingPackage = await readJson<{ claims: ClaimRecord[] }>(path.join(pendingDir, pendingClaimsFilename));
assert.ok(pendingPackage.claims.length >= 2, 'expected Perplexity ingestion to generate several claims');

const sertralineClaim = pendingPackage.claims.find((claim) => claim.claim.includes('sertraline'));
assert.ok(sertralineClaim, 'sertraline claim should exist');
assert.strictEqual(sertralineClaim?.review_state, 'needs_verification');
assert.strictEqual(sertralineClaim?.evidence_strength, 'theoretical');
assert.strictEqual(sertralineClaim?.confidence, 'low');
assert.strictEqual(sertralineClaim?.provenance?.source_type, 'ai_synthesis');
assert.strictEqual(sertralineClaim?.provenance?.requires_verification, true);
assert.strictEqual(sertralineClaim?.provenance?.ingestion_method, 'perplexity_ingestion_v1');
assert.ok((sertralineClaim?.provenance?.cited_sources ?? []).length >= 2, 'citations should be extracted');
assert.ok(sertralineClaim?.entities.includes('SSRIs'), 'sertraline should infer the SSRI class');

const citationRegistry = await readJson<{ citations: Array<{ status?: string; discovered_via?: string; title?: string; url?: string; doi?: string }> }>(citationPath);
assert.ok(citationRegistry.citations.some((entry) => entry.status === 'unverified'), 'new citations should be marked unverified');
assert.ok(citationRegistry.citations.some((entry) => entry.discovered_via === perplexitySourceId), 'citation registry should record discovery source');

const report = await readJson<any>(path.join(reportDir, 'perplexity_ingestion_report.json'));
assert.ok(report.total_files_processed >= 1, 'report should count processed files');
assert.ok(report.total_claims_generated >= 3, 'report should count claims');
assert.ok(report.candidate_new_interaction_pairs.length >= 1, 'report should note new candidate pairs');
assert.ok(typeof report.total_claims_rejected === 'number', 'report should count rejected claims');
assert.ok(Array.isArray(report.rejected_claim_examples), 'report should include rejected claim examples');
assert.strictEqual(report.quality_filters.pharmacological_filter_enabled, true);
assert.strictEqual(report.quality_filters.meta_text_rejection_enabled, true);
assert.strictEqual(report.quality_filters.structured_claim_preference_enabled, true);

const reviewedPackage = {
  ...pendingPackage,
  claims: pendingPackage.claims
    .filter((claim) => claim.claim.includes('sertraline'))
    .slice(0, 1)
    .map((claim) => ({
      ...claim,
      review_state: 'human_reviewed' as const
    }))
};
await writeJson(path.join(reviewedDir, pendingClaimsFilename), reviewedPackage);

runScript('scripts/link_claims_to_interactions.ts', {
  KB_ROOT: tempRoot,
  KB_REVIEWED_DIR: reviewedDir,
  KB_SOURCE_MANIFEST_PATH: manifestPath,
  KB_DATASET_PATH: datasetPath
});

const linkedDataset = await readJson<any>(datasetPath);
const linkedPair = linkedDataset.pairs.find((pair: any) => pair.key === 'ayahuasca|sertraline');
assert.ok(linkedPair, 'sertraline pair should exist');
assert.notStrictEqual(linkedPair.classification.code, 'DETERMINISTIC', 'Perplexity evidence must not promote deterministic classification');
assert.strictEqual(linkedPair.evidence.status, 'provisional_secondary', 'Perplexity linkage should remain provisional');
assert.ok(
  linkedPair.evidence.source_refs.some((ref: any) =>
    ref.source_id === perplexitySourceId &&
    ref.match_type === 'ai_synthesis' &&
    ref.confidence === 'low' &&
    ref.requires_verification === true
  ),
  'Perplexity source ref should be appended with provisional metadata'
);

const strongPair = linkedDataset.pairs.find((pair: any) => pair.key === 'ayahuasca|clonidine');
assert.ok(strongPair, 'strong source pair should exist');
assert.strictEqual(
  strongPair.evidence.source_refs.find((ref: any) => ref.source_id === 'existing_strong_source')?.evidence_strength,
  'strong',
  'stronger evidence must be preserved'
);
assert.strictEqual(
  strongPair.evidence.source_refs.filter((ref: any) => ref.source_id === perplexitySourceId).length,
  0,
  'weaker Perplexity evidence should not replace stronger source refs'
);

const selfPair = linkedDataset.pairs.find((pair: any) => pair.key === 'lsd|lsd');
assert.ok(selfPair, 'self pair should exist');
assert.strictEqual(selfPair.evidence.source_refs.length, 0, 'SELF interaction should not receive linked claims');

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

rmSync(tempRoot, { recursive: true, force: true });
console.log('Perplexity ingestion checks passed');

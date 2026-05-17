import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapDrugDatasetFromRepo } from './bootstrapDrugDatasetFromRepo';
import { getDRUGS, resolveInteraction } from '../src/data/drugData';
import { groupValidationFlags, inferEvidenceStatus, inferReviewState, type EvidenceEpistemicInput } from '../src/data/evidenceEpistemics';
import { linkSourceRefsForPair } from '../src/data/sourceLinking';
import type { InteractionDatasetV2 } from '../src/data/interactionSchemaV2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
bootstrapDrugDatasetFromRepo(root);
const datasetPath = path.join(root, 'src/data/interactionDatasetV2.json');

const assertDeterministicMatch = (
  drugA: string,
  drugB: string,
  expectations: {
    code?: string;
    label?: string;
    confidenceTier: 'high' | 'medium';
    riskLevel?: 'high' | 'moderate';
    mechanismNeedle?: string;
  }
) => {
  const forward = resolveInteraction(drugA, drugB);
  const reverse = resolveInteraction(drugB, drugA);

  if (expectations.code) {
    assert.strictEqual(forward.evidence.code, expectations.code, `${drugA}+${drugB} should resolve as ${expectations.code}`);
  }
  if (expectations.label) {
    assert.strictEqual(forward.evidence.label, expectations.label, `${drugA}+${drugB} should use the expected label`);
  }
  assert.strictEqual(forward.origin, 'explicit', `${drugA}+${drugB} should hit the deterministic table`);
  assert.strictEqual(forward.evidence.provenance?.source, 'deterministic_mapping_table');
  assert.strictEqual(forward.evidence.provenance?.confidenceTier, expectations.confidenceTier);
  if (expectations.riskLevel) {
    assert.strictEqual(forward.evidence.riskAssessment?.level, expectations.riskLevel);
  }
  if (expectations.mechanismNeedle) {
    assert.match(forward.evidence.mechanism ?? '', new RegExp(expectations.mechanismNeedle, 'i'));
  }
  assert.deepStrictEqual(
    {
      code: forward.evidence.code,
      label: forward.evidence.label,
      source: forward.evidence.provenance?.source,
      confidenceTier: forward.evidence.provenance?.confidenceTier,
      riskLevel: forward.evidence.riskAssessment?.level
    },
    {
      code: reverse.evidence.code,
      label: reverse.evidence.label,
      source: reverse.evidence.provenance?.source,
      confidenceTier: reverse.evidence.provenance?.confidenceTier,
      riskLevel: reverse.evidence.riskAssessment?.level
    },
    `${drugA}+${drugB} should be commutative`
  );
};

const assertFallbackInference = (drugA: string, drugB: string) => {
  const resolved = resolveInteraction(drugA, drugB);

  assert.strictEqual(resolved.evidence.code, 'INFERRED', `${drugA}+${drugB} should fall back to inference`);
  assert.strictEqual(resolved.origin, 'fallback');
  assert.strictEqual(resolved.evidence.label, 'Mechanistic inference');
  assert.strictEqual(resolved.evidence.provenance?.source, 'heuristic_fallback');
  assert.strictEqual(resolved.evidence.provenance?.method, 'rule_based_inference_v1');
  assert.strictEqual(resolved.evidence.provenance?.confidenceTier, 'low');
  assert.notStrictEqual(resolved.evidence.mechanismCategory, 'unknown');
  assert.ok(resolved.evidence.riskAssessment, `${drugA}+${drugB} should carry a risk assessment`);
};

const assertSelfPair = (drug: string) => {
  const resolved = resolveInteraction(drug, drug);
  assert.strictEqual(resolved.origin, 'self');
  assert.strictEqual(resolved.evidence.code, 'SELF');
  assert.strictEqual(resolved.evidence.label, 'Same Entity / N-A');
  assert.strictEqual(resolved.evidence.provenance?.source, 'self_pair');
};

const assertNoUnknownNonSelf = () => {
  for (let i = 0; i < getDRUGS().length; i += 1) {
    for (let j = i + 1; j < getDRUGS().length; j += 1) {
      const a = getDRUGS()[i].id;
      const b = getDRUGS()[j].id;
      const resolved = resolveInteraction(a, b);
      assert.notStrictEqual(resolved.evidence.code, 'UNKNOWN', `${a}+${b} must not resolve to UNKNOWN`);
      assert.notStrictEqual(resolved.evidence.mechanismCategory, 'unknown', `${a}+${b} must not have unknown mechanism category`);
    }
  }
};

const buildEpistemicInput = (overrides: Partial<EvidenceEpistemicInput>): EvidenceEpistemicInput => ({
  provenanceSource: 'manual_review',
  sourceRefs: ['source_a'],
  supportType: 'none',
  evidenceTier: 'not_applicable',
  reviewed: true,
  ...overrides
});

const assertEvidenceStatusMapping = () => {
  const placeholder = buildEpistemicInput({
    provenanceSource: 'generated_unknown',
    sourceRefs: ['source_gap'],
    isGeneratedPlaceholder: true,
    reviewed: false
  });
  assert.strictEqual(inferReviewState(placeholder), 'unreviewed');
  assert.strictEqual(inferEvidenceStatus(placeholder), 'not_reviewed');

  const reviewedEmpty = buildEpistemicInput({
    sourceRefs: ['source_direct'],
    supportType: 'none',
    reviewed: true
  });
  assert.strictEqual(inferReviewState(reviewedEmpty), 'human_reviewed');
  assert.strictEqual(inferEvidenceStatus(reviewedEmpty), 'no_data');

  const theoretical = buildEpistemicInput({
    provenanceSource: 'mechanistic_inference',
    supportType: 'mechanistic',
    evidenceTier: 'theoretical',
    isTheoretical: true
  });
  assert.strictEqual(inferReviewState(theoretical), 'machine_inferred');
  assert.strictEqual(inferEvidenceStatus(theoretical), 'mechanistic_inference');

  const conflicting = buildEpistemicInput({
    summary: 'conflicting reports on combined use',
    supportType: 'none',
    reviewed: true,
    isConflicting: true
  });
  assert.strictEqual(inferReviewState(conflicting), 'requires_review');
  assert.strictEqual(inferEvidenceStatus(conflicting), 'conflicting_evidence');

  const deterministic = buildEpistemicInput({
    provenanceSource: 'deterministic_mapping_table',
    supportType: 'direct',
    evidenceTier: 'direct_human_data',
    explicitDeterministic: true
  });
  assert.strictEqual(inferReviewState(deterministic), 'human_reviewed');
  assert.strictEqual(inferEvidenceStatus(deterministic), 'supported');
};

const assertValidationSeverityGrouping = () => {
  const grouped = groupValidationFlags([
    'missing_mechanism',
    'missing_timing',
    'low_confidence',
    'machine_inferred',
    'needs_human_review'
  ]);

  assert.deepStrictEqual(grouped.critical, ['missing_mechanism']);
  assert.deepStrictEqual(grouped.warning, ['missing_timing']);
  assert.deepStrictEqual(grouped.info, ['low_confidence', 'machine_inferred', 'needs_human_review']);

  const hasBlockingFailure = (flags: string[]) => groupValidationFlags(flags).critical.length > 0;
  assert.strictEqual(hasBlockingFailure(['missing_mechanism']), true);
  assert.strictEqual(hasBlockingFailure(['low_confidence']), false);
  assert.strictEqual(hasBlockingFailure(['machine_inferred', 'low_confidence']), false);
};

const assertSourceLinking = async () => {
  const raw = await readFile(datasetPath, 'utf8');
  const dataset = JSON.parse(raw) as InteractionDatasetV2;
  const sourceLibrary = dataset.sources;

  const direct = linkSourceRefsForPair({
    substanceA: 'psilocybin',
    substanceB: 'ssri',
    mechanismCategories: ['serotonergic_toxicity'],
    code: 'DANGEROUS',
    reviewState: 'human_reviewed',
    existingSourceRefs: [{ source_id: 'source_gap' }],
    sourceLibrary
  });
  assert.strictEqual(direct.matchType, 'direct_pair');
  assert.strictEqual(direct.evidenceStatus, 'supported');
  assert.strictEqual(direct.sourceLinkingConfidence, 'high');
  assert.notStrictEqual(direct.evidenceStrength, 'none');
  assert.strictEqual(direct.sourceRefs[0].match_type, 'direct_pair');
  assert.ok(direct.sourceRefs[0].title);

  const classLevel = linkSourceRefsForPair({
    substanceA: 'lsd',
    substanceB: 'benzodiazepines',
    mechanismCategories: ['psychiatric_destabilization'],
    code: 'CAUTION',
    reviewState: 'machine_inferred',
    existingSourceRefs: [{ source_id: 'source_gap' }],
    sourceLibrary
  });
  assert.strictEqual(classLevel.matchType, 'drug_class');
  assert.strictEqual(classLevel.evidenceStatus, 'limited_data');
  assert.notStrictEqual(classLevel.sourceLinkingConfidence, 'high');

  const mechanism = linkSourceRefsForPair({
    substanceA: 'clonidine',
    substanceB: 'guanfacine',
    mechanismCategories: ['noradrenergic_suppression'],
    code: 'CAUTION',
    reviewState: 'machine_inferred',
    existingSourceRefs: [{ source_id: 'source_gap' }],
    sourceLibrary
  });
  assert.strictEqual(mechanism.matchType, 'mechanism');
  assert.strictEqual(mechanism.evidenceStatus, 'mechanistic_inference');

  const adjacent = linkSourceRefsForPair({
    substanceA: 'belladonna',
    substanceB: 'brugmansia',
    mechanismCategories: ['anticholinergic_delirium'],
    code: 'CAUTION',
    reviewState: 'machine_inferred',
    existingSourceRefs: [{ source_id: 'source_gap' }],
    sourceLibrary
  });
  assert.strictEqual(adjacent.matchType, 'adjacent_domain');
  assert.strictEqual(adjacent.evidenceStatus, 'mechanistic_inference');
  assert.strictEqual(adjacent.sourceLinkingConfidence, 'low');

  const unresolved = linkSourceRefsForPair({
    substanceA: 'psilocybin',
    substanceB: 'ssri',
    mechanismCategories: ['serotonergic_toxicity'],
    code: 'DANGEROUS',
    reviewState: 'unreviewed',
    existingSourceRefs: [{ source_id: 'source_gap' }],
    sourceLibrary: [{ id: 'source_gap', title: 'Source Gap', source_type: 'generated_placeholder', reliability: 'unknown' }]
  });
  assert.strictEqual(unresolved.unresolved, true);
  assert.strictEqual(unresolved.matchType, 'source_gap');
  assert.strictEqual(unresolved.evidenceStatus, 'not_reviewed');
  assert.strictEqual(unresolved.sourceRefs[0].source_id, 'source_gap');
};

const assertDatasetEvidenceFields = async () => {
  const raw = await readFile(datasetPath, 'utf8');
  const dataset = JSON.parse(raw) as InteractionDatasetV2;
  const pairByKey = new Map(dataset.pairs.map((pair) => [pair.key, pair] as const));

  const selfPair = [...dataset.pairs].find((pair) => pair.substances[0] === pair.substances[1]);
  assert.ok(selfPair, 'expected at least one self pair');
  assert.strictEqual(selfPair?.classification.code, 'SELF');
  assert.ok(!selfPair?.audit.validation_flags.includes('missing_mechanism'), 'SELF should not get missing_mechanism');
  assert.ok(!selfPair?.audit.validation_flags.includes('missing_evidence_tier'), 'SELF should not get missing_evidence_tier');

  const samplePairs = [
    'ayahuasca|ssri',
    'beta_blockers|clonidine',
    'calcium_channel_blockers|clonidine',
    'beta_blockers|cannabis'
  ];
  for (const key of samplePairs) {
    const pair = pairByKey.get(key);
    assert.ok(pair, `expected dataset pair ${key}`);
    if (key === 'beta_blockers|clonidine' || key === 'calcium_channel_blockers|clonidine') {
      assert.strictEqual(pair?.classification.code, 'DETERMINISTIC', `${key} should be deterministic in the canonical dataset`);
    }
    assert.ok(pair?.evidence.status, `${key} should include evidence.status`);
    assert.ok(pair?.evidence.evidence_strength, `${key} should include evidence.evidence_strength`);
    assert.ok(pair?.validation?.flags, `${key} should include grouped validation flags`);
    const grouped = pair?.validation?.flags;
    assert.ok(grouped, `${key} should include grouped validation flags`);
    const flatGrouped = [...grouped.critical, ...grouped.warning, ...grouped.info].sort();
    const flatAudit = [...pair!.audit.validation_flags].sort();
    assert.deepStrictEqual(flatGrouped, flatAudit, `${key} grouped validation should match flat audit flags`);
    for (const ref of pair!.evidence.source_refs) {
      if (ref.source_id === 'source_gap') {
        assert.strictEqual(ref.evidence_strength, 'none');
        assert.strictEqual(ref.match_type, 'source_gap');
      } else {
        assert.ok(ref.match_type, `${key} linked source should have match_type`);
        assert.ok(ref.evidence_strength, `${key} linked source should have evidence_strength`);
      }
    }
  }
};

const assertValidatorWarnsOnUnresolvedSourceGap = () => {
  const raw = JSON.parse(
    JSON.stringify({
      ...({} as InteractionDatasetV2),
      schema_version: 'v2',
      generated_at: new Date().toISOString(),
      substances: [
        { id: 'psilocybin', name: 'Psilocybin Mushrooms' },
        { id: 'ssri', name: 'SSRIs' }
      ],
      pairs: [
        {
          key: 'psilocybin|ssri',
          substances: ['psilocybin', 'ssri'],
          classification: {
            code: 'INFERRED',
            status: 'inferred',
            confidence: 'low',
            risk_score: null
          },
          clinical_summary: { headline: 'Synthetic unresolved-gap fixture.' },
          mechanism: { primary_category: 'serotonergic_toxicity', categories: ['serotonergic_toxicity'] },
          evidence: {
            tier: 'direct_human_data',
            support_type: 'none',
            evidence_strength: 'none',
            source_refs: [
              {
                id: 'source_gap',
                source_id: 'source_gap',
                title: 'Source Gap',
                source_type: 'generated_placeholder',
                match_type: 'source_gap',
                relevance_score: 0,
                evidence_strength: 'none',
                notes: 'No relevant source matched the curated library.',
                support_type: 'none'
              }
            ],
            status: 'not_reviewed',
            review_state: 'unreviewed',
            review_notes: 'No relevant source matched the curated library.'
          },
          source_text: 'source-gap',
          source_fingerprint: 'synthetic',
          provenance: {
            derivation_type: 'generated_unknown',
            source: 'heuristic_fallback',
            confidence_tier: 'low',
            source_linking_method: 'source_linking_pipeline_v1',
            source_linking_confidence: 'low',
            migrated_from_v1: true,
            migration_version: 'v1_to_v2',
            migrated_at: new Date().toISOString()
          },
          override_metadata: { applied: false },
          audit: {
            validation_flags: ['source_gap', 'source_gap_unresolved'],
            review_status: 'needs_review'
          },
          validation: {
            flags: {
              critical: [],
              warning: ['source_gap', 'source_gap_unresolved'],
              info: []
            }
          }
        }
      ],
      sources: [
        { id: 'source_gap', title: 'Source Gap', source_type: 'generated_placeholder', reliability: 'unknown' }
      ]
    })
  ) as InteractionDatasetV2;

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'entheogen-source-gap-'));
  const tempPath = path.join(tempDir, 'dataset.json');
  writeFileSync(tempPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  try {
    const result = spawnSync('npx', ['tsx', 'scripts/validateInteractionsV2.ts'], {
      cwd: root,
      env: {
        ...process.env,
        INTERACTION_DATASET_V2_PATH: tempPath
      },
      encoding: 'utf8'
    });
    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(`${result.stdout}${result.stderr}`, /source_gap_unresolved/);
    assert.match(`${result.stdout}${result.stderr}`, /Validation complete\. errors=0/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

assertDeterministicMatch('ayahuasca', 'ssri', {
  confidenceTier: 'high',
});
assertDeterministicMatch('clonidine', 'beta_blockers', {
  code: 'DETERMINISTIC',
  label: 'Established clinically significant interaction',
  confidenceTier: 'high',
  riskLevel: 'high',
  mechanismNeedle: 'sympathetic rebound'
});
assertDeterministicMatch('clonidine', 'calcium_channel_blockers', {
  code: 'DETERMINISTIC',
  label: 'Predictable pharmacodynamic interaction',
  confidenceTier: 'medium',
  riskLevel: 'moderate',
  mechanismNeedle: 'predictable additive cardiovascular effects'
});
assertFallbackInference('kambo', 'ketamine');
assertSelfPair('lsd');
assertNoUnknownNonSelf();
assertEvidenceStatusMapping();
assertValidationSeverityGrouping();

await assertSourceLinking();
await assertDatasetEvidenceFields();
assertValidatorWarnsOnUnresolvedSourceGap();

console.log(`interaction classification checks passed for ${getDRUGS().length} substances`);

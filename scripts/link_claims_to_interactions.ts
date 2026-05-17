import path from 'node:path';
import {
  canonicalPairKey,
  ensureDir,
  loadSchema,
  readJson,
  slugify,
  sourceManifestToDatasetSourceType,
  sourceStrengthRank,
  stableHash,
  validateSchemaSubset,
  writeJson,
  type ClaimPackage,
  type ClaimRecord,
  type SourceManifestEntry
} from './kb-utils';
import type { InteractionDatasetV2, InteractionPairV2, SourceV2 } from '../src/data/interactionSchemaV2';

type LinkedSourceRef = {
  source_id: string;
  claim_id: string;
  match_type: 'direct_pair' | 'drug_class' | 'mechanism' | 'adjacent_domain' | 'ai_synthesis';
  evidence_strength: 'strong' | 'moderate' | 'weak' | 'theoretical';
  confidence?: 'high' | 'medium' | 'low';
  requires_verification?: boolean;
  review_state: 'human_reviewed';
  source_type?: 'ai_synthesis' | 'primary_source' | 'secondary_source' | 'field_guidance' | 'internal_research_update' | 'generated_placeholder' | 'none';
  notes?: string;
};

type LinkDiagnostics = {
  claimPackagesLoaded: number;
  claimsLoaded: number;
  eligibleClaims: number;
  interactionsLoaded: number;
  candidatePairMatches: number;
  referencesLinked: number;
  unmatchedClaimPairKeys: Map<string, number>;
};

const mechanismHintMap = new Map<string, string[]>([
  ['rebound_hypertension', ['rebound hypertension', 'sympathetic rebound', 'unopposed alpha']],
  ['additive_hypotension', ['additive hypotension', 'blood pressure lowering', 'hypotension', 'bradycardia', 'syncope']],
  ['hemodynamic_interaction', ['blood pressure', 'heart rate', 'hemodynamic']],
  ['noradrenergic_suppression', ['alpha-2', 'alpha 2', 'sympathetic outflow']],
  ['glutamate_modulation', ['nmda', 'ketamine', 'glutamate']],
  ['ion_channel_modulation', ['sodium channel', 'lamotrigine', 'ion channel']],
  ['pharmacodynamic_cns_depression', ['sedation', 'respiratory depression', 'cns depressant']],
  ['serotonergic_toxicity', ['serotonin', 'serotonergic']]
]);

const normalize = (value: string): string => slugify(value);
const canonicalizeToken = (value: string): string => normalize(value).replace(/\s+/g, '_');
const aliasMap = new Map<string, string>([
  ['ssris', 'ssri'],
  ['snris', 'snri'],
  ['tcas', 'tricyclic_ad'],
  ['opioids', 'serotonergic_opioids'],
  ['stimulants', 'amphetamine_stims'],
  ['psychedelics', 'psilocybin']
]);
const canonicalizeSubstanceId = (value: string): string => aliasMap.get(canonicalizeToken(value)) ?? canonicalizeToken(value);
const canonicalizePairKey = (a: string, b: string): string => [canonicalizeSubstanceId(a), canonicalizeSubstanceId(b)].sort().join('|');

const pairHasMechanismMatch = (claim: ClaimRecord, pair: InteractionPairV2): boolean => {
  const claimText = `${claim.claim} ${claim.mechanism ?? ''} ${claim.notes ?? ''}`.toLowerCase();
  const claimEntities = new Set(claim.entities.map(normalize));
  const pairEntities = new Set(pair.substances.map(normalize));
  const overlaps = [...pairEntities].filter((entity) => claimEntities.has(entity));
  if (overlaps.length === 1 && overlaps[0] === 'ayahuasca') {
    return false;
  }
  const pairMechanismWords = [
    pair.mechanism.primary_category,
    ...pair.mechanism.categories
  ].map((item) => item.toLowerCase().replace(/_/g, ' '));
  return pairMechanismWords.some((word) => claimText.includes(word)) ||
    Array.from(mechanismHintMap.entries()).some(([category, hints]) => {
      const categoryMatch =
        pair.mechanism.primary_category === category ||
        pair.mechanism.categories.includes(category as InteractionPairV2['mechanism']['categories'][number]);
      return categoryMatch && hints.some((hint) => claimText.includes(hint));
    });
};

const determineMatchType = (claim: ClaimRecord, pair: InteractionPairV2): LinkedSourceRef['match_type'] | null => {
  if (pair.classification.code === 'SELF') return null;

  const claimPairKeys = new Set((claim.supports_pairs ?? []).map((pairIds) => canonicalizePairKey(pairIds[0], pairIds[1])));
  const pairKeyCanonical = canonicalizePairKey(pair.substances[0], pair.substances[1]);
  if (claimPairKeys.has(pairKeyCanonical)) return 'direct_pair';

  const claimEntities = new Set(claim.entities.map(normalize));
  const pairEntities = new Set(pair.substances.map(normalize));
  const overlaps = [...pairEntities].filter((entity) => claimEntities.has(entity));

  if (overlaps.length === 2) return 'direct_pair';
  if (overlaps.length === 1 && overlaps[0] !== 'ayahuasca') return 'drug_class';
  if (overlaps.length === 1 && overlaps[0] === 'ayahuasca') return null;
  if (pairHasMechanismMatch(claim, pair)) return 'mechanism';

  const adjacentKeywords = ['blood pressure', 'heart rate', 'sedation', 'monitor', 'caution', 'avoid', 'risk'];
  const claimText = `${claim.claim} ${claim.notes ?? ''}`.toLowerCase();
  if (adjacentKeywords.some((keyword) => claimText.includes(keyword))) {
    return 'adjacent_domain';
  }

  return null;
};

const isAiSynthesisClaim = (claim: ClaimRecord, source?: SourceManifestEntry): boolean =>
  source?.source_type === 'ai_synthesis' || claim.provenance?.source_type === 'ai_synthesis';

const loadClaimPackages = async (dirPath: string): Promise<ClaimPackage[]> => {
  const entries = await (await import('node:fs/promises')).readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const packages: ClaimPackage[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.claims.json')) continue;
    packages.push(await readJson<ClaimPackage>(path.join(dirPath, entry.name)));
  }
  return packages;
};

const upsertDatasetSource = (
  dataset: InteractionDatasetV2,
  source: SourceManifestEntry
): void => {
  if (dataset.sources.some((entry) => entry.id === source.source_id)) return;
  dataset.sources.push({
    id: source.source_id,
    title: source.title,
    source_type: sourceManifestToDatasetSourceType(source.source_type),
    reliability: 'unknown',
    fingerprint: stableHash(`${source.source_id}:${source.url_or_path}`, 64)
  } satisfies SourceV2);
};

const applyClaimToPair = (
  pair: InteractionPairV2,
  claim: ClaimRecord,
  matchType: Exclude<LinkedSourceRef['match_type'], 'ai_synthesis'>,
  source: SourceManifestEntry | undefined,
  sourceType: LinkedSourceRef['source_type']
): boolean => {
  if (pair.classification.code === 'SELF') return false;

  const isAiSynthesis = isAiSynthesisClaim(claim, source);
  const evidenceStrength = isAiSynthesis ? 'theoretical' : (claim.evidence_strength ?? 'weak');
  const newRank = sourceStrengthRank(evidenceStrength);
  const existingIndices = pair.evidence.source_refs
    .map((ref, index) => ({ ref, index }))
    .filter((item) => item.ref.source_id === claim.source_id);
  const strongestExistingRank = existingIndices.reduce((max, item) => {
    const rank = sourceStrengthRank(item.ref.evidence_strength as LinkedSourceRef['evidence_strength'] | undefined);
    return Math.max(max, rank);
  }, 0);

  if (existingIndices.some((item) => item.ref.claim_id === claim.claim_id)) {
    return false;
  }
  if (strongestExistingRank >= newRank) {
    return false;
  }
  if (existingIndices.length > 0) {
    pair.evidence.source_refs = pair.evidence.source_refs.filter((ref) => ref.source_id !== claim.source_id);
  }

  pair.evidence.source_refs.push({
    source_id: claim.source_id,
    claim_id: claim.claim_id,
    match_type: isAiSynthesis ? 'ai_synthesis' : matchType,
    evidence_strength: evidenceStrength,
    confidence: isAiSynthesis ? 'low' : claim.confidence,
    requires_verification: isAiSynthesis ? true : undefined,
    review_state: 'human_reviewed',
    source_type: sourceType,
    notes: isAiSynthesis ? `Perplexity claim linked via ${matchType}` : undefined
  });

  if (isAiSynthesis && pair.evidence.status !== 'supported' && pair.evidence.status !== 'conflicting_evidence') {
    pair.evidence.status = 'provisional_secondary';
    pair.evidence.support_type = 'ai_synthesis';
  }
  return true;
};

const run = async (): Promise<void> => {
  const kbRoot = process.env.KB_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge-base');
  const reviewedDir = process.env.KB_REVIEWED_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'reviewed');
  const sourceManifestPath = process.env.KB_SOURCE_MANIFEST_PATH ?? path.join(kbRoot, 'indexes', 'source_manifest.json');
  const datasetPath = process.env.KB_DATASET_PATH ?? path.resolve(kbRoot, '..', 'src', 'data', 'interactionDatasetV2.json');

  await ensureDir(reviewedDir);

  const manifest = await readJson<{ version: string; sources: SourceManifestEntry[] }>(sourceManifestPath).catch(() => ({ version: 'kb_v1', sources: [] }));
  const reviewedPackages = await loadClaimPackages(reviewedDir);
  const dataset = await readJson<InteractionDatasetV2>(datasetPath);
  const sourceById = new Map(manifest.sources.map((entry) => [entry.source_id, entry] as const));
  const diagnostics: LinkDiagnostics = {
    claimPackagesLoaded: reviewedPackages.length,
    claimsLoaded: reviewedPackages.reduce((sum, pkg) => sum + pkg.claims.length, 0),
    eligibleClaims: 0,
    interactionsLoaded: dataset.pairs.length,
    candidatePairMatches: 0,
    referencesLinked: 0,
    unmatchedClaimPairKeys: new Map<string, number>()
  };

  for (const source of manifest.sources) {
    upsertDatasetSource(dataset, source);
  }

  const pairByCanonicalKey = new Map<string, InteractionPairV2[]>();
  for (const pair of dataset.pairs) {
    const canonicalKey = canonicalizePairKey(pair.substances[0], pair.substances[1]);
    const existing = pairByCanonicalKey.get(canonicalKey) ?? [];
    existing.push(pair);
    pairByCanonicalKey.set(canonicalKey, existing);
  }

  let linkedCount = 0;
  for (const claimPackage of reviewedPackages) {
    for (const claim of claimPackage.claims) {
      if (claim.review_state !== 'human_reviewed') continue;
      diagnostics.eligibleClaims += 1;
      const source = sourceById.get(claim.source_id);
      const sourceType = isAiSynthesisClaim(claim, source)
        ? 'ai_synthesis'
        : sourceManifestToDatasetSourceType(source?.source_type ?? 'pharmacology_reference');

      const matches = new Map<string, LinkedSourceRef['match_type']>();
      const claimSupportsCanonicalKeys = new Set(
        (claim.supports_pairs ?? []).map((pairIds) => canonicalizePairKey(pairIds[0], pairIds[1]))
      );
      const unmatchedSupports = new Set(claimSupportsCanonicalKeys);

      for (const claimKey of claimSupportsCanonicalKeys) {
        const candidatePairs = pairByCanonicalKey.get(claimKey) ?? [];
        if (candidatePairs.length > 0) {
          unmatchedSupports.delete(claimKey);
          for (const candidatePair of candidatePairs) {
            if (candidatePair.classification.code !== 'SELF') {
              matches.set(candidatePair.key, 'direct_pair');
            }
          }
        }
      }

      for (const unmatchedKey of unmatchedSupports) {
        diagnostics.unmatchedClaimPairKeys.set(unmatchedKey, (diagnostics.unmatchedClaimPairKeys.get(unmatchedKey) ?? 0) + 1);
      }

      for (const pair of dataset.pairs) {
        if (matches.has(pair.key)) continue;
        const matchType = determineMatchType(claim, pair);
        if (!matchType) continue;
        const current = matches.get(pair.key);
        const currentRank = current ? ['adjacent_domain', 'mechanism', 'drug_class', 'direct_pair'].indexOf(current) : -1;
        const nextRank = ['adjacent_domain', 'mechanism', 'drug_class', 'direct_pair'].indexOf(matchType);
        if (nextRank >= currentRank) {
          matches.set(pair.key, matchType);
        }
      }
      diagnostics.candidatePairMatches += matches.size;

      for (const [pairKey, matchType] of matches.entries()) {
        const pair = dataset.pairs.find((item) => item.key === pairKey);
        if (!pair) continue;
        if (pair.classification.code === 'SELF') continue;
        upsertDatasetSource(dataset, source ?? {
          source_id: claim.source_id,
          title: claim.source_id,
          source_type: sourceType,
          authority_level: 'contextual',
          evidence_domain: 'pharmacological',
          url_or_path: claimPackage.source_path,
          file_refs: [claimPackage.source_path],
          review_state: 'validated'
        });
        if (applyClaimToPair(pair, claim, matchType as Exclude<LinkedSourceRef['match_type'], 'ai_synthesis'>, source, sourceType)) {
          linkedCount += 1;
        }
      }
    }
  }
  diagnostics.referencesLinked = linkedCount;

  await writeJson(datasetPath, dataset);
  const topUnmatched = Array.from(diagnostics.unmatchedClaimPairKeys.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log(
    `[kb:link] claim_packages_loaded=${diagnostics.claimPackagesLoaded} claims_loaded=${diagnostics.claimsLoaded} eligible_human_reviewed_claims=${diagnostics.eligibleClaims}`
  );
  console.log(`[kb:link] interactions_loaded=${diagnostics.interactionsLoaded} candidate_pair_matches=${diagnostics.candidatePairMatches}`);
  if (topUnmatched.length > 0) {
    console.log(
      `[kb:link] top_unmatched_claim_pair_keys=${topUnmatched.map(([key, count]) => `${key}:${count}`).join(', ')}`
    );
  } else {
    console.log('[kb:link] top_unmatched_claim_pair_keys=none');
  }
  console.log(`Linked ${linkedCount} claim reference(s) into ${path.relative(kbRoot, datasetPath)}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

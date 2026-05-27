import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { getCanonicalDatasetPaths } from './datasetPaths';

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

type PairRecord = Record<string, unknown> & {
  key?: string;
  pair?: [string, string] | string[];
  substances?: [string, string] | string[];
  source_id?: string;
  match_type?: string;
  evidence_strength?: string;
  upgrade_to?: string;
  mechanism?: string[] | string;
  risk?: string;
  classification?: string | Record<string, unknown>;
};

type DuplicateSignalType =
  | 'existing_pair_match'
  | 'source_ref_deduplicated'
  | 'citation_deduplicated'
  | 'claim_deduplicated';

export type DuplicateSignal = {
  signal: DuplicateSignalType;
  detail: string;
  update_file?: string;
  pair_key?: string;
  source_id?: string;
};

export type ReviewConflict = {
  category: 'candidate_insert_blocked' | 'source_manifest_gap' | 'archive_failure';
  reason_code: string;
  message: string;
  severity: 'warning' | 'error';
  update_file?: string;
  pair_key?: string;
  source_id?: string;
  detail?: string;
  suggested_review_action: string;
  auto_resolution_applied: false;
};

type DuplicateSignalCounts = {
  existing_pair_matches: number;
  source_ref_duplicates_suppressed: number;
  citation_duplicates_suppressed: number;
  claim_duplicates_suppressed: number;
};

export type ConsolidationReport = {
  generated_at: string;
  canonical_files_detected: typeof canonical;
  update_files_absorbed: string[];
  interaction_records_inserted: number;
  interaction_records_merged: number;
  source_manifest_entries_inserted: number;
  source_manifest_entries_merged: number;
  citations_inserted: number;
  citations_merged: number;
  schema_changes_made: string[];
  claims_normalized: number;
  conflicts_detected: string[];
  review_conflicts: ReviewConflict[];
  duplicate_signals: DuplicateSignal[];
  duplicate_signal_counts: DuplicateSignalCounts;
  files_archived: string[];
  validation_results: Record<string, unknown>;
  unresolved_assumptions: string[];
};

type InteractionDataset = {
  schema_version: string;
  generated_at: string;
  substances: Array<{ id: string; [key: string]: unknown }>;
  pairs: Array<Record<string, unknown>>;
  sources: Array<{ id: string; [key: string]: unknown }>;
};

type SourceManifest = {
  version: string;
  sources: Array<Record<string, unknown>>;
};

type CitationRegistry = {
  version: string;
  citations: Array<Record<string, unknown>>;
};

type ClaimPackage = {
  source_id: string;
  source_path: string;
  source_metadata: Record<string, unknown>;
  claims: Array<Record<string, unknown>>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const canonicalPaths = getCanonicalDatasetPaths(root);
const canonical = {
  interactions: canonicalPaths.interactionPairs,
  sourceManifest: canonicalPaths.sourceManifest,
  sourceTags: canonicalPaths.sourceTags,
  citationRegistry: canonicalPaths.citationRegistry,
  sourceSchema: canonicalPaths.sourceSchema,
  claimSchema: canonicalPaths.claimSchema
};

const updateCandidates = [
  'src/data/15_high_value_pairs.json',
  'src/data/six_populated_unknown_pairs.json',
  'src/data/interactionPairs_populated_unknown_pairs.json',
  'src/data/mdma_cyp_more.json',
  'src/data/mdma_related_upgrade_flags.json',
  'knowledge-base/reports/provisional_interactions_insert_report.json',
  'knowledge-base/reports/perplexity_ingestion_report.json'
].map((p) => path.join(root, p));

const claimDirs = [
  path.join(root, 'knowledge-base/extracted/claims/pending'),
  path.join(root, 'knowledge-base/extracted/claims/reviewed'),
  path.join(root, 'knowledge-base/extracted/claims/rejected')
];

const archiveRoot = path.join(root, 'knowledge-base/archive/absorbed-updates');
const archiveReadme = path.join(archiveRoot, 'README.md');
const reportPath = path.join(root, 'knowledge-base/reports/json_consolidation_report.json');

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

const writeJson = async (filePath: string, value: Json): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const canonicalPairKey = (a: string, b: string): string => [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join('|');
const normalizeText = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

const classificationRank: Record<string, number> = {
  DETERMINISTIC: 6,
  SUPPORTED_LOW_RISK: 5,
  SUPPORTED_CLASS_RULE: 4,
  THEORETICAL: 3,
  INFERRED: 2,
  UNKNOWN: 1,
  LOW: 5,
  LOW_MOD: 4,
  CAUTION: 3,
  UNSAFE: 2,
  DANGEROUS: 6,
  SELF: 7
};

const evidenceRank: Record<string, number> = {
  deterministic: 6,
  supported: 5,
  human_reviewed: 5,
  established: 4,
  direct_pair: 4,
  clinical_guideline: 3,
  academic_paper: 3,
  expert_guideline: 2,
  expert_dataset: 2,
  ai_synthesis: 1,
  provisional_secondary: 1,
  source_gap: 0,
  unknown: 0
};

const sourceTypeAllow = new Set([
  'academic_paper',
  'clinical_guideline',
  'expert_guideline',
  'expert_dataset',
  'ai_synthesis',
  'traditional_context',
  'pharmacology_reference',
  'legal_policy'
]);

const authorityAllow = new Set(['high', 'medium', 'contextual', 'low']);
const evidenceDomainAllow = new Set(['clinical', 'pharmacological', 'aggregated_clinical', 'ceremonial', 'harm_reduction', 'legal', 'cultural']);
const sourceReviewAllow = new Set(['unreviewed', 'extracted', 'validated', 'rejected']);

const toDatasetCode = (input?: string): string | undefined => {
  if (!input) return undefined;
  const normalized = input.trim().toUpperCase();
  if (normalized === 'LOW_RISK_SUPPORTED' || normalized === 'SUPPORTED_LOW_RISK') return 'LOW';
  if (normalized === 'SUPPORTED_CLASS_RULE') return 'LOW_MOD';
  if (normalized === 'SUPPORTED_THEORETICAL') return 'THEORETICAL';
  if (normalized === 'DETERMINISTIC') return 'DETERMINISTIC';
  if (normalized === 'THEORETICAL') return 'THEORETICAL';
  if (normalized === 'INFERRED') return 'INFERRED';
  if (normalized === 'UNKNOWN') return 'UNKNOWN';
  return undefined;
};

const extractUpdateRecords = (value: unknown): PairRecord[] => {
  if (Array.isArray(value)) return value.filter((v): v is PairRecord => typeof v === 'object' && v !== null);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.interactions)) return obj.interactions.filter((v): v is PairRecord => typeof v === 'object' && v !== null);
    if (Array.isArray(obj.records)) return obj.records.filter((v): v is PairRecord => typeof v === 'object' && v !== null);
    if (Array.isArray(obj.pairs)) return obj.pairs.filter((v): v is PairRecord => typeof v === 'object' && v !== null);
    if ('pair' in obj || 'key' in obj) return [obj as PairRecord];
  }
  return [];
};

const buildRef = (rec: PairRecord): Record<string, unknown> | null => {
  if (!rec.source_id) return null;
  return {
    source_id: rec.source_id,
    id: rec.source_id,
    title: rec.source_id,
    source_type: 'primary_source',
    match_type: rec.match_type ?? 'mechanism',
    relevance_score: 0.9,
    evidence_strength: rec.evidence_strength ?? 'theoretical',
    notes: 'Merged from absorbed update file.',
    support_type: rec.match_type === 'direct_pair' ? 'direct_literature' : 'mechanistic_literature'
  };
};

const dedupeRefs = (
  refs: Array<Record<string, unknown>>
): { refs: Array<Record<string, unknown>>; duplicatesSuppressed: number } => {
  const seen = new Set<string>();
  const result: Array<Record<string, unknown>> = [];
  let duplicatesSuppressed = 0;
  for (const ref of refs) {
    const key = String(ref.source_id ?? '') + '|' + String(ref.match_type ?? '') + '|' + String(ref.evidence_strength ?? '');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(ref);
    } else {
      duplicatesSuppressed += 1;
    }
  }
  return { refs: result, duplicatesSuppressed };
};

type ConflictTrackingReport = Pick<ConsolidationReport, 'conflicts_detected' | 'review_conflicts'>;
type DuplicateTrackingReport = Pick<ConsolidationReport, 'duplicate_signals' | 'duplicate_signal_counts'>;

export const recordConflict = (
  report: ConflictTrackingReport,
  legacyMessage: string,
  details: Omit<ReviewConflict, 'auto_resolution_applied'>
): void => {
  report.conflicts_detected.push(legacyMessage);
  report.review_conflicts.push({
    ...details,
    auto_resolution_applied: false
  });
};

const duplicateSignalCounterKey: Record<DuplicateSignalType, keyof DuplicateSignalCounts> = {
  existing_pair_match: 'existing_pair_matches',
  source_ref_deduplicated: 'source_ref_duplicates_suppressed',
  citation_deduplicated: 'citation_duplicates_suppressed',
  claim_deduplicated: 'claim_duplicates_suppressed'
};

export const recordDuplicateSignal = (
  report: DuplicateTrackingReport,
  signal: DuplicateSignal
): void => {
  report.duplicate_signals.push(signal);
  const key = duplicateSignalCounterKey[signal.signal];
  report.duplicate_signal_counts[key] += 1;
};

const run = async (): Promise<void> => {
  const dataset = await readJson<InteractionDataset>(canonical.interactions);
  const manifest = await readJson<SourceManifest>(canonical.sourceManifest);
  const citations = await readJson<CitationRegistry>(canonical.citationRegistry);
  const sourceSchema = await readJson<Record<string, unknown>>(canonical.sourceSchema);
  const claimSchema = await readJson<Record<string, unknown>>(canonical.claimSchema);

  const report: ConsolidationReport = {
    generated_at: new Date().toISOString(),
    canonical_files_detected: canonical,
    update_files_absorbed: [],
    interaction_records_inserted: 0,
    interaction_records_merged: 0,
    source_manifest_entries_inserted: 0,
    source_manifest_entries_merged: 0,
    citations_inserted: 0,
    citations_merged: 0,
    schema_changes_made: [],
    claims_normalized: 0,
    conflicts_detected: [],
    review_conflicts: [],
    duplicate_signals: [],
    duplicate_signal_counts: {
      existing_pair_matches: 0,
      source_ref_duplicates_suppressed: 0,
      citation_duplicates_suppressed: 0,
      claim_duplicates_suppressed: 0
    },
    files_archived: [],
    validation_results: {},
    unresolved_assumptions: []
  };

  const pairByKey = new Map<string, Record<string, unknown>>();
  for (const pair of dataset.pairs) {
    const key = String(pair.key ?? '');
    pairByKey.set(key, pair);
  }
  const substanceIds = new Set(dataset.substances.map((s) => s.id));

  for (const filePath of updateCandidates) {
    let parsed: unknown;
    try {
      parsed = await readJson<unknown>(filePath);
    } catch {
      continue;
    }

    const updates = extractUpdateRecords(parsed);
    if (updates.length === 0) continue;

    for (const rec of updates) {
      const pairArr = Array.isArray(rec.pair) ? rec.pair : Array.isArray(rec.substances) ? rec.substances : null;
      const pairKey = typeof rec.key === 'string' ? rec.key : pairArr && pairArr.length >= 2 ? canonicalPairKey(String(pairArr[0]), String(pairArr[1])) : null;
      if (!pairKey) continue;

      const existing = pairByKey.get(pairKey);
      if (!existing) {
        if (!pairArr || pairArr.length < 2) {
          const fileName = path.basename(filePath);
          recordConflict(report, `cannot_insert:${fileName}:${pairKey}:missing_pair_shape`, {
            category: 'candidate_insert_blocked',
            reason_code: 'missing_pair_shape',
            message: `Candidate record from ${fileName} could not be inserted because pair shape is incomplete.`,
            severity: 'error',
            update_file: fileName,
            pair_key: pairKey,
            suggested_review_action: 'Review candidate payload and provide canonical pair/substances fields before merge.'
          });
          continue;
        }
        const a = String(pairArr[0]).toLowerCase();
        const b = String(pairArr[1]).toLowerCase();
        if (!substanceIds.has(a) || !substanceIds.has(b)) {
          const fileName = path.basename(filePath);
          recordConflict(report, `cannot_insert:${fileName}:${pairKey}:unknown_substance`, {
            category: 'candidate_insert_blocked',
            reason_code: 'unknown_substance',
            message: `Candidate record from ${fileName} references substances outside the canonical dataset.`,
            severity: 'warning',
            update_file: fileName,
            pair_key: pairKey,
            detail: `${a},${b}`,
            suggested_review_action: 'Resolve substance mapping in curator review before adding a new pair.'
          });
          continue;
        }
        const fileName = path.basename(filePath);
        recordConflict(report, `deferred_insert:${fileName}:${pairKey}:requires_full_record_shape`, {
          category: 'candidate_insert_blocked',
          reason_code: 'requires_full_record_shape',
          message: `Candidate record from ${fileName} matched canonical keys but lacks full dataset record shape for insertion.`,
          severity: 'warning',
          update_file: fileName,
          pair_key: pairKey,
          suggested_review_action: 'Prepare a full canonical record in curator review before insert.'
        });
        continue;
      }

      const isSelf = String((existing.classification as Record<string, unknown>)?.code ?? '') === 'SELF';
      if (isSelf) continue;
      recordDuplicateSignal(report, {
        signal: 'existing_pair_match',
        detail: 'Candidate matched an existing canonical pair and was merged as a reviewable duplicate signal.',
        update_file: path.basename(filePath),
        pair_key: pairKey,
        source_id: rec.source_id ? String(rec.source_id) : undefined
      });

      const existingClassification = String((existing.classification as Record<string, unknown>)?.code ?? 'UNKNOWN');
      const targetCode = toDatasetCode(rec.upgrade_to ?? (typeof rec.classification === 'string' ? rec.classification : undefined));
      if (targetCode && (classificationRank[targetCode] ?? 0) > (classificationRank[existingClassification] ?? 0)) {
        (existing.classification as Record<string, unknown>).code = targetCode;
      }

      if (rec.risk && typeof existing.clinical_summary === 'object' && existing.clinical_summary) {
        const clinical = existing.clinical_summary as Record<string, unknown>;
        if (!clinical.field_notes || String(clinical.field_notes).trim() === '') {
          clinical.field_notes = `Merged update risk note: ${rec.risk}`;
        }
      }

      if (Array.isArray(rec.mechanism) || typeof rec.mechanism === 'string') {
        const incoming = Array.isArray(rec.mechanism) ? rec.mechanism.map(String) : [rec.mechanism];
        if (typeof existing.mechanism === 'object' && existing.mechanism) {
          const mech = existing.mechanism as Record<string, unknown>;
          const categories = Array.isArray(mech.categories) ? mech.categories.map(String) : [];
          mech.categories = Array.from(new Set([...categories, ...incoming]));
          if (!mech.primary_category && incoming.length > 0) mech.primary_category = incoming[0];
        }
      }

      if (typeof existing.evidence === 'object' && existing.evidence) {
        const ev = existing.evidence as Record<string, unknown>;
        const existingStatus = String(ev.status ?? 'unknown');
        const updateStatus = rec.match_type ? String(rec.match_type) : undefined;
        if (updateStatus && (evidenceRank[updateStatus] ?? 0) > (evidenceRank[existingStatus] ?? 0)) {
          ev.status = updateStatus;
        }
        const newRef = buildRef(rec);
        if (newRef) {
          const refs = Array.isArray(ev.source_refs) ? (ev.source_refs as Array<Record<string, unknown>>) : [];
          const deduped = dedupeRefs([...refs, newRef]);
          ev.source_refs = deduped.refs;
          if (deduped.duplicatesSuppressed > 0) {
            for (let i = 0; i < deduped.duplicatesSuppressed; i += 1) {
              recordDuplicateSignal(report, {
                signal: 'source_ref_deduplicated',
                detail: 'Duplicate source reference was suppressed while keeping canonical source_ref entries unique.',
                update_file: path.basename(filePath),
                pair_key: pairKey,
                source_id: rec.source_id ? String(rec.source_id) : undefined
              });
            }
          }
        }
      }

      report.interaction_records_merged = Number(report.interaction_records_merged) + 1;
    }

    report.update_files_absorbed.push(path.relative(root, filePath));
  }

  const requiredSources = [
    'ruffell_2023',
    'halman_2024',
    'malcolm_2023',
    'alma_2026',
    'entheogen_2026',
    'Gilman_2023',
    'schmid_2025'
  ];

  const bySourceId = new Map(manifest.sources.map((s) => [String(s.source_id), s]));
  const sourceAliases: Record<string, string> = {
    ruffell_2023: 'ruffell_2023',
    halman_2024: 'halman_2024',
    malcolm_2023: 'malcolm_2023'
  };

  for (const required of requiredSources) {
    if (bySourceId.has(required)) continue;
    const alias = sourceAliases[required];
    const src = alias ? bySourceId.get(alias) : undefined;
    if (!src) {
      recordConflict(report, `missing_source_manifest_seed:${required}`, {
        category: 'source_manifest_gap',
        reason_code: 'missing_source_manifest_seed',
        message: `Required source manifest seed ${required} is missing from canonical source metadata.`,
        severity: 'warning',
        source_id: required,
        suggested_review_action: 'Data Curator should add or alias this source before downstream publication review.'
      });
      continue;
    }
    bySourceId.set(required, {
      ...src,
      source_id: required,
      notes: `${String(src.notes ?? '')} (alias normalized)` .trim()
    });
    report.source_manifest_entries_inserted = Number(report.source_manifest_entries_inserted) + 1;
  }

  const manifestSources = Array.from(bySourceId.values()).map((entry) => {
    const out = { ...entry } as Record<string, unknown>;
    if (!sourceTypeAllow.has(String(out.source_type))) out.source_type = 'academic_paper';
    if (!authorityAllow.has(String(out.authority_level))) out.authority_level = 'medium';
    if (!evidenceDomainAllow.has(String(out.evidence_domain))) out.evidence_domain = 'pharmacological';
    if (!sourceReviewAllow.has(String(out.review_state))) out.review_state = 'extracted';
    return out;
  });
  manifestSources.sort((a, b) => String(a.source_id).localeCompare(String(b.source_id)));
  manifest.sources = manifestSources;

  const citationNormKey = (c: Record<string, unknown>): string => {
    const doi = String(c.doi ?? '').trim().toLowerCase();
    if (doi) return `doi:${doi}`;
    const url = String(c.url ?? c.url_or_path ?? '').trim().toLowerCase();
    if (url) return `url:${url}`;
    return `txt:${normalizeText(String(c.title ?? c.citation ?? ''))}`;
  };

  const citationByKey = new Map<string, Record<string, unknown>>();
  for (const c of citations.citations) {
    const key = citationNormKey(c);
    const prior = citationByKey.get(key);
    if (!prior) {
      citationByKey.set(key, c);
      continue;
    }
    const verifiedPrior = String(prior.status ?? '').toLowerCase() === 'verified';
    const verifiedNext = String(c.status ?? '').toLowerCase() === 'verified';
    citationByKey.set(key, verifiedPrior || !verifiedNext ? prior : c);
    report.citations_merged = Number(report.citations_merged) + 1;
    recordDuplicateSignal(report, {
      signal: 'citation_deduplicated',
      detail: 'Duplicate citation candidate was merged using verified-first preference.',
      source_id: String(c.source_id ?? ''),
      update_file: 'knowledge-base/indexes/citation_registry.json'
    });
  }
  const citationList = Array.from(citationByKey.values()).map((c) => {
    const out = { ...c };
    if (!out.citation_id) {
      out.citation_id = String(out.source_id ?? out.title ?? out.citation ?? 'citation').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
    }
    if (String(out.source_id ?? '').startsWith('perplexity_') && !out.status) {
      out.status = 'unverified';
    }
    return out;
  });
  citationList.sort((a, b) => String(a.citation_id).localeCompare(String(b.citation_id)));
  citations.citations = citationList;

  const sourceTypeEnum = (((sourceSchema.properties as Record<string, unknown>)?.source_type as Record<string, unknown>)?.enum ?? []) as string[];
  for (const v of ['academic_paper', 'clinical_guideline', 'expert_guideline', 'expert_dataset', 'ai_synthesis', 'traditional_context', 'pharmacology_reference', 'legal_policy']) {
    if (!sourceTypeEnum.includes(v)) sourceTypeEnum.push(v);
  }
  (((sourceSchema.properties as Record<string, unknown>).source_type as Record<string, unknown>).enum as string[]) = sourceTypeEnum;

  const claimProps = claimSchema.properties as Record<string, unknown>;
  const evStrength = ((claimProps.evidence_strength as Record<string, unknown>).enum ?? []) as string[];
  for (const v of ['strong', 'moderate', 'weak', 'theoretical']) if (!evStrength.includes(v)) evStrength.push(v);
  (claimProps.evidence_strength as Record<string, unknown>).enum = evStrength;

  const reviewStates = ((claimProps.review_state as Record<string, unknown>).enum ?? []) as string[];
  for (const v of ['machine_extracted', 'needs_verification', 'human_reviewed', 'needs_revision', 'rejected']) if (!reviewStates.includes(v)) reviewStates.push(v);
  (claimProps.review_state as Record<string, unknown>).enum = reviewStates;

  const evidenceStatusEnum = ['supported', 'mechanistic_inference', 'provisional_secondary', 'limited_data', 'no_data', 'not_reviewed', 'conflicting_evidence'];
  if (!claimProps.evidence_status) {
    claimProps.evidence_status = { type: 'string', enum: evidenceStatusEnum };
    report.schema_changes_made.push('claim.schema.json:added evidence_status enum');
  } else {
    const existing = ((claimProps.evidence_status as Record<string, unknown>).enum ?? []) as string[];
    for (const v of evidenceStatusEnum) if (!existing.includes(v)) existing.push(v);
    (claimProps.evidence_status as Record<string, unknown>).enum = existing;
  }

  if (!claimProps.provenance || typeof claimProps.provenance !== 'object') {
    claimProps.provenance = { type: 'object', properties: {}, additionalProperties: true };
  }
  const provenance = claimProps.provenance as Record<string, unknown>;
  if (!provenance.properties || typeof provenance.properties !== 'object') provenance.properties = {};
  const provenanceProps = provenance.properties as Record<string, unknown>;
  if (!provenanceProps.source_type) provenanceProps.source_type = { type: 'string' };
  if (!provenanceProps.requires_verification) provenanceProps.requires_verification = { type: 'boolean' };
  if (!provenanceProps.cited_sources) provenanceProps.cited_sources = { type: 'array', items: { type: 'object', additionalProperties: true } };
  if (!provenanceProps.ingestion_method) provenanceProps.ingestion_method = { type: 'string' };
  if (!provenanceProps.confidence_tier) provenanceProps.confidence_tier = { type: 'string' };

  for (const dir of claimDirs) {
    const folder = path.basename(dir);
    let entries: string[] = [];
    try {
      const fs = await import('node:fs/promises');
      entries = (await fs.readdir(dir)).filter((f) => f.endsWith('.claims.json'));
    } catch {
      continue;
    }
    for (const file of entries) {
      const filePath = path.join(dir, file);
      const pkg = await readJson<ClaimPackage>(filePath);
      const seenClaimIds = new Set<string>();
      const seenClaimText = new Set<string>();
      const normalized: Array<Record<string, unknown>> = [];
      let duplicateClaimsSuppressed = 0;
      for (const claim of pkg.claims) {
        const claimId = String(claim.claim_id ?? '');
        const claimText = normalizeText(String(claim.claim ?? ''));
        if (seenClaimIds.has(claimId) || seenClaimText.has(claimText)) {
          duplicateClaimsSuppressed += 1;
          continue;
        }
        seenClaimIds.add(claimId);
        seenClaimText.add(claimText);

        const currentState = String(claim.review_state ?? 'machine_extracted');
        if (folder === 'pending' && !['machine_extracted', 'needs_verification', 'needs_revision'].includes(currentState)) {
          claim.review_state = 'needs_revision';
        }
        if (folder === 'reviewed') claim.review_state = 'human_reviewed';
        if (folder === 'rejected') claim.review_state = 'rejected';

        const sourceId = String(claim.source_id ?? '');

        if (sourceId.startsWith('perplexity_')) {
          if (!claim.evidence_strength || claim.review_state !== 'human_reviewed') claim.evidence_strength = 'theoretical';
          if (!claim.confidence || claim.review_state !== 'human_reviewed') claim.confidence = 'low';
          if (claim.clinical_actionability === 'contraindicated' && claim.review_state !== 'human_reviewed') {
            claim.clinical_actionability = 'caution';
          }
        }

        if (sourceId === 'alma_2026') {
          const sourceSpecific = (claim.source_specific && typeof claim.source_specific === 'object'
            ? claim.source_specific
            : {}) as Record<string, unknown>;
          if (!sourceSpecific.derivation) sourceSpecific.derivation = 'alma_dataset_extraction';
          claim.source_specific = sourceSpecific;
          if (claim.review_state !== 'human_reviewed') claim.evidence_strength = 'weak';
        }

        normalized.push(claim);
      }
      pkg.claims = normalized;
      for (let i = 0; i < duplicateClaimsSuppressed; i += 1) {
        recordDuplicateSignal(report, {
          signal: 'claim_deduplicated',
          detail: 'Duplicate claim candidate was suppressed by claim_id or normalized claim text.',
          update_file: path.relative(root, filePath),
          source_id: pkg.source_id
        });
      }
      report.claims_normalized = Number(report.claims_normalized) + normalized.length;
      await writeJson(filePath, pkg);
    }
  }

  await writeJson(canonical.interactions, dataset);
  await writeJson(canonical.sourceManifest, manifest);
  await writeJson(canonical.citationRegistry, citations);
  await writeJson(canonical.sourceSchema, sourceSchema);
  await writeJson(canonical.claimSchema, claimSchema);

  await mkdir(archiveRoot, { recursive: true });
  const archiveRows: string[] = ['# Absorbed Updates', '', '| File absorbed | Target canonical file | Date | Notes |', '|---|---|---|---|'];
  for (const absorbedRel of report.update_files_absorbed) {
    const sourcePath = path.join(root, absorbedRel);
    const targetPath = path.join(archiveRoot, path.basename(absorbedRel));
    try {
      await rename(sourcePath, targetPath);
      report.files_archived.push(path.relative(root, targetPath));
      archiveRows.push(`| \`${absorbedRel}\` | \`src/data/interaction_pairs.json\`, \`knowledge-base/indexes/*\`, \`knowledge-base/schemas/*\` | ${new Date().toISOString().slice(0, 10)} | Absorbed by consolidateJsonUpdates.ts |`);
    } catch (error) {
      recordConflict(report, `archive_failed:${absorbedRel}:${String(error)}`, {
        category: 'archive_failure',
        reason_code: 'archive_failed',
        message: `Update file ${absorbedRel} could not be archived after consolidation.`,
        severity: 'error',
        update_file: absorbedRel,
        detail: String(error),
        suggested_review_action: 'Inspect filesystem/archive path and re-run consolidation after fixing the archive error.'
      });
    }
  }
  await writeFile(archiveReadme, `${archiveRows.join('\n')}\n`, 'utf8');
  await writeJson(reportPath, report);

  console.log(
    JSON.stringify(
      {
        report: path.relative(root, reportPath),
        interaction_records_merged: report.interaction_records_merged,
        source_manifest_entries_inserted: report.source_manifest_entries_inserted,
        citations_merged: report.citations_merged,
        claims_normalized: report.claims_normalized,
        duplicate_signals: report.duplicate_signals.length,
        files_archived: report.files_archived.length,
        conflicts_detected: report.conflicts_detected.length
      },
      null,
      2
    )
  );
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

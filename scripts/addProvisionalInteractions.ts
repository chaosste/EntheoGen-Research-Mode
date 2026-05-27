import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalPairKey, readJson, stableHash, titleCaseFromSlug, writeJson } from './kb-utils';

type ProvisionalPairSpec = {
  pair: [string, string];
  classification: string;
  mechanism: string[];
  risk: string;
  priority: 'critical' | 'high' | 'medium';
  rationale: string;
};

type DatasetShape = {
  schema_version?: string;
  generated_at?: string;
  substances?: Array<{ id: string; name: string; class?: string; mechanism_tag?: string; notes?: string }>;
  pairs?: any[];
  interactions?: any[];
  records?: any[];
  sources?: Array<Record<string, unknown>>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const defaultDatasetPath = path.join(root, 'src/data/interaction_pairs.json');
const defaultSpecPath = path.join(root, 'src/data/15_high_value_pairs.json');
const defaultReportPath = path.join(root, 'knowledge-base/reports/provisional_interactions_insert_report.json');

const normalizeMechanism = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const normalizePairId = (value: string): string => value.trim().toLowerCase();

const chooseRiskLevel = (priority: ProvisionalPairSpec['priority']): 'high' | 'moderate' | 'provisional_moderate' => {
  if (priority === 'critical') return 'high';
  if (priority === 'high') return 'moderate';
  return 'provisional_moderate';
};

const buildClinicalSummary = (spec: ProvisionalPairSpec) => {
  const mechanisms = spec.mechanism.map(normalizeMechanism).join(', ');
  return {
    headline: `Provisional ${spec.priority} theoretical interaction requiring verification.`,
    mechanism: `${mechanisms}. Risk summary: ${spec.risk}.`,
    timing_guidance: null,
    field_notes: `Inserted from provisional gap-fill list. ${spec.rationale}`
  };
};

const buildPairRecord = (spec: ProvisionalPairSpec) => {
  const [rawA, rawB] = spec.pair;
  const a = normalizePairId(rawA);
  const b = normalizePairId(rawB);
  const mechanisms = Array.from(new Set(spec.mechanism.map(normalizeMechanism)));
  const riskAssessmentLevel = chooseRiskLevel(spec.priority);
  const pairKey = canonicalPairKey(a, b);
  const title = 'Provisional theoretical interaction';

  return {
    key: pairKey,
    substances: [a, b] as [string, string],
    classification: {
      code: 'THEORETICAL' as const,
      status: 'inferred' as const,
      confidence: 'low' as const,
      risk_score: 2,
      label: 'Provisional theoretical interaction',
      risk_assessment: {
        level: riskAssessmentLevel,
        rationale: spec.rationale
      }
    },
    clinical_summary: buildClinicalSummary(spec),
    mechanism: {
      primary_category: mechanisms[0],
      categories: mechanisms
    },
    evidence: {
      tier: 'theoretical' as const,
      support_type: 'provisional_gap_fill' as const,
      evidence_strength: 'theoretical' as const,
      source_refs: [],
      status: 'provisional_secondary' as const,
      review_state: 'needs_verification' as const,
      review_notes: `Provisional gap fill inserted from ${path.basename(defaultSpecPath)}.`,
      evidence_gaps: 'No source refs yet; provisional high-priority gap fill.'
    },
    source_text: 'manual_high_priority_gap_insert_v1',
    source_fingerprint: stableHash(`${pairKey}|manual_high_priority_gap_insert_v1|${spec.rationale}`),
    provenance: {
      derivation_type: 'curated_inference' as const,
      origin_value_v1: 'manual_high_priority_gap_fill',
      source: 'provisional_gap_fill' as const,
      confidence_tier: 'low' as const,
      method: 'manual_high_priority_gap_insert_v1',
      source_linking_method: 'manual_high_priority_gap_insert_v1',
      source_linking_confidence: 'low' as const,
      requires_verification: true,
      rationale: spec.rationale,
      migrated_from_v1: true as const,
      migration_version: 'v1_to_v2' as const,
      migrated_at: new Date().toISOString()
    },
    override_metadata: { applied: false as const },
    audit: {
      validation_flags: [
        'low_confidence',
        'provisional_secondary',
        'needs_verification',
        'upgrade_candidate'
      ],
      review_status: 'needs_review' as const
    },
    validation: {
      flags: {
        critical: [],
        warning: [],
        info: [
          'low_confidence',
          'provisional_secondary',
          'needs_verification',
          'upgrade_candidate'
        ]
      }
    }
  };
};

const addMissingSubstance = (dataset: DatasetShape, id: string): void => {
  if (!dataset.substances) return;
  if (dataset.substances.some((entry) => entry.id === id)) return;
  dataset.substances.push({
    id,
    name: titleCaseFromSlug(id),
    class: 'Pharmaceutical Class',
    mechanism_tag: 'Provisional high-priority gap fill'
  });
};

const getInteractionCollection = (dataset: DatasetShape): any[] => {
  if (Array.isArray(dataset.pairs)) return dataset.pairs;
  if (Array.isArray(dataset.interactions)) return dataset.interactions;
  if (Array.isArray(dataset.records)) return dataset.records;
  throw new Error('Unsupported dataset shape; expected array or object with pairs/interactions/records');
};

const setInteractionCollection = (dataset: DatasetShape, collection: any[]): void => {
  if (Array.isArray(dataset.pairs)) {
    dataset.pairs = collection;
    return;
  }
  if (Array.isArray(dataset.interactions)) {
    dataset.interactions = collection;
    return;
  }
  if (Array.isArray(dataset.records)) {
    dataset.records = collection;
  }
};

const run = async (): Promise<void> => {
  const datasetPath = process.env.INTERACTION_DATASET_V2_PATH ?? defaultDatasetPath;
  const specPath = process.env.PROVISIONAL_PAIR_SPEC_PATH ?? defaultSpecPath;
  const reportPath = process.env.PROVISIONAL_REPORT_PATH ?? defaultReportPath;

  const dataset = (await readJson<DatasetShape>(datasetPath)) as DatasetShape;
  const specs = JSON.parse(await readFile(specPath, 'utf8')) as ProvisionalPairSpec[];

  const collection = getInteractionCollection(dataset);
  const existingKeys = new Set(
    collection
      .filter((record) => Array.isArray(record?.substances))
      .map((record) => canonicalPairKey(String(record.substances[0]), String(record.substances[1])))
  );

  const inserted: any[] = [];
  const skippedExisting: string[] = [];
  const requested = specs.length;

  for (const spec of specs) {
    const [a, b] = spec.pair.map(normalizePairId);
    const key = canonicalPairKey(a, b);
    if (existingKeys.has(key)) {
      skippedExisting.push(key);
      continue;
    }

    addMissingSubstance(dataset, a);
    addMissingSubstance(dataset, b);

    const record = buildPairRecord(spec);
    collection.push(record);
    existingKeys.add(key);
    inserted.push(record.key);
  }

  collection.sort((left, right) => canonicalPairKey(left.substances[0], left.substances[1]).localeCompare(canonicalPairKey(right.substances[0], right.substances[1])));
  setInteractionCollection(dataset, collection);
  dataset.generated_at = new Date().toISOString();

  await writeJson(datasetPath, dataset);
  await writeJson(reportPath, {
    dataset_path_used: datasetPath,
    records_requested: requested,
    records_inserted: inserted.length,
    records_skipped_existing: skippedExisting.length,
    skipped_existing_keys: skippedExisting,
    final_total_interactions: collection.length,
    substances_added_or_retained: dataset.substances?.length ?? null,
    schema_assumptions: [
      'Dataset may be array-shaped or wrapped in pairs/interactions/records; canonical repo dataset uses pairs.',
      'New provisional rows are intentionally source-ref empty and use provisional_gap_fill provenance.',
      'Missing substance stubs are added only when the dataset needs them for validation.'
    ]
  });

  console.log(
    `Provisional interaction insert complete. inserted=${inserted.length} skipped=${skippedExisting.length} total=${collection.length}`
  );
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

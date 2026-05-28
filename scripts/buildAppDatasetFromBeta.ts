/**
 * Reads EntheoGen-Dataset-Beta-0-1 CSV exports and writes app snapshot artifacts:
 * - src/exports/interaction_pairs.json
 * - src/exports/chunk_excerpts.json
 * - src/data/substances_snapshot.json
 * - public/dataset/{interaction_pairs.json,chunk_excerpts.json,substances_snapshot.json,manifest.json}
 *
 * Usage:
 *   npx tsx scripts/buildAppDatasetFromBeta.ts [path/to/beta/data]
 *   npx tsx scripts/buildAppDatasetFromBeta.ts --print-paths
 * Default beta data dir: ../../EntheoGen-Dataset-Beta-0-1/data (sibling of EntheoGen repo)
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveBetaInteractionCode,
  normalizeBetaConfidence
} from './betaDatasetMapping';
import {
  getAppDatasetExportPaths,
  getBetaCsvPaths,
  getDefaultBetaDataDir,
  getPublicDatasetBundlePaths
} from './datasetPaths';
import { APP_DATASET_SCHEMA_VERSION } from '../src/data/datasetManifest';
import { buildChunkExcerptRecord, type ChunkExcerptIndex } from '../src/data/chunkExcerpts';

type AppInteractionCode =
  | 'LOW'
  | 'LOW_MOD'
  | 'CAU'
  | 'UNS'
  | 'DAN'
  | 'UNK'
  | 'SELF'
  | 'INFERRED'
  | 'THEORETICAL'
  | 'DETERMINISTIC';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

type CsvRow = Record<string, string>;
type PairCoverageEntry = {
  sourceRefs: string[];
  sourceTitles: string[];
  chunkRefs: string[];
  exactChunkCount: number;
  classLevelChunkCount: number;
  exactChunkIds: string[];
};
type PairCoverageByKey = Map<string, PairCoverageEntry>;

const DEFAULT_FOUNDATION_CHUNKS_JSONL = path.join(
  root,
  'src',
  'curation',
  'foundation-bundles',
  '20260527-allowlist-merge-v3',
  'chunks.jsonl'
);

function cleanCsvValue(value?: string | null): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.toUpperCase() === 'NULL' ? '' : trimmed;
}

function readCsvObjects(csvPath: string): CsvRow[] {
  const py = `
import csv, json, sys
with open(sys.argv[1], newline='', encoding='utf-8') as f:
    print(json.dumps(list(csv.DictReader(f))))
`;
  const json = execFileSync('python3', ['-c', py, csvPath], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(json) as CsvRow[];
}

function splitDelimitedRefs(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitSourceTitles(value: string | undefined): string[] {
  const refs = splitDelimitedRefs(value);
  if (refs.length === 1 && refs[0].includes('|')) {
    return refs[0].split('|').map((entry) => entry.trim()).filter(Boolean);
  }
  return refs;
}

function parseMechanismCategories(value: string | undefined): string[] {
  const cleaned = cleanCsvValue(value);
  if (!cleaned) return [];
  const inner = cleaned.replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) return [];
  return inner.split(/\s+/).map((entry) => entry.trim()).filter(Boolean);
}

function buildPairCoverageIndex(rows: CsvRow[]): PairCoverageByKey {
  const byKey: PairCoverageByKey = new Map();
  for (const row of rows) {
    const pairKey = cleanCsvValue(row.pair_key);
    if (!pairKey) continue;
    byKey.set(pairKey, {
      sourceRefs: splitDelimitedRefs(row.source_ids),
      sourceTitles: splitSourceTitles(row.source_titles),
      chunkRefs: splitDelimitedRefs(row.all_chunk_ids),
      exactChunkCount: Number.parseInt(cleanCsvValue(row.exact_chunk_count), 10) || 0,
      classLevelChunkCount: Number.parseInt(cleanCsvValue(row.class_level_chunk_count), 10) || 0,
      exactChunkIds: splitDelimitedRefs(row.exact_chunk_ids)
    });
  }
  return byKey;
}

function fingerprintPair(row: CsvRow): string {
  const payload = JSON.stringify({
    pair_key: row.pair_key,
    substance_a_id: row.substance_a_id,
    substance_b_id: row.substance_b_id,
    classification_code: row.classification_code ?? '',
    risk_score: row.risk_score,
    risk_label: row.risk_label,
    headline: row.headline
  });
  return createHash('sha256').update(payload).digest('hex');
}

function parseRiskScore(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return Number.NaN;
  const n = Number(trimmed);
  return n;
}

function defaultRiskScale(interactionCode: AppInteractionCode): number {
  if (interactionCode === 'SELF') return -1;
  if (interactionCode === 'LOW') return 1;
  if (interactionCode === 'LOW_MOD' || interactionCode === 'INFERRED' || interactionCode === 'THEORETICAL') return 2;
  if (interactionCode === 'CAU' || interactionCode === 'DETERMINISTIC') return 3;
  if (interactionCode === 'UNS') return 4;
  if (interactionCode === 'DAN') return 5;
  return 0;
}

function normalizeInteractionLabel(interactionCode: AppInteractionCode, label: string): string {
  if (interactionCode === 'INFERRED' && (!label || /unknown|insufficient data/i.test(label))) {
    return 'Mechanistic inference';
  }
  if (interactionCode === 'THEORETICAL' && !label) {
    return 'Theoretical interaction';
  }
  return label || interactionCode;
}

function deriveOrigin(row: CsvRow): 'self' | 'explicit' | 'unknown' {
  const interactionCode = resolveBetaInteractionCode(row.classification_code, row.risk_label, row.is_self_pair);
  if (interactionCode === 'SELF') {
    return 'self';
  }
  if (interactionCode === 'INFERRED' || interactionCode === 'THEORETICAL') {
    return 'unknown';
  }
  return 'explicit';
}

function buildInteractions(rows: CsvRow[], pairCoverageByKey: PairCoverageByKey, hasPairCoverage: boolean) {
  return rows.map((row) => {
    const interaction_code = resolveBetaInteractionCode(
      row.classification_code,
      row.risk_label,
      row.is_self_pair
    ) as AppInteractionCode;
    const pairCoverage = pairCoverageByKey.get(row.pair_key);

    const riskNum = parseRiskScore(row.risk_score);
    const risk_scale = Number.isFinite(riskNum) ? riskNum : defaultRiskScale(interaction_code);

    const mechanism_category = cleanCsvValue(row.primary_mechanism_category) || 'unknown';
    const mechanism_categories = parseMechanismCategories(row.mechanism_categories);
    const sourceRefs = pairCoverage?.sourceRefs.length
      ? pairCoverage.sourceRefs
      : (hasPairCoverage ? [] : ['beta_dataset']);
    const sourceTitles = pairCoverage?.sourceTitles ?? [];
    const chunkRefs = pairCoverage?.chunkRefs ?? [];

    return {
      substance_a_id: row.substance_a_id,
      substance_b_id: row.substance_b_id,
      pair_key: row.pair_key,
      origin: deriveOrigin(row),
      interaction_code,
      interaction_label: normalizeInteractionLabel(interaction_code, cleanCsvValue(row.risk_label)),
      risk_scale,
      summary: cleanCsvValue(row.headline),
      confidence: normalizeBetaConfidence(row.classification_confidence ?? ''),
      mechanism: cleanCsvValue(row.mechanism_summary) || null,
      mechanism_category,
      mechanism_categories: mechanism_categories.length ? mechanism_categories : undefined,
      coverage: pairCoverage
        ? {
          exact_chunk_count: pairCoverage.exactChunkCount,
          class_level_chunk_count: pairCoverage.classLevelChunkCount,
          exact_chunk_ids: pairCoverage.exactChunkIds
        }
        : undefined,
      timing: cleanCsvValue(row.timing_guidance) || null,
      evidence_gaps: cleanCsvValue(row.evidence_gaps) || null,
      evidence_tier: null,
      field_notes: cleanCsvValue(row.field_notes) || null,
      sources: 'beta-0-1-snapshot',
      source_refs: sourceRefs,
      source_titles: sourceTitles,
      chunk_refs: chunkRefs,
      source_fingerprint: fingerprintPair(row)
    };
  });
}

function buildSubstances(rows: CsvRow[]) {
  return rows.map((row) => {
    const deprecated = ['true', '1', 'yes'].includes(cleanCsvValue(row.deprecated).toLowerCase());
    const supersededRaw = cleanCsvValue(row.superseded_by);
    const supersededBy = supersededRaw
      ? supersededRaw.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
      : undefined;

    return {
      id: cleanCsvValue(row.id),
      name: cleanCsvValue(row.name),
      class: cleanCsvValue(row.class),
      mechanismTag: cleanCsvValue(row.mechanism_tag),
      notes: cleanCsvValue(row.notes),
      deprecated: deprecated || undefined,
      supersededBy
    };
  });
}

function buildChunkExcerptIndex(
  chunkIds: Set<string>,
  chunksJsonlPath: string
): ChunkExcerptIndex {
  if (chunkIds.size === 0 || !fs.existsSync(chunksJsonlPath)) {
    return {};
  }

  const index: ChunkExcerptIndex = {};
  const lines = fs.readFileSync(chunksJsonlPath, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const chunk = JSON.parse(line) as {
      chunk_id: string;
      source_id: string;
      source_title: string;
      year?: number;
      authors?: string[];
      chunk_text: string;
    };
    if (!chunkIds.has(chunk.chunk_id)) continue;
    index[chunk.chunk_id] = buildChunkExcerptRecord(chunk);
  }
  return index;
}

function main() {
  const args = process.argv.slice(2);
  const printPathsOnly = args.includes('--print-paths');
  const betaDataDir = args.find((arg) => !arg.startsWith('--')) ?? getDefaultBetaDataDir(root);
  const betaCsv = getBetaCsvPaths(betaDataDir);
  const exports = getAppDatasetExportPaths(root);
  const publicBundle = getPublicDatasetBundlePaths(root);

  if (printPathsOnly) {
    console.log(
      JSON.stringify(
        {
          beta_csv_inputs: betaCsv,
          app_dataset_exports: exports,
          public_dataset_bundle: publicBundle,
          canonical_outputs: exports
        },
        null,
        2
      )
    );
    return;
  }

  if (!fs.existsSync(betaCsv.substancesCsv) || !fs.existsSync(betaCsv.interactionsCsv)) {
    throw new Error(
      `Beta dataset CSVs not found under "${betaDataDir}". ` +
        `Pass the data directory as the first argument, e.g. ` +
        `npx tsx scripts/buildAppDatasetFromBeta.ts /path/to/EntheoGen-Dataset-Beta-0-1/data`
    );
  }

  const substanceRows = readCsvObjects(betaCsv.substancesCsv);
  const interactionRows = readCsvObjects(betaCsv.interactionsCsv);
  const pairCoverageCsv = fs.existsSync(betaCsv.pairCoverageCsv)
    ? betaCsv.pairCoverageCsv
    : path.join(root, 'src/curation/foundation-bundles/20260527-allowlist-merge-v3/pair_coverage.csv');
  const hasPairCoverage = fs.existsSync(pairCoverageCsv);
  const pairCoverageRows = hasPairCoverage ? readCsvObjects(pairCoverageCsv) : [];
  const pairCoverageByKey = buildPairCoverageIndex(pairCoverageRows);

  const substances = buildSubstances(substanceRows);
  const interactions = buildInteractions(interactionRows, pairCoverageByKey, hasPairCoverage);
  const chunkIds = new Set<string>();
  for (const interaction of interactions) {
    for (const chunkId of interaction.chunk_refs ?? []) {
      chunkIds.add(chunkId);
    }
  }
  const chunkExcerptIndex = buildChunkExcerptIndex(chunkIds, DEFAULT_FOUNDATION_CHUNKS_JSONL);

  const outSubstances = exports.substancesSnapshot;
  const outInteractions = exports.interactionPairsExport;
  const outChunkExcerpts = exports.chunkExcerptsExport;

  const substancesJson = `${JSON.stringify(substances, null, 2)}\n`;
  const interactionsJson = `${JSON.stringify(interactions, null, 2)}\n`;
  const chunkExcerptsJson = `${JSON.stringify(chunkExcerptIndex, null, 2)}\n`;

  fs.writeFileSync(outSubstances, substancesJson, 'utf8');
  fs.writeFileSync(outInteractions, interactionsJson, 'utf8');
  fs.writeFileSync(outChunkExcerpts, chunkExcerptsJson, 'utf8');

  fs.mkdirSync(publicBundle.dir, { recursive: true });
  fs.writeFileSync(publicBundle.substancesSnapshot, substancesJson, 'utf8');
  fs.writeFileSync(publicBundle.interactionPairs, interactionsJson, 'utf8');
  fs.writeFileSync(publicBundle.chunkExcerpts, chunkExcerptsJson, 'utf8');
  const manifest = {
    schemaVersion: APP_DATASET_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    interactionPairsSha256: createHash('sha256').update(interactionsJson, 'utf8').digest('hex'),
    substancesSnapshotSha256: createHash('sha256').update(substancesJson, 'utf8').digest('hex'),
    chunkExcerptsSha256: createHash('sha256').update(chunkExcerptsJson, 'utf8').digest('hex')
  };
  fs.writeFileSync(publicBundle.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `Wrote ${substances.length} substances -> ${path.relative(process.cwd(), outSubstances)}`
  );
  console.log(
    `Wrote ${interactions.length} interactions -> ${path.relative(process.cwd(), outInteractions)}`
  );
  console.log(
    `Wrote ${Object.keys(chunkExcerptIndex).length} chunk excerpts -> ${path.relative(process.cwd(), outChunkExcerpts)}`
  );
  console.log(
    `Source refs enriched from pair coverage: ${hasPairCoverage ? 'yes' : 'no (fallback to beta_dataset)'}`
  );
  console.log(
    `Wrote public dataset bundle -> ${path.relative(process.cwd(), publicBundle.dir)}`
  );
}

main();

/**
 * Reads EntheoGen-Dataset-Beta-0-1 CSV exports and writes app snapshot artifacts:
 * - src/exports/interaction_pairs.json
 * - src/data/substances_snapshot.json
 * - public/dataset/{interaction_pairs.json,substances_snapshot.json,manifest.json}
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
  mapBetaClassificationToAppCode,
  normalizeBetaConfidence
} from './betaDatasetMapping';
import {
  getAppDatasetExportPaths,
  getBetaCsvPaths,
  getDefaultBetaDataDir,
  getPublicDatasetBundlePaths
} from './datasetPaths';
import { APP_DATASET_SCHEMA_VERSION } from '../src/data/datasetManifest';

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

function fingerprintPair(row: CsvRow): string {
  const payload = JSON.stringify({
    pair_key: row.pair_key,
    substance_a_id: row.substance_a_id,
    substance_b_id: row.substance_b_id,
    classification_code: row.classification_code,
    risk_score: row.risk_score,
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
  if (row.is_self_pair?.toUpperCase() === 'TRUE' || row.classification_code === 'SELF') {
    return 'self';
  }
  if (row.classification_code === 'INFERRED' || row.classification_code === 'THEORETICAL') {
    return 'unknown';
  }
  return 'explicit';
}

function buildInteractions(rows: CsvRow[]) {
  return rows.map((row) => {
    const interaction_code = mapBetaClassificationToAppCode(row.classification_code) as AppInteractionCode;

    const riskNum = parseRiskScore(row.risk_score);
    const risk_scale = Number.isFinite(riskNum) ? riskNum : defaultRiskScale(interaction_code);

    const mechanism_category = cleanCsvValue(row.primary_mechanism_category) || 'unknown';

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
      timing: cleanCsvValue(row.timing_guidance) || null,
      evidence_gaps: cleanCsvValue(row.evidence_gaps) || null,
      evidence_tier: null,
      field_notes: cleanCsvValue(row.field_notes) || null,
      sources: 'beta-0-1-snapshot',
      source_refs: ['beta_dataset'],
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

  const substances = buildSubstances(substanceRows);
  const interactions = buildInteractions(interactionRows);

  const outSubstances = exports.substancesSnapshot;
  const outInteractions = exports.interactionPairsExport;

  const substancesJson = `${JSON.stringify(substances, null, 2)}\n`;
  const interactionsJson = `${JSON.stringify(interactions, null, 2)}\n`;

  fs.writeFileSync(outSubstances, substancesJson, 'utf8');
  fs.writeFileSync(outInteractions, interactionsJson, 'utf8');

  fs.mkdirSync(publicBundle.dir, { recursive: true });
  fs.writeFileSync(publicBundle.substancesSnapshot, substancesJson, 'utf8');
  fs.writeFileSync(publicBundle.interactionPairs, interactionsJson, 'utf8');
  const manifest = {
    schemaVersion: APP_DATASET_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    interactionPairsSha256: createHash('sha256').update(interactionsJson, 'utf8').digest('hex'),
    substancesSnapshotSha256: createHash('sha256').update(substancesJson, 'utf8').digest('hex')
  };
  fs.writeFileSync(publicBundle.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `Wrote ${substances.length} substances -> ${path.relative(process.cwd(), outSubstances)}`
  );
  console.log(
    `Wrote ${interactions.length} interactions -> ${path.relative(process.cwd(), outInteractions)}`
  );
  console.log(
    `Wrote public dataset bundle -> ${path.relative(process.cwd(), publicBundle.dir)}`
  );
}

main();

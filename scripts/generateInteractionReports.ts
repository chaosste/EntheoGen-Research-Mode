import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InteractionDatasetV2, InteractionPairV2 } from '../src/data/interactionSchemaV2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const datasetPath = path.join(root, 'src/data/interactionDatasetV2.json');

const escapeCsv = (value: unknown): string => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toCsv = (rows: InteractionPairV2[]): string => {
  const headers = [
    'pair_key',
    'substance_a_id',
    'substance_b_id',
    'code',
    'status',
    'confidence',
    'risk_score',
    'headline',
    'mechanism_primary_category',
    'evidence_tier',
    'validation_flags',
    'source_refs',
    'source_text'
  ];

  const lines = rows.map((row) => {
    const [a, b] = row.substances;
    return [
      row.key,
      a,
      b,
      row.classification.code,
      row.classification.status,
      row.classification.confidence,
      row.classification.risk_score,
      row.clinical_summary.headline,
      row.mechanism.primary_category,
      row.evidence.tier,
      row.audit.validation_flags.join(';'),
      row.evidence.source_refs.map((ref) => ref.source_id).join(';'),
      row.source_text ?? ''
    ]
      .map(escapeCsv)
      .join(',');
  });

  return `${headers.join(',')}\n${lines.join('\n')}\n`;
};

const run = async (): Promise<void> => {
  const raw = await readFile(datasetPath, 'utf8');
  const dataset = JSON.parse(raw) as InteractionDatasetV2;

  const unknownRows = dataset.pairs.filter(
    (pair) => pair.classification.status === 'unknown' || pair.classification.code === 'UNKNOWN'
  );
  const lowConfidenceRows = dataset.pairs.filter((pair) => pair.classification.confidence === 'low');
  const missingEvidenceRows = dataset.pairs.filter((pair) => {
    const flags = pair.audit.validation_flags;
    return flags.includes('missing_evidence_tier') || flags.includes('missing_source') || flags.includes('source_gap');
  });

  const unknownPath = path.join(root, 'src/unknown.csv');
  const lowConfidencePath = path.join(root, 'src/audit/low-confidence.csv');
  const missingEvidencePath = path.join(root, 'src/audit/missing-evidence.csv');

  await writeFile(unknownPath, toCsv(unknownRows), 'utf8');
  await writeFile(lowConfidencePath, toCsv(lowConfidenceRows), 'utf8');
  await writeFile(missingEvidencePath, toCsv(missingEvidenceRows), 'utf8');

  console.log(`Report rows: unknown=${unknownRows.length}, low-confidence=${lowConfidenceRows.length}, missing-evidence=${missingEvidenceRows.length}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

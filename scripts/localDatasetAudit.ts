import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCanonicalDatasetSourcePaths } from './datasetPaths';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface InteractionPairRow {
  pair_key: string;
  origin?: string | null;
  interaction_code?: string | null;
  risk_scale?: number | null;
  confidence?: string | null;
  mechanism_category?: string | null;
  source_refs?: string[] | null;
  chunk_refs?: string[] | null;
  evidence_gaps?: string | null;
}

type RichInteractionDataset = {
  pairs: Array<{
    key: string;
    substances: string[];
    classification: {
      code?: string | null;
      confidence?: string | null;
      risk_score?: number | null;
    };
    mechanism?: {
      primary_category?: string | null;
    };
    evidence?: {
      source_refs?: Array<string | { source_id?: string | null }>;
      evidence_gaps?: string | null;
    };
  }>;
};

export interface AuditRow {
  pair_key: string;
  interaction_code: string;
  confidence: string;
  risk_scale: number | null;
  risk_label: string;
  mechanism_category: string;
  source_refs: string[];
  chunk_refs: string[];
  linked_chunk_count: number;
  citation_status: string;
  evidence_gaps: string | null;
}

export interface LocalDatasetAudit {
  prompt: string;
  evidenceUsed: string[];
  optionalFilesLoaded: string[];
  counts: {
    totalRows: number;
    totalNonSelfRows: number;
    lowConfidenceRows: number;
    unknownConfidenceRows: number;
    lowUnknownRows: number;
    linkedChunkLowUnknownRows: number;
    noLinkedChunkLowUnknownRows: number;
    nullRiskLowUnknownRows: number;
    explicitEvidenceGapLowUnknownRows: number;
  };
  groups: {
    linkedCitationChunks: AuditRow[];
    noLinkedCitationChunks: AuditRow[];
    nullRisk: AuditRow[];
    explicitEvidenceGaps: AuditRow[];
  };
  rows: AuditRow[];
}

const optionalEvidenceFiles = [
  'foundry-upload-current/matched_reference_chunks.json',
  'foundry-upload-current/curated_reference_chunks.json',
  'foundry-upload-current/Reference_List.md'
] as const;

const priorityExamplePairKeys = [
  'atypical_ad|dox',
  'dox|kambo',
  'dox|lamotrigine',
  'mdma|tricyclic_ad',
  'mdma|two_c_x',
  'mdma|yopo',
  'nbome_series|ndri_bupropion',
  'methylphenidate|two_c_x'
] as const;

const readJson = async <T>(filePath: string): Promise<T> => {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents) as T;
};

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const loadOptionalEvidenceFile = async (filePath: string): Promise<void> => {
  if (filePath.endsWith('.json')) {
    await readJson<JsonValue>(filePath);
    return;
  }
  await fs.readFile(filePath, 'utf8');
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
};

const sourceRefsFromRich = (refs: RichInteractionDataset['pairs'][number]['evidence']['source_refs']): string[] => {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((ref) => (typeof ref === 'string' ? ref : ref.source_id ?? ''))
    .filter(Boolean);
};

const richPairToAuditInput = (pair: RichInteractionDataset['pairs'][number]): InteractionPairRow => ({
  pair_key: pair.key,
  origin: pair.classification.code === 'SELF' ? 'self' : null,
  interaction_code: pair.classification.code ?? null,
  risk_scale: pair.classification.risk_score ?? null,
  confidence: pair.classification.confidence ?? null,
  mechanism_category: pair.mechanism?.primary_category ?? null,
  source_refs: sourceRefsFromRich(pair.evidence?.source_refs),
  chunk_refs: [],
  evidence_gaps: pair.evidence?.evidence_gaps ?? null
});

const normalizeConfidence = (value: string | null | undefined): string => {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : 'unknown';
};

const isSelfPair = (row: InteractionPairRow): boolean =>
  row.origin === 'self' || row.interaction_code === 'SELF' || row.risk_scale === -1;

const isLowConfidence = (row: InteractionPairRow): boolean => normalizeConfidence(row.confidence) === 'low';

const isUnknownConfidence = (row: InteractionPairRow): boolean => {
  const confidence = normalizeConfidence(row.confidence);
  return confidence === 'unknown' || confidence === 'n/a' || confidence === 'none';
};

const hasExplicitEvidenceGaps = (row: AuditRow): boolean =>
  typeof row.evidence_gaps === 'string' && row.evidence_gaps.trim().length > 0;

const describeCitationStatus = (sourceRefs: string[], chunkRefs: string[]): string => {
  if (chunkRefs.length > 0) {
    return 'linked citation chunk in this bundle';
  }
  if (sourceRefs.length === 1 && sourceRefs[0] === 'beta_dataset') {
    return 'no linked citation chunk in this bundle';
  }
  return 'no linked citation chunk in this bundle';
};

const toAuditRow = (row: InteractionPairRow): AuditRow => {
  const sourceRefs = asStringArray(row.source_refs);
  const chunkRefs = asStringArray(row.chunk_refs);
  const riskScale = typeof row.risk_scale === 'number' ? row.risk_scale : null;

  return {
    pair_key: row.pair_key,
    interaction_code: row.interaction_code ?? 'unknown',
    confidence: normalizeConfidence(row.confidence),
    risk_scale: riskScale,
    risk_label: riskScale === null ? 'unscored/unknown' : String(riskScale),
    mechanism_category: row.mechanism_category ?? 'unknown',
    source_refs: sourceRefs,
    chunk_refs: chunkRefs,
    linked_chunk_count: chunkRefs.length,
    citation_status: describeCitationStatus(sourceRefs, chunkRefs),
    evidence_gaps: row.evidence_gaps ?? null
  };
};

export async function buildLowUnknownConfidenceAudit(
  prompt = 'Show pairings with low/unknown confidence'
): Promise<LocalDatasetAudit> {
  const datasetPath = getCanonicalDatasetSourcePaths(repoRoot).interactionPairs;
  const dataset = await readJson<RichInteractionDataset>(datasetPath);
  const rows = dataset.pairs.map(richPairToAuditInput);
  const optionalFilesLoaded: string[] = [];

  for (const relativePath of optionalEvidenceFiles) {
    const filePath = path.join(repoRoot, relativePath);
    if (await exists(filePath)) {
      await loadOptionalEvidenceFile(filePath);
      optionalFilesLoaded.push(relativePath);
    }
  }

  const nonSelfRows = rows.filter((row) => !isSelfPair(row));
  const lowUnknownSourceRows = nonSelfRows.filter((row) => isLowConfidence(row) || isUnknownConfidence(row));
  const auditRows = lowUnknownSourceRows.map(toAuditRow).sort((left, right) => left.pair_key.localeCompare(right.pair_key));

  return {
    prompt,
    evidenceUsed: ['src/data/interaction_pairs.json', ...optionalFilesLoaded],
    optionalFilesLoaded,
    counts: {
      totalRows: rows.length,
      totalNonSelfRows: nonSelfRows.length,
      lowConfidenceRows: nonSelfRows.filter(isLowConfidence).length,
      unknownConfidenceRows: nonSelfRows.filter(isUnknownConfidence).length,
      lowUnknownRows: auditRows.length,
      linkedChunkLowUnknownRows: auditRows.filter((row) => row.linked_chunk_count > 0).length,
      noLinkedChunkLowUnknownRows: auditRows.filter((row) => row.linked_chunk_count === 0).length,
      nullRiskLowUnknownRows: auditRows.filter((row) => row.risk_scale === null).length,
      explicitEvidenceGapLowUnknownRows: auditRows.filter(hasExplicitEvidenceGaps).length
    },
    groups: {
      linkedCitationChunks: auditRows.filter((row) => row.linked_chunk_count > 0),
      noLinkedCitationChunks: auditRows.filter((row) => row.linked_chunk_count === 0),
      nullRisk: auditRows.filter((row) => row.risk_scale === null),
      explicitEvidenceGaps: auditRows.filter(hasExplicitEvidenceGaps)
    },
    rows: auditRows
  };
}

const formatList = (values: string[]): string => (values.length > 0 ? values.join(', ') : '[]');

const formatNullable = (value: string | number | null): string => {
  if (value === null) {
    return 'null';
  }
  return String(value).replace(/\r?\n/g, '<br>');
};

const formatMarkdownCell = (value: string | number | null): string =>
  formatNullable(value).replace(/\|/g, '\\|');

const selectExampleRows = (rows: AuditRow[], limit: number): AuditRow[] => {
  const priorityRows = priorityExamplePairKeys
    .map((pairKey) => rows.find((row) => row.pair_key === pairKey))
    .filter((row): row is AuditRow => row !== undefined);
  const priorityKeys = new Set(priorityRows.map((row) => row.pair_key));
  const remainingRows = rows.filter((row) => !priorityKeys.has(row.pair_key));

  return [...priorityRows, ...remainingRows].slice(0, limit);
};

const renderRows = (rows: AuditRow[], limit: number): string => {
  const shownRows = selectExampleRows(rows, limit);
  const tableRows = shownRows.map((row) =>
    [
      formatMarkdownCell(row.pair_key),
      formatMarkdownCell(row.interaction_code),
      formatMarkdownCell(row.confidence),
      formatMarkdownCell(row.risk_scale),
      formatMarkdownCell(row.mechanism_category),
      formatMarkdownCell(formatList(row.source_refs)),
      formatMarkdownCell(formatList(row.chunk_refs)),
      formatMarkdownCell(row.evidence_gaps)
    ].join(' | ')
  );

  return [
    '| pair_key | interaction_code | confidence | risk_scale | mechanism_category | source_refs | chunk_refs | evidence_gaps |',
    '|---|---|---|---|---|---|---|---|',
    ...tableRows.map((row) => `| ${row} |`)
  ].join('\n');
};

export function renderLowUnknownConfidenceMarkdown(audit: LocalDatasetAudit, exampleLimit = 25): string {
  const { counts } = audit;

  return [
    '# Local Dataset Audit: Low/Unknown Confidence',
    '',
    '## Evidence Used',
    ...audit.evidenceUsed.map((filePath) => `- ${filePath}`),
    '',
    '## Summary',
    `Found ${counts.lowUnknownRows} low/unknown confidence non-self rows directly in the local dataset. ` +
      'Rows with `risk_scale: null` are reported as unscored/unknown risk, and rows with `source_refs: ["beta_dataset"]` plus empty `chunk_refs` are reported as no linked citation chunk in this bundle.',
    '',
    '## Counts',
    `- total rows: ${counts.totalRows}`,
    `- total non-self rows: ${counts.totalNonSelfRows}`,
    `- low confidence rows: ${counts.lowConfidenceRows}`,
    `- unknown/n/a confidence rows: ${counts.unknownConfidenceRows}`,
    `- low/unknown with linked chunks: ${counts.linkedChunkLowUnknownRows}`,
    `- low/unknown without linked chunks: ${counts.noLinkedChunkLowUnknownRows}`,
    `- low/unknown with risk_scale null: ${counts.nullRiskLowUnknownRows}`,
    `- low/unknown with evidence_gaps populated: ${counts.explicitEvidenceGapLowUnknownRows}`,
    '',
    '## Example Rows',
    renderRows(audit.rows, exampleLimit),
    '',
    '## Interpretation',
    'These are low-confidence inferred rows with unscored/unknown risk when `risk_scale` is null. ' +
      'The helper preserves JSON `pair_key` values exactly and does not convert pipe-delimited keys to underscores. ' +
      'A beta-only row with empty `chunk_refs` means no linked citation chunk in this bundle; it does not imply a populated evidence gap.',
    '',
    '## Candidate Follow-Up',
    '- none by default',
    '- manual evidence review for rows with low confidence and no linked chunks'
  ].join('\n');
}

const isMainModule = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isMainModule) {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const prompt = args.filter((arg) => arg !== '--json').join(' ').trim() || 'Show pairings with low/unknown confidence';
  const audit = await buildLowUnknownConfidenceAudit(prompt);

  if (jsonOutput) {
    const output: JsonValue = audit as unknown as JsonValue;
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(renderLowUnknownConfidenceMarkdown(audit));
  }
}

import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import {
  canonicalPairKey,
  ensureDir,
  loadSchema,
  parseFrontmatter,
  readJson,
  slugify,
  titleCaseFromSlug,
  validateSchemaSubset,
  writeJson,
  type ClaimPackage,
  type ClaimRecord,
  type SourceManifestEntry
} from './kb-utils';
import type { InteractionDatasetV2 } from '../src/data/interactionSchemaV2';

type AlmaSeverity = 'none' | 'minor' | 'moderate' | 'moderate_major' | 'major' | 'inconclusive';

type AlmaSourceSpecific = NonNullable<ClaimRecord['source_specific']>;

type ParsedAlmaRow = {
  originalMedicationName: string;
  normalizedMedicationName: string;
  inferredClasses: string[];
  severityRaw: string;
  severity: AlmaSeverity;
  otherInformation: string;
  originalRow: string;
  claimType: ClaimRecord['claim_type'];
  clinicalActionability: NonNullable<ClaimRecord['clinical_actionability']>;
  claim: string;
  claimId: string;
  aliases: string[];
  supportPairs: [string, string][];
};

type IngestionReport = {
  source_id: string;
  source_file: string;
  source_pdf_path?: string;
  total_rows_parsed: number;
  total_claims_generated: number;
  duplicate_medication_entries: Array<{ normalized_medication_name: string; count: number }>;
  entries_with_no_parsed_severity: Array<{ row_index: number; raw_line: string; reason: string }>;
  entries_marked_inconclusive: Array<{ claim_id: string; medication: string; severity: string }>;
  entries_conflicting_with_existing_dataset: Array<{
    claim_id: string;
    pair_key: string;
    existing_code: string;
    alma_severity: string;
    reason: string;
  }>;
  entries_suggesting_new_interaction_pairs: Array<{
    claim_id: string;
    pair_key: string;
    pair: [string, string];
    severity: string;
  }>;
  entries_matching_existing_pairs: Array<{
    claim_id: string;
    pair_key: string;
    pair: [string, string];
    severity: string;
  }>;
  entries_skipped: Array<{ raw_line: string; reason: string }>;
  counts_by_severity: Record<string, number>;
};

const ALMA_SOURCE_ID = 'alma_ayahuasca_interactions_dataset';
const severityPatterns: Array<{ raw: RegExp; severity: AlmaSeverity }> = [
  { raw: /inconclusive\s*-\s*likely\s*moderate-?\s*major/i, severity: 'inconclusive' },
  { raw: /moderate\s*[/\-]\s*major/i, severity: 'moderate_major' },
  { raw: /moderate-?major/i, severity: 'moderate_major' },
  { raw: /no interactions?/i, severity: 'none' },
  { raw: /\bminor\b/i, severity: 'minor' },
  { raw: /\bmoderate\b/i, severity: 'moderate' },
  { raw: /\bmajor\b/i, severity: 'major' },
  { raw: /\binconclusive\b/i, severity: 'inconclusive' }
];

const medicationClassRules: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: 'SSRIs',
    patterns: [
      /\b(citalopram|escitalopram|fluoxetine|fluvoxamine|paroxetine|sertraline)\b/i,
      /\b(zoloft|prozac|luvox|paxil|lexapro|celexa)\b/i
    ]
  },
  {
    label: 'SNRIs',
    patterns: [
      /\b(duloxetine|venlafaxine|desvenlafaxine|milnacipran)\b/i,
      /\b(cymbalta|effexor)\b/i
    ]
  },
  {
    label: 'TCAs',
    patterns: [
      /\b(amitriptyline|clomipramine|desipramine|doxepin|imipramine|nortriptyline|trimipramine|amoxapine)\b/i
    ]
  },
  {
    label: 'stimulants',
    patterns: [
      /\b(amphetamine|dextroamphetamine|methamphetamine|methylphenidate|cocaine|phentermine|methamfetamine|adderall|benzedrine|diethylpropion|phendimetrazine|pemoline|modafinil)\b/i
    ]
  },
  {
    label: 'opioids',
    patterns: [
      /\b(codeine|tramadol|meperidine|methadone|oxycodone|hydrocodone)\b/i
    ]
  },
  {
    label: 'triptans',
    patterns: [
      /\b(sumatriptan|rizatriptan|zolmitriptan|naratriptan|eletriptan|frovatriptan|almotriptan)\b/i
    ]
  },
  {
    label: 'MAOIs',
    patterns: [
      /\b(moclobemide|phenelzine|tranylcypromine|isocarboxazid|selegiline|rasagiline|linezolid|ipro?niazid|procarbazine|furazolidone|brofaromine|nialamide|pargyline)\b/i
    ]
  },
  {
    label: 'antihistamines',
    patterns: [
      /\b(diphenhydramine|hydroxyzine|chlorpheniramine|cetirizine|loratadine|promethazine|alimemazine|benadryl|zyrtec|phenergan)\b/i
    ]
  },
  {
    label: 'antihypertensives',
    patterns: [
      /\b(hydralazine|methyldopa|chlorthalidone|guanethidine|guanadrel)\b/i
    ]
  }
];

const medicationAliasMap = new Map<string, string>([
  ['zoloft', 'sertraline'],
  ['prozac', 'fluoxetine'],
  ['luvox', 'fluvoxamine'],
  ['paxil', 'paroxetine'],
  ['lexapro', 'escitalopram'],
  ['celexa', 'citalopram'],
  ['cymbalta', 'duloxetine'],
  ['effexor', 'venlafaxine'],
  ['wellbutrin', 'bupropion'],
  ['buspar', 'buspirone'],
  ['zyrtec', 'cetirizine'],
  ['benadryl', 'diphenhydramine'],
  ['tagamet', 'cimetidine'],
  ['phenergan', 'promethazine'],
  ['adderall', 'amphetamine'],
  ['benzedrine', 'amphetamine'],
  ['vioxx', 'rofecoxib'],
  ['percocet', 'oxycodone'],
  ['vicodin', 'hydrocodone']
]);

const interactionSeverityRank: Record<string, number> = {
  none: 0,
  minor: 1,
  inconclusive: 1,
  moderate: 2,
  moderate_major: 3,
  major: 4
};

const existingRiskRank = (code: string): number => {
  switch (code) {
    case 'DETERMINISTIC':
    case 'DANGEROUS':
    case 'UNSAFE':
      return 4;
    case 'CAUTION':
      return 3;
    case 'LOW_MOD':
      return 2;
    case 'THEORETICAL':
      return 1;
    case 'INFERRED':
      return 1;
    default:
      return 0;
  }
};

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  const compacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined && item !== null && !(Array.isArray(item) && item.length === 0)) {
      compacted[key] = item;
    }
  }
  return compacted as T;
};

const normalizeSeverity = (value: string): AlmaSeverity | null => {
  const raw = value.trim();
  if (!raw) return null;
  for (const entry of severityPatterns) {
    if (entry.raw.test(raw)) return entry.severity;
  }
  return null;
};

const severityToActionability = (severity: AlmaSeverity): NonNullable<ClaimRecord['clinical_actionability']> => {
  switch (severity) {
    case 'none':
      return 'none';
    case 'minor':
      return 'monitor';
    case 'moderate':
      return 'caution';
    case 'moderate_major':
    case 'major':
      return 'avoid';
    case 'inconclusive':
      return 'caution';
  }
};

const severityToClaimType = (severity: AlmaSeverity): ClaimRecord['claim_type'] => {
  switch (severity) {
    case 'none':
    case 'inconclusive':
      return 'guidance';
    case 'minor':
    case 'moderate':
      return 'interaction';
    case 'moderate_major':
    case 'major':
      return 'risk';
  }
};

const listAliases = (label: string): string[] => {
  const aliases = new Set<string>();
  for (const match of label.matchAll(/\[([^\]]+)\]/g)) {
    aliases.add(match[1].trim());
  }
  for (const match of label.matchAll(/\(([^)]+)\)/g)) {
    const content = match[1].trim();
    if (content && !/also known/i.test(content)) {
      aliases.add(content);
    }
  }
  return [...aliases].filter(Boolean);
};

const normalizeMedicationLabel = (label: string): { canonical: string; aliases: string[] } => {
  const aliases = listAliases(label);
  let cleaned = label
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\(([^)]*)\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/g, '');

  const lower = cleaned.toLowerCase();
  for (const [alias, canonical] of medicationAliasMap.entries()) {
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) {
      cleaned = canonical;
      break;
    }
  }

  const canonical = slugify(cleaned);
  return { canonical: canonical || slugify(label), aliases };
};

const inferClasses = (medicationText: string, otherInformation: string): string[] => {
  const haystack = `${medicationText} ${otherInformation}`.toLowerCase();
  return medicationClassRules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(haystack)))
    .map((rule) => rule.label);
};

const deriveSupportPairs = (specific: string, classes: string[]): [string, string][] => {
  const pairs: [string, string][] = [['ayahuasca', specific]];
  for (const cls of classes) {
    const key = canonicalPairKey('ayahuasca', cls);
    if (!pairs.some((pair) => canonicalPairKey(pair[0], pair[1]) === key)) {
      pairs.push(['ayahuasca', cls]);
    }
  }
  return pairs;
};

const isMedicationContinuation = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/[.?!:;]$/.test(trimmed)) return false;
  if (/^(using|concurrent|the risk|avoid|monitor|may|can|due to|usually|closely|when|since|because|also|however)/i.test(trimmed)) {
    return false;
  }
  return trimmed.length <= 80 && /^[A-Z0-9[(]/.test(trimmed);
};

const rowStartRegex = /^(.*?)\s{2,}(Inconclusive\s*-\s*likely\s*moderate-?\s*major|Moderate\s*[/\-]\s*Major|Moderate-?Major|No interactions?|Minor|Moderate|Major|Inconclusive)\s*(.*)$/i;

const extractSourceText = async (frontmatter: Record<string, unknown>, body: string): Promise<string> => {
  const bodyLooksUseful = /MEDICATION\s+INTERACTION/i.test(body) || /\bMajor\b|\bModerate\b|\bMinor\b|\bNo interactions?\b/i.test(body);
  if (bodyLooksUseful && body.trim().length > 100) {
    return body;
  }

  const pdfPath = typeof frontmatter.source_pdf_path === 'string' ? frontmatter.source_pdf_path : null;
  if (pdfPath) {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'alma-ingest-'));
    const textPath = path.join(tempDir, 'alma.txt');
    execFileSync('pdftotext', ['-layout', pdfPath, textPath]);
    return readFileSync(textPath, 'utf8');
  }

  return body;
};

const parseRows = (text: string): Array<{ medication: string; severityLabel: string; otherInformation: string; originalRow: string }> => {
  const rows: Array<{ medication: string; severityLabel: string; otherInformation: string; originalRow: string }> = [];
  let current: { medicationParts: string[]; severityLabel: string; otherParts: string[]; rawLines: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    const medication = current.medicationParts.join(' ').replace(/\s+/g, ' ').trim();
    const otherInformation = current.otherParts.join(' ').replace(/\s+/g, ' ').trim();
    const originalRow = current.rawLines.join(' ').replace(/\s+/g, ' ').trim();
    if (medication && current.severityLabel) {
      rows.push({ medication, severityLabel: current.severityLabel, otherInformation, originalRow });
    }
    current = null;
  };

  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine.replace(/\u000c/g, '').trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (
      /^(MEDICATION|Interaction|OTHER INFORMATION|Ayahuasca and medication interactions|Use the Search field|The Good, the Bad, and the Soul|https?:\/\/|phone=|Retreat Inquiry|Interest en Retiro)/i.test(trimmed)
    ) {
      continue;
    }
    const match = line.match(rowStartRegex);
    if (match) {
      flush();
      current = {
        medicationParts: [match[1].trim()],
        severityLabel: match[2].replace(/\s+/g, ' ').trim(),
        otherParts: [match[3].trim()].filter(Boolean),
        rawLines: [trimmed]
      };
      continue;
    }
    if (!current) continue;
    if (isMedicationContinuation(trimmed) && current.otherParts.length === 0) {
      current.medicationParts.push(trimmed);
    } else {
      current.otherParts.push(trimmed);
    }
    current.rawLines.push(trimmed);
  }

  flush();
  return rows;
};

const buildClaim = (
  sourceId: string,
  index: number,
  row: { medication: string; severityLabel: string; otherInformation: string; originalRow: string }
): ParsedAlmaRow | null => {
  const severity = normalizeSeverity(row.severityLabel);
  if (!severity) return null;

  const { canonical, aliases } = normalizeMedicationLabel(row.medication);
  const classes = inferClasses(row.medication, row.otherInformation);
  const supportPairs = deriveSupportPairs(canonical || slugify(row.medication), classes);
  const claimId = `${sourceId}_${String(index + 1).padStart(3, '0')}`;
  const actionability = severityToActionability(severity);
  const claimType = severityToClaimType(severity);
  const claim =
    severity === 'none'
      ? `Alma table reports no interaction for ${row.medication} with the ayahuasca proxy.`
      : `Alma table rates ${row.medication} as ${row.severityLabel} with the ayahuasca proxy.`;

  return {
    originalMedicationName: row.medication,
    normalizedMedicationName: canonical || slugify(row.medication),
    inferredClasses: classes,
    severityRaw: row.severityLabel,
    severity,
    otherInformation: row.otherInformation,
    originalRow: row.originalRow,
    claimType,
    clinicalActionability: actionability,
    claim,
    claimId,
    aliases,
    supportPairs
  };
};

const upsertManifestEntry = (
  manifest: { version: string; sources: SourceManifestEntry[] },
  entry: SourceManifestEntry
): void => {
  const index = manifest.sources.findIndex((source) => source.source_id === entry.source_id);
  if (index >= 0) {
    manifest.sources[index] = {
      ...manifest.sources[index],
      ...entry,
      review_state: manifest.sources[index].review_state === 'validated' ? 'validated' : entry.review_state
    };
    return;
  }
  manifest.sources.push(entry);
};

const conflictSummary = (
  claim: ParsedAlmaRow,
  pairKey: string,
  existingCode: string,
  existingSeverityRank: number
): string | null => {
  const almaRank = interactionSeverityRank[claim.severity];
  if (existingSeverityRank >= 4 && almaRank <= 1) {
    return 'existing dataset is more severe while Alma is minor/no interaction';
  }
  if (existingCode === 'DETERMINISTIC' && almaRank <= 1) {
    return 'deterministic high-risk dataset entry conflicts with minor/no interaction';
  }
  if (existingCode === 'SELF') return null;
  return null;
};

const run = async (): Promise<void> => {
  const kbRoot = process.env.KB_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge-base');
  const sourcePath = process.env.KB_ALMA_SOURCE_PATH ?? path.resolve(kbRoot, 'sources', 'expert-guidelines', 'alma_ayahuasca_interactions_dataset.md');
  const sourceManifestPath = process.env.KB_SOURCE_MANIFEST_PATH ?? path.join(kbRoot, 'indexes', 'source_manifest.json');
  const sourceTagsPath = process.env.KB_SOURCE_TAGS_PATH ?? path.join(kbRoot, 'indexes', 'source_tags.json');
  const citationRegistryPath = process.env.KB_CITATION_REGISTRY_PATH ?? path.join(kbRoot, 'indexes', 'citation_registry.json');
  const pendingDir = process.env.KB_PENDING_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'pending');
  const reportPath = process.env.KB_ALMA_REPORT_PATH ?? path.join(kbRoot, 'reports', 'alma_ingestion_report.json');
  const claimSchemaPath = process.env.KB_CLAIM_SCHEMA_PATH ?? path.join(kbRoot, 'schemas', 'claim.schema.json');
  const sourceSchemaPath = process.env.KB_SOURCE_SCHEMA_PATH ?? path.join(kbRoot, 'schemas', 'source.schema.json');
  const datasetPath = process.env.KB_DATASET_PATH ?? path.resolve(kbRoot, '..', 'src', 'data', 'interactionDatasetV2.json');

  await ensureDir(pendingDir);
  await ensureDir(path.dirname(reportPath));

  const sourceSchema = await loadSchema(sourceSchemaPath);
  const claimSchema = await loadSchema(claimSchemaPath);
  const dataset = await readJson<InteractionDatasetV2>(datasetPath);
  const manifest = await readJson<{ version: string; sources: SourceManifestEntry[] }>(sourceManifestPath).catch(() => ({ version: 'kb_v1', sources: [] }));
  const sourceTags = await readJson<{ version: string; source_tags: Array<{ source_id: string; tags: string[] }> }>(sourceTagsPath).catch(() => ({ version: 'kb_v1', source_tags: [] }));
  const citationRegistry = await readJson<{ version: string; citations: Array<Record<string, unknown>> }>(citationRegistryPath).catch(() => ({ version: 'kb_v1', citations: [] }));

  const sourceText = readFileSync(sourcePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(sourceText);
  const extractedText = await extractSourceText(frontmatter, body);
  const rows = parseRows(extractedText);

  const sourceId = typeof frontmatter.source_id === 'string' && frontmatter.source_id.trim()
    ? frontmatter.source_id.trim()
    : ALMA_SOURCE_ID;
  const sourceTitle = typeof frontmatter.title === 'string' && frontmatter.title.trim()
    ? frontmatter.title.trim()
    : titleCaseFromSlug(path.basename(sourcePath, path.extname(sourcePath)));
  const sourceType = (frontmatter.source_type as SourceManifestEntry['source_type'] | undefined) ?? 'expert_dataset';
  const fileRef = path.relative(kbRoot, sourcePath).replace(/\\/g, '/');
  const pdfPath = typeof frontmatter.source_pdf_path === 'string' ? frontmatter.source_pdf_path : undefined;

  const claims: Array<ClaimRecord> = [];
  const report: IngestionReport = {
    source_id: sourceId,
    source_file: fileRef,
    source_pdf_path: pdfPath,
    total_rows_parsed: 0,
    total_claims_generated: 0,
    duplicate_medication_entries: [],
    entries_with_no_parsed_severity: [],
    entries_marked_inconclusive: [],
    entries_conflicting_with_existing_dataset: [],
    entries_suggesting_new_interaction_pairs: [],
    entries_matching_existing_pairs: [],
    entries_skipped: [],
    counts_by_severity: {}
  };

  const seenMedications = new Map<string, number>();
  const existingPairs = new Map(dataset.pairs.map((pair) => [pair.key, pair] as const));

  rows.forEach((row, index) => {
    report.total_rows_parsed += 1;
    const parsed = buildClaim(sourceId, index, row);
    if (!parsed) {
      report.entries_with_no_parsed_severity.push({
        row_index: index + 1,
        raw_line: row.originalRow,
        reason: 'severity label could not be normalized'
      });
      return;
    }

    seenMedications.set(parsed.normalizedMedicationName, (seenMedications.get(parsed.normalizedMedicationName) ?? 0) + 1);
    report.counts_by_severity[parsed.severity] = (report.counts_by_severity[parsed.severity] ?? 0) + 1;

    const sourceSpecific: AlmaSourceSpecific = compactObject({
      original_medication_name: parsed.originalMedicationName,
      normalized_medication_name: parsed.normalizedMedicationName,
      severity_label: parsed.severityRaw,
      other_information: parsed.otherInformation,
      derivation: 'secondary_compilation_using_moclobemide_proxy',
      original_row: parsed.originalRow,
      aliases: parsed.aliases
    });

    const claim: ClaimRecord = compactObject({
      claim_id: parsed.claimId,
      source_id: sourceId,
      claim: `${parsed.claim}${parsed.otherInformation ? ` ${parsed.otherInformation}` : ''}`.trim(),
      claim_type: parsed.claimType,
      entities: ['ayahuasca', parsed.normalizedMedicationName, ...parsed.inferredClasses],
      mechanism: parsed.inferredClasses.length > 0 ? `Class-level coverage via ${parsed.inferredClasses.join(', ')}` : undefined,
      evidence_strength: 'weak' as const,
      confidence: 'low' as const,
      supports_pairs: parsed.supportPairs,
      clinical_actionability: parsed.clinicalActionability,
      review_state: 'machine_extracted' as const,
      notes: `Derived from Alma secondary compilation using the moclobemide/RIMA proxy. Severity: ${parsed.severityRaw}.`,
      source_specific: sourceSpecific
    });

    const issues = validateSchemaSubset(claimSchema, claim, `$.claims[${claims.length}]`);
    if (issues.length > 0) {
      report.entries_skipped.push({
        raw_line: parsed.originalRow,
        reason: issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
      });
      return;
    }

    claims.push(claim);
    if (parsed.severity === 'inconclusive') {
      report.entries_marked_inconclusive.push({
        claim_id: parsed.claimId,
        medication: parsed.originalMedicationName,
        severity: parsed.severityRaw
      });
    }

    for (const supportPair of parsed.supportPairs) {
      const pairKey = canonicalPairKey(supportPair[0], supportPair[1]);
      const existingPair = existingPairs.get(pairKey);
      if (!existingPair) {
        report.entries_suggesting_new_interaction_pairs.push({
          claim_id: parsed.claimId,
          pair_key: pairKey,
          pair: supportPair,
          severity: parsed.severityRaw
        });
        continue;
      }
      report.entries_matching_existing_pairs.push({
        claim_id: parsed.claimId,
        pair_key: pairKey,
        pair: supportPair,
        severity: parsed.severityRaw
      });
      const conflictReason = conflictSummary(parsed, pairKey, existingPair.classification.code, existingRiskRank(existingPair.classification.code));
      if (conflictReason) {
        report.entries_conflicting_with_existing_dataset.push({
          claim_id: parsed.claimId,
          pair_key: pairKey,
          existing_code: existingPair.classification.code,
          alma_severity: parsed.severityRaw,
          reason: conflictReason
        });
      }
    }
  });

  const duplicateEntries = [...seenMedications.entries()]
    .filter(([, count]) => count > 1)
    .map(([normalized_medication_name, count]) => ({ normalized_medication_name, count }))
    .sort((a, b) => a.normalized_medication_name.localeCompare(b.normalized_medication_name));

  report.duplicate_medication_entries = duplicateEntries;
  report.total_claims_generated = claims.length;

  const packageRecord: ClaimPackage = {
    source_id: sourceId,
    source_path: fileRef,
    source_metadata: compactObject({
      ...frontmatter,
      source_id: sourceId,
      title: sourceTitle,
      source_type: sourceType,
      authority_level: (frontmatter.authority_level as SourceManifestEntry['authority_level'] | undefined) ?? 'low',
      evidence_domain: (frontmatter.evidence_domain as SourceManifestEntry['evidence_domain'] | undefined) ?? 'aggregated_clinical',
      review_state: 'extracted',
      url_or_path: typeof frontmatter.url_or_path === 'string' ? frontmatter.url_or_path : fileRef,
      notes: typeof frontmatter.notes === 'string' ? frontmatter.notes : 'Secondary interaction compilation using moclobemide/RIMA as ayahuasca proxy.'
    }),
    claims
  };

  await writeJson(path.join(pendingDir, `${sourceId}.claims.json`), packageRecord);

  const sourceEntry: SourceManifestEntry = compactObject({
    source_id: sourceId,
    title: sourceTitle,
    source_type: sourceType,
    authority_level: 'low' as const,
    evidence_domain: 'aggregated_clinical' as const,
    year: typeof frontmatter.year === 'number' ? frontmatter.year : undefined,
    authors: Array.isArray(frontmatter.authors) ? frontmatter.authors.map((author) => String(author)) : undefined,
    citation: typeof frontmatter.citation === 'string' ? frontmatter.citation : 'Alma Healing Center. Ayahuasca and medication interactions.',
    url_or_path: typeof frontmatter.url_or_path === 'string' ? frontmatter.url_or_path : fileRef,
    file_refs: [fileRef],
    review_state: 'extracted' as const,
    notes: typeof frontmatter.notes === 'string' ? frontmatter.notes : 'Secondary interaction compilation using moclobemide/RIMA as an ayahuasca proxy.'
  });

  upsertManifestEntry(manifest, sourceEntry);

  const schemaErrors = manifest.sources.flatMap((entry, index) => validateSchemaSubset(sourceSchema, entry, `$.sources[${index}]`));
  if (schemaErrors.length > 0) {
    throw new Error(`source manifest validation failed:\n${schemaErrors.map((issue) => `${issue.path}: ${issue.message}`).join('\n')}`);
  }

  await writeJson(sourceManifestPath, manifest);

  const tags = Array.from(
    new Set([
      'expert_dataset',
      'interaction_table',
      'ayahuasca_proxy',
      ...claims.map((claim) => claim.claim_type),
      ...claims.flatMap((claim) => claim.entities.filter((entity) => entity !== 'ayahuasca'))
    ])
  ).sort();
  const tagIndex = sourceTags.source_tags.findIndex((entry) => entry.source_id === sourceId);
  if (tagIndex >= 0) {
    sourceTags.source_tags[tagIndex] = { source_id: sourceId, tags: Array.from(new Set([...sourceTags.source_tags[tagIndex].tags, ...tags])).sort() };
  } else {
    sourceTags.source_tags.push({ source_id: sourceId, tags });
  }
  await writeJson(sourceTagsPath, sourceTags);

  const citationEntry = {
    source_id: sourceId,
    citation: typeof frontmatter.citation === 'string' ? frontmatter.citation : 'Alma Healing Center. Ayahuasca and medication interactions.',
    title: sourceTitle,
    source_type: sourceType,
    year: typeof frontmatter.year === 'number' ? frontmatter.year : undefined,
    url_or_path: typeof frontmatter.url_or_path === 'string' ? frontmatter.url_or_path : fileRef
  };
  const citationIndex = citationRegistry.citations.findIndex((entry) => entry.source_id === sourceId);
  if (citationIndex >= 0) {
    citationRegistry.citations[citationIndex] = citationEntry;
  } else {
    citationRegistry.citations.push(citationEntry);
  }
  await writeJson(citationRegistryPath, citationRegistry);

  await writeJson(reportPath, report);
  console.log(`Ingested ${claims.length} Alma claim(s) from ${rows.length} parsed row(s)`);
  console.log(`Report written to ${path.relative(kbRoot, reportPath)}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

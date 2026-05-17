import { canonicalPairKey, splitSentences, stableHash } from './kb-utils';

export interface PerplexityCitation {
  title?: string;
  url?: string;
  doi?: string;
  authors?: string;
  year?: number | string;
  citation_text?: string;
}

export interface PerplexityMechanismMatch {
  label: string;
  patterns: RegExp[];
}

export interface PerplexityClaimCandidate {
  claim_id: string;
  source_id: string;
  claim: string;
  claim_type: 'mechanism' | 'interaction' | 'risk' | 'contraindication' | 'guidance';
  entities: string[];
  mechanism: string[];
  evidence_strength: 'theoretical';
  confidence: 'low';
  supports_pairs: [string, string][];
  clinical_actionability: 'none' | 'monitor' | 'caution' | 'avoid';
  review_state: 'needs_verification';
  notes: string;
  provenance: {
    source_type: 'ai_synthesis';
    requires_verification: true;
    ingestion_method: 'perplexity_ingestion_v1';
    cited_sources: PerplexityCitation[];
  };
  source_specific?: {
    original_row?: string;
    normalized_medication_name?: string;
    original_medication_name?: string;
    aliases?: string[];
    severity_label?: string;
    other_information?: string;
    derivation?: string;
  };
}

const MEDICATION_CLASS_MAP: Array<{ label: string; classLabel: string }> = [
  { label: 'sertraline', classLabel: 'SSRIs' },
  { label: 'citalopram', classLabel: 'SSRIs' },
  { label: 'escitalopram', classLabel: 'SSRIs' },
  { label: 'fluoxetine', classLabel: 'SSRIs' },
  { label: 'fluvoxamine', classLabel: 'SSRIs' },
  { label: 'paroxetine', classLabel: 'SSRIs' },
  { label: 'duloxetine', classLabel: 'SNRIs' },
  { label: 'venlafaxine', classLabel: 'SNRIs' },
  { label: 'desvenlafaxine', classLabel: 'SNRIs' },
  { label: 'milnacipran', classLabel: 'SNRIs' },
  { label: 'amitriptyline', classLabel: 'TCAs' },
  { label: 'clomipramine', classLabel: 'TCAs' },
  { label: 'desipramine', classLabel: 'TCAs' },
  { label: 'doxepin', classLabel: 'TCAs' },
  { label: 'imipramine', classLabel: 'TCAs' },
  { label: 'nortriptyline', classLabel: 'TCAs' },
  { label: 'trimipramine', classLabel: 'TCAs' },
  { label: 'amphetamine', classLabel: 'stimulants' },
  { label: 'dextroamphetamine', classLabel: 'stimulants' },
  { label: 'methamphetamine', classLabel: 'stimulants' },
  { label: 'methylphenidate', classLabel: 'stimulants' },
  { label: 'cocaine', classLabel: 'stimulants' },
  { label: 'phentermine', classLabel: 'stimulants' },
  { label: 'codeine', classLabel: 'opioids' },
  { label: 'tramadol', classLabel: 'opioids' },
  { label: 'meperidine', classLabel: 'opioids' },
  { label: 'methadone', classLabel: 'opioids' },
  { label: 'oxycodone', classLabel: 'opioids' },
  { label: 'sumatriptan', classLabel: 'triptans' },
  { label: 'rizatriptan', classLabel: 'triptans' },
  { label: 'zolmitriptan', classLabel: 'triptans' },
  { label: 'naratriptan', classLabel: 'triptans' },
  { label: 'eletriptan', classLabel: 'triptans' },
  { label: 'frovatriptan', classLabel: 'triptans' },
  { label: 'almotriptan', classLabel: 'triptans' },
  { label: 'moclobemide', classLabel: 'MAOIs' },
  { label: 'phenelzine', classLabel: 'MAOIs' },
  { label: 'tranylcypromine', classLabel: 'MAOIs' },
  { label: 'isocarboxazid', classLabel: 'MAOIs' },
  { label: 'selegiline', classLabel: 'MAOIs' },
  { label: 'rasagiline', classLabel: 'MAOIs' },
  { label: 'linezolid', classLabel: 'MAOIs' },
  { label: 'diphenhydramine', classLabel: 'antihistamines' },
  { label: 'hydroxyzine', classLabel: 'antihistamines' },
  { label: 'chlorpheniramine', classLabel: 'antihistamines' },
  { label: 'cetirizine', classLabel: 'antihistamines' },
  { label: 'loratadine', classLabel: 'antihistamines' },
  { label: 'hydralazine', classLabel: 'antihypertensives' },
  { label: 'methyldopa', classLabel: 'antihypertensives' },
  { label: 'chlorthalidone', classLabel: 'antihypertensives' },
  { label: 'guanethidine', classLabel: 'antihypertensives' },
  { label: 'guanadrel', classLabel: 'antihypertensives' },
  { label: 'ketamine', classLabel: 'dissociatives' },
  { label: 'clonidine', classLabel: 'antihypertensives' },
  { label: 'guanfacine', classLabel: 'antihypertensives' },
  { label: 'beta_blockers', classLabel: 'antihypertensives' },
  { label: 'calcium_channel_blockers', classLabel: 'antihypertensives' }
];

const MECHANISM_MATCHES: PerplexityMechanismMatch[] = [
  { label: 'serotonergic_toxicity', patterns: [/serotonin syndrome/i, /serotonergic/i, /5-ht/i] },
  { label: 'maoi_potentiation', patterns: [/maoi/i, /mao[-\s]?a/i, /monoamine oxidase/i, /rima/i] },
  { label: 'hemodynamic_interaction', patterns: [/blood pressure/i, /heart rate/i, /hemodynamic/i] },
  { label: 'noradrenergic_suppression', patterns: [/alpha-2/i, /alpha 2/i, /sympathetic outflow/i] },
  { label: 'glutamate_modulation', patterns: [/nmda/i, /glutamate/i, /ketamine/i] },
  { label: 'ion_channel_modulation', patterns: [/sodium channel/i, /ion channel/i, /lamotrigine/i] },
  { label: 'pharmacodynamic_cns_depression', patterns: [/sedation/i, /respiratory depression/i, /cns depress/i] },
  { label: 'sympathomimetic_load', patterns: [/stimulant/i, /sympathomimetic/i, /cocaine/i, /amphetamine/i] },
  { label: 'cardiovascular_load', patterns: [/blood pressure/i, /hypertension/i, /tachycardia/i, /bradycardia/i] }
];

const KNOWN_CLASS_LABELS = new Set(MEDICATION_CLASS_MAP.map((entry) => entry.classLabel));

const compactObject = <T extends Record<string, unknown>>(value: T): T => {
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      output[key] = entry;
    }
  }
  return output as T;
};

export const normalizeMedicationLabel = (value: string): { normalized: string; aliases: string[] } => {
  const original = value.trim();
  const aliases: string[] = [];
  const bracketMatches = [...original.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim()).filter(Boolean);
  aliases.push(...bracketMatches);
  const normalized = original
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s*\/\s*rima\s*/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
    .toLowerCase();
  return { normalized: normalized || original.toLowerCase(), aliases: Array.from(new Set(aliases)) };
};

export const inferPerplexityClass = (entity: string): string | null => {
  const normalized = entity.toLowerCase().trim();
  const match = MEDICATION_CLASS_MAP.find((entry) => entry.label === normalized);
  return match?.classLabel ?? null;
};

export const extractPerplexityEntities = (text: string, sourceId: string, sourceTitle?: string): string[] => {
  const normalizedText = `${sourceId} ${sourceTitle ?? ''} ${text}`.toLowerCase();
  const entities = new Set<string>();
  if (/ayahuasca/.test(normalizedText)) {
    entities.add('ayahuasca');
  }
  for (const entry of MEDICATION_CLASS_MAP) {
    const pattern = new RegExp(`\\b${entry.label.replace(/_/g, '[ _-]')}\\b`, 'i');
    if (pattern.test(normalizedText)) {
      entities.add(entry.label);
      entities.add(entry.classLabel);
    }
  }
  if (/moclobemide/i.test(normalizedText)) {
    entities.add('moclobemide');
    entities.add('MAOIs');
  }
  if (/rima/i.test(normalizedText)) {
    entities.add('MAOIs');
  }
  if (/beta[-_\s]?block/i.test(normalizedText)) {
    entities.add('beta_blockers');
  }
  if (/calcium[-_\s]?channel[-_\s]?block/i.test(normalizedText)) {
    entities.add('calcium_channel_blockers');
  }
  return Array.from(entities).sort();
};

export const extractPerplexityMechanisms = (text: string): string[] =>
  Array.from(
    new Set(
      MECHANISM_MATCHES
        .filter((entry) => entry.patterns.some((pattern) => pattern.test(text)))
        .map((entry) => entry.label)
    )
  );

export const inferPerplexityClaimType = (text: string): PerplexityClaimCandidate['claim_type'] => {
  const normalized = text.toLowerCase();
  if (/contraindicat|do not|avoid/.test(normalized)) return 'contraindication';
  if (/mechanism|mediated by|because|due to/.test(normalized)) return 'mechanism';
  if (/monitor|blood pressure|heart rate|risk|sedation|hypotension|hypertension/.test(normalized)) return 'risk';
  if (/guidance|recommend|screen|caution/.test(normalized)) return 'guidance';
  return 'interaction';
};

export const inferPerplexityActionability = (text: string): PerplexityClaimCandidate['clinical_actionability'] => {
  const normalized = text.toLowerCase();
  if (/contraindicat|major|avoid/.test(normalized)) return 'avoid';
  if (/monitor/.test(normalized)) return 'monitor';
  if (/caution|minor|moderate/.test(normalized)) return 'caution';
  return 'none';
};

export const isPerplexitySourceId = (sourceId: string): boolean => sourceId.startsWith('perplexity_');

export const summarizePerplexityClaimText = (claim: PerplexityClaimCandidate): string => {
  const mechanismSummary = claim.mechanism.length > 0 ? ` mechanisms=${claim.mechanism.join(',')}` : '';
  const pairSummary = claim.supports_pairs.length > 0 ? ` pairs=${claim.supports_pairs.map((pair) => canonicalPairKey(pair[0], pair[1])).join(',')}` : '';
  return `${claim.claim}${mechanismSummary}${pairSummary}`;
};

export const buildPerplexityCitationKey = (citation: PerplexityCitation): string =>
  citation.doi?.trim()
    ? `doi:${citation.doi.trim().toLowerCase()}`
    : citation.url?.trim()
      ? `url:${citation.url.trim().toLowerCase()}`
      : `text:${normalizeWhitespace((citation.citation_text ?? citation.title ?? '').toLowerCase())}`;

export const normalizePerplexitySourceLabel = (value: string): string =>
  value
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s*\/\s*rima\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const knownPerplexityClassLabels = Array.from(KNOWN_CLASS_LABELS).sort();

export interface PerplexityExtractionRejected {
  text: string;
  reason: string;
  section: string;
}

export interface PerplexityExtractionResult {
  claims: PerplexityClaimCandidate[];
  rejected: PerplexityExtractionRejected[];
  citations: PerplexityCitation[];
}

type MarkdownSection = {
  heading: string;
  level: number;
  body: string;
  citations: PerplexityCitation[];
};

const EXCLUDED_SECTION_PATTERNS = [
  /metadata/i,
  /summary/i,
  /limitations/i,
  /notes/i,
  /extraction notes/i,
  /source notes/i,
  /how to use/i,
  /references?/i,
  /bibliography/i
];

const INCLUDED_SECTION_PATTERNS = [
  /key claims/i,
  /mechanisms described/i,
  /clinical\s*\/\s*practical guidance/i,
  /contraindications\s*\/\s*risks/i,
  /interaction relevance/i
];

const META_REJECT_PHRASES = [
  'not primary evidence',
  'not authoritative',
  'ai-generated',
  'tertiary synthesis',
  'this source',
  'this document',
  'limitations',
  'notes',
  'extraction notes',
  'suitable for',
  'not suitable for',
  'requires validation',
  'requires verification',
  'candidate interaction pairs',
  'guide for literature retrieval',
  'must not',
  'should be treated as',
  'claim quality',
  'source type',
  'confidence penalty'
];

const PHARM_ENTITY_PATTERNS = [
  /\bayahuasca\b/i,
  /\bdmt\b/i,
  /\bharmine\b/i,
  /\bharmaline\b/i,
  /\btetrahydroharmine\b/i,
  /\bmaoi\b/i,
  /\bmao[-\s]?a\b/i,
  /\brima\b/i,
  /\bssri(s)?\b/i,
  /\bsnri(s)?\b/i,
  /\btca(s)?\b/i,
  /\bantidepressant(s)?\b/i,
  /\bantipsychotic(s)?\b/i,
  /\bstimulant(s)?\b/i,
  /\bopioid(s)?\b/i,
  /\bketamine\b/i,
  /\blamotrigine\b/i,
  /\bclonidine\b/i,
  /\bguanfacine\b/i,
  /\bantihypertensive(s)?\b/i,
  /\btriptan(s)?\b/i,
  /\bserotonergic\b/i,
  /\bserotonin\b/i,
  /\bdopamine\b/i,
  /\bnorepinephrine\b/i,
  /\bblood pressure\b/i,
  /\bheart rate\b/i,
  /\bcyp\b/i,
  /\b5-ht2a\b/i,
  /\bnmda\b/i,
  /\bharmala\b/i,
  /\bbeta[-_\s]?blockers?\b/i,
  /\bcalcium[-_\s]?channel[-_\s]?blockers?\b/i
];

const PHARM_ACTION_PATTERNS = [
  /\binhibit\b/i,
  /\bincrease\b/i,
  /\bdecrease\b/i,
  /\battenuate\b/i,
  /\bpotentiate\b/i,
  /\bcause\b/i,
  /\brisk\b/i,
  /\bcontraindicat/i,
  /\bavoid\b/i,
  /\bmonitor\b/i,
  /\binteract\b/i,
  /\bmodulate\b/i,
  /\bmetabolized\b/i,
  /\binduce\b/i,
  /\bblock\b/i,
  /\bagonist\b/i,
  /\bantagonist\b/i,
  /\btoxicity\b/i,
  /\bsyndrome\b/i,
  /\bhypertensive\b/i,
  /\bhypotension\b/i,
  /\bsedation\b/i,
  /\bseizure\b/i
];

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();
const makeClaimId = (sourceId: string, section: string, text: string, index: number): string =>
  `${sourceId}_${String(index + 1).padStart(3, '0')}_${stableHash(`${section}|${text}`, 8)}`;

const textMatchesAny = (text: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

const isExcludedSection = (heading: string): boolean => textMatchesAny(heading, EXCLUDED_SECTION_PATTERNS);

const isIncludedSection = (heading: string): boolean => textMatchesAny(heading, INCLUDED_SECTION_PATTERNS);

const containsMetaNoise = (text: string): boolean => textMatchesAny(text, META_REJECT_PHRASES.map((phrase) => new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')));

const hasPharmacologicalSignal = (text: string): boolean =>
  textMatchesAny(text, PHARM_ENTITY_PATTERNS) && textMatchesAny(text, PHARM_ACTION_PATTERNS);

const isValidClaimText = (text: string, context = ''): boolean => {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return false;
  if (!hasPharmacologicalSignal(`${cleaned} ${context}`.trim())) return false;
  return true;
};

const parseMarkdownSections = (text: string): MarkdownSection[] => {
  const sections: MarkdownSection[] = [];
  let current: { heading: string; level: number; lines: string[] } = {
    heading: '__preamble__',
    level: 0,
    lines: []
  };

  const flush = (): void => {
    sections.push({
      heading: current.heading,
      level: current.level,
      body: current.lines.join('\n'),
      citations: []
    });
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (level <= 2) {
        flush();
        current = {
          heading: headingMatch[2].trim(),
          level,
          lines: [rawLine.trim()]
        };
      } else {
        current.lines.push(rawLine);
      }
      continue;
    }
    current.lines.push(rawLine);
  }

  flush();
  return sections.map((section) => ({
    ...section,
    citations: extractPerplexityCitations(section.body)
  }));
};

const parseKeyValueLine = (line: string): [string, string] | null => {
  const match = line.match(/^[-*]\s*([^:]+):\s*(.*)$/);
  if (!match) return null;
  return [match[1].trim().toLowerCase().replace(/\s+/g, '_'), match[2].trim()];
};

const parseListValue = (value: string): string[] => {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    return inner
      .split(',')
      .map((item) => item.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return trimmed
    .split(',')
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
};

const buildSupportsPairs = (entities: string[]): [string, string][] => {
  const pairs: [string, string][] = [];
  const normalized = Array.from(new Set(entities.map((entity) => entity.toLowerCase())));
  const hasAyahuasca = normalized.includes('ayahuasca');
  const pairable = normalized.filter((entity) => entity !== 'ayahuasca');
  if (hasAyahuasca) {
    for (const entity of pairable) {
      pairs.push(['ayahuasca', entity]);
    }
  }
  if (!hasAyahuasca) {
    for (let index = 0; index < normalized.length; index += 1) {
      for (let offset = index + 1; offset < normalized.length; offset += 1) {
        pairs.push([normalized[index], normalized[offset]]);
      }
    }
  }
  return Array.from(new Map(pairs.map((pair) => [canonicalPairKey(pair[0], pair[1]), pair] as const)).values());
};

const parseStructuredClaimBlocks = (
  section: MarkdownSection,
  sourceId: string,
  sourceTitle: string
): { claims: PerplexityClaimCandidate[]; rejected: PerplexityExtractionRejected[] } => {
  const claims: PerplexityClaimCandidate[] = [];
  const rejected: PerplexityExtractionRejected[] = [];
  const lines = section.body.split(/\r?\n/);
  let currentBlock: string[] = [];
  let currentHeading = '';

  const flushBlock = (): void => {
    if (currentHeading || currentBlock.length > 0) {
      const blockText = [currentHeading, ...currentBlock].join('\n').trim();
      const fieldMap = new Map<string, string>();
      let rawClaim = '';
      for (const line of currentBlock) {
        const parsed = parseKeyValueLine(line.trim());
        if (!parsed) continue;
        const [key, value] = parsed;
        fieldMap.set(key, value);
        if (key === 'claim') rawClaim = value;
      }

      if (!rawClaim) {
        rejected.push({ text: blockText, reason: 'missing structured claim text', section: section.heading });
      } else if (containsMetaNoise(rawClaim) && !hasPharmacologicalSignal(rawClaim)) {
        rejected.push({ text: rawClaim, reason: 'meta/source language without pharmacological claim', section: section.heading });
      } else if (!isValidClaimText(rawClaim, `${fieldMap.get('entities') ?? ''} ${fieldMap.get('mechanism') ?? ''} ${sourceTitle}`)) {
        rejected.push({ text: rawClaim, reason: 'lacks pharmacological claim signal', section: section.heading });
      } else {
        const inferredEntities = extractPerplexityEntities(rawClaim, sourceId, sourceTitle);
        const explicitEntities = fieldMap.has('entities') ? parseListValue(fieldMap.get('entities') ?? '') : [];
        const entities = Array.from(new Set([...explicitEntities, ...inferredEntities]));
        const mechanisms = Array.from(
          new Set([
            ...(fieldMap.has('mechanism') ? parseListValue(fieldMap.get('mechanism') ?? '') : []),
            ...extractPerplexityMechanisms(rawClaim)
          ])
        );
        const citations = extractPerplexityCitations(blockText);
        const claimType = (fieldMap.get('type') ?? inferPerplexityClaimType(rawClaim)) as PerplexityClaimCandidate['claim_type'];
        claims.push({
          claim_id: makeClaimId(sourceId, section.heading, rawClaim, claims.length),
          source_id: sourceId,
          claim: normalizeWhitespace(rawClaim),
          claim_type: claimType,
          entities: entities.length > 0 ? entities : ['ayahuasca'],
          mechanism: mechanisms.length > 0 ? mechanisms : ['provisional_secondary'],
          evidence_strength: 'theoretical',
          confidence: 'low',
          supports_pairs: buildSupportsPairs(entities.length > 0 ? entities : ['ayahuasca']),
          clinical_actionability: inferPerplexityActionability(rawClaim),
          review_state: 'needs_verification',
          notes: 'Provisional claim extracted from AI synthesis; requires corroboration before promotion.',
          provenance: {
            source_type: 'ai_synthesis',
            requires_verification: true,
            ingestion_method: 'perplexity_ingestion_v1',
            cited_sources: citations
          },
          source_specific: compactObject({
            original_row: blockText,
            normalized_medication_name: fieldMap.get('entities') ? parseListValue(fieldMap.get('entities') ?? '').join(', ') : undefined,
            original_medication_name: fieldMap.get('entities') ? parseListValue(fieldMap.get('entities') ?? '').join(', ') : undefined,
            severity_label: fieldMap.get('evidence_strength'),
            other_information: fieldMap.get('directionality'),
            derivation: 'structured_key_claim'
          })
        });
      }
    }
    currentBlock = [];
    currentHeading = '';
  };

  for (const rawLine of lines) {
    const claimHeading = rawLine.match(/^###\s*Claim\b/i);
    if (claimHeading) {
      flushBlock();
      currentHeading = rawLine.trim();
      continue;
    }
    if (currentHeading) {
      currentBlock.push(rawLine.trim());
    }
  }
  flushBlock();
  return { claims, rejected };
};

const extractClaimCandidatesFromSection = (
  section: MarkdownSection,
  sourceId: string,
  sourceTitle: string,
  sourceSpecific?: Record<string, unknown>
): { claims: PerplexityClaimCandidate[]; rejected: PerplexityExtractionRejected[] } => {
  const lines = section.body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const claims: PerplexityClaimCandidate[] = [];
  const rejected: PerplexityExtractionRejected[] = [];

  for (const rawLine of lines) {
    if (/^#{1,6}\s+/.test(rawLine)) continue;
    if (/^[-*•]\s+/.test(rawLine) || /[.?!]/.test(rawLine)) {
      let candidate = rawLine.replace(/^[-*•]\s+/, '').trim();
      const claimMatch = candidate.match(/^claim:\s*(.+)$/i);
      if (claimMatch) candidate = claimMatch[1].trim();
      if (containsMetaNoise(candidate) && !hasPharmacologicalSignal(candidate)) {
        rejected.push({ text: candidate, reason: 'meta/source language without pharmacological claim', section: section.heading });
        continue;
      }
      if (!isValidClaimText(candidate, `${section.heading} ${sourceTitle}`)) {
        rejected.push({ text: candidate, reason: 'lacks pharmacological claim signal', section: section.heading });
        continue;
      }
      const entities = extractPerplexityEntities(candidate, sourceId, sourceTitle);
      const mechanisms = extractPerplexityMechanisms(candidate);
      claims.push({
        claim_id: makeClaimId(sourceId, section.heading, candidate, claims.length),
        source_id: sourceId,
        claim: normalizeWhitespace(candidate),
        claim_type: inferPerplexityClaimType(candidate),
        entities: entities.length > 0 ? entities : ['ayahuasca'],
        mechanism: mechanisms.length > 0 ? mechanisms : ['provisional_secondary'],
        evidence_strength: 'theoretical',
        confidence: 'low',
        supports_pairs: buildSupportsPairs(entities.length > 0 ? entities : ['ayahuasca']),
        clinical_actionability: inferPerplexityActionability(candidate),
        review_state: 'needs_verification',
        notes: 'Provisional claim extracted from AI synthesis; requires corroboration before promotion.',
        provenance: {
          source_type: 'ai_synthesis',
          requires_verification: true,
          ingestion_method: 'perplexity_ingestion_v1',
          cited_sources: section.citations
        },
        source_specific: compactObject({
          original_row: candidate,
          derivation: 'section_sentence_extraction',
          ...sourceSpecific
        })
      });
    }
  }

  return { claims, rejected };
};

export const extractPerplexityCitations = (text: string): PerplexityCitation[] => {
  const citations = new Map<string, PerplexityCitation>();
  const lines = text.split(/\r?\n/);

  const addCitation = (citation: PerplexityCitation): void => {
    const key = buildPerplexityCitationKey(citation);
    if (!citations.has(key)) {
      citations.set(key, citation);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isStructuredFieldLine = /^[-*•]\s*[A-Za-z][A-Za-z0-9 _/-]+:\s*/.test(trimmed);
    const citationLine = trimmed.replace(/^[-*•]\s*[A-Za-z][A-Za-z0-9 _/-]+:\s*/, '').trim();

    for (const match of trimmed.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
      addCitation({
        title: match[1].trim(),
        url: match[2].trim(),
        citation_text: match[0]
      });
    }

    for (const match of trimmed.matchAll(/https?:\/\/[^\s)]+/g)) {
      const url = match[0].replace(/[.,;]+$/g, '');
      addCitation({
        url,
        citation_text: trimmed
      });
    }

    for (const match of trimmed.matchAll(/https?:\/\/doi\.org\/(10\.\d{4,9}\/[^\s)]+)/gi)) {
      const doi = match[1];
      addCitation({
        doi,
        url: `https://doi.org/${doi}`,
        citation_text: trimmed
      });
    }

    for (const match of trimmed.matchAll(/\bdoi:\s*(10\.\d{4,9}\/[^\s)\]]+)/gi)) {
      const doi = match[1];
      addCitation({
        doi,
        citation_text: trimmed
      });
    }

    for (const match of trimmed.matchAll(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi)) {
      const doi = match[1].replace(/[.,;]+$/g, '');
      addCitation({
        doi,
        citation_text: trimmed
      });
    }

    if (
      !isStructuredFieldLine &&
      /\b(et al\.?|and colleagues)\b/i.test(trimmed) &&
      /\b(19|20)\d{2}\b/.test(trimmed) &&
      !containsMetaNoise(trimmed)
    ) {
      const urlMatch = citationLine.match(/https?:\/\/[^\s)]+/i);
      const doiMatch = citationLine.match(/\b(?:doi:\s*)?(10\.\d{4,9}\/[^\s)\]]+)/i);
      const cleanedTitle = citationLine
        .replace(/https?:\/\/[^\s)]+/gi, '')
        .replace(/\bdoi:\s*10\.\d{4,9}\/[^\s)\]]+/gi, '')
        .replace(/\b10\.\d{4,9}\/[^\s)\]]+/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      addCitation({
        ...(cleanedTitle ? { title: cleanedTitle } : {}),
        ...(urlMatch ? { url: urlMatch[0].replace(/[.,;]+$/g, '') } : {}),
        ...(doiMatch ? { doi: doiMatch[1].replace(/[.,;]+$/g, '') } : {}),
        citation_text: citationLine
      });
    }
  }

  return Array.from(citations.values());
};

export const extractPerplexityClaimsDetailed = (
  sourceId: string,
  sourceTitle: string,
  body: string,
  sourceSpecific?: Record<string, unknown>
): PerplexityExtractionResult => {
  const sections = parseMarkdownSections(body);
  const allCitations = sections.flatMap((section) => section.citations);
  const keyClaimsSection = sections.find((section) => /key claims/i.test(section.heading));
  const rejected: PerplexityExtractionRejected[] = [];

  if (keyClaimsSection) {
    const structured = parseStructuredClaimBlocks(keyClaimsSection, sourceId, sourceTitle);
    rejected.push(...structured.rejected);
    if (structured.claims.length > 0) {
      return { claims: structured.claims, rejected, citations: allCitations };
    }
  }

  const candidateSections = sections.filter((section) => isIncludedSection(section.heading) && !isExcludedSection(section.heading));
  const claims: PerplexityClaimCandidate[] = [];
  for (const section of candidateSections) {
    const extracted = extractClaimCandidatesFromSection(section, sourceId, sourceTitle, sourceSpecific);
    claims.push(...extracted.claims);
    rejected.push(...extracted.rejected);
  }

  return { claims, rejected, citations: allCitations };
};

export const extractPerplexityClaims = (
  sourceId: string,
  sourceTitle: string,
  body: string,
  citedSources: PerplexityCitation[],
  sourceSpecific?: Record<string, unknown>
): PerplexityClaimCandidate[] => {
  const result = extractPerplexityClaimsDetailed(sourceId, sourceTitle, body, sourceSpecific);
  if (citedSources.length > 0) {
    return result.claims.map((claim) => ({
      ...claim,
      provenance: {
        ...claim.provenance,
        cited_sources: claim.provenance.cited_sources.length > 0 ? claim.provenance.cited_sources : citedSources
      }
    }));
  }
  return result.claims;
};

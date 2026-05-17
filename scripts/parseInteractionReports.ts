import { appendFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type {
  ConfidenceLevel,
  EvidenceSupportType,
  EvidenceTierV2,
  InteractionCodeV2,
  InteractionDatasetV2,
  MechanismCategoryV2
} from '../src/data/interactionSchemaV2';
import { getCanonicalDatasetSourcePaths } from './datasetPaths';
import type { WorkflowState } from './workflow/stateMachine';

type ProposalStatus = 'proposed';
type ParseConfidence = Exclude<ConfidenceLevel, 'none' | 'not_applicable'>;
type ProposalCreator = 'manual_nl_report';

interface ProposalSourceRef {
  source_id: string;
  claim_support: EvidenceSupportType;
  support_type?: EvidenceSupportType;
  locator?: string;
  quote?: string;
}

interface ReportSection {
  heading: string;
  body: string;
  raw: string;
}

interface InteractionUpdateProposal {
  update_id: string;
  created_at: string;
  created_by: ProposalCreator;
  pair: [string, string];
  claim: string;
  source_refs: ProposalSourceRef[];
  requested_change: {
    'classification.code': InteractionCodeV2;
    'classification.confidence': ParseConfidence;
    'clinical_summary.headline': string;
    'mechanism.categories': MechanismCategoryV2[];
    'mechanism.primary_category': MechanismCategoryV2;
    'evidence.tier': EvidenceTierV2;
    'evidence.support_type': EvidenceSupportType[];
    'evidence.evidence_gaps': string;
    'clinical_summary.mechanism'?: string;
    'clinical_summary.field_notes'?: string;
    'clinical_summary.timing_guidance'?: string;
  };
  reviewer_notes?: string;
  rationale: string;
  status: ProposalStatus;
  workflow: {
    state: WorkflowState;
    transition_history: [];
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const incomingDir = path.join(root, 'src/curation/nl-reports/incoming');
const parsedDir = path.join(root, 'src/curation/nl-reports/parsed');
const failedDir = path.join(root, 'src/curation/nl-reports/failed');
const outputJsonl = path.join(root, 'src/curation/interaction-updates.jsonl');
const datasetPath = getCanonicalDatasetSourcePaths(root).interactionDatasetV2;

let substanceIdSet = new Set<string>();
let substanceAliasMap = new Map<string, string>();

const headingFamilies = {
  pair: ['dataset-ready interaction entry', 'pairing'],
  classification: ['danger', 'classification', 'evidence-based interaction readout'],
  confidence: ['confidence', 'evidence confidence'],
  mechanism: ['core interpretation', 'serotonin-related risk', 'additive cns and respiratory depression', 'opioid-system overlap', 'mechanism'],
  guidance: ['action posture', 'avoid high-risk patterns', 'if used in a clinical setting', 'if recently combined'],
  gaps: ['evidence confidence', 'evidence gaps', 'limitations']
} as const;

const phraseAliasMap: Record<string, string> = {
  'serotonergic opioids': 'serotonergic_opioids',
  '5-meo-dmt': 'five_meo_dmt',
  '5 meo dmt': 'five_meo_dmt',
  'n,n-dmt': 'nn_dmt',
  'nn dmt': 'nn_dmt',
  'n n dmt': 'nn_dmt',
  'tobacco rape': 'tobacco_rape',
  'rapé': 'tobacco_rape',
  'rape': 'tobacco_rape'
};

const cleanToken = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/["'`]/g, '')
    .replace(/[^a-z0-9\s_\-/,]+/g, ' ')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const sentences = (text: string): string[] => (text.match(/[^.!?\n]+[.!?]?/g) ?? []).map((s) => s.trim()).filter(Boolean);

const containsAny = (text: string, patterns: string[]): boolean => patterns.some((p) => new RegExp(p, 'i').test(text));

const isHeadingLine = (line: string): boolean => {
  const t = line.trim();
  if (!t) return false;
  if (/^#{1,6}\s+/.test(t)) return true;
  if (/^[A-Z][A-Za-z0-9\s\-\/()]{2,}:\s*$/.test(t)) return true;
  if (/^[-*]\s*[A-Z][A-Za-z0-9\s\-\/()]{2,}:\s*$/.test(t)) return true;
  return Object.values(headingFamilies).flat().some((h) => new RegExp(`^[-*#\\s]*${h}[:\\s]*$`, 'i').test(t));
};

export function splitReportIntoSections(text: string): ReportSection[] {
  const lines = text.split(/\r?\n/);
  const sections: ReportSection[] = [];
  let heading = 'report';
  let buffer: string[] = [];

  const flush = (): void => {
    const body = buffer.join('\n').trim();
    if (!body) return;
    sections.push({ heading, body, raw: body });
  };

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush();
      heading = line.replace(/^[-*#\s]*/, '').replace(/:\s*$/, '').trim().toLowerCase();
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

export function getSection(sections: ReportSection[], headingNames: string[]): ReportSection | null {
  for (const section of sections) {
    if (headingNames.some((h) => section.heading.includes(h.toLowerCase()))) return section;
  }
  return null;
}

export function getBulletValue(sectionText: string, labels: string[]): string | null {
  const lines = sectionText.split(/\r?\n/);
  for (const line of lines) {
    for (const label of labels) {
      const match = line.match(new RegExp(`^\\s*[-*]?\\s*${label}\\s*:\\s*(.+)$`, 'i'));
      if (match?.[1]) return match[1].trim();
    }
  }
  return null;
}

export function getFirstUsefulParagraph(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^#{1,6}\s/.test(p));
  return paragraphs[0] ?? '';
}

export function extractSentencesMatching(text: string, patterns: RegExp[], maxChars: number): string {
  const matched = sentences(text).filter((s) => patterns.some((p) => p.test(s)));
  return matched.join(' ').replace(/\s+/g, ' ').slice(0, maxChars).trim();
}

export function normalizeText(input: string): string {
  return input
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, ' x ')
    .replace(/\+/g, ' x ')
    .replace(/\bcombined with\b/gi, ' with ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const resolveAlias = (raw: string): string => {
  const lower = raw.toLowerCase().trim();
  if (phraseAliasMap[lower]) return phraseAliasMap[lower];
  const canonical = cleanToken(lower);
  return phraseAliasMap[canonical] ?? canonical;
};

const resolveSubstanceId = (raw: string): string | null => {
  const alias = resolveAlias(raw);
  return substanceAliasMap.get(alias) ?? substanceAliasMap.get(cleanToken(alias)) ?? null;
};

const pairFromCandidate = (aRaw: string, bRaw: string): [string, string] | null => {
  const a = resolveSubstanceId(aRaw);
  const b = resolveSubstanceId(bRaw);
  if (!a || !b) return null;
  return [a, b].sort() as [string, string];
};

export function extractPair(text: string): [string, string] | null {
  const sections = splitReportIntoSections(text);
  const datasetSection = getSection(sections, [...headingFamilies.pair]);
  const pairing = datasetSection ? getBulletValue(datasetSection.body, ['pairing', 'pair']) : null;
  if (pairing) {
    const m = pairing.match(/^(.+?)\s*(?:x|with|\+)\s*(.+)$/i);
    if (m) {
      const p = pairFromCandidate(m[1], m[2]);
      if (p) return p;
    }
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = lines.find((l) => /^#{0,6}\s*[^#]+/.test(l));
  if (title) {
    const stripped = title.replace(/^#{1,6}\s*/, '');
    const m = stripped.match(/^(.+?)\s*(?:x|with|\+)\s*(.+)$/i);
    if (m) {
      const p = pairFromCandidate(m[1], m[2]);
      if (p) return p;
    }
  }

  for (const pattern of [
    /([a-z0-9_\- ,]+)\s+combined with\s+([a-z0-9_\- ,]+)/i,
    /([a-z0-9_\- ,]+)\s+with\s+([a-z0-9_\- ,]+)/i,
    /([a-z0-9_\- ,]+)\s+plus\s+([a-z0-9_\- ,]+)/i,
    /([a-z0-9_\- ,]+)\s+and\s+([a-z0-9_\- ,]+)/i
  ]) {
    const m = text.match(pattern);
    if (!m) continue;
    const p = pairFromCandidate(m[1], m[2]);
    if (p) return p;
  }

  return null;
}

const classificationKeywords = {
  DANGEROUS: ['contraindicated', 'dangerous', '\\bred\\b', 'avoid completely', 'strongly avoid', 'do not combine', 'highly unsafe', 'medical emergency likely'],
  UNSAFE: ['\\bunsafe\\b', 'high risk', 'higher-risk', 'significant risk', 'not recommended', 'avoid unsupervised'],
  CAUTION: ['amber', 'caution', 'moderate risk', 'use caution', 'monitor', 'not clearly contraindicated', 'risk depends', 'polypharmacy-driven', 'context-dependent'],
  LOW_MOD: ['effect modulation', 'blunted', 'intensified', 'altered effects', 'interaction but low acute toxicity'],
  LOW: ['low risk', 'minimal risk', 'unlikely interaction', 'little evidence of harm'],
  UNKNOWN: ['unknown', 'insufficient data', 'no data', 'unclear', 'not enough evidence']
} as const;

const fromClassValue = (value: string): InteractionCodeV2 | null => {
  const v = value.toLowerCase();
  if (/amber/.test(v)) return 'CAUTION';
  if (/red|dangerous|contraindicated/.test(v)) return 'DANGEROUS';
  if (/green/.test(v)) return 'LOW';
  if (/grey|gray|unknown/.test(v)) return 'UNKNOWN';
  if (/caution/.test(v)) return 'CAUTION';
  return null;
};

const hasClassificationSignal = (text: string): boolean =>
  Object.values(classificationKeywords).flat().some((k) => new RegExp(k, 'i').test(text));

export function extractClassification(text: string): InteractionCodeV2 {
  const sections = splitReportIntoSections(text);
  const datasetSection = getSection(sections, [...headingFamilies.pair]);
  const explicit = datasetSection ? getBulletValue(datasetSection.body, ['danger', 'classification']) : null;
  const explicitCode = explicit ? fromClassValue(explicit) : null;
  if (explicitCode) return explicitCode;

  const sentence = sentences(text).find((s) => /best rated as|best classified as/i.test(s));
  const sentenceCode = sentence ? fromClassValue(sentence) : null;
  if (sentenceCode) return sentenceCode;

  const classSection = getSection(sections, [...headingFamilies.classification]);
  if (classSection) {
    const sectionCode = fromClassValue(classSection.body);
    if (sectionCode) return sectionCode;
  }

  if (/not clearly contraindicated|amber|caution/i.test(text) && !explicitCode) return 'CAUTION';

  if (containsAny(text, [...classificationKeywords.DANGEROUS]) && containsAny(text, [...classificationKeywords.CAUTION])) {
    return 'CAUTION';
  }
  if (containsAny(text, [...classificationKeywords.DANGEROUS])) return 'DANGEROUS';
  if (containsAny(text, [...classificationKeywords.UNSAFE])) return 'UNSAFE';
  if (containsAny(text, [...classificationKeywords.CAUTION])) return 'CAUTION';
  if (containsAny(text, [...classificationKeywords.LOW_MOD])) return 'LOW_MOD';
  if (containsAny(text, [...classificationKeywords.LOW])) return 'LOW';
  if (containsAny(text, [...classificationKeywords.UNKNOWN])) return 'UNKNOWN';
  return 'UNKNOWN';
}

export function extractConfidence(text: string): ParseConfidence {
  const sections = splitReportIntoSections(text);
  const datasetSection = getSection(sections, [...headingFamilies.pair]);
  const explicit = datasetSection ? getBulletValue(datasetSection.body, ['confidence']) : null;
  if (explicit) {
    if (/high/i.test(explicit)) return 'high';
    if (/medium/i.test(explicit)) return 'medium';
    if (/low/i.test(explicit)) return 'low';
  }

  const overall = text.match(/overall\s*:\s*(high|medium|low)/i)?.[1];
  if (overall) return overall.toLowerCase() as ParseConfidence;

  const evidenceConf = getSection(sections, [...headingFamilies.confidence]);
  if (evidenceConf) {
    if (/high confidence|confidence\s*:\s*high/i.test(evidenceConf.body)) return 'high';
    if (/medium confidence|confidence\s*:\s*medium/i.test(evidenceConf.body)) return 'medium';
    if (/low confidence|confidence\s*:\s*low/i.test(evidenceConf.body)) return 'low';
  }

  if (/no direct data|very limited|extrapolated|source_gap|conflicting|speculative/i.test(text)) return 'low';
  if (/strong mechanistic reasoning|some clinical|practice evidence|robust for related mechanisms/i.test(text)) return 'medium';
  return 'low';
}

export function extractHeadline(text: string): string {
  const beforeDataset = text.split(/dataset-ready interaction entry/i)[0] ?? text;
  const preferred = sentences(beforeDataset).find((s) => /best rated as|best classified as|driven mainly by|rather than/i.test(s));
  const fallback = getFirstUsefulParagraph(beforeDataset) || getFirstUsefulParagraph(text);
  const chosen = preferred ?? fallback;
  return chosen
    .replace(/\b(tramadol|methadone|meperidine|pethidine|tapentadol|dextromethorphan|fentanyl)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

export function extractMechanismText(text: string): string | null {
  const sections = splitReportIntoSections(text);
  const parts = [
    getSection(sections, ['core interpretation'])?.body,
    getSection(sections, ['serotonin-related risk'])?.body,
    getSection(sections, ['additive cns and respiratory depression'])?.body,
    getSection(sections, ['opioid-system overlap'])?.body,
    getSection(sections, ['mechanism'])?.body
  ].filter(Boolean) as string[];

  const merged = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (merged.length >= 500) return merged.slice(0, 1200);

  const fallback = extractSentencesMatching(text, [/nmda/i, /seroton/i, /cns/i, /respiratory/i, /poly-serotonergic/i, /clinical co-use/i], 1200);
  return fallback || (merged ? merged.slice(0, 1200) : null);
}

export function extractClaimSummary(text: string, fallbackHeadline: string): string {
  const beforeDataset = text.split(/dataset-ready interaction entry/i)[0] ?? text;
  const preferred = sentences(beforeDataset).find((s) => /best rated as|best classified as|driven mainly by|risk/i.test(s));
  const fallback = sentences(beforeDataset)[0] ?? fallbackHeadline;
  const chosen = preferred ?? fallback;
  return chosen.replace(/\s+/g, ' ').trim().slice(0, 280);
}

const categoryRules: Array<{ category: MechanismCategoryV2; patterns: RegExp[] }> = [
  { category: 'serotonergic_toxicity', patterns: [/serotonin syndrome/i, /serotonergic toxicity/i, /serotonergic/i, /\bssri\b/i, /\bsnri\b/i, /\bmaoi\b/i, /\btca\b/i, /\bmdma\b/i, /linezolid/i, /tramadol/i, /meperidine/i, /pethidine/i, /tapentadol/i, /dextromethorphan/i, /fentanyl/i, /methadone/i] },
  { category: 'maoi_potentiation', patterns: [/\bmaoi\b/i, /mao-a/i, /harmala/i, /harmine/i, /harmaline/i, /ayahuasca/i, /reversible mao inhibition/i] },
  { category: 'psychedelic_intensification', patterns: [/intensify/i, /potentiation/i, /stronger psychedelic effects/i, /prolonged psychedelic effects/i, /stacked intensity/i] },
  { category: 'sympathomimetic_load', patterns: [/stimulant/i, /amphetamine/i, /methylphenidate/i, /cocaine/i, /catecholamine/i, /adrenergic/i, /hypertension/i, /hypertensive/i] },
  { category: 'cardiovascular_load', patterns: [/blood pressure/i, /heart rate/i, /tachycardia/i, /hypertension/i, /hypotension/i, /arrhythmia/i, /hemodynamic/i, /cardiovascular/i] },
  { category: 'qt_or_arrhythmia_risk', patterns: [/\bqt\b/i, /qtc/i, /torsades/i, /arrhythmia/i, /cardiac conduction/i] },
  { category: 'cns_depression', patterns: [/cns depression/i, /sedation/i, /impaired consciousness/i, /oversedation/i, /unconscious/i, /sedative/i, /coma/i] },
  { category: 'respiratory_depression', patterns: [/respiratory depression/i, /respiratory drive/i, /airway compromise/i, /oxygen saturation/i, /hypoxia/i, /overdose/i, /opioid/i] },
  { category: 'seizure_threshold', patterns: [/seizure/i, /convulsion/i, /seizure threshold/i, /lithium/i, /bupropion/i] },
  { category: 'anticholinergic_delirium', patterns: [/anticholinergic/i, /atropine/i, /scopolamine/i, /hyoscyamine/i, /delirium/i, /belladonna/i, /brugmansia/i] },
  { category: 'dopaminergic_load', patterns: [/dopamine/i, /dopaminergic/i, /psychostimulant/i, /mania/i] },
  { category: 'glutamatergic_dissociation', patterns: [/ketamine/i, /nmda/i, /dissociation/i, /dissociative/i, /glutamate/i, /glutamatergic/i] },
  { category: 'gabaergic_modulation', patterns: [/benzodiazepine/i, /\bgaba\b/i, /alcohol/i, /barbiturate/i, /z-drug/i] },
  { category: 'dehydration_or_electrolyte_risk', patterns: [/dehydration/i, /electrolyte/i, /vomiting/i, /diarrhea/i, /purging/i, /hyponatremia/i, /fluid loss/i] },
  { category: 'psychiatric_destabilization', patterns: [/panic/i, /psychosis/i, /mania/i, /destabilization/i, /agitation/i, /confusion/i, /derealization/i] },
  { category: 'operational_or_behavioral_risk', patterns: [/unsupervised/i, /recreational/i, /accident/i, /fall/i, /aspiration/i, /impaired mobility/i, /behavioral disorganization/i, /polypharmacy/i, /polysubstance/i, /monitored setting/i, /clinical setting/i] }
];

export function inferMechanismCategories(text: string): MechanismCategoryV2[] {
  const found = new Set<MechanismCategoryV2>();
  for (const rule of categoryRules) {
    if (rule.patterns.some((p) => p.test(text))) found.add(rule.category);
  }
  if (!found.size) return ['unknown'];

  const ketamineOpioid = /ketamine/i.test(text) && /serotonergic opioids|serotonergic_opioids/i.test(text);
  if (ketamineOpioid) {
    const ordered: MechanismCategoryV2[] = ['cns_depression', 'respiratory_depression', 'serotonergic_toxicity', 'glutamatergic_dissociation', 'operational_or_behavioral_risk'];
    return ordered.filter((c) => found.has(c));
  }

  const defaultOrder: MechanismCategoryV2[] = [
    'cns_depression', 'respiratory_depression', 'cardiovascular_load', 'serotonergic_toxicity', 'maoi_potentiation',
    'glutamatergic_dissociation', 'operational_or_behavioral_risk', 'psychiatric_destabilization', 'sympathomimetic_load',
    'qt_or_arrhythmia_risk', 'psychedelic_intensification', 'seizure_threshold', 'anticholinergic_delirium',
    'dopaminergic_load', 'gabaergic_modulation', 'dehydration_or_electrolyte_risk'
  ];
  return defaultOrder.filter((c) => found.has(c));
}

export function inferEvidenceTier(text: string): EvidenceTierV2 {
  if (/self-pair|same entity/i.test(text)) return 'not_applicable';
  if (/no sources|source missing|unsupported|source_gap/i.test(text)) return 'source_gap';

  const direct = /direct human data|controlled trial|clinical trial|pharmacokinetic study|human pk|human study directly on this combination/i.test(text);
  const directLimited = /direct clinical data specifically|very limited direct|no direct data for exact pair|not specifically documenting/i.test(text);
  if (direct && !directLimited) return 'direct_human_data';
  if (/prescribing guidance|clinical guidance|guideline|label warning|perioperative guidance/i.test(text)) return 'clinical_guideline';
  if (/case report|case series|pharmacovigilance case/i.test(text)) return 'case_report_or_series';
  if (/observational|pharmacovigilance|real-world data|clinical co-use|routine co-use|perioperative|postoperative/i.test(text)) return 'observational_report';
  if (/field consensus|facilitator consensus|retreat guidance|harm-reduction consensus/i.test(text)) return 'field_consensus';
  if (/traditional use|ethnographic|ceremonial use/i.test(text)) return 'traditional_use_precedent';
  if (/mechanistic|extrapolated|indirect|preclinical|animal|receptor|pharmacodynamic|no direct data/i.test(text)) return 'mechanistic_inference';
  return 'mechanistic_inference';
}

export function inferEvidenceSupportTypes(text: string): EvidenceSupportType[] {
  const types = new Set<EvidenceSupportType>();
  if (/direct evidence|exact combination|human study directly on this pair/i.test(text)) types.add('direct');
  if (/indirect|related literature|extrapolated from/i.test(text)) types.add('indirect');
  if (/mechanism|receptor|pharmacodynamic|pharmacokinetic|nmda|opioid receptor|serotonin syndrome mechanism/i.test(text)) types.add('mechanistic');
  if (/real-world|clinical practice|routine co-use|postoperative|perioperative|harm-reduction practice/i.test(text)) types.add('field_observation');
  if (/traditional|ceremonial|ethnographic/i.test(text)) types.add('traditional_context');
  if (/no evidence|source gap|unsupported/i.test(text)) types.add('none');
  if (!types.size) types.add('mechanistic');
  return Array.from(types);
}

export function extractEvidenceGaps(text: string): string | null {
  const sections = splitReportIntoSections(text);
  const sec = getSection(sections, [...headingFamilies.gaps]);
  const fromSection = sec
    ? extractSentencesMatching(sec.body, [/direct clinical data specifically/i, /very limited/i, /extrapolated/i, /not specifically documenting/i, /no strong signal/i, /limited data/i], 500)
    : '';
  if (fromSection) return fromSection;

  const fromText = extractSentencesMatching(text, [/direct clinical data specifically/i, /very limited/i, /extrapolated/i, /not specifically documenting/i, /no strong signal/i, /limited data/i], 500);
  return fromText || null;
}

export function extractActionGuidance(text: string): string | null {
  const sections = splitReportIntoSections(text);
  const chunks = [
    getSection(sections, ['action posture'])?.body,
    getSection(sections, ['avoid high-risk patterns'])?.body,
    getSection(sections, ['if used in a clinical setting'])?.body,
    getSection(sections, ['if recently combined'])?.body
  ].filter(Boolean) as string[];

  const merged = chunks.join(' ').replace(/\s+/g, ' ').trim();
  if (merged.length >= 500) return merged.slice(0, 1200);

  const fallback = extractSentencesMatching(text, [/avoid unsupervised/i, /avoid.*depressants/i, /poly-serotonergic/i, /monitor/i, /oxygen saturation/i, /urgent care/i], 1200);
  return fallback || (merged || null);
}

export function extractTimingGuidance(text: string): string | null {
  if (!/washout|\bhours?\b|\bdays?\b|recently combined|before|after|during and after/i.test(text)) return null;
  const timing = extractSentencesMatching(text, [/washout/i, /\bhours?\b/i, /\bdays?\b/i, /recently combined/i, /before/i, /after/i, /during and after/i], 900);
  return timing || null;
}

export function extractSourceRefs(text: string): ProposalSourceRef[] {
  const refs: ProposalSourceRef[] = [];
  const bracketed = [...text.matchAll(/\[(?:source|source_id)\s*:\s*([a-z0-9_\-]+)\]/gi)].map((m) => cleanToken(m[1]));
  const labeled = text
    .split(/\r?\n/)
    .filter((line) => /^sources?\s*:/i.test(line))
    .flatMap((line) => line.replace(/^sources?\s*:/i, '').split(/[;,]/))
    .map((token) => cleanToken(token))
    .filter(Boolean);

  for (const sourceId of [...bracketed, ...labeled]) {
    refs.push({ source_id: sourceId, claim_support: 'indirect', support_type: 'indirect' });
  }

  if (!refs.length) return [{ source_id: 'source_gap', claim_support: 'mechanistic', support_type: 'mechanistic' }];

  const unique = new Map<string, ProposalSourceRef>();
  for (const ref of refs) unique.set(ref.source_id, ref);
  return Array.from(unique.values());
}

const shortHash = (value: string): string => createHash('sha1').update(value).digest('hex').slice(0, 6);

const dedupeNonEmpty = (values: string[]): string[] => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const formatReviewerNotes = (sections: {
  extracted: string[];
  inferred: string[];
  uncertainty: string[];
  draftOnly: string[];
}): string => {
  const extracted = dedupeNonEmpty(sections.extracted);
  const inferred = dedupeNonEmpty(sections.inferred);
  const uncertainty = dedupeNonEmpty(sections.uncertainty);
  const draftOnly = dedupeNonEmpty(sections.draftOnly);

  const extractedText = extracted.length ? extracted.join(' ') : 'No explicit extracted facts were captured from the source text.';
  const inferredText = inferred.length ? inferred.join(' ') : 'No inferred suggestions were generated.';
  const uncertaintyText = uncertainty.length ? uncertainty.join(' ') : 'No additional uncertainty note was captured.';
  const draftOnlyText = draftOnly.length
    ? draftOnly.join(' ')
    : 'Draft-only output; requires human review before any downstream use.';

  return `Extracted: ${extractedText} Inferred: ${inferredText} Uncertainty: ${uncertaintyText} Draft-only: ${draftOnlyText}`;
};

export async function initParserContext(): Promise<void> {
  const raw = await readFile(datasetPath, 'utf8');
  const dataset = JSON.parse(raw) as InteractionDatasetV2;
  substanceIdSet = new Set(dataset.substances.map((s) => s.id));
  substanceAliasMap = new Map<string, string>();

  for (const substance of dataset.substances) {
    const aliases = [substance.id, cleanToken(substance.id), substance.name, cleanToken(substance.name)];
    for (const alias of aliases) {
      const key = cleanToken(alias);
      if (key && !substanceAliasMap.has(key)) substanceAliasMap.set(key, substance.id);
    }
  }

  for (const [alias, id] of Object.entries(phraseAliasMap)) {
    if (substanceIdSet.has(id)) substanceAliasMap.set(cleanToken(alias), id);
  }
}

export function buildUpdateProposal(reportText: string, filename: string): InteractionUpdateProposal {
  const normalized = normalizeText(reportText);
  const sections = splitReportIntoSections(normalized);

  const pair = extractPair(normalized);
  if (!pair) throw new Error('Pair extraction failed: no valid known substance pair found.');
  if (!substanceIdSet.has(pair[0]) || !substanceIdSet.has(pair[1])) throw new Error(`Pair extraction failed: unknown substance IDs (${pair[0]}, ${pair[1]}).`);

  const datasetSection = getSection(sections, [...headingFamilies.pair]);
  const hasExplicitClass = Boolean(datasetSection && getBulletValue(datasetSection.body, ['danger', 'classification']));
  if (!hasExplicitClass && !hasClassificationSignal(normalized)) throw new Error('Classification extraction failed: no classification signal detected.');

  const code = extractClassification(normalized);
  const headline = extractHeadline(normalized);
  const mechanism = extractMechanismText(normalized);
  const fieldNotes = extractActionGuidance(normalized);
  const timingGuidance = extractTimingGuidance(normalized);
  const mechanismCategories = inferMechanismCategories(normalized);
  const mechanismPrimary = mechanismCategories[0] ?? 'unknown';
  const evidenceTier = inferEvidenceTier(normalized);
  const supportTypes = inferEvidenceSupportTypes(normalized);
  const sourceRefs = extractSourceRefs(normalized);
  const evidenceGaps = extractEvidenceGaps(normalized) ?? 'Direct clinical data specifically on this pair are very limited; estimate is extrapolated from related literature.';

  let confidence = extractConfidence(normalized);
  const extractedNotes: string[] = [];
  const inferredNotes: string[] = [];
  const uncertaintyNotes: string[] = [];
  const draftOnlyNotes: string[] = [];

  const sourceGapOnly = sourceRefs.every((ref) => ref.source_id === 'source_gap');
  if (sourceGapOnly) {
    extractedNotes.push('No structured source IDs were present in the report (`source_gap` fallback).');
  } else {
    extractedNotes.push(`Structured source IDs captured: ${sourceRefs.map((ref) => ref.source_id).join(', ')}.`);
  }
  extractedNotes.push(`Pair extracted from report: ${pair[0]} x ${pair[1]}.`);

  inferredNotes.push(`Candidate classification: ${code}.`);
  inferredNotes.push(`Candidate confidence: ${confidence}.`);
  inferredNotes.push(`Candidate primary mechanism category: ${mechanismPrimary}.`);
  inferredNotes.push(`Candidate evidence tier: ${evidenceTier}.`);

  if (sourceGapOnly && confidence === 'high') confidence = 'medium';
  if (/direct clinical data specifically|very limited direct data|exact pair.*limited/i.test(normalized) && confidence === 'high') {
    confidence = 'medium';
    uncertaintyNotes.push('Confidence capped at medium because direct evidence for the exact pair is limited.');
  }
  if (/no direct data|very limited|limited direct data|exact pair.*limited|extrapolated|conflicting|speculative|source_gap/i.test(normalized)) {
    uncertaintyNotes.push(
      'Direct evidence for the exact pair is limited; interpretation includes mechanistic or extrapolated reasoning.'
    );
  }
  if (['CAUTION', 'UNSAFE', 'DANGEROUS'].includes(code) && sourceGapOnly) {
    uncertaintyNotes.push('Risk classification lacks structured source refs and requires curator review before application.');
  }
  if (code === 'DANGEROUS' && confidence === 'high' && supportTypes.includes('indirect') && !supportTypes.includes('direct')) {
    confidence = 'medium';
    uncertaintyNotes.push('High-confidence dangerous classification was downgraded to medium due to indirect-only evidence.');
  }
  inferredNotes.push(`Candidate confidence after guardrails: ${confidence}.`);
  draftOnlyNotes.push('Draft summary generated from a natural-language report.');
  draftOnlyNotes.push('Use this output as a structured draft, not as clinical advice.');

  const pairKey = `${pair[0]}_${pair[1]}`;
  const updateId = `nl_${pairKey}_${shortHash(`${pair.join('|')}|${cleanToken(headline)}|${filename}`)}`;

  const proposal: InteractionUpdateProposal = {
    update_id: updateId,
    created_at: new Date().toISOString(),
    created_by: 'manual_nl_report',
    pair,
    claim: extractClaimSummary(normalized, headline),
    source_refs: sourceRefs,
    requested_change: {
      'classification.code': code,
      'classification.confidence': confidence,
      'clinical_summary.headline': headline,
      'mechanism.categories': mechanismCategories,
      'mechanism.primary_category': mechanismPrimary,
      'evidence.tier': evidenceTier,
      'evidence.support_type': supportTypes,
      'evidence.evidence_gaps': evidenceGaps
    },
    rationale: reportText,
    status: 'proposed',
    workflow: {
      state: 'submitted',
      transition_history: []
    }
  };

  if (mechanism) proposal.requested_change['clinical_summary.mechanism'] = mechanism;
  if (fieldNotes) proposal.requested_change['clinical_summary.field_notes'] = fieldNotes;
  if (timingGuidance) proposal.requested_change['clinical_summary.timing_guidance'] = timingGuidance;
  proposal.reviewer_notes = formatReviewerNotes({
    extracted: extractedNotes,
    inferred: inferredNotes,
    uncertainty: uncertaintyNotes,
    draftOnly: draftOnlyNotes
  });

  if (!proposal.requested_change['clinical_summary.headline']) throw new Error('Proposal validation failed: missing required headline.');
  return proposal;
}

const failReport = async (filename: string, sourcePath: string, reason: string): Promise<void> => {
  const failedPath = path.join(failedDir, filename);
  await rename(sourcePath, failedPath);
  await writeFile(`${failedPath}.error.txt`, `${reason}\n`, 'utf8');
};

export async function runParser(): Promise<void> {
  await mkdir(incomingDir, { recursive: true });
  await mkdir(parsedDir, { recursive: true });
  await mkdir(failedDir, { recursive: true });
  await initParserContext();

  const entries = await readdir(incomingDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name).filter((n) => /\.(txt|md)$/i.test(n)).sort();

  let parsedCount = 0;
  let failedCount = 0;
  let appendedCount = 0;
  let warningCount = 0;

  for (const filename of files) {
    const sourcePath = path.join(incomingDir, filename);
    try {
      const reportText = await readFile(sourcePath, 'utf8');
      const proposal = buildUpdateProposal(reportText, filename);
      if (proposal.reviewer_notes) warningCount += 1;
      await appendFile(outputJsonl, `${JSON.stringify(proposal)}\n`, 'utf8');
      await rename(sourcePath, path.join(parsedDir, filename));
      parsedCount += 1;
      appendedCount += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await failReport(filename, sourcePath, reason);
      failedCount += 1;
      console.error(`Failed parsing ${filename}: ${reason}`);
    }
  }

  console.log(`reports found=${files.length}`);
  console.log(`reports parsed=${parsedCount}`);
  console.log(`proposals appended=${appendedCount}`);
  console.log(`failed reports=${failedCount}`);
  console.log(`warnings=${warningCount}`);
}

const isMain = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url : false;
if (isMain) {
  runParser().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

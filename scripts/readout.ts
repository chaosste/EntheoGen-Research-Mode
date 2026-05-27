import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Drug, MechanismCategory } from '../src/data/drugData';
import { LEGEND } from '../src/data/drugData';
import type { InteractionPair } from '../src/data/interactionDataset';
import { registerAppDataset } from '../src/data/datasetRegistry';
import { getUIInteraction, type UIInteraction } from '../src/data/uiInteractions';
import { getInteractionExplanation } from '../src/services/ruleBasedReadoutService';
import { getPublicDatasetBundlePaths } from './datasetPaths';

type PairCommand = {
  mode: 'pair';
  substanceA: string;
  substanceB: string;
  includeSources?: boolean;
  outputPath?: string;
};

type CsvCommand = {
  mode: 'csv';
  target: string;
  includeSources?: boolean;
  outputPath?: string;
};

export type ReadoutCommand = PairCommand | CsvCommand;

export type ReadoutContext = {
  root: string;
  drugs: Drug[];
  pairs: InteractionPair[];
  drugById: Map<string, Drug>;
};

type CsvSubject =
  | {
    kind: 'substance';
    label: string;
    ids: string[];
    targetId: string;
  }
  | {
    kind: 'class';
    label: string;
    ids: string[];
    targetId?: undefined;
  };

type RunOptions = {
  cwd?: string;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
};

type RunResult = {
  exitCode: number;
  outputPath?: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(__dirname, '..');

const SUBSTANCE_ALIASES: Record<string, string> = {
  amphetamine: 'amphetamine_stims',
  amphetamines: 'amphetamine_stims',
  'amphetamine stimulant': 'amphetamine_stims',
  'amphetamine stimulants': 'amphetamine_stims',
  antipsychotic: 'antipsychotics',
  maoi: 'maoi_pharma',
  maois: 'maoi_pharma',
  'pharmaceutical maoi': 'maoi_pharma',
  'pharmaceutical maois': 'maoi_pharma',
  mushrooms: 'psilocybin',
  'psilocybin mushroom': 'psilocybin',
  'psilocybin mushrooms': 'psilocybin'
};

class ReadoutCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadoutCliError';
  }
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function normalizeLookupText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function singularize(value: string): string {
  return value
    .split(' ')
    .map((part) => {
      if (part.endsWith('ies') && part.length > 4) return `${part.slice(0, -3)}y`;
      if (part.endsWith('ses') && part.length > 4) return part.slice(0, -2);
      if (part.endsWith('s') && part.length > 3) return part.slice(0, -1);
      return part;
    })
    .join(' ');
}

function stripPromptPunctuation(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/g, '').trim();
}

function cleanNaturalTarget(value: string): string {
  return stripPromptPunctuation(value)
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+(?:with|including|include)\s+(?:source[_\s-]?ids?|sources?)$/i, '')
    .replace(/\s+(?:combinations?|pairs?|readouts?|table)$/i, '')
    .trim();
}

function parseNaturalPrompt(prompt: string, outputPath?: string, forceIncludeSources = false): ReadoutCommand {
  const cleaned = stripPromptPunctuation(prompt).replace(/\s+/g, ' ');
  const includeSources = forceIncludeSources || /\b(?:three-column|source[_\s-]?ids?|sources?)\b/i.test(cleaned);
  const promptWithoutSourceSuffix = cleaned
    .replace(/\s+(?:with|including|include)\s+(?:source[_\s-]?ids?|sources?)$/i, '')
    .trim();
  const asksForCsv = /\b(?:csv|table|all combinations|all the readouts|all readouts)\b/i.test(cleaned);

  if (asksForCsv) {
    const targetMatch = promptWithoutSourceSuffix.match(/\b(?:for|of)\s+(.+?)(?:\s+combinations?|\s+pairs?|\s+readouts?)?$/i);
    if (!targetMatch?.[1]) {
      throw new ReadoutCliError('Could not find the CSV target in the prompt. Try: npm run readout -- --csv ayahuasca');
    }
    return {
      mode: 'csv',
      target: cleanNaturalTarget(targetMatch[1]),
      includeSources,
      outputPath
    };
  }

  const pairMatch = promptWithoutSourceSuffix.match(/\bfor\s+(.+?)\s+(?:and|with|plus|\+|&)\s+(.+)$/i);
  if (!pairMatch?.[1] || !pairMatch?.[2]) {
    throw new ReadoutCliError('Could not find a pair in the prompt. Try: npm run readout -- --pair ayahuasca ketamine');
  }

  return {
    mode: 'pair',
    substanceA: cleanNaturalTarget(pairMatch[1]),
    substanceB: cleanNaturalTarget(pairMatch[2]),
    includeSources,
    outputPath
  };
}

function takeFlag(args: string[], names: string[]): { enabled: boolean; args: string[] } {
  const nextArgs = args.filter((arg) => !names.includes(arg));
  return {
    enabled: nextArgs.length !== args.length,
    args: nextArgs
  };
}

function takeOptionValue(args: string[], names: string[]): { value?: string; args: string[] } {
  const nextArgs: string[] = [];
  let value: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const inlineName = names.find((name) => arg.startsWith(`${name}=`));
    if (inlineName) {
      value = arg.slice(inlineName.length + 1);
      continue;
    }
    if (names.includes(arg)) {
      value = args[index + 1];
      index += 1;
      continue;
    }
    nextArgs.push(arg);
  }

  return { value, args: nextArgs };
}

export function parseReadoutArgs(argv: string[]): ReadoutCommand {
  const output = takeOptionValue(argv, ['-o', '--output']);
  const sources = takeFlag(output.args, ['--sources', '--with-sources', '--source-ids', '--source_id', '--source-refs']);
  const args = sources.args.filter((arg) => arg.trim().length > 0);
  const outputPath = output.value;
  const includeSources = sources.enabled;

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    throw new ReadoutCliError(
      [
        'Usage:',
        '  npm run readout -- "What is the readout for ayahuasca and ketamine?"',
        '  npm run readout -- "Produce a three-column .csv table showing all the readouts for Antipsychotics combinations with sources."',
        '  npm run readout -- --pair ayahuasca ketamine',
        '  npm run readout -- --csv ayahuasca -o ayahuasca-readouts.csv',
        '  npm run readout -- --csv antipsychotics --sources -o antipsychotics-readouts.csv'
      ].join('\n')
    );
  }

  if (args[0] === '--pair') {
    if (args.length < 3) {
      throw new ReadoutCliError('Expected two substances after --pair.');
    }
    return {
      mode: 'pair',
      substanceA: args[1],
      substanceB: args[2],
      includeSources,
      outputPath
    };
  }

  if (args[0]?.startsWith('--pair=')) {
    const [substanceA, substanceB] = args[0].slice('--pair='.length).split(',').map((part) => part.trim());
    if (!substanceA || !substanceB) {
      throw new ReadoutCliError('Expected --pair=substance_a,substance_b.');
    }
    return { mode: 'pair', substanceA, substanceB, includeSources, outputPath };
  }

  if (args[0] === '--csv') {
    if (args.length < 2) {
      throw new ReadoutCliError('Expected a substance or class after --csv.');
    }
    return {
      mode: 'csv',
      target: args[1],
      includeSources,
      outputPath
    };
  }

  if (args[0]?.startsWith('--csv=')) {
    const target = args[0].slice('--csv='.length).trim();
    if (!target) {
      throw new ReadoutCliError('Expected --csv=substance_or_class.');
    }
    return { mode: 'csv', target, includeSources, outputPath };
  }

  return parseNaturalPrompt(args.join(' '), outputPath, includeSources);
}

export function createReadoutContext(root = defaultRoot): ReadoutContext {
  const paths = getPublicDatasetBundlePaths(root);
  const drugs = readJsonFile<Drug[]>(paths.substancesSnapshot);
  const pairs = readJsonFile<InteractionPair[]>(paths.interactionPairs);
  registerAppDataset(drugs, pairs);

  return {
    root,
    drugs,
    pairs,
    drugById: new Map(drugs.map((drug) => [drug.id, drug] as const))
  };
}

function candidateLabelsForDrug(drug: Drug): string[] {
  const labels = [drug.id, drug.name];
  const parenthetical = drug.name.match(/\((.+?)\)/)?.[1];
  if (parenthetical) labels.push(parenthetical);
  for (const part of drug.name.split('/')) {
    labels.push(part);
  }
  return labels;
}

export function resolveSubstance(context: ReadoutContext, input: string): Drug {
  const normalized = normalizeLookupText(input);
  const aliasTarget = SUBSTANCE_ALIASES[normalized] ?? SUBSTANCE_ALIASES[singularize(normalized)];
  if (aliasTarget) {
    const aliasDrug = context.drugById.get(aliasTarget);
    if (aliasDrug) return aliasDrug;
  }

  for (const drug of context.drugs) {
    for (const candidate of candidateLabelsForDrug(drug)) {
      const normalizedCandidate = normalizeLookupText(candidate);
      if (normalizedCandidate === normalized || singularize(normalizedCandidate) === singularize(normalized)) {
        return drug;
      }
    }
  }

  const partialMatches = context.drugs.filter((drug) =>
    candidateLabelsForDrug(drug).some((candidate) => {
      const normalizedCandidate = normalizeLookupText(candidate);
      return normalizedCandidate.includes(normalized) || singularize(normalizedCandidate).includes(singularize(normalized));
    })
  );

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  const suffix = partialMatches.length > 1
    ? ` Ambiguous matches: ${partialMatches.map((drug) => drug.name).join(', ')}.`
    : '';
  throw new ReadoutCliError(`Could not resolve "${input}" to a dataset substance.${suffix}`);
}

export function resolveCsvSubject(context: ReadoutContext, input: string): CsvSubject {
  try {
    const substance = resolveSubstance(context, input);
    return {
      kind: 'substance',
      label: substance.name,
      ids: [substance.id],
      targetId: substance.id
    };
  } catch (error) {
    if (!(error instanceof ReadoutCliError)) throw error;
  }

  const normalized = normalizeLookupText(input);
  const classMatches = context.drugs.filter((drug) => {
    const normalizedClass = normalizeLookupText(drug.class);
    return normalizedClass === normalized || singularize(normalizedClass) === singularize(normalized);
  });

  if (classMatches.length === 0) {
    throw new ReadoutCliError(`Could not resolve "${input}" to a dataset substance or class.`);
  }

  return {
    kind: 'class',
    label: classMatches[0].class,
    ids: classMatches.map((drug) => drug.id)
  };
}

function getPairRow(context: ReadoutContext, substanceAId: string, substanceBId: string): InteractionPair | undefined {
  const pairKey = [substanceAId, substanceBId].sort().join('|');
  return context.pairs.find((pair) => pair.pair_key === pairKey);
}

function riskScaleForInteraction(row: InteractionPair | undefined, interaction: UIInteraction): number {
  if (typeof row?.risk_scale === 'number' && Number.isFinite(row.risk_scale)) {
    return row.risk_scale;
  }
  if (typeof interaction.riskScore === 'number' && Number.isFinite(interaction.riskScore)) {
    return interaction.riskScore;
  }
  return LEGEND[interaction.riskLabel]?.riskScale ?? 0;
}

function normalizeInline(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function confidenceForPair(row: InteractionPair | undefined): string {
  const normalized = row?.confidence?.trim().toLowerCase();
  if (!normalized || normalized === 'n/a' || normalized === 'unknown' || normalized === 'not_applicable') {
    return 'Unknown';
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function compactReadout(interaction: UIInteraction, row: InteractionPair | undefined): string {
  const parts = [
    `Risk: ${interaction.riskDisplayLabel}`,
    `Confidence: ${confidenceForPair(row)}`,
    `Mechanism: ${interaction.mechanismDisplayLabel}`,
    `Readout: ${interaction.headline}`,
    row?.timing ? `Timing: ${normalizeInline(row.timing)}` : '',
    row?.field_notes ? `Notes: ${normalizeInline(row.field_notes)}` : '',
    row?.evidence_gaps ? `Uncertainty: ${normalizeInline(row.evidence_gaps)}` : ''
  ].filter(Boolean);

  return parts.map(normalizeInline).join('; ');
}

function csvEscape(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function sourceIdsForPair(row: InteractionPair | undefined): string {
  const sourceRefs = row?.source_refs?.filter((sourceRef) => sourceRef.trim().length > 0) ?? [];
  return sourceRefs.length > 0 ? sourceRefs.join('; ') : 'unknown';
}

function sourceIdsListForPair(row: InteractionPair | undefined): string[] {
  return row?.source_refs?.filter((sourceRef) => sourceRef.trim().length > 0) ?? [];
}

function sourceTitlesForPair(row: InteractionPair | undefined): string[] {
  return row?.source_titles?.filter((title) => title.trim().length > 0) ?? [];
}

function chunkRefsForPair(row: InteractionPair | undefined): string[] {
  return row?.chunk_refs?.filter((chunkRef) => chunkRef.trim().length > 0) ?? [];
}

export async function renderPairReadout(
  context: ReadoutContext,
  substanceAInput: string,
  substanceBInput: string,
  includeSources = false
): Promise<string> {
  const substanceA = resolveSubstance(context, substanceAInput);
  const substanceB = resolveSubstance(context, substanceBInput);
  const interaction = getUIInteraction(substanceA.id, substanceB.id);
  const row = getPairRow(context, substanceA.id, substanceB.id);
  const readout = await getInteractionExplanation(
    substanceA.name,
    substanceB.name,
    interaction.riskDisplayLabel,
    interaction.headline,
    {
      riskScale: riskScaleForInteraction(row, interaction),
      mechanism: row?.mechanism ?? undefined,
      mechanismCategory: interaction.mechanismCategory === 'unknown'
        ? undefined
        : interaction.mechanismCategory as MechanismCategory,
      timing: row?.timing ?? undefined,
      evidenceGaps: row?.evidence_gaps ?? undefined,
      confidence: row?.confidence ?? undefined,
      evidenceTier: row?.evidence_tier ?? null,
      fieldNotes: row?.field_notes ?? undefined,
      isEvidenceBacked: interaction.isEvidenceBacked,
      citationLabels: interaction.citationLabels,
      sourceIds: sourceIdsListForPair(row),
      sourceTitles: sourceTitlesForPair(row),
      chunkRefs: chunkRefsForPair(row)
    }
  );

  const sourceLine = includeSources ? [`Source IDs: ${sourceIdsForPair(row)}`] : [];
  return [`Pair: ${substanceA.name} + ${substanceB.name}`, ...sourceLine, '', readout].join('\n');
}

export function buildCsvReadouts(context: ReadoutContext, subject: CsvSubject, includeSources = false): string {
  const subjectIds = new Set(subject.ids);
  const rows = context.pairs
    .filter((pair) => {
      if (pair.substance_a_id === pair.substance_b_id) return false;
      return subjectIds.has(pair.substance_a_id) || subjectIds.has(pair.substance_b_id);
    })
    .map((pair) => {
      const a = context.drugById.get(pair.substance_a_id);
      const b = context.drugById.get(pair.substance_b_id);
      if (!a || !b) {
        throw new ReadoutCliError(`Pair ${pair.pair_key} references a missing substance.`);
      }

      const [first, second] = subject.kind === 'substance' && pair.substance_b_id === subject.targetId
        ? [b, a]
        : [a, b];
      const interaction = getUIInteraction(first.id, second.id);
      return {
        pair: `${first.name} + ${second.name}`,
        readout: compactReadout(interaction, pair),
        sourceId: sourceIdsForPair(pair)
      };
    })
    .sort((left, right) => left.pair.localeCompare(right.pair));

  const header = includeSources ? ['pair', 'readout', 'source_id'] : ['pair', 'readout'];
  const lines = [
    header.map(csvEscape).join(','),
    ...rows.map((row) => {
      const values = includeSources ? [row.pair, row.readout, row.sourceId] : [row.pair, row.readout];
      return values.map(csvEscape).join(',');
    })
  ];
  return `${lines.join('\n')}\n`;
}

export async function runReadoutCli(argv: string[], options: RunOptions = {}): Promise<RunResult> {
  const cwd = options.cwd ?? process.cwd();
  const stdout = options.stdout ?? ((message: string) => process.stdout.write(message));
  const stderr = options.stderr ?? ((message: string) => process.stderr.write(message));

  try {
    const command = parseReadoutArgs(argv);
    const context = createReadoutContext(defaultRoot);
    const content = command.mode === 'pair'
      ? `${await renderPairReadout(context, command.substanceA, command.substanceB, command.includeSources)}\n`
      : buildCsvReadouts(context, resolveCsvSubject(context, command.target), command.includeSources);

    if (command.outputPath) {
      const outputPath = path.resolve(cwd, command.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, content, 'utf8');
      stdout(`Wrote ${outputPath}\n`);
      return { exitCode: 0, outputPath };
    }

    stdout(content);
    return { exitCode: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr(`${message}\n`);
    return { exitCode: 1 };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runReadoutCli(process.argv.slice(2));
  process.exitCode = result.exitCode;
}

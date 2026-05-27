import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCsvReadouts,
  createReadoutContext,
  parseReadoutArgs,
  renderPairReadout,
  resolveCsvSubject,
  resolveSubstance,
  runReadoutCli
} from './readout';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const context = createReadoutContext(root);

const naturalPair = parseReadoutArgs(['What is the readout for Alcohol and amphetamines?']);
assert.deepStrictEqual(naturalPair, {
  mode: 'pair',
  substanceA: 'Alcohol',
  substanceB: 'amphetamines',
  includeSources: false,
  outputPath: undefined
});

const explicitPair = parseReadoutArgs(['--pair', 'ayahuasca', 'ketamine']);
assert.deepStrictEqual(explicitPair, {
  mode: 'pair',
  substanceA: 'ayahuasca',
  substanceB: 'ketamine',
  includeSources: false,
  outputPath: undefined
});

const naturalCsv = parseReadoutArgs(['Produce a two-column .csv table showing all the readouts for Antipsychotics combinations.']);
assert.deepStrictEqual(naturalCsv, {
  mode: 'csv',
  target: 'Antipsychotics',
  includeSources: false,
  outputPath: undefined
});

const naturalCsvWithSources = parseReadoutArgs([
  'Produce a three-column .csv table showing all the readouts for Antipsychotics combinations with sources.'
]);
assert.deepStrictEqual(naturalCsvWithSources, {
  mode: 'csv',
  target: 'Antipsychotics',
  includeSources: true,
  outputPath: undefined
});

const flaggedCsvWithSources = parseReadoutArgs(['--csv', 'antipsychotics', '--sources']);
assert.deepStrictEqual(flaggedCsvWithSources, {
  mode: 'csv',
  target: 'antipsychotics',
  includeSources: true,
  outputPath: undefined
});

assert.strictEqual(resolveSubstance(context, 'amphetamines').id, 'amphetamine_stims');
assert.strictEqual(resolveSubstance(context, 'Alcohol').id, 'alcohol');

const pairReadout = await renderPairReadout(context, 'ayahuasca', 'ketamine');
assert.match(pairReadout, /Pair: Ayahuasca \+ Ketamine/);
assert.match(pairReadout, /Caution \/ moderate risk/i);
assert.match(pairReadout, /MAOI potentiation/i);

const sourcedPairReadout = await renderPairReadout(context, 'alcohol', 'amphetamines', true);
assert.match(sourcedPairReadout, /Source IDs: /);
assert.match(sourcedPairReadout, /Dataset evidence detail/);
assert.match(sourcedPairReadout, /Linked chunks:/);

const csv = buildCsvReadouts(context, resolveCsvSubject(context, 'Antipsychotics'));
assert.ok(csv.startsWith('pair,readout\n'), 'CSV should use pair,readout header');
assert.match(csv, /Antipsychotics \+ Ayahuasca/);
assert.match(csv, /psychiatric/i);

const csvWithSources = buildCsvReadouts(context, resolveCsvSubject(context, 'Antipsychotics'), true);
assert.ok(csvWithSources.startsWith('pair,readout,source_id\n'), 'source CSV should use three-column header');
assert.match(csvWithSources, /Antipsychotics \+ Ayahuasca/);
assert.match(csvWithSources, /\b[a-z][a-z0-9_]*_\d{4}\b/);
assert.doesNotMatch(csvWithSources, /\bbeta_dataset\b/);
assert.doesNotMatch(csvWithSources, /undefined/);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entheogen-readout-'));
const outputFile = path.join(tempDir, 'ayahuasca-readouts.csv');
const runResult = await runReadoutCli(['--csv', 'ayahuasca', '-o', outputFile], {
  cwd: root,
  stdout: () => undefined,
  stderr: () => undefined
});
assert.strictEqual(runResult.exitCode, 0);
assert.ok(fs.existsSync(outputFile), 'CLI should write requested CSV output file');
assert.match(fs.readFileSync(outputFile, 'utf8'), /Ayahuasca \+ Ketamine/);

const outputFileWithSources = path.join(tempDir, 'ayahuasca-readouts-with-sources.csv');
const sourceRunResult = await runReadoutCli(['--csv', 'ayahuasca', '--sources', '-o', outputFileWithSources], {
  cwd: root,
  stdout: () => undefined,
  stderr: () => undefined
});
assert.strictEqual(sourceRunResult.exitCode, 0);
assert.ok(fs.existsSync(outputFileWithSources), 'CLI should write requested source CSV output file');
assert.match(fs.readFileSync(outputFileWithSources, 'utf8'), /^pair,readout,source_id/m);
assert.match(fs.readFileSync(outputFileWithSources, 'utf8'), /\b[a-z][a-z0-9_]*_\d{4}\b/);
assert.doesNotMatch(fs.readFileSync(outputFileWithSources, 'utf8'), /\bbeta_dataset\b/);
assert.doesNotMatch(fs.readFileSync(outputFileWithSources, 'utf8'), /undefined/);
fs.rmSync(tempDir, { recursive: true, force: true });

console.log('readout CLI checks passed');

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAppDatasetExportPaths,
  getBetaCsvPaths,
  getCanonicalDatasetPaths,
  getCanonicalDatasetSourcePaths,
  getDefaultBetaDataDir,
  getPublicDatasetBundlePaths
} from './datasetPaths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const canonical = getCanonicalDatasetPaths(root);
const canonicalSources = getCanonicalDatasetSourcePaths(root);
const appExports = getAppDatasetExportPaths(root);

assert.deepStrictEqual(canonical, { ...canonicalSources, ...appExports }, 'canonical path helper should compose source + export paths');

assert.ok(
  canonical.interactionPairs.endsWith(path.join('src', 'data', 'interaction_pairs.json')),
  'interactionPairs path should resolve to canonical v2 dataset file'
);
assert.ok(
  canonical.interactionPairsExport.endsWith(path.join('src', 'exports', 'interaction_pairs.json')),
  'interactionPairsExport path should resolve to app export snapshot file'
);
assert.ok(
  canonical.substancesSnapshot.endsWith(path.join('src', 'data', 'substances_snapshot.json')),
  'substancesSnapshot path should resolve to app substance snapshot file'
);
assert.ok(
  canonical.sourceManifest.endsWith(path.join('knowledge-base', 'indexes', 'source_manifest.json')),
  'sourceManifest path should resolve to canonical KB source manifest'
);
assert.ok(
  canonical.sourceTags.endsWith(path.join('knowledge-base', 'indexes', 'source_tags.json')),
  'sourceTags path should resolve to canonical KB source tags index'
);
assert.ok(
  canonical.citationRegistry.endsWith(path.join('knowledge-base', 'indexes', 'citation_registry.json')),
  'citationRegistry path should resolve to canonical KB citation registry'
);
assert.ok(
  canonical.sourceSchema.endsWith(path.join('knowledge-base', 'schemas', 'source.schema.json')),
  'sourceSchema path should resolve to canonical KB source schema'
);
assert.ok(
  canonical.claimSchema.endsWith(path.join('knowledge-base', 'schemas', 'claim.schema.json')),
  'claimSchema path should resolve to canonical KB claim schema'
);

const betaDir = getDefaultBetaDataDir(root);
const betaCsv = getBetaCsvPaths(betaDir);
assert.strictEqual(betaCsv.substancesCsv, path.join(betaDir, 'substances.csv'));
const publicBundle = getPublicDatasetBundlePaths(root);
assert.ok(
  publicBundle.manifest.endsWith(path.join('public', 'dataset', 'manifest.json')),
  'public manifest path should resolve under public/dataset'
);
assert.ok(
  publicBundle.interactionPairs.endsWith(path.join('public', 'dataset', 'interaction_pairs.json')),
  'public interaction_pairs path should resolve under public/dataset'
);

console.log('dataset path helper checks passed');

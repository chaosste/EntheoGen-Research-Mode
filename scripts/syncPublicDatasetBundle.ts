/**
 * Copies `src/exports/interaction_pairs.json` + `src/data/substances_snapshot.json`
 * into `public/dataset/` and writes `manifest.json` (schema version + content hashes).
 * Used by `npm run dataset:sync-public` and `prebuild` so Vite can serve `/dataset/*`.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_DATASET_SCHEMA_VERSION } from '../src/data/datasetManifest';
import { getAppDatasetExportPaths, getPublicDatasetBundlePaths } from './datasetPaths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function main() {
  const srcPaths = getAppDatasetExportPaths(root);
  const pub = getPublicDatasetBundlePaths(root);

  if (!fs.existsSync(srcPaths.interactionPairsExport) || !fs.existsSync(srcPaths.substancesSnapshot)) {
    throw new Error(
      `Missing app snapshot files. Run \`npm run dataset:build-beta\` first or ensure:\n` +
        `  ${srcPaths.interactionPairsExport}\n` +
        `  ${srcPaths.substancesSnapshot}`
    );
  }

  const pairsContent = fs.readFileSync(srcPaths.interactionPairsExport, 'utf8');
  const substancesContent = fs.readFileSync(srcPaths.substancesSnapshot, 'utf8');

  fs.mkdirSync(pub.dir, { recursive: true });
  fs.writeFileSync(pub.interactionPairs, pairsContent, 'utf8');
  fs.writeFileSync(pub.substancesSnapshot, substancesContent, 'utf8');

  const manifest = {
    schemaVersion: APP_DATASET_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    interactionPairsSha256: sha256Hex(pairsContent),
    substancesSnapshotSha256: sha256Hex(substancesContent)
  };
  fs.writeFileSync(pub.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Synced app dataset bundle -> ${path.relative(process.cwd(), pub.dir)}`);
}

main();

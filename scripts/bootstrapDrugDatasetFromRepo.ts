import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { getCanonicalDatasetSourcePaths } from './datasetPaths';
import { registerRichInteractionDataset, type RichInteractionDataset } from '../src/data/datasetRegistry';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Loads the canonical rich interaction dataset and registers the in-memory
 * dataset used by `drugData` / `uiInteractions` / `sourceLinking`. Call from Node
 * scripts before any resolveInteraction / normalizeInteraction use.
 */
export function bootstrapDrugDatasetFromRepo(repoRoot = defaultRoot): void {
  dotenv.config({ path: path.join(repoRoot, '.env.local') });
  dotenv.config({ path: path.join(repoRoot, '.env') });
  const paths = getCanonicalDatasetSourcePaths(repoRoot);
  const dataset = JSON.parse(fs.readFileSync(paths.interactionPairs, 'utf8')) as RichInteractionDataset;
  registerRichInteractionDataset(dataset);
}

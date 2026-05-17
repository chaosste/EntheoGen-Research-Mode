import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { getAppDatasetExportPaths } from './datasetPaths';
import { registerAppDataset } from '../src/data/datasetRegistry';
import type { Drug } from '../src/data/drugData';
import type { InteractionPair } from '../src/data/interactionDataset';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Loads substances + interaction_pairs from `src/` and registers the in-memory
 * dataset used by `drugData` / `uiInteractions` / `sourceLinking`. Call from Node
 * scripts before any resolveInteraction / normalizeInteraction use.
 */
export function bootstrapDrugDatasetFromRepo(repoRoot = defaultRoot): void {
  dotenv.config({ path: path.join(repoRoot, '.env.local') });
  dotenv.config({ path: path.join(repoRoot, '.env') });
  const paths = getAppDatasetExportPaths(repoRoot);
  const drugs = JSON.parse(fs.readFileSync(paths.substancesSnapshot, 'utf8')) as Drug[];
  const pairs = JSON.parse(fs.readFileSync(paths.interactionPairsExport, 'utf8')) as InteractionPair[];
  registerAppDataset(drugs, pairs);
}

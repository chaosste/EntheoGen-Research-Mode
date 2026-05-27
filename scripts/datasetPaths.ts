import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface CanonicalDatasetPaths {
  interactionPairs: string;
  sourceManifest: string;
  sourceTags: string;
  citationRegistry: string;
  sourceSchema: string;
  claimSchema: string;
  interactionPairsExport: string;
  substancesSnapshot: string;
}

export interface CanonicalDatasetSourcePaths {
  interactionPairs: string;
  sourceManifest: string;
  sourceTags: string;
  citationRegistry: string;
  sourceSchema: string;
  claimSchema: string;
}

export interface AppDatasetExportPaths {
  interactionPairsExport: string;
  substancesSnapshot: string;
}

/** Static files copied into Vite `public/` for runtime fetch (Mode A). */
export interface PublicDatasetBundlePaths {
  dir: string;
  manifest: string;
  interactionPairs: string;
  substancesSnapshot: string;
}

export interface BetaCsvPaths {
  dataDir: string;
  substancesCsv: string;
  interactionsCsv: string;
  pairCoverageCsv: string;
}

export const defaultBetaCsvFilenames = {
  substances: 'substances.csv',
  interactions: 'interactions.csv',
  pairCoverage: 'pair_coverage.csv'
} as const;

export function getCanonicalDatasetSourcePaths(root = repoRoot): CanonicalDatasetSourcePaths {
  return {
    interactionPairs: path.join(root, 'src', 'data', 'interaction_pairs.json'),
    sourceManifest: path.join(root, 'knowledge-base', 'indexes', 'source_manifest.json'),
    sourceTags: path.join(root, 'knowledge-base', 'indexes', 'source_tags.json'),
    citationRegistry: path.join(root, 'knowledge-base', 'indexes', 'citation_registry.json'),
    sourceSchema: path.join(root, 'knowledge-base', 'schemas', 'source.schema.json'),
    claimSchema: path.join(root, 'knowledge-base', 'schemas', 'claim.schema.json')
  };
}

export function getAppDatasetExportPaths(root = repoRoot): AppDatasetExportPaths {
  return {
    interactionPairsExport: path.join(root, 'src', 'exports', 'interaction_pairs.json'),
    substancesSnapshot: path.join(root, 'src', 'data', 'substances_snapshot.json')
  };
}

export function getPublicDatasetBundlePaths(root = repoRoot): PublicDatasetBundlePaths {
  const dir = path.join(root, 'public', 'dataset');
  return {
    dir,
    manifest: path.join(dir, 'manifest.json'),
    interactionPairs: path.join(dir, 'interaction_pairs.json'),
    substancesSnapshot: path.join(dir, 'substances_snapshot.json')
  };
}

export function getCanonicalDatasetPaths(root = repoRoot): CanonicalDatasetPaths {
  return {
    ...getCanonicalDatasetSourcePaths(root),
    ...getAppDatasetExportPaths(root)
  };
}

export function getDefaultBetaDataDir(root = repoRoot): string {
  return path.join(path.dirname(root), 'EntheoGen-Dataset-Beta-0-1', 'data');
}

export function getBetaCsvPaths(dataDir: string): BetaCsvPaths {
  return {
    dataDir,
    substancesCsv: path.join(dataDir, defaultBetaCsvFilenames.substances),
    interactionsCsv: path.join(dataDir, defaultBetaCsvFilenames.interactions),
    pairCoverageCsv: path.join(dataDir, defaultBetaCsvFilenames.pairCoverage)
  };
}

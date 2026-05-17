import {
  APP_DATASET_SCHEMA_VERSION,
  SUPPORTED_APP_DATASET_SCHEMA_VERSIONS,
  WARN_ONLY_APP_DATASET_SCHEMA_VERSIONS,
  type AppDatasetManifest
} from './datasetManifest';
import type { Drug } from './drugData';
import type { InteractionPair } from './interactionDataset';

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function manifestUrl(baseUrl: string | undefined): string {
  const b = baseUrl ? trimSlash(baseUrl) : '';
  return b ? `${b}/manifest.json` : '/dataset/manifest.json';
}

function joinBase(baseUrl: string | undefined, file: string): string {
  const b = baseUrl ? trimSlash(baseUrl) : '';
  return b ? `${b}/${file}` : `/dataset/${file}`;
}

export type LoadedAppDataset = {
  manifest: AppDatasetManifest;
  interactionPairs: InteractionPair[];
  substances: Drug[];
};

/**
 * Mode A: same-origin `/dataset/*`. Mode B: `import.meta.env.VITE_DATASET_BASE_URL`
 * pointing at a directory that contains manifest.json + JSON siblings.
 */
export async function loadAppDatasetBundle(): Promise<LoadedAppDataset> {
  const env = import.meta.env.VITE_DATASET_BASE_URL;
  const baseUrl = typeof env === 'string' && env.trim() !== '' ? env.trim() : undefined;

  const manifestRes = await fetch(manifestUrl(baseUrl));
  if (!manifestRes.ok) {
    throw new Error(`Failed to load dataset manifest: ${manifestRes.status} ${manifestRes.statusText}`);
  }
  const manifest = (await manifestRes.json()) as AppDatasetManifest;

  if (WARN_ONLY_APP_DATASET_SCHEMA_VERSIONS.has(manifest.schemaVersion)) {
    console.warn(
      `[datasetLoader] manifest schemaVersion "${manifest.schemaVersion}" is known-compatible with app schema "${APP_DATASET_SCHEMA_VERSION}".`
    );
  } else if (!SUPPORTED_APP_DATASET_SCHEMA_VERSIONS.has(manifest.schemaVersion)) {
    throw new Error(
      `Unsupported dataset manifest schemaVersion "${manifest.schemaVersion}". ` +
        `This app supports "${APP_DATASET_SCHEMA_VERSION}".`
    );
  }

  const [pairsRes, substancesRes] = await Promise.all([
    fetch(joinBase(baseUrl, 'interaction_pairs.json')),
    fetch(joinBase(baseUrl, 'substances_snapshot.json'))
  ]);

  if (!pairsRes.ok) {
    throw new Error(`Failed to load interaction_pairs.json: ${pairsRes.status}`);
  }
  if (!substancesRes.ok) {
    throw new Error(`Failed to load substances_snapshot.json: ${substancesRes.status}`);
  }

  const interactionPairs = (await pairsRes.json()) as InteractionPair[];
  const substances = (await substancesRes.json()) as Drug[];

  return { manifest, interactionPairs, substances };
}

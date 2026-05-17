/** Contract version for public/dataset/manifest.json - bump when JSON shapes change. */
export const APP_DATASET_SCHEMA_VERSION = '1';
export const SUPPORTED_APP_DATASET_SCHEMA_VERSIONS = new Set([APP_DATASET_SCHEMA_VERSION]);

/**
 * Versions with wire-compatible JSON shapes. Keep this narrow: add a version here
 * only after confirming the app can render it without code changes.
 */
export const WARN_ONLY_APP_DATASET_SCHEMA_VERSIONS = new Set<string>();

export interface AppDatasetManifest {
  schemaVersion: string;
  generatedAt: string;
  interactionPairsSha256: string;
  substancesSnapshotSha256: string;
}

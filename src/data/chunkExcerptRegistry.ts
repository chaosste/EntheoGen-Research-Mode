import type { ChunkExcerptIndex } from './chunkExcerpts';

let chunkExcerptIndex: ChunkExcerptIndex | null = null;

export function registerChunkExcerptIndex(next: ChunkExcerptIndex): void {
  chunkExcerptIndex = next;
}

export function getChunkExcerptIndex(): ChunkExcerptIndex {
  return chunkExcerptIndex ?? {};
}

export function isChunkExcerptIndexRegistered(): boolean {
  return chunkExcerptIndex !== null;
}

export function clearChunkExcerptIndex(): void {
  chunkExcerptIndex = null;
}

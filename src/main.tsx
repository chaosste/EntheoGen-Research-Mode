import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import interactionPairs from './exports/interaction_pairs.json';
import chunkExcerpts from './exports/chunk_excerpts.json';
import substances from './data/substances_snapshot.json';
import type { Drug } from './data/drugData';
import type { InteractionPair } from './data/interactionDataset';
import { registerAppDataset } from './data/datasetRegistry';
import { registerChunkExcerptIndex } from './data/chunkExcerptRegistry';
import type { ChunkExcerptIndex } from './data/chunkExcerpts';

registerAppDataset(substances as Drug[], interactionPairs as InteractionPair[]);
registerChunkExcerptIndex(chunkExcerpts as ChunkExcerptIndex);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

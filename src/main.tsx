import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import interactionDataset from './data/interaction_pairs.json';
import { registerRichInteractionDataset, type RichInteractionDataset } from './data/datasetRegistry';

registerRichInteractionDataset(interactionDataset as RichInteractionDataset);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

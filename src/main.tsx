import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadAppDatasetBundle } from './data/datasetLoader';
import { registerAppDataset } from './data/datasetRegistry';

function BootstrapShell() {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadAppDatasetBundle()
      .then(({ interactionPairs, substances }) => {
        registerAppDataset(substances, interactionPairs);
        setReady(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-8 text-red-400 text-sm">
        Failed to load dataset: {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white/80 text-sm">
        Loading dataset…
      </div>
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootstrapShell />
  </StrictMode>
);

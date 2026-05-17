import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const suites = [
  'scripts/testKnowledgeBasePipeline.ts',
  'scripts/testAlmaIngestion.ts',
  'scripts/testPerplexityIngestion.ts'
];

for (const suite of suites) {
  await import(pathToFileURL(path.join(root, suite)).href);
}


import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const README_PATH = process.argv[2] ?? path.join(root, 'README.md');
const PAIRS_PATH = process.argv[3] ?? path.join(root, 'src', 'exports', 'interaction_pairs.json');
const SUBSTANCES_PATH = process.argv[4] ?? path.join(root, 'src', 'data', 'substances_snapshot.json');

function badge(label: string, message: string | number, color: string) {
  const safeLabel = encodeURIComponent(label).replace(/-/g, '--');
  const safeMessage = encodeURIComponent(String(message)).replace(/-/g, '--');
  return `![${label}](https://img.shields.io/badge/${safeLabel}-${safeMessage}-${color})`;
}

const pairsRaw = fs.readFileSync(PAIRS_PATH, 'utf8');
const substancesRaw = fs.readFileSync(SUBSTANCES_PATH, 'utf8');
const pairs = JSON.parse(pairsRaw) as unknown[];
const substances = JSON.parse(substancesRaw) as unknown[];

if (!Array.isArray(pairs) || !Array.isArray(substances)) {
  throw new Error('Expected interaction_pairs.json and substances_snapshot.json to be arrays.');
}

const interactionCount = pairs.length;
const substanceCount = substances.length;

const badges = [
  badge('Dataset', 'beta-0.1', 'blue'),
  badge('Interactions', interactionCount, 'informational'),
  badge('Substances', substanceCount, 'informational'),
  badge('App data', 'static JSON snapshot', 'lightgrey'),
  badge('TypeScript', 'compile pass', 'brightgreen'),
  badge('Checks', 'adapter + mapping scripts', 'green'),
  badge('KB parallel', 'schema v2', 'blue'),
  badge('Review stance', 'human-in-loop', 'orange'),
  badge('Use', 'educational — not clinical advice', 'critical')
].join('\n');

const start = '<!-- BADGES:START -->';
const end = '<!-- BADGES:END -->';

const readme = fs.readFileSync(README_PATH, 'utf8');

if (!readme.includes(start) || !readme.includes(end)) {
  throw new Error(`README must contain ${start} and ${end}`);
}

const nextReadme = readme.replace(
  new RegExp(`${start}[\\s\\S]*?${end}`),
  `${start}\n${badges}\n${end}`
);

fs.writeFileSync(README_PATH, nextReadme);

console.log('Updated README badges:');
console.log(badges);

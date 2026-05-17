import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface DriftEntry {
  status: string;
  path: string;
}

const parseArgs = () => {
  const allow = new Set<string>();
  const allowPrefix: string[] = [];

  for (let i = 2; i < process.argv.length; i += 1) {
    const token = process.argv[i];
    if (token === '--allow') {
      const value = process.argv[i + 1];
      if (!value) throw new Error('Missing value for --allow');
      allow.add(value);
      i += 1;
      continue;
    }

    if (token.startsWith('--allow=')) {
      allow.add(token.slice('--allow='.length));
      continue;
    }

    if (token === '--allow-prefix') {
      const value = process.argv[i + 1];
      if (!value) throw new Error('Missing value for --allow-prefix');
      allowPrefix.push(value);
      i += 1;
      continue;
    }

    if (token.startsWith('--allow-prefix=')) {
      allowPrefix.push(token.slice('--allow-prefix='.length));
      continue;
    }
  }

  return { allow, allowPrefix };
};

const parseStatusLine = (line: string): DriftEntry | null => {
  if (!line.trim()) return null;

  if (line.startsWith('?? ')) {
    return { status: '??', path: line.slice(3).trim() };
  }

  const status = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const renamed = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) ?? rawPath : rawPath;
  return {
    status,
    path: renamed
  };
};

const isAllowed = (entry: DriftEntry, allow: Set<string>, allowPrefix: string[]): boolean => {
  if (allow.has(entry.path)) return true;
  return allowPrefix.some((prefix) => entry.path.startsWith(prefix));
};

async function main(): Promise<void> {
  const { allow, allowPrefix } = parseArgs();

  const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
    encoding: 'utf8'
  });

  const entries = stdout
    .split(/\r?\n/)
    .map((line) => parseStatusLine(line))
    .filter((entry): entry is DriftEntry => entry !== null);

  const unexpected = entries.filter((entry) => !isAllowed(entry, allow, allowPrefix));

  if (unexpected.length === 0) {
    console.log('Workspace baseline check passed: no unexpected drift.');
    return;
  }

  console.error('Workspace baseline check failed: unexpected drift detected.');
  for (const entry of unexpected) {
    console.error(`${entry.status} ${entry.path}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

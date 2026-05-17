import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getCanonicalDatasetSourcePaths } from './datasetPaths';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const defaultOutputPath = path.join(root, 'knowledge-base', 'reports', 'dataset_changelog.md');

interface CliArgs {
  baseRef: string;
  headRef: string;
  prRef: string;
  outputPath: string;
}

interface FileDelta {
  file: string;
  added: number;
  removed: number;
}

interface ChangelogInput {
  baseRef: string;
  headRef: string;
  prRef: string;
  canonicalFiles: string[];
  changedFiles: FileDelta[];
  commits: Array<{ hash: string; subject: string }>;
}

const parseArgValue = (name: string): string | undefined => {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);

  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
};

function parseArgs(): CliArgs {
  const prRef = parseArgValue('pr');
  if (!prRef || !prRef.trim()) {
    throw new Error('Missing required --pr (for example --pr "PR #123" or --pr "https://github.com/org/repo/pull/123").');
  }

  return {
    baseRef: parseArgValue('base') ?? 'HEAD~1',
    headRef: parseArgValue('head') ?? 'HEAD',
    prRef: prRef.trim(),
    outputPath: path.resolve(parseArgValue('out') ?? defaultOutputPath)
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runGit(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    encoding: 'utf8'
  });
  return stdout.trim();
}

function parseNumstatRow(row: string, file: string): FileDelta {
  const [addedRaw, removedRaw] = row.split(/\s+/, 3);
  const added = Number.parseInt(addedRaw, 10);
  const removed = Number.parseInt(removedRaw, 10);
  return {
    file,
    added: Number.isFinite(added) ? added : 0,
    removed: Number.isFinite(removed) ? removed : 0
  };
}

async function collectChangedFiles(baseRef: string, headRef: string, canonicalFiles: string[]): Promise<FileDelta[]> {
  if (canonicalFiles.length === 0) return [];

  const nameOnly = await runGit(['diff', '--name-only', `${baseRef}..${headRef}`, '--', ...canonicalFiles]);
  if (!nameOnly) return [];

  const changed = nameOnly.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const deltas: FileDelta[] = [];

  for (const file of changed) {
    const numstat = await runGit(['diff', '--numstat', `${baseRef}..${headRef}`, '--', file]);
    if (!numstat) {
      deltas.push({ file, added: 0, removed: 0 });
      continue;
    }
    const firstRow = numstat.split(/\r?\n/).find((line) => line.trim().length > 0);
    deltas.push(firstRow ? parseNumstatRow(firstRow, file) : { file, added: 0, removed: 0 });
  }

  return deltas;
}

async function collectCommitList(baseRef: string, headRef: string, canonicalFiles: string[]): Promise<Array<{ hash: string; subject: string }>> {
  if (canonicalFiles.length === 0) return [];
  const output = await runGit(['log', '--pretty=format:%h\t%s', `${baseRef}..${headRef}`, '--', ...canonicalFiles]);
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, ...rest] = line.split('\t');
      return { hash, subject: rest.join('\t') };
    });
}

export function buildMarkdownChangelog(input: ChangelogInput): string {
  const lines: string[] = [];
  lines.push('# Dataset Changelog Draft');
  lines.push('');
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push(`- Compare range: \`${input.baseRef}..${input.headRef}\``);
  lines.push(`- PR reference: ${input.prRef}`);
  lines.push('');
  lines.push('## Canonical Source Files');
  if (input.canonicalFiles.length === 0) {
    lines.push('- None detected.');
  } else {
    for (const file of input.canonicalFiles) {
      lines.push(`- \`${file}\``);
    }
  }
  lines.push('');
  lines.push('## File Deltas');
  if (input.changedFiles.length === 0) {
    lines.push('No canonical dataset file changes detected in this range.');
  } else {
    lines.push('| File | +Lines | -Lines |');
    lines.push('| --- | ---: | ---: |');
    for (const change of input.changedFiles) {
      lines.push(`| \`${change.file}\` | ${change.added} | ${change.removed} |`);
    }
  }
  lines.push('');
  lines.push('## Commits Touching Canonical Sources');
  if (input.commits.length === 0) {
    lines.push('No commits in range touched canonical dataset sources.');
  } else {
    for (const commit of input.commits) {
      lines.push(`- \`${commit.hash}\` ${commit.subject}`);
    }
  }
  lines.push('');
  lines.push('## Review Checklist');
  lines.push('- [ ] Confirm the PR reference maps to the intended review/approval artifact.');
  lines.push('- [ ] Verify dataset classification and evidence shifts are expected.');
  lines.push('- [ ] Confirm changelog wording matches reviewer-facing release note expectations.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export async function generateDatasetChangelog(args: CliArgs): Promise<{ outputPath: string; changedFileCount: number }> {
  const canonicalPaths = getCanonicalDatasetSourcePaths(root);
  const canonicalFiles = (
    await Promise.all(
      Object.values(canonicalPaths).map(async (absPath) => {
        const exists = await fileExists(absPath);
        if (!exists) return null;
        return path.relative(root, absPath);
      })
    )
  ).filter((value): value is string => value !== null);

  const changedFiles = await collectChangedFiles(args.baseRef, args.headRef, canonicalFiles);
  const commits = await collectCommitList(args.baseRef, args.headRef, canonicalFiles);

  const markdown = buildMarkdownChangelog({
    baseRef: args.baseRef,
    headRef: args.headRef,
    prRef: args.prRef,
    canonicalFiles,
    changedFiles,
    commits
  });

  await mkdir(path.dirname(args.outputPath), { recursive: true });
  await writeFile(args.outputPath, markdown, 'utf8');

  return {
    outputPath: args.outputPath,
    changedFileCount: changedFiles.length
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const result = await generateDatasetChangelog(args);
  console.log(`Dataset changelog generated: ${path.relative(root, result.outputPath)}`);
  console.log(`Canonical files changed in range: ${result.changedFileCount}`);
}

const isMain = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url : false;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

import assert from 'node:assert/strict';
import { buildMarkdownChangelog } from './generateDatasetChangelog';

const markdown = buildMarkdownChangelog({
  baseRef: 'abc123',
  headRef: 'def456',
  prRef: 'PR #999',
  canonicalFiles: [
    'src/data/interactionDatasetV2.json',
    'knowledge-base/indexes/source_manifest.json'
  ],
  changedFiles: [
    {
      file: 'src/data/interactionDatasetV2.json',
      added: 12,
      removed: 3
    }
  ],
  commits: [
    {
      hash: 'abc1234',
      subject: 'Update canonical interaction pair confidence'
    }
  ]
});

assert.match(markdown, /# Dataset Changelog Draft/, 'expected title');
assert.match(markdown, /PR reference: PR #999/, 'expected PR reference section');
assert.match(markdown, /`src\/data\/interactionDatasetV2\.json`/, 'expected canonical dataset file listing');
assert.match(markdown, /\| `src\/data\/interactionDatasetV2\.json` \| 12 \| 3 \|/, 'expected review table row');
assert.match(markdown, /`abc1234` Update canonical interaction pair confidence/, 'expected commit summary entry');
assert.match(markdown, /## Review Checklist/, 'expected reviewer checklist section');

console.log('dataset changelog generation assertions passed.');

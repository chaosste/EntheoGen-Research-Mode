import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  ensureDir,
  extractClaimEntities,
  inferAuthorityLevel,
  inferClinicalActionability,
  inferClaimType,
  inferEvidenceDomain,
  inferEvidenceStrength,
  inferSourceTypeFromPath,
  loadSchema,
  parseFrontmatter,
  readJson,
  splitSentences,
  stableHash,
  titleCaseFromSlug,
  walkFiles,
  writeJson,
  type ClaimRecord,
  type ClaimPackage,
  type SourceManifestEntry,
  validateSchemaSubset,
} from './kb-utils';

const keywordPatterns = [
  /interaction/i,
  /contraindicat/i,
  /\brisk\b/i,
  /mechanism/i,
  /blood pressure/i,
  /heart rate/i,
  /sedation/i,
  /monitor/i,
  /\bcaution\b/i,
  /\bavoid\b/i
];

const createClaimId = (sourceId: string, sentence: string, index: number): string =>
  `${sourceId}_${index + 1}_${stableHash(sentence, 10)}`;

const extractClaimsFromText = (
  sourceId: string,
  body: string,
  metadata: Record<string, unknown>,
  fileStem: string
): ClaimRecord[] => {
  const entities = extractClaimEntities(metadata, fileStem, body);
  const supportsPairs = metadata.supports_pairs ? (Array.isArray(metadata.supports_pairs) ? metadata.supports_pairs : []) : [];
  const pairSupport = Array.isArray(supportsPairs) ? supportsPairs : [];
  const claims: ClaimRecord[] = [];
  const sentences = splitSentences(body);

  for (const [index, sentence] of sentences.entries()) {
    if (!keywordPatterns.some((pattern) => pattern.test(sentence))) continue;
    const claimType = inferClaimType(sentence);
    claims.push({
      claim_id: createClaimId(sourceId, sentence, index),
      source_id: sourceId,
      claim: sentence,
      claim_type: claimType,
      entities,
      mechanism: claimType === 'mechanism' ? sentence : (typeof metadata.mechanism === 'string' ? metadata.mechanism : undefined),
      evidence_strength: inferEvidenceStrength(sentence),
      confidence: 'low',
      supports_pairs: pairSupport.length ? pairSupport : undefined,
      clinical_actionability: inferClinicalActionability(sentence),
      review_state: 'machine_extracted',
      notes: `Extracted from ${fileStem} using rule-based keyword matching.`
    });
  }

  return claims;
};

const upsertManifestEntry = (
  manifest: { version: string; sources: SourceManifestEntry[] },
  entry: SourceManifestEntry
): void => {
  const index = manifest.sources.findIndex((source) => source.source_id === entry.source_id);
  if (index >= 0) {
    manifest.sources[index] = {
      ...manifest.sources[index],
      ...entry,
      review_state: manifest.sources[index].review_state === 'validated' ? 'validated' : entry.review_state
    };
    return;
  }
  manifest.sources.push(entry);
};

const compactManifestEntry = (entry: SourceManifestEntry): SourceManifestEntry => {
  const compacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (value !== undefined) {
      compacted[key] = value;
    }
  }
  return compacted as unknown as SourceManifestEntry;
};

const run = async (): Promise<void> => {
  const kbRoot = process.env.KB_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge-base');
  const sourcesDir = process.env.KB_SOURCES_DIR ?? path.join(kbRoot, 'sources');
  const pendingDir = process.env.KB_PENDING_DIR ?? path.join(kbRoot, 'extracted', 'claims', 'pending');
  const indexesDir = process.env.KB_INDEXES_DIR ?? path.join(kbRoot, 'indexes');
  const sourceManifestPath = process.env.KB_SOURCE_MANIFEST_PATH ?? path.join(indexesDir, 'source_manifest.json');
  const sourceTagsPath = process.env.KB_SOURCE_TAGS_PATH ?? path.join(indexesDir, 'source_tags.json');
  const citationRegistryPath = process.env.KB_CITATION_REGISTRY_PATH ?? path.join(indexesDir, 'citation_registry.json');
  const sourceSchemaPath = process.env.KB_SOURCE_SCHEMA_PATH ?? path.join(kbRoot, 'schemas', 'source.schema.json');

  await ensureDir(pendingDir);
  await ensureDir(indexesDir);

  const sourceSchema = await loadSchema(sourceSchemaPath);
  const sourceFiles = await walkFiles(sourcesDir, ['.md', '.txt']);
  const manifestRaw = (await readJson<{ version: string; sources: SourceManifestEntry[] }>(sourceManifestPath).catch(() => ({ version: 'kb_v1', sources: [] })));
  const manifest = { version: manifestRaw.version ?? 'kb_v1', sources: [...(manifestRaw.sources ?? [])] };
  const sourceTags = (await readJson<{ version: string; source_tags: Array<{ source_id: string; tags: string[] }> }>(sourceTagsPath).catch(() => ({ version: 'kb_v1', source_tags: [] })));
  const citationRegistry = (await readJson<{ version: string; citations: Array<Record<string, unknown>> }>(citationRegistryPath).catch(() => ({ version: 'kb_v1', citations: [] })));

  const seenSourceIds = new Set<string>();

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(kbRoot, filePath).replace(/\\/g, '/');
    const fileStem = path.basename(filePath, path.extname(filePath));
    const text = await readFile(filePath, 'utf8');
    const { frontmatter, body } = parseFrontmatter(text);
    const sourceId = typeof frontmatter.source_id === 'string' && frontmatter.source_id.trim()
      ? frontmatter.source_id.trim()
      : fileStem;
    if (seenSourceIds.has(sourceId)) continue;
    seenSourceIds.add(sourceId);

    const sourceType = (frontmatter.source_type as SourceManifestEntry['source_type'] | undefined) ?? inferSourceTypeFromPath(filePath);
    const title = typeof frontmatter.title === 'string' && frontmatter.title.trim()
      ? frontmatter.title.trim()
      : titleCaseFromSlug(fileStem);
    const fileRefs = [relativePath];
    const sourceEntry: SourceManifestEntry = {
      source_id: sourceId,
      title,
      source_type: sourceType,
      authority_level: (frontmatter.authority_level as SourceManifestEntry['authority_level'] | undefined) ?? inferAuthorityLevel(sourceType),
      evidence_domain: (frontmatter.evidence_domain as SourceManifestEntry['evidence_domain'] | undefined) ?? inferEvidenceDomain(sourceType),
      year: typeof frontmatter.year === 'number' ? frontmatter.year : undefined,
      authors: Array.isArray(frontmatter.authors) ? frontmatter.authors.map((author) => String(author)) : undefined,
      citation: typeof frontmatter.citation === 'string' ? frontmatter.citation : undefined,
      url_or_path: typeof frontmatter.url_or_path === 'string' ? frontmatter.url_or_path : relativePath,
      file_refs: fileRefs,
      review_state: 'extracted',
      notes: typeof frontmatter.notes === 'string' ? frontmatter.notes : `Auto-indexed from ${relativePath}`
    };
    const compactSourceEntry = compactManifestEntry(sourceEntry);

    const claims = extractClaimsFromText(sourceId, body, frontmatter, fileStem);
    if (claims.length === 0) {
      upsertManifestEntry(manifest, compactSourceEntry);
      continue;
    }

    upsertManifestEntry(manifest, compactSourceEntry);
    const packageRecord: ClaimPackage = {
      source_id: sourceId,
      source_path: relativePath,
      source_metadata: frontmatter,
      claims
    };

    await writeJson(path.join(pendingDir, `${sourceId}.claims.json`), packageRecord);

    const tags = Array.from(
      new Set([
        ...claims.map((claim) => claim.claim_type),
        ...claims.flatMap((claim) => claim.clinical_actionability ? [claim.clinical_actionability] : []),
        sourceType
      ])
    );
    const existingTagIndex = sourceTags.source_tags.findIndex((entry) => entry.source_id === sourceId);
    if (existingTagIndex >= 0) {
      const mergedTags = new Set([...sourceTags.source_tags[existingTagIndex].tags, ...tags]);
      sourceTags.source_tags[existingTagIndex] = { source_id: sourceId, tags: Array.from(mergedTags).sort() };
    } else {
      sourceTags.source_tags.push({ source_id: sourceId, tags: tags.sort() });
    }

    const citationEntry = {
      source_id: sourceId,
      citation: sourceEntry.citation ?? `${sourceEntry.title} (${sourceEntry.year ?? 'n.d.'})`,
      title: sourceEntry.title,
      source_type: sourceEntry.source_type,
      year: sourceEntry.year,
      url_or_path: sourceEntry.url_or_path
    };
    const citationIndex = citationRegistry.citations.findIndex((entry) => entry.source_id === sourceId);
    if (citationIndex >= 0) {
      citationRegistry.citations[citationIndex] = citationEntry;
    } else {
      citationRegistry.citations.push(citationEntry);
    }
  }

  const schemaErrors = manifest.sources.flatMap((entry, index) =>
    validateSchemaSubset(sourceSchema, entry, `$.sources[${index}]`)
  );
  if (schemaErrors.length > 0) {
    throw new Error(`source manifest validation failed:\n${schemaErrors.map((issue) => `${issue.path}: ${issue.message}`).join('\n')}`);
  }

  await writeJson(sourceManifestPath, manifest);
  await writeJson(sourceTagsPath, { version: sourceTags.version ?? 'kb_v1', source_tags: sourceTags.source_tags });
  await writeJson(citationRegistryPath, { version: citationRegistry.version ?? 'kb_v1', citations: citationRegistry.citations });

  console.log(`Extracted claims for ${sourceFiles.length} source file(s)`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

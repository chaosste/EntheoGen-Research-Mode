import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SourceManifestEntry {
  source_id: string;
  title: string;
  source_type: 'academic_paper' | 'clinical_guideline' | 'expert_guideline' | 'expert_dataset' | 'ai_synthesis' | 'traditional_context' | 'pharmacology_reference' | 'legal_policy';
  authority_level: 'high' | 'medium' | 'contextual' | 'low';
  evidence_domain: 'clinical' | 'pharmacological' | 'aggregated_clinical' | 'ceremonial' | 'harm_reduction' | 'legal' | 'cultural';
  year?: number;
  authors?: string[];
  citation?: string;
  url_or_path: string;
  file_refs?: string[];
  review_state: 'unreviewed' | 'extracted' | 'validated' | 'rejected';
  notes?: string;
}

export interface ClaimRecord {
  claim_id: string;
  source_id: string;
  claim: string;
  claim_type: 'mechanism' | 'interaction' | 'risk' | 'contraindication' | 'guidance';
  entities: string[];
  mechanism?: string | string[];
  evidence_strength?: 'strong' | 'moderate' | 'weak' | 'theoretical';
  confidence?: 'high' | 'medium' | 'low';
  supports_pairs?: [string, string][];
  clinical_actionability?: 'none' | 'monitor' | 'caution' | 'avoid' | 'contraindicated';
  review_state: 'machine_extracted' | 'needs_verification' | 'human_reviewed' | 'rejected' | 'needs_revision';
  notes?: string;
  provenance?: {
    source_type?: 'ai_synthesis';
    requires_verification?: boolean;
    ingestion_method?: string;
    cited_sources?: Array<{
      title?: string;
      url?: string;
      doi?: string;
      authors?: string;
      year?: number | string;
      citation_text?: string;
    }>;
    [key: string]: unknown;
  };
  source_specific?: {
    original_medication_name?: string;
    normalized_medication_name?: string;
    severity_label?: string;
    other_information?: string;
    derivation?: string;
    original_row?: string;
    aliases?: string[];
    [key: string]: unknown;
  };
}

export interface ClaimPackage {
  source_id: string;
  source_path: string;
  source_metadata: Partial<SourceManifestEntry> & Record<string, unknown>;
  claims: ClaimRecord[];
}

export interface KnowledgeBasePaths {
  root: string;
  sourcesDir: string;
  indexesDir: string;
  extractedDir: string;
  pendingDir: string;
  reviewedDir: string;
  rejectedDir: string;
  sourceManifestPath: string;
  sourceTagsPath: string;
  citationRegistryPath: string;
  datasetPath: string;
  sourceSchemaPath: string;
  claimSchemaPath: string;
}

export const defaultKbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'knowledge-base');

export const getKnowledgeBasePaths = (): KnowledgeBasePaths => {
  const root = process.env.KB_ROOT ?? defaultKbRoot;
  return {
    root,
    sourcesDir: process.env.KB_SOURCES_DIR ?? path.join(root, 'sources'),
    indexesDir: process.env.KB_INDEXES_DIR ?? path.join(root, 'indexes'),
    extractedDir: process.env.KB_EXTRACTED_DIR ?? path.join(root, 'extracted'),
    pendingDir: process.env.KB_PENDING_DIR ?? path.join(root, 'extracted', 'claims', 'pending'),
    reviewedDir: process.env.KB_REVIEWED_DIR ?? path.join(root, 'extracted', 'claims', 'reviewed'),
    rejectedDir: process.env.KB_REJECTED_DIR ?? path.join(root, 'extracted', 'claims', 'rejected'),
    sourceManifestPath: process.env.KB_SOURCE_MANIFEST_PATH ?? path.join(root, 'indexes', 'source_manifest.json'),
    sourceTagsPath: process.env.KB_SOURCE_TAGS_PATH ?? path.join(root, 'indexes', 'source_tags.json'),
    citationRegistryPath: process.env.KB_CITATION_REGISTRY_PATH ?? path.join(root, 'indexes', 'citation_registry.json'),
    datasetPath: process.env.KB_DATASET_PATH ?? path.resolve(root, '..', 'src', 'data', 'interactionDatasetV2.json'),
    sourceSchemaPath: process.env.KB_SOURCE_SCHEMA_PATH ?? path.join(root, 'schemas', 'source.schema.json'),
    claimSchemaPath: process.env.KB_CLAIM_SCHEMA_PATH ?? path.join(root, 'schemas', 'claim.schema.json')
  };
};

export const ensureDir = async (dirPath: string): Promise<void> => {
  await mkdir(dirPath, { recursive: true });
};

export const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

export const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

export const walkFiles = async (root: string, extensions: string[]): Promise<string[]> => {
  const results: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      if (extensions.some((extension) => entry.name.toLowerCase().endsWith(extension))) {
        results.push(fullPath);
      }
    }
  };
  await visit(root);
  return results.sort();
};

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const titleCaseFromSlug = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

export const stableHash = (value: string, length = 8): string =>
  createHash('sha256').update(value).digest('hex').slice(0, length);

const parseScalar = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1);
  }
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (trimmed.includes(',') && !trimmed.includes(':')) {
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return trimmed;
};

export const parseFrontmatter = (text: string): { frontmatter: Record<string, unknown>; body: string } => {
  if (!text.startsWith('---')) {
    return { frontmatter: {}, body: text };
  }
  const endIndex = text.indexOf('\n---');
  if (endIndex === -1) {
    return { frontmatter: {}, body: text };
  }
  const frontmatterBlock = text.slice(3, endIndex).trim();
  const body = text.slice(endIndex + 4).replace(/^\n/, '');
  const frontmatter: Record<string, unknown> = {};
  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (!key) continue;
    frontmatter[key] = parseScalar(value);
  }
  return { frontmatter, body };
};

export const splitSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

export const inferSourceTypeFromPath = (filePath: string): SourceManifestEntry['source_type'] => {
  const normalized = filePath.toLowerCase();
  if (normalized.includes('/clinical-guidelines/')) return 'clinical_guideline';
  if (normalized.includes('/expert-guidelines/')) return 'expert_guideline';
  if (normalized.includes('/expert-datasets/')) return 'expert_dataset';
  if (path.basename(normalized).startsWith('perplexity_')) return 'ai_synthesis';
  if (normalized.includes('/traditional-contexts/')) return 'traditional_context';
  if (normalized.includes('/legal-policy/')) return 'legal_policy';
  if (normalized.includes('/pharmacology-reference/')) return 'pharmacology_reference';
  return 'academic_paper';
};

export const inferAuthorityLevel = (sourceType: SourceManifestEntry['source_type']): SourceManifestEntry['authority_level'] => {
  if (sourceType === 'clinical_guideline' || sourceType === 'pharmacology_reference') return 'high';
  if (sourceType === 'academic_paper' || sourceType === 'expert_guideline') return 'medium';
  if (sourceType === 'traditional_context') return 'contextual';
  return 'low';
};

export const inferEvidenceDomain = (sourceType: SourceManifestEntry['source_type']): SourceManifestEntry['evidence_domain'] => {
  if (sourceType === 'clinical_guideline') return 'clinical';
  if (sourceType === 'pharmacology_reference' || sourceType === 'academic_paper') return 'pharmacological';
  if (sourceType === 'expert_dataset') return 'aggregated_clinical';
  if (sourceType === 'ai_synthesis') return 'aggregated_clinical';
  if (sourceType === 'expert_guideline') return 'harm_reduction';
  if (sourceType === 'traditional_context') return 'cultural';
  if (sourceType === 'legal_policy') return 'legal';
  return 'clinical';
};

export const inferClinicalActionability = (sentence: string): ClaimRecord['clinical_actionability'] => {
  const normalized = sentence.toLowerCase();
  if (/(contraindicat|do not combine|avoid)/.test(normalized)) return 'contraindicated';
  if (/monitor|watch for/.test(normalized)) return 'monitor';
  if (/caution|careful/.test(normalized)) return 'caution';
  if (/avoid/.test(normalized)) return 'avoid';
  return 'none';
};

export const inferClaimType = (sentence: string): ClaimRecord['claim_type'] => {
  const normalized = sentence.toLowerCase();
  if (/contraindicat|avoid/.test(normalized)) return 'contraindication';
  if (/mechanism|because|due to|mediated by|through/.test(normalized)) return 'mechanism';
  if (/monitor|blood pressure|heart rate|sedation|hypotension|hypertension|risk/.test(normalized)) return 'risk';
  if (/guidance|recommend|use with|screen|watch for|monitor/.test(normalized)) return 'guidance';
  return 'interaction';
};

export const inferEvidenceStrength = (sentence: string): ClaimRecord['evidence_strength'] => {
  const normalized = sentence.toLowerCase();
  if (/mechanism|because|due to|plausible|theoretical/.test(normalized)) return 'theoretical';
  if (/direct trial|randomized|observed|case report|case series|guideline/.test(normalized)) return 'moderate';
  return 'weak';
};

export const extractClaimEntities = (
  metadata: Record<string, unknown>,
  fileStem: string,
  body: string
): string[] => {
  const explicitEntities = metadata.entities;
  if (Array.isArray(explicitEntities) && explicitEntities.length > 0) {
    return explicitEntities.map((entity) => String(entity)).filter(Boolean);
  }
  const title = typeof metadata.title === 'string' ? metadata.title : titleCaseFromSlug(fileStem);
  const pieces = new Set<string>([slugify(fileStem)]);
  for (const token of title.split(/\s+/)) {
    const cleaned = slugify(token);
    if (cleaned) pieces.add(cleaned);
  }
  const inferredFromBody = body
    .split(/\W+/)
    .map((token) => slugify(token))
    .filter((token) => token.length > 2);
  for (const token of inferredFromBody.slice(0, 8)) {
    pieces.add(token);
  }
  return Array.from(pieces).filter(Boolean);
};

export const parseSupportPairs = (value: unknown): [string, string][] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (Array.isArray(item) && item.length >= 2) {
          return [String(item[0]), String(item[1])] as [string, string];
        }
        if (typeof item === 'string' && item.includes('|')) {
          const [a, b] = item.split('|');
          return [a.trim(), b.trim()] as [string, string];
        }
        return null;
      })
      .filter((item): item is [string, string] => Boolean(item));
  }
  if (typeof value === 'string' && value.includes('|')) {
    const [a, b] = value.split('|');
    return [[a.trim(), b.trim()]];
  }
  return [];
};

export const canonicalPairKey = (a: string, b: string): string => [a, b].sort().join('|');

export type ValidationIssue = {
  path: string;
  message: string;
};

const schemaTypeMatches = (schemaType: string | string[] | undefined, value: unknown): boolean => {
  if (!schemaType) return true;
  const types = Array.isArray(schemaType) ? schemaType : [schemaType];
  return types.some((type) => {
    switch (type) {
      case 'object':
        return value !== null && typeof value === 'object' && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'string':
        return typeof value === 'string';
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'number':
        return typeof value === 'number' && Number.isFinite(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'null':
        return value === null;
      default:
        return true;
    }
  });
};

export const validateSchemaSubset = (
  schema: Record<string, unknown>,
  value: unknown,
  pathName = '$'
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const schemaType = schema.type as string | string[] | undefined;
  if (!schemaTypeMatches(schemaType, value)) {
    issues.push({ path: pathName, message: `expected ${Array.isArray(schemaType) ? schemaType.join('|') : schemaType}` });
    return issues;
  }

  if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(value as never)) {
    issues.push({ path: pathName, message: `value not in enum` });
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      issues.push({ path: pathName, message: `string shorter than minLength ${schema.minLength}` });
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      issues.push({ path: pathName, message: `array shorter than minItems ${schema.minItems}` });
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      issues.push({ path: pathName, message: `array longer than maxItems ${schema.maxItems}` });
    }
    if (schema.items && typeof schema.items === 'object') {
      for (const [index, item] of value.entries()) {
        issues.push(...validateSchemaSubset(schema.items as Record<string, unknown>, item, `${pathName}[${index}]`));
      }
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    for (const requiredKey of required) {
      if (!(requiredKey in objectValue)) {
        issues.push({ path: pathName, message: `missing required property ${requiredKey}` });
      }
    }

    const properties = (schema.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in objectValue) {
        issues.push(...validateSchemaSubset(propSchema, objectValue[key], `${pathName}.${key}`));
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!(key in properties)) {
          issues.push({ path: `${pathName}.${key}`, message: 'additional property not allowed' });
        }
      }
    }
  }

  return issues;
};

export const loadSchema = async (schemaPath: string): Promise<Record<string, unknown>> => readJson(schemaPath);

export const sourceManifestToDatasetSourceType = (
  sourceType: SourceManifestEntry['source_type']
): 'primary_source' | 'secondary_source' | 'field_guidance' | 'internal_research_update' | 'ai_synthesis' | 'generated_placeholder' | 'none' => {
  if (sourceType === 'clinical_guideline' || sourceType === 'expert_guideline') return 'field_guidance';
  if (sourceType === 'expert_dataset') return 'secondary_source';
  if (sourceType === 'ai_synthesis') return 'ai_synthesis';
  if (sourceType === 'traditional_context') return 'secondary_source';
  if (sourceType === 'legal_policy') return 'secondary_source';
  if (sourceType === 'academic_paper' || sourceType === 'pharmacology_reference') return 'primary_source';
  return 'secondary_source';
};

export const sourceStrengthRank = (strength?: 'strong' | 'moderate' | 'weak' | 'theoretical' | 'none'): number => {
  switch (strength) {
    case 'strong':
      return 4;
    case 'moderate':
      return 3;
    case 'weak':
      return 2;
    case 'theoretical':
      return 1;
    default:
      return 0;
  }
};

export const readTextIfExists = async (filePath: string): Promise<string | null> => {
  try {
    const text = await readFile(filePath, 'utf8');
    return text;
  } catch {
    return null;
  }
};

export const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};
export function buildPerplexityCitationKey(input: {
  title?: string;
  url?: string;
  doi?: string;
  year?: string | number;
}): string {
  const base =
    input.doi ||
    input.url ||
    [input.title, input.year].filter(Boolean).join(" ");

  return String(base || "unknown_citation")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}
import citationRegistryRaw from '../../knowledge-base/indexes/citation_registry.json';
import sourceManifestRaw from '../../knowledge-base/indexes/source_manifest.json';

type CitationEntry = {
  source_id: string;
  citation?: string;
  title?: string;
  year?: number;
  authors?: string[];
};

type CitationRegistry = {
  citations?: CitationEntry[];
};

type SourceManifest = {
  sources?: CitationEntry[];
};

const PLACEHOLDER_SOURCE_IDS = new Set(['beta_dataset', 'source_gap', 'not_available', 'none']);

const KNOWN_INLINE_CITATIONS: Record<string, string> = {
  alma_2026: '(Alma Healing Centre, 2026)',
  malcolm_2023: '(Malcolm, 2023)',
  Gilman_2023: '(Gillman, 2005)',
  halman_2024: '(Halman et al., 2024)',
  entheogen_2026: '(EntheoGen, 2026)',
  ruffell_2023: '(Ruffell et al., 2023)',
  schmid_2025: '(Schmid et al., 2015)'
};

const registryEntries = ((citationRegistryRaw as CitationRegistry).citations ?? []);
const manifestEntries = ((sourceManifestRaw as SourceManifest).sources ?? []);

const sourceById = new Map<string, CitationEntry>();
for (const entry of [...registryEntries, ...manifestEntries]) {
  sourceById.set(entry.source_id, { ...sourceById.get(entry.source_id), ...entry });
}

const unique = (values: string[]): string[] => [...new Set(values)];

export const isStableSourceId = (sourceId: string): boolean => {
  const normalized = sourceId.trim();
  return normalized.length > 0 && !PLACEHOLDER_SOURCE_IDS.has(normalized);
};

export const normalizeSourceIds = (sourceRefs: unknown): string[] => {
  if (!Array.isArray(sourceRefs)) return [];

  return unique(
    sourceRefs
      .map((ref) => {
        if (typeof ref === 'string') return ref.trim();
        if (ref && typeof ref === 'object' && 'source_id' in ref) {
          const sourceId = (ref as { source_id?: unknown }).source_id;
          return typeof sourceId === 'string' ? sourceId.trim() : '';
        }
        return '';
      })
      .filter(isStableSourceId)
  );
};

const extractYear = (entry?: CitationEntry): number | undefined => {
  if (entry?.year) return entry.year;
  const text = `${entry?.citation ?? ''} ${entry?.title ?? ''} ${entry?.source_id ?? ''}`;
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
};

const surnameFromText = (text: string): string => {
  const cleaned = text
    .replace(/[_-]+/g, ' ')
    .replace(/\bet al\b.*$/i, '')
    .trim();
  const [firstToken] = cleaned.split(/\s+/);
  return firstToken ? firstToken.replace(/[^A-Za-z]/g, '') : 'Source';
};

const authorLabel = (entry: CitationEntry | undefined, sourceId: string): string => {
  const authors = entry?.authors?.filter(Boolean) ?? [];
  if (authors.length === 1) return surnameFromText(authors[0]);
  if (authors.length === 2) return `${surnameFromText(authors[0])} & ${surnameFromText(authors[1])}`;
  if (authors.length > 2) return `${surnameFromText(authors[0])} et al.`;

  const text = entry?.citation ?? entry?.title ?? sourceId;
  if (/\bet al\b/i.test(text)) return `${surnameFromText(text)} et al.`;
  return surnameFromText(text);
};

export const formatInlineCitation = (sourceId: string): string => {
  if (KNOWN_INLINE_CITATIONS[sourceId]) return KNOWN_INLINE_CITATIONS[sourceId];

  const entry = sourceById.get(sourceId);
  const year = extractYear(entry);
  const author = authorLabel(entry, sourceId);
  return year ? `(${author}, ${year})` : `(${author}, n.d.)`;
};

export const formatInlineCitations = (sourceIds: string[]): string[] =>
  unique(sourceIds.map(formatInlineCitation));

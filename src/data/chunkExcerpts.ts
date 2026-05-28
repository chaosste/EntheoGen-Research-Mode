import { formatInlineCitation } from './sourceCitations';

export type ChunkExcerptRecord = {
  source_id: string;
  source_title: string;
  year?: number;
  authors?: string[];
  excerpt: string;
};

export type ChunkExcerptIndex = Record<string, ChunkExcerptRecord>;

export type ResolvedChunkExcerpt = {
  chunkId: string;
  citationLabel: string;
  excerpt: string;
};

const sanitizeExcerpt = (text: string, maxLen = 400): string => {
  let normalized = text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\*\*==> picture[\s\S]*?<==\*\*/g, '')
    .replace(/\*\*----- Start of picture text -----[\s\S]*?----- End of picture text -----\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length > maxLen) {
    normalized = `${normalized.slice(0, maxLen - 1)}…`;
  }
  return normalized;
};

export const buildChunkExcerptRecord = (chunk: {
  chunk_id: string;
  source_id: string;
  source_title: string;
  year?: number;
  authors?: string[];
  chunk_text: string;
}): ChunkExcerptRecord => ({
  source_id: chunk.source_id,
  source_title: chunk.source_title,
  year: chunk.year,
  authors: chunk.authors,
  excerpt: sanitizeExcerpt(chunk.chunk_text)
});

export const resolveChunkExcerpts = (
  chunkIds: string[],
  index: ChunkExcerptIndex
): ResolvedChunkExcerpt[] =>
  chunkIds
    .map((chunkId) => {
      const record = index[chunkId];
      if (!record?.excerpt) return null;
      return {
        chunkId,
        citationLabel: formatInlineCitation(record.source_id),
        excerpt: record.excerpt
      };
    })
    .filter((entry): entry is ResolvedChunkExcerpt => entry !== null);

export const formatEvidenceExcerptsMarkdown = (options: {
  exactChunkIds: string[];
  classLevelChunkIds: string[];
  index: ChunkExcerptIndex;
  classLevelSampleSize?: number;
}): string | null => {
  const { exactChunkIds, classLevelChunkIds, index, classLevelSampleSize = 3 } = options;
  const exactExcerpts = resolveChunkExcerpts(exactChunkIds, index);
  const classLevelExcerpts = resolveChunkExcerpts(classLevelChunkIds, index).slice(0, classLevelSampleSize);

  if (exactExcerpts.length === 0 && classLevelExcerpts.length === 0) {
    return null;
  }

  const lines: string[] = ['#### Supporting source excerpts'];

  if (exactExcerpts.length > 0) {
    lines.push(`**Pair-specific (${exactExcerpts.length}):**`);
    for (const excerpt of exactExcerpts) {
      lines.push(`- ${excerpt.citationLabel} ${excerpt.excerpt}`);
    }
  }

  if (classLevelExcerpts.length > 0) {
    const totalClassLevel = classLevelChunkIds.length;
    const sampleLabel = totalClassLevel > classLevelExcerpts.length
      ? ` (sample ${classLevelExcerpts.length} of ${totalClassLevel})`
      : '';
    lines.push(`**Class-level mechanism context${sampleLabel}:**`);
    for (const excerpt of classLevelExcerpts) {
      lines.push(`- ${excerpt.citationLabel} ${excerpt.excerpt}`);
    }
  }

  if (exactExcerpts.length > 0 && classLevelExcerpts.length > 0) {
    lines.push(
      '**Evidence linkage note:** The contraindication headline is curated; linked literature primarily supports mechanism/context. Pair-specific excerpts may not state the full clinical posture on their own.'
    );
  } else if (exactExcerpts.length === 0 && classLevelExcerpts.length > 0) {
    lines.push(
      '**Evidence linkage note:** Linked chunks provide class-level mechanism/context rather than a direct pair-specific contraindication statement.'
    );
  }

  return lines.join('\n');
};

export type RuleOrigin = 'self' | 'explicit' | 'fallback' | 'unknown';

export type InteractionCode =
  | 'LOW'
  | 'LOW_MOD'
  | 'CAU'
  | 'UNS'
  | 'DAN'
  | 'UNK'
  | 'SELF'
  | 'INFERRED'
  | 'THEORETICAL'
  | 'DETERMINISTIC';

export interface InteractionPair {
  substance_a_id: string;
  substance_b_id: string;
  pair_key: string;
  origin: RuleOrigin;
  interaction_code: InteractionCode;
  interaction_label: string;
  risk_scale: number;
  summary: string;
  confidence: string;
  mechanism: string | null;
  mechanism_category: string;
  timing: string | null;
  evidence_gaps: string | null;
  evidence_tier: string | null;
  field_notes: string | null;
  sources: string;
  source_refs: string[];
  source_titles?: string[];
  chunk_refs?: string[];
  source_fingerprint: string;
}

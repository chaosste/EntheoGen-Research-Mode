-- Phase 2: bootstrap normalized V2 storage model while preserving legacy access.

create table if not exists public.sources_v2 (
  id text primary key,
  title text not null,
  source_type text not null,
  reliability text not null default 'unknown',
  fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_v2_source_type_chk check (
    source_type in (
      'primary_source',
      'secondary_source',
      'field_guidance',
      'internal_research_update',
      'ai_synthesis',
      'generated_placeholder',
      'none'
    )
  ),
  constraint sources_v2_reliability_chk check (reliability = 'unknown')
);

create table if not exists public.interaction_pairs_v2 (
  pair_key text primary key,
  substance_a_id text not null references public.substances(id),
  substance_b_id text not null references public.substances(id),
  is_self_pair boolean not null default false,
  classification_code text not null,
  classification_status text not null,
  classification_confidence text not null,
  risk_score numeric,
  risk_label text,
  risk_assessment_level text,
  risk_assessment_rationale text,
  headline text not null,
  mechanism_summary text,
  timing_guidance text,
  field_notes text,
  primary_mechanism_category text not null,
  mechanism_categories text[] not null default '{}',
  source_text text,
  source_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interaction_pairs_v2_key_canonical_chk
    check (pair_key = least(substance_a_id, substance_b_id) || '|' || greatest(substance_a_id, substance_b_id)),
  constraint interaction_pairs_v2_self_flag_chk
    check (is_self_pair = (substance_a_id = substance_b_id)),
  constraint interaction_pairs_v2_classification_code_chk
    check (
      classification_code in (
        'SELF', 'UNKNOWN', 'INFERRED', 'THEORETICAL', 'DETERMINISTIC',
        'LOW', 'LOW_MOD', 'CAUTION', 'UNSAFE', 'DANGEROUS'
      )
    ),
  constraint interaction_pairs_v2_classification_status_chk
    check (
      classification_status in (
        'confirmed', 'inferred', 'low_confidence', 'missing_evidence', 'unknown', 'not_applicable'
      )
    ),
  constraint interaction_pairs_v2_classification_confidence_chk
    check (
      classification_confidence in ('high', 'medium', 'low', 'none', 'not_applicable')
    )
);

create index if not exists interaction_pairs_v2_substance_a_idx on public.interaction_pairs_v2 (substance_a_id);
create index if not exists interaction_pairs_v2_substance_b_idx on public.interaction_pairs_v2 (substance_b_id);
create index if not exists interaction_pairs_v2_code_risk_idx on public.interaction_pairs_v2 (classification_code, risk_score);
create index if not exists interaction_pairs_v2_mechanism_categories_gin_idx on public.interaction_pairs_v2 using gin (mechanism_categories);

create table if not exists public.interaction_evidence_v2 (
  pair_key text primary key references public.interaction_pairs_v2(pair_key) on delete cascade,
  tier text not null,
  support_type text not null,
  evidence_strength text,
  status text,
  review_state text,
  review_notes text,
  evidence_gaps text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interaction_evidence_v2_tier_chk
    check (
      tier in (
        'direct_human_data',
        'clinical_guideline',
        'case_report_or_series',
        'observational_report',
        'mechanistic_inference',
        'theoretical',
        'low',
        'field_consensus',
        'traditional_use_precedent',
        'source_gap',
        'not_applicable'
      )
    ),
  constraint interaction_evidence_v2_support_type_chk
    check (
      support_type in (
        'direct',
        'indirect',
        'mechanistic',
        'field_observation',
        'traditional_context',
        'extrapolated',
        'direct_literature',
        'class_level_literature',
        'mechanistic_literature',
        'adjacent_domain_literature',
        'provisional_gap_fill',
        'ai_synthesis',
        'none'
      )
    ),
  constraint interaction_evidence_v2_status_chk
    check (
      status is null or status in (
        'not_reviewed',
        'no_data',
        'limited_data',
        'conflicting_evidence',
        'mechanistic_inference',
        'supported',
        'provisional_secondary'
      )
    ),
  constraint interaction_evidence_v2_review_state_chk
    check (
      review_state is null or review_state in (
        'unreviewed',
        'machine_inferred',
        'human_reviewed',
        'requires_review',
        'needs_verification'
      )
    ),
  constraint interaction_evidence_v2_strength_chk
    check (
      evidence_strength is null or evidence_strength in ('strong', 'moderate', 'weak', 'theoretical', 'none')
    )
);

create table if not exists public.interaction_source_refs_v2 (
  id bigserial primary key,
  pair_key text not null references public.interaction_pairs_v2(pair_key) on delete cascade,
  source_id text not null references public.sources_v2(id),
  claim_id text,
  title text,
  authors text[],
  year integer,
  source_type text,
  match_type text,
  relevance_score numeric,
  evidence_strength text,
  confidence text,
  review_state text,
  requires_verification boolean,
  notes text,
  claim_excerpt text,
  support_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interaction_source_refs_v2_pair_idx on public.interaction_source_refs_v2 (pair_key);
create index if not exists interaction_source_refs_v2_source_idx on public.interaction_source_refs_v2 (source_id);

create table if not exists public.interaction_provenance_v2 (
  pair_key text primary key references public.interaction_pairs_v2(pair_key) on delete cascade,
  derivation_type text not null,
  source text,
  confidence_tier text,
  method text,
  source_linking_method text,
  source_linking_confidence text,
  requires_verification boolean,
  rationale text,
  parent_node text,
  parent_nodes text[],
  deprecated boolean,
  origin_value_v1 text,
  migrated_from_v1 boolean not null default true,
  migration_version text not null default 'v1_to_v2',
  migrated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interaction_provenance_v2_derivation_chk
    check (
      derivation_type in (
        'explicit_source',
        'curated_inference',
        'decomposition',
        'fallback_rule',
        'generated_unknown',
        'self_pair'
      )
    ),
  constraint interaction_provenance_v2_source_chk
    check (
      source is null or source in (
        'deterministic_mapping_table',
        'heuristic_fallback',
        'self_pair',
        'decomposition',
        'mechanistic_inference',
        'provisional_gap_fill'
      )
    ),
  constraint interaction_provenance_v2_confidence_tier_chk
    check (confidence_tier is null or confidence_tier in ('high', 'medium', 'low')),
  constraint interaction_provenance_v2_source_linking_confidence_chk
    check (source_linking_confidence is null or source_linking_confidence in ('high', 'medium', 'low'))
);

create table if not exists public.interaction_override_metadata_v2 (
  pair_key text primary key references public.interaction_pairs_v2(pair_key) on delete cascade,
  applied boolean not null default false,
  override_id text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interaction_audit_v2 (
  pair_key text primary key references public.interaction_pairs_v2(pair_key) on delete cascade,
  review_status text not null,
  validation_notes text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interaction_audit_v2_review_status_chk
    check (review_status in ('human_reviewed', 'needs_review'))
);

create table if not exists public.interaction_validation_flags_v2 (
  pair_key text not null references public.interaction_pairs_v2(pair_key) on delete cascade,
  severity text not null,
  flag text not null,
  created_at timestamptz not null default now(),
  primary key (pair_key, severity, flag),
  constraint interaction_validation_flags_v2_severity_chk
    check (severity in ('critical', 'warning', 'info'))
);

-- Compatibility views
create or replace view public.substances_legacy_vw as
select
  s.id,
  s.name,
  s.class,
  s.mechanism_tag,
  s.notes,
  s.deprecated,
  s.superseded_by,
  s.source_schema_version,
  s.source_generated_at
from public.substances s;

create or replace view public.interactions_legacy_vw as
select
  ip.pair_key,
  ip.substance_a_id,
  ip.substance_b_id,
  ip.is_self_pair,
  ip.classification_code,
  ip.classification_confidence,
  ip.risk_score,
  ip.risk_label,
  ip.headline,
  ip.mechanism_summary,
  ip.timing_guidance,
  ip.field_notes,
  ip.primary_mechanism_category,
  to_jsonb(coalesce(ip.mechanism_categories, array[]::text[])) as mechanism_categories,
  ev.evidence_gaps,
  prov.confidence_tier as provenance_confidence_tier,
  prov.rationale as provenance_rationale
from public.interaction_pairs_v2 ip
left join public.interaction_evidence_v2 ev on ev.pair_key = ip.pair_key
left join public.interaction_provenance_v2 prov on prov.pair_key = ip.pair_key;

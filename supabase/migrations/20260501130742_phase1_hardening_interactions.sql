-- Phase 1: harden current flattened schema without breaking callers.

-- Canonical pair_key must match sorted substance ids.
alter table public.interactions
  add constraint interactions_pair_key_canonical_chk
  check (pair_key = least(substance_a_id, substance_b_id) || '|' || greatest(substance_a_id, substance_b_id))
  not valid;

-- is_self_pair must match whether both ids are the same.
alter table public.interactions
  add constraint interactions_self_flag_consistency_chk
  check (is_self_pair = (substance_a_id = substance_b_id))
  not valid;

-- Self pairs must carry SELF code.
alter table public.interactions
  add constraint interactions_self_code_chk
  check ((not is_self_pair) or classification_code = 'SELF')
  not valid;

-- mechanism_categories is expected to be a JSON array.
alter table public.interactions
  add constraint interactions_mechanism_categories_array_chk
  check (jsonb_typeof(mechanism_categories) = 'array')
  not valid;

-- Optional enum-like hardening.
alter table public.interactions
  add constraint interactions_classification_code_domain_chk
  check (
    classification_code is null
    or classification_code in (
      'SELF', 'UNKNOWN', 'INFERRED', 'THEORETICAL', 'DETERMINISTIC',
      'LOW', 'LOW_MOD', 'CAUTION', 'UNSAFE', 'DANGEROUS'
    )
  )
  not valid;

alter table public.interactions
  add constraint interactions_classification_confidence_domain_chk
  check (
    classification_confidence is null
    or classification_confidence in ('high', 'medium', 'low', 'none', 'not_applicable')
  )
  not valid;

alter table public.interactions
  add constraint interactions_provenance_confidence_tier_domain_chk
  check (
    provenance_confidence_tier is null
    or provenance_confidence_tier in ('high', 'medium', 'low')
  )
  not valid;

-- Query-performance indexes for common lookups.
create index if not exists interactions_substance_a_idx
  on public.interactions (substance_a_id);

create index if not exists interactions_substance_b_idx
  on public.interactions (substance_b_id);

create index if not exists interactions_classification_risk_idx
  on public.interactions (classification_code, risk_score);

create index if not exists interactions_mechanism_categories_gin_idx
  on public.interactions using gin (mechanism_categories);

-- Validate once constraints are installed.
alter table public.interactions validate constraint interactions_pair_key_canonical_chk;
alter table public.interactions validate constraint interactions_self_flag_consistency_chk;
alter table public.interactions validate constraint interactions_self_code_chk;
alter table public.interactions validate constraint interactions_mechanism_categories_array_chk;
alter table public.interactions validate constraint interactions_classification_code_domain_chk;
alter table public.interactions validate constraint interactions_classification_confidence_domain_chk;
alter table public.interactions validate constraint interactions_provenance_confidence_tier_domain_chk;

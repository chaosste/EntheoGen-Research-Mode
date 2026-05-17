-- Human-friendly duplicate (paste in dashboard): docs/metabase/supabase-install-interactions-enriched-view.sql
-- Keep this migration and that file identical (except comments at top).
--
-- Postgres 42P16: CREATE OR REPLACE VIEW cannot change column names/order vs an
-- existing view. Drop dependents first, then recreate.
drop view if exists public.interactions_enriched_current cascade;
drop view if exists public.interactions_enriched cascade;

-- Canonical analytics view: public.interactions_enriched
-- Definition must stay aligned with docs/metabase/interactions_enriched.sql
-- (Metabase paste + Supabase Table Editor).

create view public.interactions_enriched
with (security_invoker = true) as
select
  enriched.*,
  enriched.risk_severity_bucket as risk_bucket
from (
  select
    i.pair_key,
    i.substance_a_id,
    i.substance_b_id,
    least(i.substance_a_id, i.substance_b_id) as substance_1_id,
    greatest(i.substance_a_id, i.substance_b_id) as substance_2_id,
    s_low.name as substance_1_name,
    s_high.name as substance_2_name,
    s_low.class as substance_1_class,
    s_high.class as substance_2_class,
    not coalesce(i.is_self_pair, false) as is_comparable_pair,
    i.classification_code,
    i.classification_confidence,
    case lower(coalesce(i.classification_confidence, ''))
      when 'high' then 'high'
      when 'medium' then 'medium'
      when 'low' then 'low'
      when 'none' then 'none'
      when 'not_applicable' then 'not_applicable'
      else 'unknown'
    end as confidence_bucket,
    i.risk_score,
    i.risk_label,
    case
      when i.is_self_pair then 'self_pair'
      when i.risk_score is null then 'unknown'
      when i.risk_score >= 5 then 'critical'
      when i.risk_score >= 4 then 'high'
      when i.risk_score >= 3 then 'moderate'
      else 'low'
    end as risk_severity_bucket,
    case
      when i.is_self_pair then 'Same substance (not a pair)'
      when i.risk_score is null then 'N/A'
      else trim(to_char(i.risk_score, 'FM999999990.009'))
    end as risk_score_display,
    case
      when i.is_self_pair then coalesce(s_low.name, i.substance_a_id) || ' (self)'
      else coalesce(s_low.name, '') || ' and ' || coalesce(s_high.name, '')
    end as pair_label_natural,
    i.headline,
    i.mechanism_summary,
    i.timing_guidance,
    i.field_notes,
    i.primary_mechanism_category,
    i.mechanism_categories,
    coalesce(jsonb_array_length(i.mechanism_categories), 0) as mechanism_category_count,
    (coalesce(jsonb_array_length(i.mechanism_categories), 0) > 1) as is_multi_mechanism,
    i.evidence_gaps,
    i.provenance_confidence_tier,
    i.provenance_rationale
  from public.interactions i
  join public.substances s_low
    on s_low.id = least(i.substance_a_id, i.substance_b_id)
  join public.substances s_high
    on s_high.id = greatest(i.substance_a_id, i.substance_b_id)
  where not s_low.deprecated
    and not s_high.deprecated
    and i.pair_key = concat_ws(
      '|',
      least(i.substance_a_id, i.substance_b_id),
      greatest(i.substance_a_id, i.substance_b_id)
    )
) enriched;

comment on view public.interactions_enriched is
  'Phase 1 pair analytics (normalized LEAST/GREATEST, pair_key hygiene, risk buckets). Mirror docs/metabase/interactions_enriched.sql.';

-- Legacy name used in older dashboards / Table Editor: same rows as canonical view.
create view public.interactions_enriched_current
with (security_invoker = true) as
select * from public.interactions_enriched;

comment on view public.interactions_enriched_current is
  'Alias of public.interactions_enriched for backward compatibility; prefer interactions_enriched.';

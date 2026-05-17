-- Metabase model: class_interaction_matrix (Phase 1 Supabase)
--
-- Depends on the corrected core model:
--   public.interactions_enriched
--
-- Semantics:
--   - Starts from interactions_enriched so substance class values come from
--     LEAST/GREATEST-normalized pair ids, not raw substance_a/substance_b order.
--   - Excludes self-pairs by default via is_comparable_pair.
--   - Canonicalizes class pairs for order-independent class-to-class analysis.
--   - Use matrix_row_class and matrix_column_class as heatmap axes.
--
-- Paste into Metabase -> Native query -> model name class_interaction_matrix
-- Or: CREATE OR REPLACE VIEW public.class_interaction_matrix AS <this select>

with normalized_class_pairs as (
  select
    coalesce(nullif(trim(substance_1_class), ''), 'Unclassified') as normalized_substance_1_class,
    coalesce(nullif(trim(substance_2_class), ''), 'Unclassified') as normalized_substance_2_class,
    risk_score,
    risk_severity_bucket,
    confidence_bucket
  from public.interactions_enriched
  where is_comparable_pair
),
canonical_class_pairs as (
  select
    least(normalized_substance_1_class, normalized_substance_2_class) as matrix_row_class,
    greatest(normalized_substance_1_class, normalized_substance_2_class) as matrix_column_class,
    risk_score,
    risk_severity_bucket,
    confidence_bucket
  from normalized_class_pairs
)
select
  concat_ws('|', matrix_row_class, matrix_column_class) as class_pair_key,
  matrix_row_class,
  matrix_column_class,
  (matrix_row_class = matrix_column_class) as is_same_class_pair,
  count(*) as interaction_pair_count,
  count(*) filter (where risk_score is not null) as scored_pair_count,
  count(*) filter (where risk_score is null) as unknown_risk_pair_count,
  round(avg(risk_score) filter (where risk_score is not null), 2) as avg_risk_score,
  min(risk_score) filter (where risk_score is not null) as min_risk_score,
  max(risk_score) filter (where risk_score is not null) as max_risk_score,
  count(*) filter (where risk_severity_bucket = 'critical') as critical_pair_count,
  count(*) filter (where risk_severity_bucket = 'high') as high_pair_count,
  count(*) filter (where risk_severity_bucket = 'moderate') as moderate_pair_count,
  count(*) filter (where risk_severity_bucket = 'low') as low_pair_count,
  count(*) filter (
    where risk_severity_bucket in ('critical', 'high')
  ) as high_or_critical_pair_count,
  round(
    (
      count(*) filter (where risk_severity_bucket in ('critical', 'high'))
    )::numeric / nullif(count(*), 0),
    4
  ) as high_or_critical_pair_share,
  count(*) filter (where confidence_bucket = 'high') as high_confidence_pair_count,
  count(*) filter (where confidence_bucket = 'medium') as medium_confidence_pair_count,
  count(*) filter (where confidence_bucket = 'low') as low_confidence_pair_count
from canonical_class_pairs
group by
  matrix_row_class,
  matrix_column_class
order by
  matrix_row_class,
  matrix_column_class;

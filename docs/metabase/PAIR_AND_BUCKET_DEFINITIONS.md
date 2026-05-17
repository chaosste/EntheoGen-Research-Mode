# Pair normalization and bucket definitions (NEW-88)

This document **confirms** how [interactions_enriched.sql](./interactions_enriched.sql) implements the working assumptions for **Phase 1** analytics. Column names can differ from older exports; behavior below is what matters.

## Pair normalization

| Decision | Implementation |
|----------|------------------|
| Canonical pair identity | **`pair_key`** must equal `least(a,b) \|\| '\|' \|\| greatest(a,b)` (text ids). Rows failing the check are **excluded** from the model (bad data hygiene). |
| Undirected analytics | **`substance_1_id` / `substance_2_id`** and joined **`substance_1_*` / `substance_2_*`** use **`LEAST` / `GREATEST`** so labels always attach to sorted ids (matches DB constraint intent). |
| Raw storage order | **`substance_a_id` / `substance_b_id`** kept as in `public.interactions` for traceability. |
| Self-pairs in dashboards | Rows **remain** in the model. Use **`is_comparable_pair = true`** as the default filter on pair charts so self rows do not skew “combination” analytics. |

## Risk score and buckets

| Decision | Implementation |
|----------|------------------|
| Scale | **`risk_score`** is **numeric**, **integer-like 1–5** in normal pairs; **null** when unknown; **self-pairs** may carry **-1** but are bucketed as **`self_pair`** first. **Not** a 0–1 probability scale. |
| Buckets | **`risk_severity_bucket`** (and alias **`risk_bucket`**): `self_pair` → `unknown` (null score) → `critical` (≥5) → `high` (≥4) → `moderate` (≥3) → **`low`** (everything else, including 1–2). |
| Charts | Prefer a **1–5** numeric axis using **`risk_score`** where not null; use **`risk_severity_bucket`** for discrete colour / breakdown. |
| Null / N/A for humans | **`risk_score_display`** is text: **`N/A`** when score is null (and not self), a short self explanation when self-pair, otherwise a trimmed numeric string for labels. |

## Classification confidence

| Decision | Implementation |
|----------|------------------|
| Type | **`classification_confidence`** is **TEXT** (`high`, `medium`, `low`, `none`, `not_applicable`). |
| Bucket column | **`confidence_bucket`** maps those tiers (plus **`unknown`** for empty / unexpected). **No** numeric rounding on confidence. |

## Natural language helpers

| Field | Use |
|-------|-----|
| **`pair_label_natural`** | “A and B” (or “Name (self)” for self-pairs) for chart titles and tooltips without rebuilding strings in Metabase. |

## Mechanisms

| Decision | Implementation |
|----------|------------------|
| Storage | **`mechanism_categories`** is **JSONB array**. |
| Multi-label | **`mechanism_category_count`**, **`is_multi_mechanism`**; for exploded analytics use **`jsonb_array_elements_text(mechanism_categories)`** in native SQL questions. |

## Deprecated substances

Rows where either side’s substance is **`deprecated`** are **excluded** from this model (same as before).

---

**Sign-off:** When `public.interactions` satisfies the canonical `pair_key` constraint and row counts look right after deploy, treat this definition as **stable for Phase 1** unless the numeric risk scale or confidence domain changes in Postgres.

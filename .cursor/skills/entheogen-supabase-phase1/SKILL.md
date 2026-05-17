---
name: entheogen-supabase-phase1
description: >-
  EntheoGen Supabase Phase 1 (public.interactions, public.substances), CSV export
  pipeline, Metabase model SQL interactions_enriched, analytics semantics
  (risk_score, pair_key, LEAST/GREATEST), and emit-bundle. Use for Phase 1 DB
  questions, Metabase/view definitions, staging swap runbooks, and dataset CSV
  alignment after live edits.
---

# EntheoGen — Supabase Phase 1 & Metabase

Use this skill for **this repo’s** Phase 1 Postgres surface, **workspace CSV ↔ DB** automation, and the **Metabase / analytics** model—not generic Supabase tutorials.

Longer runbooks and UI steps live in:

- [docs/automation/SUPABASE_PHASE1_CSV_PIPELINE.md](../../../docs/automation/SUPABASE_PHASE1_CSV_PIPELINE.md)
- [docs/metabase/README.md](../../../docs/metabase/README.md)

Repo-wide product rules and verification commands: [AGENTS.md](../../../AGENTS.md).

## Canonical `interactions_enriched` (single source)

- **One maintained definition:** [docs/metabase/interactions_enriched.sql](../../../docs/metabase/interactions_enriched.sql). There is **no** separate `interactions_enriched_v2.sql` in this repo; older “v2” semantics (pair hygiene, `is_comparable_pair`, severity buckets) live in **this file only**.
- **Supabase:** paste **`docs/metabase/supabase-install-interactions-enriched-view.sql`** in the SQL Editor (human-friendly name); or `CREATE OR REPLACE VIEW public.interactions_enriched AS` with the **same body** as `docs/metabase/interactions_enriched.sql`. The `supabase/migrations/*_public_interactions_enriched_view.sql` file mirrors the install script for CLI pushes—keep them in sync.
- **Metabase:** New → SQL query → paste that file → save as a **model** named **`interactions_enriched`** (or point questions at the view).
- **When the repo SQL changes:** refresh the Supabase view (if used) and re-paste or sync the Metabase model so saved questions do not drift.

## Semantics agents must not confuse

- **`risk_score`:** Phase 1 uses **numeric, typically integer-like 1–5**, plus nulls and **self-pair** cases (e.g. **-1**). **Do not** treat as 0–1 probability or use fractional thresholds from legacy drafts.
- **`classification_confidence`:** **text** (`high` / `medium` / `low` / `none` / `not_applicable`), not a numeric score. The model maps it to **`confidence_bucket`**.
- **`risk_severity_bucket`:** `critical` | `high` | `moderate` | `low` | `unknown` | `self_pair` from integer cutpoints on `risk_score` and `is_self_pair`.
- **`risk_bucket`:** **Same values as `risk_severity_bucket`** (column alias for legacy Metabase/saved questions). Prefer **`risk_severity_bucket`** for new charts.
- **`pair_key`:** Rows are **excluded** unless `pair_key` equals `concat_ws('|', least(a,b), greatest(a,b))` (data hygiene).
- **Undirected analytics:** **`substance_1_*` / `substance_2_*`** come from **`LEAST` / `GREATEST`** on `substance_a_id` / `substance_b_id`, not raw row order. Join substance labels to those ids for charts.
- **`is_comparable_pair`:** `true` when **not** a self-pair. For **pair-only** dashboards, use a **default filter** `is_comparable_pair = true`; self rows remain in the result set for reference.
- **`mechanism_categories`:** **jsonb array** — use `jsonb_array_length`, `jsonb_array_elements_text`, etc., not comma-string `LIKE` patterns.
- **Deprecated substances:** the model **filters out** rows where either joined substance has `deprecated` true. For legacy analytics that include them, fork the SQL (see metabase README).

## CSV pipeline & generated bundle

- **Export (needs DB):** `npm run supabase:phase1-csv-pipeline -- export` — writes repo-root **`interactions.csv`** and **`substances.csv`** from `public.interactions` / `public.substances`. Requires **`DATABASE_URL`** or **`SUPABASE_DB_URL`** in **`.env.local`** (gitignored); do not commit secrets.
- **`emit-bundle` (no DB):** `npm run supabase:phase1-csv-pipeline -- emit-bundle` — copies **`docs/metabase/interactions_enriched.sql`** → **`scripts/automation/generated/interactions_enriched.sql`**. If a stale **`scripts/automation/generated/interactions_enriched_v2.sql`** exists from older runs, it is **removed** (that filename is not produced anymore).
- **After a live Supabase swap** (staging → live): align workspace CSVs with what the build expects, then run **`npm run dataset:build-beta -- .`** so snapshots match production (see AGENTS.md “Learned User Preferences”).

## Supabase dashboard SQL (manual maintenance)

Scripts under [scripts/automation/sql](../../../scripts/automation/sql): backup → staging DDL → import CSVs → swap. Full sequence and safety notes: **SUPABASE_PHASE1_CSV_PIPELINE.md**.

## Metabase analytics defaults (quality, not governance)

- Use **1–5** (integer-style) axis for `risk_score` aggregations; do not remap to 0–1.
- Prefer **natural labels** for nulls (e.g. “N/A”) where quick in Metabase.
- Follow-on patterns: substance risk profile on `substance_1_id` / `substance_1_name`; mechanism × risk on `primary_mechanism_category` + `risk_severity_bucket`; class × class on `substance_1_class` / `substance_2_class`.

## What Phase 1 does **not** expose yet

Phase 1 is **`interactions`** and **`substances`** only. Pair analytics in Metabase may use **`public.analytics_interactions_v2`** (or equivalent) until Phase 2 adds normalized pair tables—see AGENTS.md learned workspace facts when answering cross-schema questions.

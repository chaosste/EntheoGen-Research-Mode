# Metabase on EntheoGen Phase 1 (Supabase)

## Pair normalization and buckets (NEW-88)

Confirmed definitions and how they map to SQL columns: **[PAIR_AND_BUCKET_DEFINITIONS.md](./PAIR_AND_BUCKET_DEFINITIONS.md)**.

## `interactions_enriched` model (NEW-89)

Older planning notes used **0–1 `risk_score`** and **numeric `classification_confidence`**. Phase 1 Postgres uses:

- **`risk_score`**: numeric, typically **1–5** (plus nulls and **self-pair `-1`** semantics).
- **`classification_confidence`**: **text** (`high` / `medium` / `low` / `none` / `not_applicable`).
- **`mechanism_categories`**: **jsonb** array — use `jsonb_array_length` or `jsonb_array_elements_text` for multi-label analytics.

Canonical pair labels for joins: **`LEAST` / `GREATEST`** on substance ids (see [AGENTS.md](../../AGENTS.md) learned workspace facts).

### Install `public.interactions_enriched` on Supabase

If the Table Editor only shows **`interactions_enriched_current`** (or nothing with the exact name **`interactions_enriched`**), use the **obviously named** install script (not buried under migration timestamps):

1. Open **Supabase** → **SQL** → **New query**.
2. Paste the full contents of **[`docs/metabase/supabase-install-interactions-enriched-view.sql`](./supabase-install-interactions-enriched-view.sql)** and **Run**.
3. Refresh **Table Editor**. You should see **`interactions_enriched`**. The script also redefines **`interactions_enriched_current`** as `SELECT * FROM public.interactions_enriched` so anything that still points at `_current` stays valid.

The same SQL lives under `supabase/migrations/20260504080000_public_interactions_enriched_view.sql` for **`supabase db push`** / linked-remote workflows only—**for hand pasting, use the `docs/metabase/supabase-install-…` file above.**

If PostgREST or a client cannot read the new view, grant explicitly, for example: `GRANT SELECT ON public.interactions_enriched TO authenticated, service_role;` (adjust roles to your policy).

### Create the model in Metabase

1. Connect Metabase to the Supabase Postgres database (read-only user recommended).
2. **New** → **SQL query** → paste the contents of [interactions_enriched.sql](./interactions_enriched.sql).
3. Run the query; confirm row count matches expectations (non-deprecated substances only).
4. **Save** → choose **Turn this into a model** (or your Metabase version’s equivalent: save as **Model** with collection + friendly name `interactions_enriched`).
5. Set **primary key** / entity keys in the model UI to `pair_key` if Metabase prompts for grain.
6. Build charts from the **model** so pair normalization, buckets, and deprecated filtering stay consistent.

### Single canonical SQL (NEW-89 / NEW-90)

Older Metabase/CSV exports (for example **2026-04-28** snapshots) often used **fractional `risk_score`**, a **`risk_bucket` label that did not match** Phase 1 integer cutpoints, **empty text `classification_confidence`**, or **names not aligned to normalized ids**. Phase 1 Postgres and the app use **integer-like `risk_score` (1–5, null, self-pair -1)**, **text confidence**, and **canonical `pair_key`**.

**[interactions_enriched.sql](./interactions_enriched.sql)** is the only maintained definition. Use it for Metabase models, Supabase `VIEW`s, and runbooks:

1. **New** → **SQL query** → paste `interactions_enriched.sql` → run.
2. Confirm row count: the query **drops** rows where `pair_key` ≠ `least(id)|greatest(id)` (data hygiene). If the count is unexpectedly low, fix `pair_key` in `public.interactions` first.
3. Save as a model named **`interactions_enriched`** (or `CREATE OR REPLACE VIEW public.interactions_enriched AS …` with the same body).
4. In questions, group on **`substance_1_id` / `substance_1_name`** (normalized), not raw `substance_a_id`, unless you intentionally want row storage order.
5. Prefer **`risk_severity_bucket`** for new charts; **`risk_bucket`** is the same value (alias for older saved questions). Do not reuse legacy export columns named `Risk Bucket` that used different semantics.

### Dashboard and display conventions (Phase 1)

These are **defaults for analytics quality**, not a governance gate: routine chart tweaks and exclusions do **not** need explicit sign-off.

- **Self-pairs:** The model keeps self rows but exposes **`is_comparable_pair`** (`true` when not a self-pair). Set a **default Metabase segment / filter** `is_comparable_pair = true` on most charts so pair analytics stay comparable; self rows remain available for reference. If you maintain a Supabase **`VIEW`**, refresh its body when this repo’s SQL changes.
- **`risk_score`:** Use the Phase **1–5** (integer-style) numeric axis and aggregations. **Do not** remap to **0–1** for charts or exports — that scale dropped most of the signal in older pipelines.
- **Nulls:** Show **`NULL`** as **“N/A”** (or equivalent) in Metabase column display names / custom expressions where it is quick to do.
- **Labels:** Prefer **natural, UI-friendly** column titles and category labels on charts (Metabase field display names, axis labels) where it is straightforward.
- **Dataset scope:** Prefer getting the **best insight from the current Phase 1 dataset** over blocking dashboards on future schema work.

### Optional follow-on models

Once `interactions_enriched` exists as a Metabase model, downstream saved questions can use:

- **Substance risk profile**: `GROUP BY substance_1_id, substance_1_name` with `avg(risk_score)`, counts, `high` share — **union** both ends of the pair if you need undirected substance totals (or aggregate on `substance_1_id` only if you adopt a fixed undirected convention).
- **Mechanism × risk**: `GROUP BY primary_mechanism_category, risk_severity_bucket` (or `risk_bucket`; same values).
- **Class × class**: use **[class_interaction_matrix.sql](./class_interaction_matrix.sql)**. It starts from `interactions_enriched`, uses class values joined from normalized `LEAST` / `GREATEST` pair ids, and exposes `matrix_row_class` / `matrix_column_class` for heatmap axes.

### `class_interaction_matrix` model (NEW-93)

Use this when building class-level heatmaps or matrix-style charts.

1. Make sure **`interactions_enriched`** exists first.
2. **New** → **SQL query** → paste [class_interaction_matrix.sql](./class_interaction_matrix.sql).
3. Run the query and save it as a model named **`class_interaction_matrix`**.
4. Use **`matrix_row_class`** and **`matrix_column_class`** as the heatmap dimensions; use **`interaction_pair_count`**, **`avg_risk_score`**, or **`high_or_critical_pair_share`** as the metric.

For Supabase view installs, run [supabase-install-class-interaction-matrix-view.sql](./supabase-install-class-interaction-matrix-view.sql) after [supabase-install-interactions-enriched-view.sql](./supabase-install-interactions-enriched-view.sql).

### Deprecated / legacy rows

The base query **excludes** rows where either joined substance is `deprecated`. For legacy analytics, copy the SQL, remove the `WHERE not s_low.deprecated` clause (or branch with a parameter once Metabase supports it), and save as a separate model (e.g. `interactions_enriched_with_deprecated`).

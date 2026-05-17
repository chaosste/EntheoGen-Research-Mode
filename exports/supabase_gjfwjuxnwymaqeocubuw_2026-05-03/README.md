# Phase 1 CSVs for Supabase project `gjfwjuxnwymaqeocubuw`

The bundled `*.csv` files here are copies of the workspace-root canonical tables used by `npm run dataset:build-beta -- .`. On **2026-05-03** they were checked against live `public.substances` / `public.interactions` in project `gjfwjuxnwymaqeocubuw` (Supabase MCP): **41** substances and **794** interaction **records** (the interactions file has more physical lines because some fields contain embedded newlines inside quoted cells).

**Dashboard:** [Supabase project](https://supabase.com/dashboard/project/gjfwjuxnwymaqeocubuw)

## Files

| File | Rows (excl. header) | Notes |
|------|---------------------|--------|
| [substances.csv](./substances.csv) | 41 | Import **before** interactions (FK targets). |
| [interactions.csv](./interactions.csv) | 794 | `mechanism_categories` uses repo CSV conventions; DB column is `jsonb`—use SQL import or cast if the Table Editor is strict. |

## Import tips

1. **Order:** `substances` first, then `interactions` (foreign keys on `substance_a_id` / `substance_b_id`).
2. **RLS:** Table editor / `anon` may be blocked by RLS; use the **SQL editor** with a role that bypasses RLS (e.g. `postgres`) or temporarily adjust policies for maintenance windows—follow your security runbook.
3. **Idempotent refresh:** Prefer `DELETE`/`TRUNCATE` staging tables or use `INSERT ... ON CONFLICT` on `pair_key` / `id` if you have unique constraints, rather than duplicating keys.
4. **After upload:** Re-run app dataset build from these same files locally (`npm run dataset:build-beta -- .`) so snapshots stay aligned with production.

## Regenerate later

To refresh from the dashboard DB again, use Supabase SQL export, Table Editor CSV export, or a local script with the **service role** connection string (never commit it). The MCP-linked Cursor Supabase integration can also run `SELECT` queries for spot checks.

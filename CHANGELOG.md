### Changelog (after Beta‑0‑1 wiki, **non‑exhaustive**)

## Unreleased

## After Beta‑0‑1 (wiki 2026-04-28) — repo highlights

### Documentation and governance
- Expanded automation documentation (intake/integration hub, backend and data foundations, quality and CI map, agent and safety outputs).
- Clarified Supabase’s role (Phase 1 analytics / exports) vs static SPA data.
- Added `docs/private-student-beta/` for parallel programme workflow: environments, GitLab guardrails, Linear-first linking, Jira sync policy, and Supabase CSV import notes under `exports/…/README.md`.
- `AGENTS.md` updated with durable workspace facts (e.g. dataset build vs `mechanism_categories`, Cloud Agent repo deps) and contributor preferences.

### Data and curation
- Interaction mechanism / field updates tied to dataset tickets (e.g. NEW-60 / NEW-61).
- `use field_notes and timing_guidance` reflected in pipeline/consumption where applicable.

### Housekeeping
- Continual-learning index and memory-updater–driven `AGENTS.md` refinements.
- Git ignore rules for local Supabase CSV snapshot duplicates under `exports/supabase_*/*.csv`.
- Routine merge / branch sync commits (PRs #15–27 and related).

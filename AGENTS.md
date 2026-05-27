## Repo Guidance

Before deploying from agent-made changes (Codex, Cursor, or similar), **sync
local `main` from `origin/main`** (fetch and merge or rebase as you usually do),
then commit and push from that updated local checkout to `main`. Treat the remote
repo as the deployment source of truth; do not deploy from unpushed local state
or from an agent-only side channel.

Work directly when the task is clear, bounded, and low-risk. Keep diffs small,
reviewable, and reversible, and prefer the repository's existing patterns over
new abstractions.

Do not commit secrets, tokens, private keys, or live credentials. Use placeholder
values in examples and documentation.
For Doppler-first workspace layout (private hub repo, `doppler run`, keys never
in git), follow `.cursor/skills/doppler-workspace/SKILL.md`.

Do not revert user or branch changes unless explicitly asked. If unrelated
changes are present, leave them alone; if they affect the task, work with them
and call out any remaining risk.

Dependencies may be added when they are needed for requested work,
verification, or existing tooling. Keep additions narrow and explain why they
are needed.

Technical checks must verify that the code, data, build, or runtime behavior
works. Do not make technical checks depend on project-management ceremony,
branch names, checklist completion, agent/delegate identity, or documentation
anchors. Process details must never block local work, tests, workflow use, or
repository operation unless the user explicitly asks for that enforcement.

Use `guard`, `gate`, `enforce`, `required`, and `must` only for technical
invariants or explicit human instructions. For process metadata, prefer
`record`, `note`, `document`, `suggest`, or `prefer`.

Broad refactors should be protected with tests before behavior-changing edits.
Small obvious fixes, documentation edits, and simple tooling updates may be made
directly.

Commit messages should explain why the change was made. Structured trailers are
not required.

## Verification

Forbidden verification: do not add tests, scripts, package commands,
or build steps that assert project-management ceremony. Tests may verify product
behavior, data validity, schemas, runtime contracts, type safety, build output,
and executable workflow logic. Tests must not verify branch names, checklist
completion, issue labels, agent identity, or documentation anchors.

Before adding any test, script, CI check, or package command, confirm:

- It proves runtime, code, data, schema, build, or executable workflow behavior.
- It cannot fail because optional process metadata is missing or worded
  differently.
- It cannot block useful work that otherwise functions.

If any check would fail because of project-management ceremony, do not add it.

Use the real commands available in this repo:

- `npm run typecheck` for TypeScript verification.
- `npm run build` for production build verification.
- `npm test` for the knowledge-base and interaction validation suite.
- Targeted scripts such as `npm run test:slack`, `npm run kb:validate`, or
  `npm run validate:interactions:v2` when they directly cover the change.

Run the checks that are directly relevant to the files changed. Do not invent
fake verification.

## OMX Runtime

Use direct execution for routine, bounded repo work.

Use OMX runtime workflows such as `ralph`, `ralplan`, `team`, or `ultrawork`
only when the user explicitly asks for them, or when the task is large,
ambiguous, multi-agent, or needs durable staged coordination.

Do not require PRDs, test-spec gates, team overlays, or runtime state updates
for small fixes, documentation edits, simple scripts, dependency/tooling fixes,
or ordinary verification.

## Learned User Preferences

- **Local first / microscopic scope:** Default to local edits and narrow
  verification; for interaction or evidence work use one file, one pair, or one
  explicit diff—no “while I’m here” refactors, parallel repos, or export steps
  the user did not ask for.
- **Stop when told:** If the user says STOP (or clearly halts work), stop
  immediately—no further tools, rebuilds, syncs, or follow-up “help.”
- **Agent boundaries:** Never offer personal, career, financial, mental-health,
  or coping guidance or helplines unless explicitly asked; never suggest stepping
  away from the project or taking a break unless the user asks.
- **Follow-up passes break dataset work:** After the first successful task in a
  session, avoid extra agent passes that add scripts, docs, layers, or
  regenerate exports—the user reports follow-ups often break the project.
- **EntheoGen → deployment:** Always update local `main` from remote before
  pushing work that will feed remote deploys, so deploys are based on current
  upstream, not a stale branch tip.
- Prefer minimal, isolated patches over broad refactors.
- Keep auth systems untouched during interaction UI/data-layer work unless
  explicitly requested.
- Use normalized `UIInteraction` fields for UI behavior and rendering instead of
  raw dataset fields.
- Keep retained memory artifacts and Slack channel record artifacts local-only
  (gitignored), not committed; when `.env` gains new local-only keys or paths,
  extend `.gitignore` so those additions are not committed.
- Treat legacy `interactions_enriched` CSV exports as reference-only, not
  canonical against the live `interactions` table.
- When normalizing Phase 1 imports or split migrations, map short codes and
  `UNK` into existing `INFERRED`/`THEORETICAL` conventions instead of ad hoc
  enum values.
- **Do not re-wire Foundry citation chunks:** Do not recommend porting rollback
  `chunk_refs`, `pair_chunk_sources.json`, or `foundry-upload-current` linkage
  into Research-Mode—the user abandoned that path after repeated failure.

## Learned Workspace Facts

- The UI interaction adapter is centered in `src/data/uiInteractions.ts`.
- Research Mode filtering is centralized in `src/data/researchMode.ts`.
- **App runtime dataset truth** is `public/dataset/interaction_pairs.json`,
  registered via `registerAppDataset` in `main.tsx`—not raw
  `interactions.csv`, `src/data/interactionDatasetV2.json`, or KB claim files.
- Research-Mode `scripts/buildAppDatasetFromBeta.ts` hardcodes
  `source_refs: ['beta_dataset']` and does **not** emit `chunk_refs` (EntheoGen-rollback’s
  builder may differ when `pair_chunk_sources.json` is present).
- **`npm run audit:dataset`** runs `scripts/localDatasetAudit.ts`—a deterministic,
  no-LLM reader over `public/dataset/interaction_pairs.json` (optional
  `foundry-upload-current/*` only if present on disk).
- Interaction evidence can be entered in CSV, KB, rollback/Foundry, or Supabase,
  but without an explicit single shipped-truth lock the app export often stays
  `source_refs: ["beta_dataset"]` only—user input does not reliably reach the
  public bundle.
- Supabase Phase 1 exposes `interactions` and `substances` base tables; canonical
  pair analytics SQL is **`public.interactions_enriched`** (see
  `docs/metabase/interactions_enriched.sql` and
  `supabase/migrations/*_public_interactions_enriched_view.sql`).
- Multi-mechanism Metabase questions should explode `mechanism_categories` with
  `jsonb_array_elements_text` in native SQL. When replacing
  **`public.interactions_enriched`**, **`CREATE OR REPLACE VIEW`** cannot change
  column names or order (**`42P16`**); use **`DROP VIEW … CASCADE`** then
  **`CREATE VIEW`**.
- `npm run dataset:build-beta -- .` reads workspace-root **`interactions.csv`**
  and **`substances.csv`** and rebuilds `src/data/substances_snapshot.json`,
  `src/exports/interaction_pairs.json`, and the public dataset bundle; mechanism
  on the export reflects **`primary_mechanism_category`**.
- Phase 1 `public.interactions`: `classification_confidence` is **text** tiers
  (`low`/`medium`/`high`/etc.), **`risk_score`** is an integer scale (typically
  **1–5** plus null/`is_self_pair` quirks), not 0–1 probabilities—for ad hoc SQL
  and Metabase, bucket and cast accordingly; joined substance labels must attach
  to **`LEAST`/`GREATEST`**-sorted IDs when canonicalizing `(a,b)` order.
- **Cursor stale worktrees:** Agent sessions can leave worktrees under
  `~/.cursor/worktrees/EntheoGen-Research-Mode/` that block GitHub Desktop
  branch checkout; stash any WIP, then `git worktree remove <path>` and
  `git worktree prune`.
- `npm run test:suite:alignment` includes `npm run test:ui-adapter`; remote
  `npm ci` on hosts without an SSH agent fails on unused **`git+ssh://`** GitHub
  deps—prefer HTTPS pins or remove unused private git dependencies.

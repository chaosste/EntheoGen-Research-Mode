# EntheoGen Phase 1 Automation Backlog

This backlog defines practical automation and workflow alignment tasks for the
current EntheoGen repository.

The system is live and operational, but it is still being improved. Phase 1
should preserve stability while allowing normal product, dataset, tooling,
documentation, and reliability work.

This backlog is repo-grounded:

- Use current repository paths.
- Inspect before changing.
- Do not create imagined `/apps` or `/packages` structures to satisfy a plan.
- Do not assume a source workspace layout applies here.
- Do not treat incomplete dataset records or `UNK` ratings as blockers by
default.
- Make warnings, uncertainty, and review signals visible so the dataset can be
evaluated and improved.

## How To Use This Backlog

Each item includes:

- **Linear alignment**: the likely issue family or owner.
- **Current touchpoints**: real files or directories in this repo.
- **Codex task**: the bounded work to perform.
- **Do not invent**: architecture or ceremony to avoid.
- **Acceptance signal**: how to know the task is useful.
- **Verification**: real commands or checks available in this repo.

Consequential changes should be traceable through Linear and reviewable through
GitHub when appropriate. Small docs, scripts, tests, local tooling, and
evaluation-support changes may be made directly as reviewable working-tree
diffs when requested.

## Canonical Issue Crosswalk (NEW ↔ ENT)

Use this as the source of truth for cross-references between current Linear
issues (`NEW-*`) and prior scoped references (`ENT-*`).

| Area | Linear issue(s) | ENT reference(s) | Notes |
| --- | --- | --- | --- |
| Workflow state alignment | NEW-24 | ENT-003, ENT-019 | NEW-24 consolidates ENT-003 + ENT-019 scope. |
| Workflow transition enforcement follow-up | NEW-42 | ENT-003, ENT-019 (via NEW-24) | Implementation follow-up to ensure guarded state transitions in mutation paths. |
| Canonical dataset helper alignment | NEW-25 | ENT-020 | Dataset helper/docs alignment without data model change. |
| Publication workflow alignment | NEW-26 | ENT-021 | Publication flow alignment with approvals + PR review representation. |
| Review/workflow umbrella | NEW-35 | (no direct ENT mapping in this backlog) | Parent workflow/review alignment family. |
| Parent coordination umbrella | NEW-36 | (parent container) | Parent issue for NEW-24/25/26 in current plan shape. |
| Workspace drift/baseline hygiene follow-up | NEW-43 | (no direct ENT mapping) | Branch hygiene and task-start baseline checks. |

## EPIC 1 - Governance And Automation Documentation

### P1-1 Lean Automation Guidance

**Linear alignment:** NEW-33, Product Lead

**Current touchpoints:**

- `AGENTS.md`
- `AUTOMATION_README.md`
- `AUTOMATION_GOVERNANCE.md`
- `docs/automation/AUTOMATION_AGENTS.md`

**Codex task:**

- Keep the docs aligned with the actual repository.
- Remove brittle absolutes and ceremony that blocks normal work.
- Preserve human authority for consequential decisions.
- Keep explicit allowances for Azure, Supabase, Cloudflare/Wrangler, Slack,
GitHub, Linear, Cursor, Copilot, and other approved tools.

**Do not invent:**

- PRD gates for small fixes.
- Mandatory Linear issues for every local edit.
- Fake architecture diagrams or non-existent services.

**Acceptance signal:**

- Docs explain how to work safely without preventing investigation, UI testing,
or normal development.

**Verification:**

- `git diff --check`

### P1-2 Reference Hygiene

**Linear alignment:** NEW-35, Product Lead

**Current touchpoints:**

- Root automation docs.
- Existing docs under `docs/`.

**Codex task:**

- Ensure cross-references point to files that actually exist.
- Remove stale references to old source-workspace docs unless they are created
in this repo.

**Do not invent:**

- Placeholder docs just to make references look complete.

**Acceptance signal:**

- A reader can follow every referenced local file.

**Verification:**

- `rg -n "docs/|AUTOMATION_|AGENTS.md" *.md docs`

## EPIC 2 - TypeScript And Package Verification

### P1-3 TypeScript Verification Alias

**Linear alignment:** NEW-37, Technical Lead

**Current touchpoints:**

- `package.json`
- `tsconfig.json`
- `src/**/*.ts`
- `src/**/*.tsx`
- `scripts/**/*.ts`

**Codex task:**

- Keep `npm run typecheck` as the explicit TypeScript verification command.
- Keep `npm run lint` aligned if it remains a typecheck alias.
- Fix type errors caused by new work.

**Do not invent:**

- Fake lint commands.
- A new test framework unless the change actually needs one.

**Acceptance signal:**

- TypeScript verification has an obvious command and passes.

**Verification:**

- `npm run typecheck`

### P1-4 Package Test Surface

**Linear alignment:** NEW-37, Technical Lead

**Current touchpoints:**

- `package.json`
- `scripts/validateKnowledgeBase.ts`
- `scripts/validateInteractionsV2.ts`
- `scripts/run_kb_tests.ts`
- `scripts/testUIInteractionsAdapter.ts`
- `scripts/slack/slackApi.test.ts`

**Codex task:**

- Keep package scripts focused on real checks.
- Add targeted test aliases only when they run real scripts.
- Prefer small deterministic tests for new executable behavior.

**Do not invent:**

- Placeholder test scripts.
- Mandatory all-check pipelines for docs-only changes.

**Acceptance signal:**

- Relevant checks are discoverable and runnable from `package.json`.

**Verification:**

- `npm test`
- `npm run test:slack` when Slack bridge behavior changes.

## EPIC 3 - Dataset Visibility And UI Evaluation

### P1-5 `UNK` And Uncertainty Triage

**Linear alignment:** NEW-33, NEW-37, Data Curator

**Current touchpoints:**

- `src/data/interactionDatasetV2.json`
- `src/data/evidenceEpistemics.ts`
- `src/data/uiInteractions.ts`
- `src/data/sourceLinking.ts`
- `src/audit/low-confidence.csv`
- `src/audit/missing-evidence.csv`
- `src/unknown.csv`
- `scripts/validateInteractionsV2.ts`

**Codex task:**

- Make unknown, low-confidence, missing-evidence, and provenance gaps easier to
inspect.
- Preserve the distinction between howling errors, missing links, unsupported
entries, and reasonable mechanistic inference.
- Prefer visibility and triage over automatic blocking.

**Do not invent:**

- A governance rule that freezes `UNK` entries.
- A requirement that every entry has peer-reviewed support before it can be
evaluated or published.
- Direct mutation of canonical data without a reviewable diff.

**Acceptance signal:**

- Developers and curators can identify why an entry is unknown and what kind of
follow-up it needs.

**Verification:**

- `npm run validate:interactions:v2`
- Targeted script tests if new triage scripts are added.

### P1-6 Hands-On UI Safety Review

**Linear alignment:** NEW-33, NEW-37, UX/UI Designer, Ethics Advisor

**Current touchpoints:**

- `src/App.tsx`
- `src/components/ResearchModePanel.tsx`
- `src/data/uiInteractions.ts`
- `src/data/researchMode.ts`
- `docs/assets/`

**Codex task:**

- Treat UI-based dataset evaluation as first-class work.
- Improve surfaces that help developers inspect interaction risk, uncertainty,
evidence status, and safety messaging.
- Capture concrete UI findings as issues or review notes.

**Do not invent:**

- A separate admin app unless explicitly requested.
- Automatic safety approval.
- UI blockers that prevent examining incomplete records.

**Acceptance signal:**

- A developer can use the UI to find confusing, risky, unsupported, or obviously
wrong records and turn them into actionable fixes.

**Verification:**

- `npm run typecheck`
- `npm run build`
- Browser/UI verification when UI changes are made.

### P1-7 UI Interaction Adapter Regression Safety

**Linear alignment:** NEW-37, Technical Lead

**Current touchpoints:**

- `src/data/uiInteractions.ts`
- `scripts/testUIInteractionsAdapter.ts`

**Codex task:**

- Keep UI interaction behavior centralized in the adapter.
- Add regression assertions when adapter behavior changes.
- Use normalized `UIInteraction` fields for rendering behavior.

**Do not invent:**

- Parallel UI data models.
- Raw dataset field branching in components when adapter fields exist.

**Acceptance signal:**

- Adapter changes are covered by a targeted script or TypeScript check.

**Verification:**

- `tsx scripts/testUIInteractionsAdapter.ts`
- `npm run typecheck`

## EPIC 4 - Workflow And Review Signals

### P1-8 Workflow Signal Documentation

**Linear alignment:** NEW-35, NEW-24, NEW-42, Product Lead

**Current touchpoints:**

- `AUTOMATION_README.md`
- `AUTOMATION_GOVERNANCE.md`
- `docs/automation/AUTOMATION_AGENTS.md`

**Codex task:**

- Keep workflow language focused on visibility, reviewability, and human
judgement.
- Ensure warnings and uncertainty are not described as automatic blockers.

**Do not invent:**

- A workflow engine.
- Hard-coded state transition enforcement without an explicit implementation
task.

**Acceptance signal:**

- Docs distinguish warnings from blockers and review signals from approvals.

**Verification:**

- `git diff --check`

### P1-9 Review Action Alignment

**Linear alignment:** NEW-35, NEW-26, Data Curator, Product Lead

**Current touchpoints:**

- Existing docs.
- Dataset validation scripts.
- Future review helpers if explicitly requested.

**Codex task:**

- Define or improve review output shapes only where they are consumed.
- Prefer simple fields such as `needs_review`, `review_note`, `uncertainty`,
`source_gap`, and `suggested_follow_up` when they match current data flow.

**Do not invent:**

- `/packages/review/`.
- A formal approval engine.
- Automatic publication blockers.

**Acceptance signal:**

- Review signals help humans triage records without freezing the dataset.

**Verification:**

- Relevant script tests if executable behavior changes.
- `npm run typecheck`

## EPIC 5 - Slack And External Workflow Bridges

### P1-10 Slack Bridge

**Linear alignment:** NEW-33, NEW-35, Technical Lead

**Current touchpoints:**

- `scripts/slack/slackEnv.ts`
- `scripts/slack/slackApi.ts`
- `scripts/slack/slackPost.ts`
- `scripts/slack/slackApi.test.ts`
- `.env.example`
- `package.json`

**Codex task:**

- Keep Slack bridge behavior small, explicit, and testable.
- Use placeholder env docs only.
- Support posting, DMs, threads, and permalink fallback.

**Do not invent:**

- A Slack governance layer.
- Real credentials.
- Workspace-wide claims from incomplete Slack context.

**Acceptance signal:**

- The bridge can be tested without real Slack credentials and used with
configured credentials when explicitly requested.

**Verification:**

- `npm run test:slack`
- `npm run typecheck`

### P1-11 External Service Allowances

**Linear alignment:** NEW-33, Technical Lead

**Current touchpoints:**

- `AUTOMATION_README.md`
- `AUTOMATION_GOVERNANCE.md`
- `docs/automation/AUTOMATION_AGENTS.md`
- `vite.config.ts`
- `package.json`

**Codex task:**

- Keep Azure as the current live deployment target.
- Allow scoped Supabase, Cloudflare/Wrangler, Slack, GitHub, Linear, Cursor,
Copilot, and other approved integrations.
- Prefer dry runs and local verification for high-impact service work.

**Do not invent:**

- Supabase as the runtime unless the repo actually implements it.
- Cloudflare as the live deployment target unless explicitly changed.
- Live mutations without explicit scope and approval.

**Acceptance signal:**

- Docs allow useful integrations without creating automatic authority or fake
infrastructure assumptions.

**Verification:**

- `git diff --check`

## EPIC 6 - Curation And Knowledge Pipeline

### P1-12 Knowledge Base Script Clarity

**Linear alignment:** NEW-37, NEW-25, Data Curator

**Current touchpoints:**

- `scripts/validateKnowledgeBase.ts`
- `scripts/run_kb_tests.ts`
- `scripts/extract_claims.ts`
- `scripts/link_claims_to_interactions.ts`
- `scripts/promote_reviewed_claims.ts`
- `scripts/promote_eligible_reviewed_claims.ts`
- `scripts/audit_claims_pending.ts`
- `src/curation/`

**Codex task:**

- Document or improve the existing knowledge-base script flow.
- Keep extracted facts, inferred suggestions, missing information, and
uncertainty separate.
- Add focused tests when script behavior changes.

**Do not invent:**

- A new agent package tree.
- A database-backed workflow if file-based scripts are enough.

**Acceptance signal:**

- A developer can tell which script validates, extracts, links, promotes, or
audits curation data.

**Verification:**

- `npm run kb:validate`
- `npm run kb:test` when script behavior changes.

### P1-13 Interaction Report Flow

**Linear alignment:** NEW-33, Data Curator

**Current touchpoints:**

- `scripts/generateInteractionReports.ts`
- `scripts/parseInteractionReports.ts`
- `scripts/testParseInteractionReports.ts`
- `src/curation/nl-reports/`
- `src/curation/examples/`

**Codex task:**

- Keep report generation and parsing practical and testable.
- Preserve uncertainty and missing information in parsed outputs.

**Do not invent:**

- Required publication gates for report parsing.
- Hidden data mutation.

**Acceptance signal:**

- Reports can be generated, parsed, and tested with clear outputs.

**Verification:**

- `npm run updates:test-parser`

## EPIC 7 - Build, Deployment, And Quality

### P1-14 Build Verification

**Linear alignment:** NEW-37, Technical Lead

**Current touchpoints:**

- `package.json`
- `vite.config.ts`
- `src/`

**Codex task:**

- Keep build verification real and current.
- Treat large bundle warnings as follow-up signals unless the task is about
performance or deployment.

**Do not invent:**

- A CI requirement that does not exist.
- A deployment gate for docs-only work.

**Acceptance signal:**

- Production build passes after app or package changes.

**Verification:**

- `npm run build`

### P1-15 CI And GitHub Workflow Discovery

**Linear alignment:** NEW-37, Technical Lead

**Current touchpoints:**

- `.github/workflows/` if present.
- `package.json`.

**Codex task:**

- Inspect existing GitHub workflows before proposing CI changes.
- Align CI with real package scripts.

**Do not invent:**

- `.github/workflows/ci.yml` unless explicitly requested or clearly needed.
- Checks that cannot run in this repo.

**Acceptance signal:**

- CI docs or workflow changes match actual commands.

**Verification:**

- `rg --files .github package.json`
- Relevant package scripts.

## Suggested Execution Order

Use the smallest useful slice, not a waterfall:

1. Keep root guidance and automation docs lean.
2. Confirm TypeScript and package verification.
3. Improve dataset visibility for `UNK`, missing evidence, and uncertainty.
4. Use the UI to evaluate risk/safety behavior and capture actionable fixes.
5. Tighten targeted scripts and tests around changed behavior.
6. Improve Slack or external bridges only when they support current workflow.
7. Add CI/deployment changes only after inspecting what exists.

## Codex Execution Rules

Codex should:

- inspect this repository before planning changes
- use current paths and scripts
- keep diffs small and reversible
- produce reviewable outputs
- run real verification for changed behavior
- preserve uncertainty instead of hiding it
- support hands-on UI and dataset evaluation

Codex should not:

- create fake package/app structures to match old plans
- require Linear issues or PRs for every local edit
- treat `UNK`, missing evidence, or incomplete provenance as automatic blockers
- mutate production without explicit scope and approval
- add real secrets
- bypass human approval for consequential decisions

## Phase 1 Completion Criteria

Phase 1 is healthy when:

- docs reflect the actual repo and live Azure deployment
- TypeScript and relevant package checks are easy to run
- dataset uncertainty is visible and triageable
- UI-based evaluation is supported instead of blocked
- Slack and external service bridges are scoped and testable
- automation improves flow without taking over human authority
- no fictional architecture is introduced just to satisfy the backlog

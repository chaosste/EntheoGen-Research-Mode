# EntheoGen Automation & Workflow Execution

This document describes how EntheoGen uses workflow automation, role
augmentation, and PR-based execution around the live application and dataset.

The current system is treated as live and operational. Work should preserve
stability and avoid unnecessary foundational redesign, while still allowing
normal product, data, tooling, and reliability improvements.

## Documentation direction (NEW-31)

Canonical **tone**, **submission framing**, and **boundary** language for
product-facing work live in Linear:

- [Tone and direction guidance](https://linear.app/new-psychonaut/document/tone-and-direction-guidance-51ab8ce0ad71)
- [Submission intake how-to](https://linear.app/new-psychonaut/document/submission-intake-how-to-e14174e53d28)

Repo Markdown should stay aligned with those documents and with **current
paths** in `docs/automation/BACKEND_AND_DATA_FOUNDATIONS.md`,
`docs/automation/INTAKE_AND_INTEGRATION.md`, and
`docs/automation/QUALITY_AND_RELIABILITY.md`. Automation **supports** proposals,
parsing, verification, and review packets; **the human owner** retains final
approval for consequential dataset, safety, and deployment outcomes (see
`docs/governance.md`).

## Scope

This is not a build or setup guide. It defines how work is executed, how roles
interact, and how automation operates within the live workflow.

Included:

- Linear-driven workflow execution.
- Codex implementation and maintenance work.
- GitHub PR-based review for consequential system and dataset changes.
- Role-aligned automation responsibilities.
- Dataset interaction through controlled, reviewable workflows.
- Integrations with approved tools and services.

Current concrete surfaces named by this guide:

- `scripts/parseInteractionReports.ts`
- `src/curation/interaction-updates.jsonl`
- `scripts/workflow/stateMachine.ts`
- `scripts/workflow/transitionInteractionUpdateState.ts`
- `scripts/workflow/linearWorkflowAlignment.ts`
- `scripts/datasetPaths.ts`
- `scripts/buildAppDatasetFromBeta.ts`
- `scripts/consolidateJsonUpdates.ts`
- `scripts/generateDatasetChangelog.ts`
- `.github/workflows/azure-deploy.yml`
- `.github/workflows/ci.yml`
- `docs/automation/AUTOMATION_AGENTS.md`
- `docs/automation/QUALITY_AND_RELIABILITY.md`
- `docs/automation/AGENT_AND_SAFETY_OUTPUTS.md`
- `docs/automation/BACKEND_AND_DATA_FOUNDATIONS.md`
- `docs/automation/INTAKE_AND_INTEGRATION.md`
- `docs/automation/SUBMISSION_HOW_TO.md`

Not included:

- Autonomous replacement of human decision authority.
- Unreviewed production mutation.
- Unscoped database, schema, or infrastructure redesign.
- Bypassing safety, evidence, publication, or deployment gates.

## Core Principles

### Human Authority

Humans retain final authority over ethics, safety, evidence interpretation,
publication, participant welfare, and consequential product scope.

Automation may draft, extract, compare, summarize, flag, test, and implement
reviewable changes. It does not approve its own consequential outputs.

### Workflow Over Autonomy

Automation improves coordination, throughput, visibility, and quality. It does
not replace judgement, approval, or accountability.

### PR-Based Execution

Consequential system and dataset changes should be produced as reviewable
artifacts, normally GitHub branches and pull requests. Humans review and approve
before deployment.

Small local fixes, documentation edits, scripts, tests, and verification updates
may be made directly in the working tree when requested. They still need to be
reviewable and reversible.

### Linear As Workflow Authority

Linear defines work, ownership, state, and approval requirements. It is the
workflow authority, not a substitute for human judgement and not an execution
engine by itself.

The current Linear issue states are `Backlog`, `Todo`, `In Progress`,
`In Review`, `Done`, `Canceled`, and `Duplicate`. These states track work
execution and review readiness. They do not grant dataset approval, publication
approval, safety approval, or production deployment authority.

### Bounded Execution

Codex should stay within the intent of assigned work. It may inspect the repo,
run relevant verification, and make small adjacent fixes when needed to complete
the task safely.

If a task requires meaningful scope expansion, Codex should document the reason
and keep the resulting change reviewable.

## Operational Architecture

The workflow uses several tools. These tools support delivery; they do not
create independent authority.

- **Linear**: workflow control, state, ownership, and approvals.
- **Codex**: repo inspection, implementation, verification, and reviewable
  output.
- **Cursor**: optional reasoning, drafting, transformation, and editing support.
- **GitHub Copilot**: optional implementation acceleration.
- **GitHub**: version control, pull requests, review, and change history.
- **Azure**: current deployment target for the live application at
  `https://entheogen.azurewebsites.net/`.
- **Supabase**: allowed data, auth, storage, and database integration surface
  when explicitly scoped and safely verified.
- **Cloudflare/Wrangler**: allowed worker, edge, tooling, and deployment-support
  surface when explicitly scoped and safely verified.
- **Slack**: allowed communication, notification, triage, and workflow bridge
  surface when explicitly scoped.
- **Other approved tools**: allowed when they support the requested work, follow
  the same approval boundaries, and do not introduce unreviewed authority.

## Integration Allowances

Automation may interact with external services when the interaction is scoped to
the task, uses already-approved credentials or local configuration, and produces
reviewable output.

Allowed examples:

- Reading workflow state, issues, PRs, logs, diagnostics, or channel context.
- Running health checks, dry runs, local validation, and type checks.
- Posting or drafting Slack updates when explicitly requested.
- Preparing Supabase migrations, policies, queries, or schema changes for human
  review.
- Running Wrangler or Cloudflare commands for local development, validation, dry
  runs, and explicitly approved deployment-support work.
- Generating branches, PR descriptions, changelogs, summaries, and structured
  review packets.

Boundaries:

- Do not add or expose real secrets.
- Do not mutate production without explicit scope and approval.
- Do not publish autonomously.
- Do not modify schemas, databases, auth rules, or infrastructure unless the
  work is explicitly scoped and reviewable.
- Prefer dry runs, local verification, and PR-based changes before live effects.
- If a service action is high-impact or irreversible, stop and surface the
  approval requirement.

## Current Error Behavior

This repository does not currently centralize errors under a dedicated
`/packages/errors/` subsystem. Error handling is intentionally surface-specific:

- Deployed browser UI (`src/App.tsx`) uses React `error: string | null` plus a
  single user-facing readout message; diagnostics go to `console.error` (no
  shared JSON error envelope in the SPA).
- Workflow transitions and guards throw plain `Error` messages that are printed
  by CLI wrappers on failure.
- Validation scripts emit prefixed diagnostics (`ERROR:`, `WARN:`, `INFO:`),
  then summary counts and non-zero exit codes when errors exist.
- Slack integration helper (`scripts/slack/slackApi.ts`) throws on missing
  tokens or non-2xx HTTP; on HTTP 2xx it returns Slack JSON including `ok` /
  `error` fields without throwing when Slack sets `ok: false` (callers check
  `.ok` where required).
- Slack posting CLI emits JSON success/failure payloads (`ok: true/false`) for
  integration-safe consumption.
- Agent-oriented automation payloads may include `errors` arrays for
  report-level issues; those are not a universal runtime exception envelope.

For canonical automation-agent contract wording, see
`docs/automation/AUTOMATION_AGENTS.md`.

## Execution Flow

Typical consequential change flow:

```text
User or team need
↓
Linear issue or explicit scoped task (Backlog/Todo)
↓
Codex implementation and verification (In Progress)
↓
GitHub branch or reviewable working-tree diff (In Review when ready)
↓
Human review and approval
↓
Approved deployment pipeline (after human approval)
↓
Live Azure application
```

Approval and deployment gates must not be skipped for consequential changes.
Small non-production docs, scripts, tests, and local verification fixes do not
need ceremony beyond clear scope and reviewable diffs.

Current publication workflow surfaces in this repository:

- Workflow-state transition guard logic:
  - `scripts/workflow/stateMachine.ts`
  - `scripts/workflow/transitionInteractionUpdateState.ts`
  - `approved -> published` requires a non-empty transition note so publication
    state changes carry a review/approval reference
- Review and merge control:
  - GitHub branch + PR review process (human approval required)
- Deployment enforcement surface:
  - `.github/workflows/azure-deploy.yml` (build + deploy pipeline)
  - live target: `https://entheogen.azurewebsites.net`

There is no in-repo backend route at `/apps/api/routes/publish.*` in this
repository layout. Publication flow here is enforced through the workflow state
machine, review controls, and deployment pipeline above.

There is also no in-repo backend route at `/apps/api/routes/submission.*`.
Submission intake is currently file-first via:

- `scripts/parseInteractionReports.ts`
- `src/curation/interaction-updates.jsonl`
- `scripts/workflow/transitionInteractionUpdateState.ts`
- `scripts/workflow/linearWorkflowAlignment.ts` for recommended Linear state and
  owner-role sync guidance

## Role-Based Automation

Automation is aligned to human roles. It supports role responsibilities without
replacing role authority.

### Product Lead

Automation supports summaries, release visibility, planning context, issue
drafting, and workflow tracking.

The Product Lead retains scope decisions, approval authority, and governance
ownership.

### Data Curator

Automation supports structured drafts, **duplicate surfacing** (V2 validator
checks, consolidation `duplicate_signals` / `review_conflicts`, intake source-id
dedupe — not a `packages/agents/deduplication/` package), normalization,
formatting, evidence comparison, and changelog preparation.

The Data Curator retains scientific judgement and final content approval.

### Ethics Advisor

Automation supports risk flag surfacing, structured summaries, missing-context
identification, and escalation packets.

The Ethics Advisor retains ethical judgement and approval authority.

### Technical Lead

Automation supports implementation, CI/CD, testing, diagnostics, integration
work, and reliability improvements.

The Technical Lead retains architecture ownership and system integrity
authority.

### Beta Coordinator / UX

Automation supports intake, classification, summarization, issue creation, and
feedback synthesis.

The Beta Coordinator / UX role retains human interaction and experience
judgement.

## Dataset Interaction Model

The deployed dataset is the current authoritative baseline. It is not assumed to
be final or complete.

Dataset updates should be reviewable:

```text
proposed change -> branch or diff -> PR/review -> approval -> merge -> deployment
```

Automation may draft, extract, normalize, and compare dataset changes. Humans
approve scientific interpretation, safety classification, and publication.

Canonical dataset files should be named in the task or issue when a change
depends on them. Do not assume a source workspace's file layout matches this
repository.

Current canonical dataset helper surfaces in this repo are:

- `scripts/datasetPaths.ts` for canonical source path resolution
  (`getCanonicalDatasetSourcePaths`) and app export path resolution
  (`getAppDatasetExportPaths`).
- `scripts/buildAppDatasetFromBeta.ts` (`npm run dataset:build-beta`) for
  Beta CSV export (`substances.csv`, `interactions.csv`) into app snapshots.
- `scripts/consolidateJsonUpdates.ts` (`npm run json:consolidate`) for merging
  update artifacts into canonical dataset/index/schema files.
- `scripts/generateDatasetChangelog.ts` (`npm run changelog:dataset`) for
  PR-linked canonical change summaries used during review.

Canonical dataset files currently used by those helpers:

- `src/data/interactionDatasetV2.json`
- `knowledge-base/indexes/source_manifest.json`
- `knowledge-base/indexes/source_tags.json`
- `knowledge-base/indexes/citation_registry.json`
- `knowledge-base/schemas/source.schema.json`
- `knowledge-base/schemas/claim.schema.json`

App dataset export files currently written by those helpers:

- `src/data/substances_snapshot.json`
- `src/exports/interaction_pairs.json`

## Automation Components

Automation operates as role-aligned functions.

### Knowledge Steward

The Knowledge Steward structures data into schema-aligned drafts, separates
extracted facts from inferred suggestions, preserves uncertainty notes, and
generates summaries or changelogs.

Outputs are review material, not final approval.
For dataset-facing draft proposals (`src/curation/interaction-updates.jsonl`),
`reviewer_notes` should remain sectioned as `Extracted`, `Inferred`,
`Uncertainty`, and `Draft-only`.

### Safety Sentinel

The Safety Sentinel identifies risk signals, missing context, and escalation
needs.

Outputs are flags and recommendations, not final decisions.

### Workflow Integration

Linear tracks work and responsibility. GitHub tracks execution artifacts. Azure
is the current live deployment target. Supabase, Cloudflare/Wrangler, Slack, and
other approved tools may support the workflow within the boundaries above.

## Non-Automated Decisions

The following decisions remain human-controlled:

- Ethics approval.
- Safety classification approval.
- Publication approval.
- Participant welfare decisions.
- Final scientific claim interpretation.
- High-impact production or infrastructure changes.

Automation may prepare the materials that inform these decisions, but it does
not make or approve them.

## Definition Of Done

Automation alignment is healthy when:

- Linear, an explicit user request, or another scoped maintenance context
  defines the work and owner.
- Codex can build, fix, verify, and document bounded changes.
- Consequential changes are reviewable through GitHub or equivalent review.
- Human approval gates are preserved.
- The approved deployment pipeline controls live deployment.
- The dataset remains a protected authoritative baseline.
- Automation improves workflow without taking over authority.

## Acceptance And Verification

This guidance is aligned when a reader can identify:

- the present-tense repo surfaces involved in automation work
- what automation may do without extra ceremony
- what humans must approve before consequential outcomes
- what automation is prohibited from doing autonomously
- the command or observable evidence that verifies a change
- any residual risk, limitation, or missing infrastructure

For documentation-only guidance updates, verification is:

```sh
git diff --check
```

Expected output: the command exits successfully with no whitespace errors.

Residual limitation: this document describes current repo behavior and approval
boundaries. It does not prove production safety, dataset correctness, clinical
truth, publication readiness, or external-service health.

## Ongoing Work

Ongoing work may include workflow alignment, documentation clarity, automation
refinement, role-based execution improvements, product changes, dataset
corrections, integration work, reliability fixes, and normal implementation.

Foundational redesign should be explicitly scoped and reviewed, not smuggled
into routine automation work.

## References

- `AGENTS.md`
- `docs/automation/AUTOMATION_AGENTS.md`
- `docs/automation/DATASET_INTERACTION_FLOW.md`
- `docs/automation/SUBMISSION_INTAKE_FLOW.md`
- `AUTOMATION_GOVERNANCE.md`
- `AUTOMATION_PHASE_1_BACKLOG.md`

## Core Principle

Codex builds within EntheoGen. It does not govern EntheoGen.

Codex executes bounded work, produces reviewable outputs, verifies its changes,
and leaves consequential approval to humans and the approved workflow.

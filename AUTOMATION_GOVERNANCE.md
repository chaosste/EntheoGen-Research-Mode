# EntheoGen Governance Model

This document defines decision authority, approval rules, escalation paths,
workflow control, and automation boundaries for work on EntheoGen.

Governance applies to work within and on EntheoGen, including maintenance,
implementation, integrations, dataset evaluation, reliability work, and system
changes. It should protect real decision points without blocking investigation,
hands-on testing, or normal development.

Current governance surfaces in this repo include Linear issue states, GitHub
review history, `.github/workflows/azure-deploy.yml`,
`scripts/workflow/stateMachine.ts`,
`scripts/workflow/transitionInteractionUpdateState.ts`,
`scripts/workflow/linearWorkflowAlignment.ts`, dataset validators, and the
automation documents under `docs/automation/`.

## Governance Model

EntheoGen uses a hybrid governance model:

- Humans retain authority over critical decisions (in the usual setup, one
  owner may carry every role label in Linear; that does not move approval to
  automation).
- Systems provide structure, consistency, validation, and audit support.
- Automation helps build, inspect, test, summarize, and prepare reviewable work.

Governance defines who decides, how risk is controlled, and which actions need
approval. It should not turn every local edit, test run, or exploratory review
into ceremony.

## Core Principles

### Human Authority

Humans retain final authority over:

- ethics approval
- safety classification approval
- evidence interpretation
- publication decisions
- participant welfare
- consequential product scope

Automation may prepare evidence, drafts, summaries, reports, and review packets.
It may not approve its own consequential outputs or override human decisions.

### Explicit Accountability

Consequential workflow, dataset, approval, publication, and production-affecting
actions must have a clear owner and be attributable.

Local development work, repo inspection, verification commands, draft notes, and
hands-on UI testing do not need publication-grade audit ceremony unless they
produce or approve a consequential change.

### Separation Of Responsibilities

| Layer | Responsibility |
| --- | --- |
| Linear | workflow state, ownership, approval tracking |
| GitHub | version control, pull requests, review, change history |
| Azure | current live application deployment target |
| Supabase | scoped persistence, validation, auth, audit, or data services when used |
| Codex | implementation, inspection, verification, and reviewable outputs |
| Cursor | optional reasoning, drafting, transformation, and editing support |
| GitHub Copilot | optional implementation acceleration |
| Humans | final decisions and approvals |

These tools support governance. They do not replace human authority.

### Auditability

Meaningful workflow events should be logged, timestamped, attributable, and
reconstructable. This includes approvals, rejections, publication events,
production-affecting changes, dataset changes accepted into review, and state
transitions that affect release or publication.

Not every development action needs governance logging. A developer using the UI,
running a validation script, checking an `UNK` entry, or making a reviewable doc
edit should not be blocked by audit theater.

### Conservative Defaults

When uncertainty affects safety, publication, participant welfare, or production
behavior, treat risk as higher, confidence as lower, and escalate for human
review.

When uncertainty affects investigation or triage, preserve the uncertainty and
keep evaluating. Do not block discovery just because the record is incomplete.

## Decision Authority By Role

### Product Lead

Owns scope, roadmap, release timing, and dataset inclusion policy.

Approves publication readiness and release decisions.

### Ethics Advisor

Owns risk acceptability, participant safety standards, consent, and data ethics.

Has veto authority over unsafe content and unethical workflows.

### Data Curator

Owns evidence quality, interaction accuracy, and schema-aligned correctness.

Approves structured record integrity and readiness for safety review.

### Technical Lead

Owns system integrity, reliability, deployment behavior, and data handling
consistency.

Approves changes affecting runtime, stability, infrastructure, auth, database
schema, or production behavior.

### Beta Coordinator

Owns participant lifecycle, communication, and feedback handling.

Escalates safety concerns and participant distress.

### UX/UI Designer

Owns usability, clarity, and accessibility.

Advises on interface-related risk, confusion, and evaluation quality.

## Workflow Governance

### Sources Of Truth

| System | Role |
| --- | --- |
| Linear | workflow state and responsibility |
| GitHub | execution artifacts and review history |
| Azure | current live deployment target |
| Supabase | scoped enforced data state and persistence when used |

These systems should remain consistent where their responsibilities overlap.

### Execution Model

Typical consequential change flow:

```text
Linear or explicit scoped task
-> Codex implementation and verification
-> GitHub branch, PR, or reviewable working-tree diff
-> Human review and approval
-> Approved deployment path
-> Live Azure application
```

For small docs, scripts, tests, local tooling, and evaluation support, a
reviewable working-tree diff is enough unless the user asks for a branch or PR.

### Workflow States

Linear is the control plane for implementation work. The current issue states
are:

| Linear state | Meaning |
| --- | --- |
| Backlog | Accepted work that is not scheduled for active execution. |
| Todo | Ready work that can be picked up next. |
| In Progress | Work actively being implemented or investigated. |
| In Review | Work waiting for human, PR, or issue review. |
| Done | Work completed and verified for the requested scope. |
| Canceled | Work intentionally stopped without completion. |
| Duplicate | Work represented by another issue. |

These Linear states describe work execution. They do not approve dataset,
publication, safety, or production outcomes by themselves.

Dataset and review records may use domain states such as:

- submitted
- structured
- curator_review
- safety_review
- approved
- published
- archived
- blocked

State names are workflow aids, not shackles. A record may move to `blocked`,
`archived`, or back to review when evidence changes or a correction is needed.

### Transition Rules

- Linear issue transitions should reflect the actual work status and keep
  ownership visible.
- Publication and approval transitions must follow the defined workflow.
- Exceptions and corrective transitions must be documented.
- High-risk flags, missing data, and uncertainty must be surfaced clearly for
  review instead of hidden or silently normalized.
- Transitions that affect review, release, or publication must be logged.

## Dataset Evaluation And `UNK` Records

The dataset is not public. The deployed dataset is the current authoritative
baseline, but it is not assumed to be final, complete, or correct.

Large groups of `UNK` or unknown-rated entries are not governance failures by
themselves. They are triage targets.

Developer use and hands-on UI testing are valid and necessary ways to evaluate
dataset risk, safety, clarity, and practical behavior. Governance must not block
the work needed to find howling errors, distinguish them from reasonable
inference, or improve the dataset.

Dataset records may remain in draft, intake, triage, or review states when:

- required fields are missing
- peer-reviewed evidence is absent
- provenance is incomplete
- confidence is low
- the entry is a reasonable mechanistic inference
- the entry needs UI-based risk/safety evaluation

Those conditions should not automatically block publication, approval,
inspection, comparison, UI testing, issue creation, curator review, or targeted
correction work. They should be visible enough that humans can judge the record
in context and improve it over time.

Automation and developers should preserve uncertainty notes and make the reason
for `UNK` explicit when possible:

- unsupported by specific peer-reviewed study
- evidence not yet linked
- mechanistic inference
- contradictory evidence
- unclear source provenance
- possible data error
- needs human curator review
- needs hands-on UI safety/risk evaluation

## Approval Requirements

| Transition | Required Role |
| --- | --- |
| structured -> curator_review | Data Curator or accepted automation intake rule |
| curator_review -> safety_review | Data Curator |
| safety_review -> approved | Ethics Advisor |
| approved -> published | Product Lead, with publication note linking approval artifact (for example PR/review reference) |
| production-impacting technical change | Technical Lead |

Automation can prepare transition packets and identify warnings, gaps, and
escalation notes. It does not grant final approval.

## Escalation Model

Escalation is required when a finding affects safety, publication, participant
welfare, production behavior, ownership, or data integrity in a way the current
actor cannot resolve.

| Condition | Escalate To |
| --- | --- |
| Safety risk | Ethics Advisor |
| Evidence conflict | Data Curator |
| Workflow ambiguity | Product Lead |
| System issue | Technical Lead |
| Participant distress | Beta Coordinator + Ethics Advisor |
| UI confusion affecting safety interpretation | UX/UI Designer + Ethics Advisor |

## Blocking Rules

Surface prominently during review when:

- required publication fields are missing
- no supporting evidence or rationale is present
- safety concerns are unresolved
- schema-aligned structure is invalid
- provenance is incomplete for a claim that needs provenance
- approval history is missing

These conditions are warnings and triage signals, not automatic stop signs.
They should not block investigation, UI testing, triage, issue creation, draft
review, publication, or approval by default. That is exactly when the work needs
to happen.

## Automation Governance

### General Rule

Automation supports roles but does not make consequential decisions.

### Codex

Codex may:

- inspect the repository
- use the UI for hands-on dataset and safety evaluation
- generate code and documentation
- create tests and verification scripts
- run relevant checks
- create branches, PRs, summaries, and review packets
- implement scoped changes

Codex must:

- produce reviewable outputs
- preserve uncertainty when evidence is incomplete
- avoid real secrets
- surface approval requirements for high-impact actions

Codex must not:

- mutate production without explicit scope and approval
- publish autonomously
- bypass required human approval gates
- silently alter canonical dataset records outside controlled workflows

### Cursor And Copilot

Cursor and GitHub Copilot may support drafting, reasoning, transformation, and
implementation acceleration.

Their outputs are useful work products, not governance authority.

### Knowledge Steward

The Knowledge Steward may structure data, generate draft summaries, identify
gaps, compare evidence, and prepare changelogs.

It may not assign final evidence judgement or overwrite the canonical dataset
without review.

### Safety Sentinel

The Safety Sentinel may flag risks, surface issues, identify missing context,
and recommend escalation.

It may not declare content safe or approve progression.

## Publication Governance

Publication governance is a visibility and accountability layer, not an
automatic eligibility blocker.

Before publication or approval, the workflow should show the responsible human:

- whether required publication fields are complete
- whether structure has been validated
- known risks and uncertainty notes
- known evidence, provenance, or rationale gaps
- known `UNK` reasons or unresolved triage notes
- available Data Curator, Ethics Advisor, and Product Lead review status

For now, incomplete fields, weak evidence, missing provenance, `UNK` status, or
unresolved triage notes are not automatic blockers. Humans may approve or
publish with known warnings visible.

Current repository enforcement path for publication-aligned workflow:

1. Workflow state transitions must pass guard rules:
   - `scripts/workflow/stateMachine.ts`
   - `scripts/workflow/transitionInteractionUpdateState.ts`
   - publication transitions (`approved -> published`) require a non-empty
     review note in transition context
2. Human approval and review occur through GitHub branch/PR review.
3. Deployment to live environment is controlled through:
   - `.github/workflows/azure-deploy.yml`
   - Azure App Service target `https://entheogen.azurewebsites.net`

This repository does not currently contain an `/apps/api/routes/publish.*`
backend route. Publication governance is therefore represented by workflow
state enforcement plus PR/deployment controls, not a standalone publish route.

This repository also does not currently contain an
`/apps/api/routes/submission.*` backend route. Submission intake is represented
by parser + workflow files:

- `scripts/parseInteractionReports.ts`
- `src/curation/interaction-updates.jsonl`
- `scripts/workflow/transitionInteractionUpdateState.ts`

Linear status/owner alignment for workflow states is centralized in:

- `scripts/workflow/linearWorkflowAlignment.ts`

The system should still prevent:

- automatic publishing
- bypassing required approval stages
- direct unreviewed dataset mutation
- unlogged publication-affecting changes
- suppression of risk signals

## Audit Requirements

For consequential workflow records, maintain transformation history, review
history, and state transitions.

Audit entries should include:

- actor
- actor_type: `human`, `automation`, `system`, or `integration`
- actor_detail: for example `codex`, `cursor`, `github`, `slack`, `supabase`,
  or `linear`
- timestamp
- reason or rationale

## Governance Enforcement

Governance is enforced through:

- Linear for workflow state and ownership
- GitHub for PR review and change control
- Azure as the current live deployment target
- Supabase for scoped persistence, validation, auth, audit, or data services
  when used
- UI and developer testing for practical dataset risk/safety evaluation

Governance is embedded in workflow execution. It should make good work safer and
more visible, not prevent the work required to discover and fix problems.

## Operational Constraints

- No autonomous approvals.
- No autonomous publishing.
- No unapproved production mutation.
- No unscoped schema, database, auth, or infrastructure changes.
- No suppression of risk signals.
- No pretending uncertainty is certainty.

These constraints apply to consequential outcomes. They do not prohibit normal
building, debugging, UI testing, scripts, documentation, verification, or
dataset triage.

## Governance Success Criteria

Governance is functioning when:

- every consequential decision has a clear owner
- approval and publication transitions are traceable
- unsafe content cannot reach publication without review
- workflow is visible enough to coordinate work
- system behavior is consistent and enforceable
- Codex outputs are reviewable
- Cursor and Copilot outputs remain attributable when used
- incomplete dataset records can be evaluated and improved instead of frozen

## Verification And Residual Risk

For guidance-only governance updates, verify the edited text with:

```sh
git diff --check
```

Expected output: the command exits successfully with no whitespace errors.

Residual risks:

- Governance text does not replace executable workflow checks in
  `scripts/workflow/`.
- Linear state, PR review, and deployment history remain separate systems that
  can drift until humans or automation reconcile them.
- Incomplete evidence, `UNK` records, and missing provenance remain review
  signals rather than automatic blockers.

## Core Principle

Governance defines control over consequential decisions.

Linear defines work.
Codex builds and verifies.
Humans decide.
Systems enforce approved outcomes.

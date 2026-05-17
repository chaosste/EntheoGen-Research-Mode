# Test Suite Map

This map aligns live test commands to current EntheoGen modules.

## Coverage Labels

| Coverage label | Command | Modules covered |
| --- | --- | --- |
| `changelog_alignment` | `npm run test:changelog` | `scripts/generateDatasetChangelog.ts` review-draft generation over canonical dataset file paths + PR reference requirement |
| `dataset_helpers` | `npm run test:dataset-helpers` | `scripts/datasetPaths.ts`, `scripts/buildAppDatasetFromBeta.ts`, `scripts/betaDatasetMapping.ts` |
| `workflow_modules` | `npm run test:workflow` | `scripts/workflow/stateMachine.ts`, `scripts/workflow/transitionInteractionUpdateState.ts`, `scripts/workflow/interactionUpdateWorkflow.ts` |
| `agent_output_contracts` | `npm run updates:test-parser` | `scripts/parseInteractionReports.ts` proposal output shape and workflow initialization, including `reviewer_notes` separation (`Extracted`/`Inferred`/`Uncertainty`/`Draft-only`) |
| `submission_intake` | `npm run test:submission-intake` | parser + workflow transition integration for `submission -> structured/review` handling without backend route assumptions |
| `knowledge_base_pipeline` | `npm run kb:test` | `scripts/testKnowledgeBasePipeline.ts`, `scripts/testAlmaIngestion.ts`, `scripts/testPerplexityIngestion.ts` |
| `ui_interaction_adapter` | `npm run test:ui-adapter` | `scripts/testUIInteractionsAdapter.ts` normalized UI readout behavior for legacy and current interaction rows |
| `external_bridge_slack` | `npm run test:slack` | `scripts/slack/slackApi.ts` request/response bridge behavior |
| `validation_surface` | `npm test` | `scripts/validateKnowledgeBase.ts`, `scripts/validateInteractionsV2.ts` |
| `validation_alignment` | `npm run test:validation-alignment` | current dataset + schema expectations |

## Full Alignment Suite

Use this when validating test-surface alignment across dataset helpers, workflow
modules, agent output contracts, UI normalization, and external bridge checks:

```bash
npm run test:suite:alignment
```

## Notes

- There is no `/tests/` directory in this repository; executable tests live under `scripts/`.
- When touching docs or issues, update command references manually if they
  become stale. Do not add tests that assert documentation wording, issue
  fields, or other project-management ceremony.
- Add or remove coverage labels only when the associated command changes.
- Obsolete construction-stage tests that depend on removed fixtures should be
  deleted instead of kept as broken placeholders.
- The retired `workflow_write_path_guards` coverage label previously checked
  direct `workflow.state` write paths by filepath allowlist. It is no longer an
  automated gate because it encoded implementation ownership rather than runtime
  behavior.

# Schema Reference (Current Repo)

Purpose: this document describes the schema contracts currently used by the
deployed EntheoGen app, public dataset bundle, source snapshots, and canonical
dataset artifacts.

## Scope

This schema reference is intentionally scoped to concrete in-repo surfaces:

- Runtime TypeScript schema contract:
  `src/data/interactionSchemaV2.ts`
- Canonical interaction dataset artifact:
  `src/data/interaction_pairs.json`
- App source snapshot artifacts used to build the deployed bundle:
  `src/exports/interaction_pairs.json` and
  `src/data/substances_snapshot.json`
- Public runtime dataset bundle consumed by the browser:
  `public/dataset/manifest.json`,
  `public/dataset/interaction_pairs.json`, and
  `public/dataset/substances_snapshot.json`
- Runtime dataset loader and readers:
  `src/data/datasetLoader.ts`, `src/data/datasetRegistry.ts`,
  `src/data/drugData.ts`, and `src/data/uiInteractions.ts`
- Knowledge-base JSON Schemas:
  `knowledge-base/schemas/source.schema.json` and
  `knowledge-base/schemas/claim.schema.json`
- Canonical knowledge-base artifacts:
  `knowledge-base/indexes/source_manifest.json` and
  `knowledge-base/indexes/citation_registry.json`
- Active schema/shape validators:
  `scripts/validateInteractionsV2.ts` and `scripts/validateKnowledgeBase.ts`
- Dataset path helper:
  `scripts/datasetPaths.ts`
- App snapshot build path:
  `scripts/buildAppDatasetFromBeta.ts`

Out of scope:

- schema redesign
- dataset content edits
- migration proposals not represented in current implementation
- database migration or Supabase table changes
- deployed backend/API route changes

## Current Contract Surfaces

| Surface | Role | Enforcement |
| --- | --- | --- |
| `src/data/interactionSchemaV2.ts` | Primary typed contract for interaction dataset V2 structures and enums | TypeScript compile-time checks plus script-level runtime validation |
| `src/data/interaction_pairs.json` | Canonical interaction dataset artifact used in repo workflows | `scripts/validateInteractionsV2.ts` |
| `knowledge-base/schemas/source.schema.json` | JSON Schema for source manifest entries | `scripts/validateKnowledgeBase.ts` |
| `knowledge-base/schemas/claim.schema.json` | JSON Schema for extracted claims | `scripts/validateKnowledgeBase.ts` |
| `src/exports/interaction_pairs.json` and `src/data/substances_snapshot.json` | Source snapshot artifacts for local scripts and public-bundle sync | Generated via `scripts/buildAppDatasetFromBeta.ts`; typed through runtime readers |
| `public/dataset/manifest.json` | Browser runtime bundle manifest; current schema version is `1` | Written by `scripts/buildAppDatasetFromBeta.ts` or `scripts/syncPublicDatasetBundle.ts`; checked by `src/data/datasetLoader.ts` |
| `public/dataset/interaction_pairs.json` and `public/dataset/substances_snapshot.json` | Static JSON loaded by the deployed browser app | Synced from source snapshots by `scripts/syncPublicDatasetBundle.ts` |

The deployed app reads static JSON from `public/dataset/` or from an equivalent
remote base set by `VITE_DATASET_BASE_URL`. It does not depend on a runtime
backend schema endpoint, Supabase client, or Postgres connection for interaction
lookups.

## Current Artifact Roles

- Canonical interaction source: `src/data/interaction_pairs.json`.
- App interaction source snapshot: `src/exports/interaction_pairs.json`.
- App substance source snapshot: `src/data/substances_snapshot.json`.
- Browser runtime bundle:
  `public/dataset/manifest.json`,
  `public/dataset/interaction_pairs.json`, and
  `public/dataset/substances_snapshot.json`.
- Knowledge-base source schema:
  `knowledge-base/schemas/source.schema.json`.
- Knowledge-base claim schema:
  `knowledge-base/schemas/claim.schema.json`.

The canonical dataset and app snapshots are related but not identical. The
canonical V2 dataset stores structured classification, evidence, provenance,
audit, and validation metadata. The app source snapshots store the flattened
fields that are copied into `public/dataset/` for browser startup.

## Validator CLI diagnostics (not a schema field)

Interaction and knowledge-base validators (`scripts/validateInteractionsV2.ts`,
`scripts/validateKnowledgeBase.ts`) report issues as **prefixed stdout lines**
(`ERROR:`, `WARN:`, `INFO:`), then a summary and a **non-zero exit code** when
errors exist. That format is the current script-facing signal; it is **not**
the same shape as browser UI strings.
**Duplicate canonical pair keys** and related pair-shape checks are part of this
validator surface.

## Canonical Dataset V2 Shape

Top-level object (`src/data/interaction_pairs.json`):

- `schema_version`: currently `v2`
- `generated_at`: ISO timestamp string
- `substances`: array of substance objects
- `pairs`: array of interaction pair objects
- `sources`: array of dataset source objects

`substances[]` (`SubstanceV2`):

- `id`: string
- `name`: string
- `class`: optional string
- `mechanism_tag`: optional string
- `notes`: optional string
- `deprecated`: optional boolean
- `superseded_by`: optional string array

`sources[]` (`SourceV2`):

- `id`: string
- `title`: string
- `source_type`: enum (`primary_source`, `secondary_source`,
  `field_guidance`, `internal_research_update`, `ai_synthesis`,
  `generated_placeholder`, `none`)
- `reliability`: currently `unknown`
- `fingerprint`: optional string

`pairs[]` (`InteractionPairV2`):

- `key`: canonical pair key string
- `substances`: tuple of two substance IDs
- `classification`: object:
  - `code`: `InteractionCodeV2`
  - `status`: `InteractionStatus`
  - `confidence`: `ConfidenceLevel`
  - `risk_score`: number or `null`
  - `label`: optional string
  - `risk_assessment`: optional object with `level` and optional `rationale`
- `clinical_summary`: object with required `headline`; optional `mechanism`,
  optional `timing_guidance`, optional `field_notes`
- `mechanism`: object with `primary_category` and `categories[]`
- `evidence`: object:
  - `tier`: `EvidenceTierV2`
  - `support_type`: singular `EvidenceSupportType`
  - `source_refs`: array of source/claim references
  - `evidence_strength`: optional `EvidenceStrengthV2`
  - `status`: optional `EvidenceStatusV2` in the TypeScript contract
  - `review_state`: optional `ReviewStateV2` in the TypeScript contract
  - `review_notes`: optional string or `null`
  - `evidence_gaps`: optional string or `null`
- `provenance`: derivation, source-linking, and migration metadata
- `override_metadata`: override tracking with required `applied` boolean
- `audit`: validation and review metadata with `validation_flags[]` and
  `review_status`
- `validation`: grouped validation flags by severity; the current validator
  requires this for non-self pairs (`SELF` pairs are the exception)
- optional passthrough fields currently used by data workflows:
  `source_text`, `source_fingerprint`

Current validator rules to preserve for downstream automation:

- pair keys must be the sorted canonical `a|b` form
- active non-deprecated pair keys must be unique
- pair substances must exist in `substances[]`
- non-self pairs may not use `UNKNOWN` classification or `risk_score: 0`
- `SELF` pairs must use `classification.code: SELF` and risk score `-1`
- `THEORETICAL` pairs must use `evidence.tier: theoretical`
- `INFERRED` pairs must have `risk_score: null`
- non-self pairs must have a non-`unknown` primary mechanism category
- `mechanism.primary_category` must be present in `mechanism.categories[]`
- source references must point to IDs in `sources[]`, except explicit
  provisional gap-fill handling
- grouped `validation.flags` must match flat `audit.validation_flags`

## Enumerated Values (Runtime Contract)

Primary enum sets are defined in `src/data/interactionSchemaV2.ts`:

- Interaction code: `SELF`, `UNKNOWN`, `INFERRED`, `THEORETICAL`,
  `DETERMINISTIC`, `LOW`, `LOW_MOD`, `CAUTION`, `UNSAFE`, `DANGEROUS`
- Interaction status: `confirmed`, `inferred`, `low_confidence`,
  `missing_evidence`, `unknown`, `not_applicable`
- Confidence: `high`, `medium`, `low`, `none`, `not_applicable`
- Review state: `unreviewed`, `machine_inferred`, `human_reviewed`,
  `requires_review`, `needs_verification`
- Evidence status: `not_reviewed`, `no_data`, `limited_data`,
  `conflicting_evidence`, `mechanistic_inference`, `supported`,
  `provisional_secondary`
- Evidence support type: `direct`, `indirect`, `mechanistic`,
  `field_observation`, `traditional_context`, `extrapolated`,
  `direct_literature`, `class_level_literature`, `mechanistic_literature`,
  `adjacent_domain_literature`, `provisional_gap_fill`, `ai_synthesis`, `none`
- Source match type: `direct_pair`, `single_agent`, `drug_class`, `mechanism`,
  `adjacent_domain`, `source_gap`, `provisional_gap_fill`, `ai_synthesis`
- Derivation type: `explicit_source`, `curated_inference`, `decomposition`,
  `fallback_rule`, `generated_unknown`, `self_pair`
- Source kind: `primary_source`, `secondary_source`, `field_guidance`,
  `internal_research_update`, `ai_synthesis`, `generated_placeholder`, `none`
- Validation severity buckets: `critical`, `warning`, `info`
- Validation flag set: defined by `VALIDATION_FLAGS_V2` and consumed by
  both flat `audit.validation_flags` and grouped `validation.flags`

Observed canonical dataset values as of the current artifact include
`CAUTION`, `DANGEROUS`, `DETERMINISTIC`, `INFERRED`, `LOW_MOD`, `SELF`,
`THEORETICAL`, and `UNSAFE` classification codes. The enum contract allows
additional values listed above even when a value is not present in the current
artifact.

## App Snapshot Contracts

`src/exports/interaction_pairs.json` is the flattened interaction source
snapshot used by scripts and copied into
`public/dataset/interaction_pairs.json`.

Each app interaction row currently uses:

- `substance_a_id`: string
- `substance_b_id`: string
- `pair_key`: canonical pair key string
- `origin`: `self`, `explicit`, `fallback`, or `unknown`
- `interaction_code`: app/runtime code such as `LOW`, `LOW_MOD`, `CAU`, `UNS`,
  `DAN`, `UNK`, `SELF`, `INFERRED`, `THEORETICAL`, or `DETERMINISTIC`
- `interaction_label`: display label string
- `risk_scale`: number
- `summary`: display summary string
- `confidence`: display/source confidence string; current snapshot values
  include `high`, `medium`, `low`, and `n/a`
- `mechanism`: string or `null`
- `mechanism_category`: category string used for UI normalization
- `timing`: string or `null`
- `evidence_gaps`: string or `null`
- `evidence_tier`: string or `null`
- `field_notes`: string or `null`
- `sources`: string
- `source_refs`: string array
- `source_fingerprint`: string

`src/data/substances_snapshot.json` is the flattened substance source snapshot
used by scripts and copied into `public/dataset/substances_snapshot.json`.

Each app substance row currently uses:

- `id`: string
- `name`: string
- `class`: string
- `mechanismTag`: string
- `notes`: string
- `deprecated`: optional boolean
- `supersededBy`: optional string array

The UI normalization layer in `src/data/uiInteractions.ts` is the preferred
surface for display behavior. It turns raw app snapshot fields into
`UIInteraction` fields such as `riskDisplayLabel`, `mechanismDisplayLabel`, and
`confidenceLabel`; downstream UI code should prefer those normalized fields over
raw dataset fields.

## Knowledge-Base Schema Contracts

`knowledge-base/schemas/source.schema.json`:

- Required fields: `source_id`, `title`, `source_type`, `authority_level`,
  `evidence_domain`, `url_or_path`, `review_state`
- `source_type` enum includes `academic_paper`, `clinical_guideline`,
  `expert_guideline`, `expert_dataset`, `ai_synthesis`, `traditional_context`,
  `pharmacology_reference`, `legal_policy`
- `review_state` enum is `unreviewed`, `extracted`, `validated`, `rejected`
- `additionalProperties` is currently `true`

`knowledge-base/schemas/claim.schema.json`:

- Required fields: `claim_id`, `source_id`, `claim`, `claim_type`, `entities`,
  `review_state`
- Contains structured fields for `supports_pairs`, `clinical_actionability`,
  `provenance`, `source_specific`, and `evidence_status`
- `claim_type` enum is `mechanism`, `interaction`, `risk`, `contraindication`,
  `guidance`
- `review_state` enum is `machine_extracted`, `needs_verification`,
  `human_reviewed`, `rejected`, `needs_revision`
- `evidence_status` enum is `supported`, `mechanistic_inference`,
  `provisional_secondary`, `limited_data`, `no_data`, `not_reviewed`,
  `conflicting_evidence`
- `additionalProperties` is currently `true`

## Read/Write Pathways

Read pathways:

- App runtime fetches `public/dataset/manifest.json`,
  `public/dataset/interaction_pairs.json`, and
  `public/dataset/substances_snapshot.json` through
  `src/data/datasetLoader.ts`, then registers the loaded data through
  `src/data/datasetRegistry.ts`.
- If `VITE_DATASET_BASE_URL` is set, app runtime fetches the same manifest and
  JSON filenames from that remote static base instead of same-origin
  `/dataset/`.
- Validation and ingestion scripts read canonical dataset and knowledge-base
  artifacts from `src/data/` and `knowledge-base/`.

Write pathways:

- App source snapshot artifacts and the public runtime bundle are written by
  `scripts/buildAppDatasetFromBeta.ts`.
- `scripts/syncPublicDatasetBundle.ts` copies source snapshots into
  `public/dataset/` and writes a manifest with schema version `1` plus content
  hashes. `npm run build` runs this sync through `prebuild`.
- Canonical dataset/index/schema artifacts may be updated by scoped scripts such
  as `scripts/consolidateJsonUpdates.ts` and domain ingestion/linking scripts.
- Schema definition files are updated only when a scoped schema change issue is
  explicitly approved.
- Root `substances.csv` and `interactions.csv` can be used as snapshot build
  inputs when `npm run dataset:build-beta -- .` is intentionally in scope.

## Boundaries And Approvals

Local tooling may:

- validate schema conformance with the existing scripts
- generate schema-alignment documentation
- inspect current field sets and enum usage in canonical artifacts

Out of scope:

- introducing new schema subsystems
- modifying schema implementations while claiming docs-only alignment
- silently changing canonical artifact structure outside reviewable workflows
- changing app snapshot artifacts, CSV inputs, or knowledge-base artifacts as
  part of this documentation-only alignment

## Risk-Based Guidance

- Use targeted verification when changes are docs-only or contract-clarification
  only.
- Run full validation gates when a change touches schema definitions, validators,
  or canonical dataset artifacts.
- If a docs claim depends on runtime-required conditions, prefer validator truth
  over TypeScript optionality and record the condition explicitly.
- Treat fields with `additionalProperties: true` as extensible but not
  unconstrained; document observed usage before adding new keys.
- When downstream automation needs display behavior, use normalized
  `UIInteraction` fields instead of raw snapshot fields.
- When downstream automation needs canonical evidence or provenance behavior,
  use `InteractionDatasetV2` fields and validation scripts rather than app
  snapshot display fields.

## Acceptance Criteria (Testable Now)

- `docs/schema.md` maps directly to active schema sources in this repository.
- The doc distinguishes canonical V2 dataset schema from deployed app snapshot
  schemas.
- Field definitions are explicit and consistent with current TypeScript and JSON
  schema contracts.
- Validator-required conditions are called out separately from TypeScript
  optional fields where they differ.
- The doc states boundaries for automation, human approval, and prohibited
  actions.
- The doc includes runnable verification commands and expected outcomes.
- This documentation update changes no implementation, schema, dataset, CSV, or
  app snapshot artifacts.

## Verification

Run:

```bash
npm run typecheck
npm run test:interactions:validate
npm run test:kb:validate
npm run test:ui-adapter
```

Expected outputs:

- `npm run typecheck` completes without TypeScript errors.
- `npm run test:interactions:validate` prints
  `Validation complete. errors=0 ...` (warnings/info may be non-zero).
- `npm run test:kb:validate` prints
  `KB validation complete. errors=0 ...`.
- `npm run test:ui-adapter` prints
  `UI interaction adapter assertions passed.`

Residual risks and limitations:

- Runtime TypeScript contracts and JSON Schema contracts are complementary but
  not perfectly symmetrical.
- TypeScript optionality and validator-required conditions differ for some V2
  fields; downstream automation should treat validator behavior as the release
  gate.
- `additionalProperties: true` in knowledge-base schemas allows extension keys,
  so downstream consumers should rely on required/enumerated fields plus
  validator behavior.
- Record counts and timestamps in canonical artifacts change over time; this doc
  describes structure and enforcement surfaces, not fixed content values.
- Supabase migration files may define future or adjacent database surfaces, but
  this document describes a static-only deployed app: database credentials stay
  in local environment files and scripts, not in the browser bundle.

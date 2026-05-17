# Knowledge Base Pipeline

This directory stores source material, extracted claim candidates, review state,
indexes, schemas, and validation reports for the EntheoGen interaction data.

## Scope

- Source surfaces: `sources/`, `indexes/`, `schemas/`, and
  `extracted/claims/`.
- App export/runtime surfaces are outside this directory, mainly
  `src/data/interactionDatasetV2.json`, `src/exports/interaction_pairs.json`,
  and adapters such as `src/data/uiInteractions.ts`.
- Automation may extract, validate, promote explicitly reviewed claims, and link
  reviewed source references. Humans keep final authority over claim review,
  interpretation, safety posture, and publication-facing changes.

## Folder Layout

- `sources/` stores raw `.md` and `.txt` source notes.
- `indexes/` stores the source manifest, tag index, and citation registry.
- `extracted/claims/pending/` stores machine-generated claim candidates waiting for review.
- `extracted/claims/reviewed/` stores human-reviewed claims ready for dataset linking.
- `extracted/claims/rejected/` stores claims that were reviewed and rejected.
- `schemas/` stores the JSON Schemas used to validate source and claim records.
- Perplexity research syntheses live under `sources/expert-guidelines/` with filenames like `perplexity_<topic_slug>_<year>.md`.

The preferred extraction format is `.md` or `.txt`. PDFs can remain archival
source material, but they are not part of the extraction pipeline yet.

## Workflow

1. Add or edit a source file under `knowledge-base/sources/`.
2. Run `npm run kb:extract` to create machine-generated claim candidates in `extracted/claims/pending/`.
3. Review the pending claims manually.
4. Mark reviewed claims as `human_reviewed`, `rejected`, or `needs_revision`.
5. Run `npm run kb:promote` to move reviewed claims into `reviewed/` or `rejected/`.
6. Run `npm run kb:link` to attach reviewed claim source references into the interaction dataset.
7. Run `npm run kb:validate` to verify manifests, claim files, source files, and dataset references.
8. Run `npm run kb:ingest:perplexity` only when adding Perplexity research
   syntheses as provisional claim candidates and citation leads.

## Adding a Source

Create a new `.md` or `.txt` file under one of the typed subfolders:

- `academic-papers/`
- `clinical-guidelines/`
- `expert-guidelines/`
- `traditional-contexts/`
- `legal-policy/`
- `pharmacology-reference/`

Frontmatter is optional, but recommended. When present, it can define source metadata such as `source_id`, `title`, `source_type`, `authority_level`, `evidence_domain`, `year`, `authors`, `citation`, and `url_or_path`.

## Extraction

`npm run kb:extract`

The extractor scans `.md` and `.txt` files, looks for explicit interaction/risk/mechanism language, and writes candidate claims into `extracted/claims/pending/`.

All machine-generated claims are provisional. Treat them as candidates only, not
validated evidence.

### Perplexity Research Synthesis

`npm run kb:ingest:perplexity`

Perplexity-derived markdown notes are treated as provisional secondary evidence.

- They are extracted into candidate claims with `review_state = needs_verification`.
- Their `evidence_strength` defaults to `theoretical`.
- Any citations that appear in the synthesis are copied into the citation registry as `unverified`.
- They may help close coverage gaps, but they do not upgrade dataset confidence by themselves.

## Review and Promotion

After human review, set the claim `review_state` to one of:

- `human_reviewed`
- `rejected`
- `needs_revision`

Then run:

`npm run kb:promote`

Reviewed claims move to `reviewed/`, rejected claims move to `rejected/`, and unresolved claims stay in `pending/`.

Automation may move claims only when the review state is already explicit in the
claim file. Direct bypasses around review state are defects to fix in code or
scripts, not process exceptions to normalize in documentation.

## Linking

`npm run kb:link`

The linker reads reviewed claims and adds source references to non-SELF interaction records using:

- `supports_pairs`
- entity overlap
- mechanism overlap

It does not modify SELF records, and it does not upgrade weak evidence into strong evidence.

## Validation

`npm run kb:validate`

Validation checks:

- `source_manifest.json` entries against `schemas/source.schema.json`
- claim files against `schemas/claim.schema.json`
- reviewed claims are actually marked `human_reviewed`
- rejected claims are actually marked `rejected`
- reviewed claims reference known source IDs
- manifest entries point to real source files
- dataset source references resolve to known dataset sources
- Perplexity claims stay provisional unless manually verified and corroborated by stronger evidence

## Acceptance Criteria

- Source changes are represented by files under `knowledge-base/sources/` and,
  when applicable, matching manifest/index updates.
- Claim files validate against `knowledge-base/schemas/claim.schema.json`.
- Reviewed and rejected claims have matching review states before promotion.
- Linked app data references known source IDs and does not treat provisional AI
  synthesis as standalone support for stronger classification.
- PR descriptions include what changed, verification commands, and any residual
  uncertainty for reviewers.

## Verification Commands

Run the narrowest checks that cover the change:

```bash
npm run kb:validate
npm run validate:interactions:v2
npm run lint
```

For parser or adapter work, add targeted checks such as:

```bash
npm run updates:test-parser
npm run kb:test
tsx scripts/testUIInteractionsAdapter.ts
```

## Safety Note

Machine-extracted claims are not validated evidence. They are the first pass in a review workflow, not a final citation layer.
Perplexity synthesis is useful for discovery, not authority.

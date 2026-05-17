# Natural Language Report to Interaction Update Proposal

Purpose: convert one natural-language pharmacology or harm-reduction report into
one structured `InteractionUpdateProposal` JSONL line.

`src/curation/interaction-updates.jsonl`

This prompt proposes structured data only. It does not apply or reinterpret the
report beyond the evidence it provides.

## Scope

Use this prompt for reports that identify a substance pair, mechanism, risk
interpretation, and supporting source context.

Automation may:
- Normalize the pair into existing dataset substance IDs when they are clear.
- Convert report text into the JSON shape below.
- Preserve uncertainty and source gaps explicitly.

Do not:
- Invent source IDs, quotes, locators, or direct evidence.
- Upgrade confidence because the report is persuasive.
- Mark an update as applied.

## Output rules

- Output exactly one JSON object.
- No markdown fence.
- No commentary.
- Must be valid single-line JSONL.
- Do not approve or apply the update.
- Always set `"status": "proposed"`.
- Use existing pair IDs/substance IDs from the dataset when available.
- If no structured source IDs exist, use `"source_gap"`.
- Preserve uncertainty conservatively.
- Keep output explicitly draft-oriented and never frame it as final authority.
- Use `reviewer_notes` with explicit section labels in this order:
  `Extracted: ... Inferred: ... Uncertainty: ... Draft-only: ...`
  so extracted facts, inferred suggestions, and uncertainty remain separated.
- Use current dataset-facing summary fields: `clinical_summary.headline`,
  `clinical_summary.mechanism`, `clinical_summary.timing_guidance`, and
  `clinical_summary.field_notes`.
- Put reviewer-facing action posture, monitoring, and practical cautions in
  `clinical_summary.field_notes`; do not emit the stale
  `clinical_summary.practical_guidance` key.

## Required JSON shape

{
  "update_id": "nl_<pair_key>_<short_hash>",
  "created_at": "<ISO timestamp>",
  "created_by": "manual_nl_report",
  "pair": ["<substance_a_id>", "<substance_b_id>"],
  "claim": "<one-sentence summary>",
  "source_refs": [
    {
      "source_id": "<source_id>",
      "claim_support": "direct | indirect | mechanistic | field_observation | traditional_context | extrapolated | none",
      "locator": "<optional>",
      "quote": "<optional>"
    }
  ],
  "requested_change": {
    "classification.code": "CAUTION",
    "classification.confidence": "medium",
    "clinical_summary.headline": "...",
    "clinical_summary.mechanism": "...",
    "clinical_summary.timing_guidance": "...",
    "clinical_summary.field_notes": "...",
    "mechanism.primary_category": "...",
    "mechanism.categories": ["..."],
    "evidence.tier": "...",
    "evidence.support_type": ["..."],
    "evidence.evidence_gaps": "..."
  },
  "rationale": "<condensed rationale from report>",
  "reviewer_notes": "Extracted: <source-grounded facts>. Inferred: <candidate interpretation/suggestions>. Uncertainty: <limitations, evidence gaps, ambiguity>. Draft-only: <human approval required; no publication authority>",
  "status": "proposed",
  "workflow": {
    "state": "submitted",
    "transition_history": []
  }
}

## Classification mapping

- green / low → LOW
- amber / caution / moderate → CAUTION
- unsafe / high risk → UNSAFE
- red / dangerous / contraindicated → DANGEROUS
- unknown / insufficient data → UNKNOWN

## Confidence rules

- Use `"high"` only with direct evidence or strong guideline support.
- Use `"medium"` for plausible, well-supported mechanistic or clinical-practice claims.
- Use `"low"` for sparse, speculative, or source-gap-only claims.
- If direct data are limited, cap confidence at `"medium"`.
- If the report depends on unverified synthesis or field observation only, cap
  confidence at `"low"` unless a human reviewer later adds stronger sources.

## Mechanism category rules

Use only valid v2.1 categories:
- serotonergic_toxicity
- maoi_potentiation
- psychedelic_intensification
- sympathomimetic_load
- cardiovascular_load
- qt_or_arrhythmia_risk
- cns_depression
- respiratory_depression
- seizure_threshold
- anticholinergic_delirium
- dopaminergic_load
- glutamatergic_dissociation
- gabaergic_modulation
- dehydration_or_electrolyte_risk
- psychiatric_destabilization
- operational_or_behavioral_risk
- unknown

## Acceptance criteria

- The output parses as one JSON object on one line.
- `status` is `"proposed"`.
- The pair uses known substance IDs where possible, or reviewer notes explain the
  unresolved mapping.
- Every missing or weak source link is visible in `source_refs` or
  `reviewer_notes`.
- No field claims that human review has already approved, applied, or published
  the change.

## Verification

After adding generated output to `src/curation/interaction-updates.jsonl`, run:

```sh
npm run updates:test-parser
npm run validate:interactions:v2
```

Expected output: parser and interaction validation commands exit successfully.

Known limitation: this prompt structures a proposal; it cannot establish clinical
truth, source adequacy, or publication readiness without reviewer approval.
truth, source adequacy, or publication readiness without reviewer approval.

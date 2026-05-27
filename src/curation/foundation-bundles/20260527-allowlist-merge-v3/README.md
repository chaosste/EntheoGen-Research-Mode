# Dataset Repository Foundation 20260517-165954

This bundle is a neutral foundation for evaluating information coverage in the current EntheoGen dataset. It reports only counts and provenance links: how many chunks are associated with each substance or pair, and which sources those chunks come from.

It does not grade evidence quality, does not infer medical meaning from coverage counts, and does not change interaction classifications.

## Files

- `substances.csv` - current substance table copy.
- `interactions.csv` - current single interaction-pair table copy.
- `chunks.jsonl` - normalized chunk records used for coverage counting.
- `substance_coverage.csv` / `substance_coverage.jsonl` - per-substance chunk and source counts.
- `pair_coverage.csv` / `pair_coverage.jsonl` - per-pair chunk and source counts.
- `source_catalog.csv` - source metadata represented in the chunk file.
- `unmatched_chunks.csv` - chunks not currently associated with a substance or pair by existing chunk mapping fields.
- `zero_substance_coverage.csv` / `zero_substance_coverage.jsonl` - substances with zero associated chunks, including interaction-pair counts and direct alias scan counts.
- `zero_pair_coverage_by_substance.csv` / `zero_pair_coverage_by_substance.jsonl` - pair coverage grouped by substance, including zero-coverage pair keys.
- `zero_pair_coverage_by_class.csv` / `zero_pair_coverage_by_class.jsonl` - pair coverage grouped by substance class pair, including zero-coverage pair keys.
- `unmatched_chunk_mapping_notes.csv` / `unmatched_chunk_mapping_notes.jsonl` - unmatched chunks with source provenance and direct zero-substance alias scan outputs.
- `COVERAGE_GAP_NOTES.md` - human-readable neutral gap notes.
- `manifest.json` - machine-readable bundle manifest and counts.
- `COVERAGE_SUMMARY.md` - human-readable count summary.

## Count Method

Substance coverage counts unique `chunk_id` values associated through either `candidate_substance_ids` or through matched pair membership.

Pair coverage counts unique `chunk_id` values from existing `exact_pair_matches` and `class_level_pair_matches` fields in `chunks.jsonl`.

`source_ids` and `source_titles` are copied from the chunk records.

Gap notes are derived from the existing coverage files and chunk mapping fields. Direct alias scans are string matches against the current chunk text and do not add new mappings by themselves.

## Source ID Contract

`source_id` values use short lowercase `author_year` identifiers. `previous_source_id` is retained in `source_catalog.csv` only as a migration bridge for older long IDs.

Chunk IDs use the canonical source ID as their prefix:

```text
source_id::chunk::signature
```

For example:

```text
higgins_2021::chunk::1dcbda0d3a84
```

## Pair Key Contract

Interaction pairs are unordered. The dataset stores one row per substance pair, not one row for each direction.

`pair_key` is the join key across `interactions.csv`, `pair_coverage.csv`, and chunk mapping fields. It uses the two substance IDs sorted into canonical `a|b` form.

For example, a lookup for `psilocybin` + `ketamine` should use the same row as `ketamine` + `psilocybin`:

```text
ketamine|psilocybin
```

Do not create a second reversed row such as `psilocybin|ketamine`. If a tool receives a pair in either order, sort the two IDs first, join them with `|`, then look up that canonical `pair_key`.

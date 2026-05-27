# Dataset Contract

This bundle uses a single-row interaction model.

## Pair Keys

Interaction pairs are unordered. Store and join pairs by one canonical `pair_key`.

Create `pair_key` by sorting the two substance IDs and joining them with `|`.

Examples:

```text
ketamine + psilocybin -> ketamine|psilocybin
psilocybin + ketamine -> ketamine|psilocybin
```

The reversed row should not be added.

## Joins

- Join `interactions.csv` to `pair_coverage.csv` on `pair_key`.
- Join chunk-level details through `chunk_id`.
- Join source-level details through `source_id`.

## Source IDs

Use short lowercase `author_year` `source_id` values for source joins.

`previous_source_id` in `source_catalog.csv` is a migration bridge for older long IDs and is not the canonical join key.

Chunk IDs use the canonical source ID as their prefix:

```text
source_id::chunk::signature
```

## Neutral Coverage Rule

Coverage files report counts and provenance only. They do not grade evidence, infer clinical meaning, or change interaction classifications.

# Coverage Gap Notes

This report is count-only. It lists coverage gaps and mapping-note outputs without grading evidence, making medical judgments, or changing interaction classifications.

## Zero-Chunk Substances

- `ghb_gamma_hydroxybutyrate` - GHB: 0 substance chunks; 0 interaction pairs; 0 pairs with chunks; 0 pairs without chunks; direct alias chunk hits: 0.
- `mdma_2cx_dox_nbome` - MDMA / 2C-x / DOx / NBOMe: 0 substance chunks; 0 interaction pairs; 0 pairs with chunks; 0 pairs without chunks; direct alias chunk hits: 0.
- `mephedrone` - Mephedrone: 0 substance chunks; 0 interaction pairs; 0 pairs with chunks; 0 pairs without chunks; direct alias chunk hits: 0.
- `yopo` - Yopo: 0 substance chunks; 41 interaction pairs; 0 pairs with chunks; 41 pairs without chunks; direct alias chunk hits: 0.

## Zero-Pair Coverage

- Pairs with zero associated chunks: 517
- See `zero_pair_coverage_by_substance.csv` for grouping by substance.
- See `zero_pair_coverage_by_class.csv` for grouping by substance class pair.

## Unmatched Chunks

- Unmatched chunks: 102
- See `unmatched_chunk_mapping_notes.csv` for source IDs, source titles, row indexes, questions, answers, and direct zero-substance alias scan results.

## Mapping Boundary Notes

- `mdma_2cx_dox_nbome` is marked deprecated in `substances.csv`; it has no interaction pairs in `pair_coverage.csv`.
- `nbome_series`, `two_c_x`, and `salvia` have interaction pairs but no direct alias hits in the current chunk text scan.
- `yopo` has no direct `yopo` alias hits in the current chunk text scan. Chunks mentioning bufotenine are already mapped to constituent-level IDs such as `five_meo_dmt` or `nn_dmt`, not to `yopo` by this neutral reporter.

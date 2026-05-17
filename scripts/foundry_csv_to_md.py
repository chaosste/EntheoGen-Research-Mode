#!/usr/bin/env python3
"""
Regenerate foundry/*.md as GitHub-flavored markdown pipe tables from workspace CSVs.

Reads RFC 4180 CSV (including quoted fields with embedded newlines), escapes | in
cells as \\|, and flattens newlines inside fields to single spaces so each table
row is one line.

Default layout (repo root = parent of scripts/):
  substances.csv   -> foundry/substances.md
  interactions.csv -> foundry/interactions.md
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


def md_cell(value: str | None) -> str:
    if value is None:
        return ""
    s = str(value).replace("\r\n", "\n").replace("\r", "\n")
    s = s.replace("\n", " ").replace("\t", " ")
    while "  " in s:
        s = s.replace("  ", " ")
    s = s.strip()
    return s.replace("|", "\\|")


def write_md_table(
    csv_path: Path,
    md_path: Path,
    *,
    title: str,
    preamble: str,
) -> tuple[int, int]:
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        raise ValueError(f"empty CSV: {csv_path}")
    header, body = rows[0], rows[1:]
    lines: list[str] = [
        f"# {title}",
        "",
        preamble,
        "",
        "| " + " | ".join(md_cell(h) for h in header) + " |",
        "|" + "|".join("---" for _ in header) + "|",
    ]
    for row in body:
        if len(row) < len(header):
            row = row + [""] * (len(header) - len(row))
        elif len(row) > len(header):
            row = row[: len(header)]
        lines.append("| " + " | ".join(md_cell(c) for c in row) + " |")
    md_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(header), len(body)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="repo root containing CSVs and foundry/ (default: parent of scripts/)",
    )
    parser.add_argument(
        "--substances-csv",
        type=Path,
        default=None,
        help="override path to substances.csv",
    )
    parser.add_argument(
        "--interactions-csv",
        type=Path,
        default=None,
        help="override path to interactions.csv",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="override output directory (default: <root>/foundry)",
    )
    parser.add_argument(
        "--substances-only",
        action="store_true",
        help="only write substances.md",
    )
    parser.add_argument(
        "--interactions-only",
        action="store_true",
        help="only write interactions.md",
    )
    args = parser.parse_args()
    root: Path = args.root.resolve()
    out_dir: Path = (args.out_dir or root / "foundry").resolve()
    substances_csv = (
        args.substances_csv.resolve()
        if args.substances_csv
        else root / "substances.csv"
    )
    interactions_csv = (
        args.interactions_csv.resolve()
        if args.interactions_csv
        else root / "interactions.csv"
    )

    if args.substances_only and args.interactions_only:
        print("error: use at most one of --substances-only / --interactions-only", file=sys.stderr)
        return 2

    do_substances = not args.interactions_only
    do_interactions = not args.substances_only

    note = (
        "Pipe characters in cells are escaped as `\\|`. "
        "Newlines inside fields are flattened to single spaces for valid GFM tables."
    )

    if do_substances:
        if not substances_csv.is_file():
            print(f"error: missing {substances_csv}", file=sys.stderr)
            return 1
        cols, n = write_md_table(
            substances_csv,
            out_dir / "substances.md",
            title="Substances (dataset)",
            preamble=f"Generated from `{substances_csv.name}`. {note}",
        )
        print(f"wrote {out_dir / 'substances.md'}  rows={n}  cols={cols}")

    if do_interactions:
        if not interactions_csv.is_file():
            print(f"error: missing {interactions_csv}", file=sys.stderr)
            return 1
        cols, n = write_md_table(
            interactions_csv,
            out_dir / "interactions.md",
            title="Interaction pairs (dataset)",
            preamble=f"Generated from `{interactions_csv.name}`. One row per parsed CSV record. {note}",
        )
        print(f"wrote {out_dir / 'interactions.md'}  rows={n}  cols={cols}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

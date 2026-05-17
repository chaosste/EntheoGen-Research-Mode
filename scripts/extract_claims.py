#!/usr/bin/env python3

import json
import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]

SOURCES_DIR = ROOT / "knowledge-base" / "sources"
MANIFEST_PATH = ROOT / "knowledge-base" / "indexes" / "source_manifest.json"
OUTPUT_DIR = ROOT / "knowledge-base" / "extracted" / "claims" / "pending"

SUPPORTED_EXTENSIONS = {".md", ".txt"}

CLAIM_TYPE_KEYWORDS = {
    "contraindication": ["contraindicated", "contraindication", "avoid", "should not"],
    "risk": ["risk", "adverse", "toxicity", "hypertension", "hypotension", "serotonin syndrome", "harm"],
    "interaction": ["interaction", "interact", "combined", "combination", "co-administration", "attenuate", "potentiate"],
    "mechanism": ["mechanism", "inhibit", "agonist", "antagonist", "metabolism", "receptor", "MAO", "CYP", "bioavailability"],
    "guidance": ["monitor", "recommend", "guidance", "caution", "clinical", "management"],
}

ENTITY_KEYWORDS = [
    "ayahuasca",
    "DMT",
    "N,N-dimethyltryptamine",
    "5-MeO-DMT",
    "harmine",
    "harmaline",
    "tetrahydroharmine",
    "THH",
    "MAOI",
    "MAO-A",
    "SSRI",
    "SNRI",
    "antidepressants",
    "antipsychotics",
    "LSD",
    "psilocybin",
    "psilocin",
    "mescaline",
    "ketamine",
    "lamotrigine",
    "clonidine",
    "guanfacine",
    "beta_blockers",
    "calcium_channel_blockers",
    "blood pressure",
    "heart rate",
    "5-HT2A",
    "5-HT1A",
    "CYP450",
    "CYP2D6",
    "serotonin",
]

MECHANISM_KEYWORDS = {
    "mao_inhibition": ["MAO", "MAOI", "MAO-A", "monoamine oxidase"],
    "serotonergic_modulation": ["serotonin", "5-HT", "5-HT2A", "5-HT1A"],
    "cyp_metabolism": ["CYP", "CYP450", "CYP2D6", "CYP3A4"],
    "hemodynamic_interaction": ["blood pressure", "heart rate", "hypertension", "hypotension"],
    "receptor_antagonism": ["antagonist", "block", "attenuate"],
    "receptor_agonism": ["agonist", "activation"],
    "bioavailability_increase": ["bioavailability", "orally active", "degradation", "metabolism"],
}


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Missing manifest: {MANIFEST_PATH}")

    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    if isinstance(data, list):
        return {entry["source_id"]: entry for entry in data}

    if isinstance(data, dict):
        if "sources" in data and isinstance(data["sources"], list):
            return {entry["source_id"]: entry for entry in data["sources"]}
        return data

    raise ValueError("source_manifest.json must be an array or object")


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def get_source_id(path: Path, manifest: dict) -> str:
    relative = str(path.relative_to(ROOT))

    for source_id, entry in manifest.items():
        paths = []

        if "path" in entry:
            paths.append(entry["path"])

        if "url_or_path" in entry:
            paths.append(entry["url_or_path"])

        if "file_refs" in entry and isinstance(entry["file_refs"], list):
            paths.extend(entry["file_refs"])

        normalised_paths = {p.strip("./") for p in paths if isinstance(p, str)}

        if relative in normalised_paths or relative.replace("\\", "/") in normalised_paths:
            return source_id

        if path.name in normalised_paths:
            return source_id

    return slugify(path.stem)


def extract_key_claim_blocks(text: str) -> list[str]:
    """
    Prefer explicitly structured template claims.
    Falls back to sentence extraction if no Key Claims section exists.
    """

    match = re.search(
        r"## Key Claims\s*(.*?)(?=\n## |\Z)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    if not match:
        return []

    section = match.group(1).strip()

    blocks = re.split(r"\n### Claim\s+\d+\s*\n", section, flags=re.IGNORECASE)
    blocks = [block.strip() for block in blocks if block.strip()]

    return blocks


def parse_structured_claim_block(block: str) -> dict | None:
    fields = {}

    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("- "):
            continue

        if ":" not in line:
            continue

        key, value = line[2:].split(":", 1)
        key = key.strip()
        value = value.strip()

        fields[key] = value

    if "claim" not in fields:
        return None

    entities = parse_list_field(fields.get("entities", "[]"))
    mechanisms = infer_mechanisms(fields["claim"])

    return {
        "claim": fields["claim"],
        "claim_type": normalise_claim_type(fields.get("type", infer_claim_type(fields["claim"]))),
        "entities": entities or infer_entities(fields["claim"]),
        "mechanism": mechanisms,
        "directionality": null_if_empty(fields.get("directionality")),
        "evidence_strength": normalise_evidence_strength(fields.get("evidence_strength", "weak")),
        "confidence": normalise_confidence(fields.get("confidence", "low")),
        "supports_pairs": infer_supports_pairs(entities),
        "clinical_actionability": infer_actionability(fields["claim"]),
        "notes": null_if_empty(fields.get("notes")),
    }


def parse_list_field(value: str) -> list[str]:
    value = value.strip()

    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [item.strip().strip('"').strip("'") for item in inner.split(",") if item.strip()]

    return []


def sentence_split(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text)
    return re.split(r"(?<=[.!?])\s+", text)


def extract_candidate_sentences(text: str) -> list[str]:
    candidates = []

    for sentence in sentence_split(text):
        lowered = sentence.lower()

        if len(sentence) < 40 or len(sentence) > 500:
            continue

        if any(keyword.lower() in lowered for keywords in CLAIM_TYPE_KEYWORDS.values() for keyword in keywords):
            candidates.append(sentence.strip())

    return dedupe(candidates)


def infer_claim_type(text: str) -> str:
    lowered = text.lower()

    for claim_type, keywords in CLAIM_TYPE_KEYWORDS.items():
        if any(keyword.lower() in lowered for keyword in keywords):
            return claim_type

    return "mechanism"


def normalise_claim_type(value: str) -> str:
    allowed = {"mechanism", "interaction", "risk", "contraindication", "guidance"}
    value = value.strip().lower()
    return value if value in allowed else "mechanism"


def normalise_evidence_strength(value: str) -> str:
    allowed = {"strong", "moderate", "weak", "theoretical"}
    value = value.strip().lower()
    return value if value in allowed else "weak"


def normalise_confidence(value: str) -> str:
    allowed = {"high", "medium", "low"}
    value = value.strip().lower()
    return value if value in allowed else "low"


def infer_entities(text: str) -> list[str]:
    found = []

    for entity in ENTITY_KEYWORDS:
        pattern = r"\b" + re.escape(entity) + r"\b"
        if re.search(pattern, text, flags=re.IGNORECASE):
            found.append(entity)

    return dedupe(found)


def infer_mechanisms(text: str) -> list[str]:
    found = []
    lowered = text.lower()

    for mechanism, keywords in MECHANISM_KEYWORDS.items():
        if any(keyword.lower() in lowered for keyword in keywords):
            found.append(mechanism)

    return dedupe(found)


def infer_supports_pairs(entities: list[str]) -> list[list[str]]:
    """
    Conservative: only create pairs if at least 2 entities are present.
    Avoid creating every possible pair from noisy entity lists.
    """
    if len(entities) < 2:
        return []

    clean = [slugify(e) for e in entities[:4]]
    pairs = []

    for i in range(len(clean)):
        for j in range(i + 1, len(clean)):
            pairs.append([clean[i], clean[j]])

    return pairs


def infer_actionability(text: str) -> str:
    lowered = text.lower()

    if "contraindicated" in lowered:
        return "contraindicated"
    if "avoid" in lowered:
        return "avoid"
    if "caution" in lowered or "risk" in lowered:
        return "caution"
    if "monitor" in lowered:
        return "monitor"

    return "none"


def null_if_empty(value):
    if value is None:
        return None
    value = str(value).strip()
    return value if value else None


def dedupe(items: list[str]) -> list[str]:
    seen = set()
    out = []

    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            out.append(item)

    return out


def build_claim(source_id: str, index: int, candidate: dict) -> dict:
    return {
        "claim_id": f"{source_id}_claim_{index:03d}",
        "source_id": source_id,
        "claim": candidate["claim"],
        "claim_type": candidate["claim_type"],
        "entities": candidate.get("entities", []),
        "mechanism": candidate.get("mechanism", []),
        "directionality": candidate.get("directionality"),
        "evidence_strength": candidate.get("evidence_strength", "weak"),
        "confidence": candidate.get("confidence", "low"),
        "supports_pairs": candidate.get("supports_pairs", []),
        "clinical_actionability": candidate.get("clinical_actionability", "none"),
        "review_state": "machine_extracted",
        "notes": candidate.get("notes"),
        "extraction": {
            "method": "rule_based_markdown_extractor_v1",
            "extracted_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        },
    }


def extract_claims_from_file(path: Path, manifest: dict) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    source_id = get_source_id(path, manifest)

    candidates = []

    structured_blocks = extract_key_claim_blocks(text)

    for block in structured_blocks:
        parsed = parse_structured_claim_block(block)
        if parsed:
            candidates.append(parsed)

    if not candidates:
        for sentence in extract_candidate_sentences(text):
            entities = infer_entities(sentence)
            candidates.append(
                {
                    "claim": sentence,
                    "claim_type": infer_claim_type(sentence),
                    "entities": entities,
                    "mechanism": infer_mechanisms(sentence),
                    "directionality": None,
                    "evidence_strength": "weak",
                    "confidence": "low",
                    "supports_pairs": infer_supports_pairs(entities),
                    "clinical_actionability": infer_actionability(sentence),
                    "notes": "Fallback sentence-level extraction; requires review.",
                }
            )

    return [build_claim(source_id, idx + 1, candidate) for idx, candidate in enumerate(candidates)]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest()

    files = [
        path
        for path in SOURCES_DIR.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not files:
        print(f"No supported source files found in {SOURCES_DIR}")
        return

    total_claims = 0

    for path in files:
        claims = extract_claims_from_file(path, manifest)

        if not claims:
            print(f"No claims extracted from {path}")
            continue

        source_id = claims[0]["source_id"]
        output_path = OUTPUT_DIR / f"{source_id}.claims.json"

        output_path.write_text(
            json.dumps(claims, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        total_claims += len(claims)
        print(f"Extracted {len(claims)} claims → {output_path.relative_to(ROOT)}")

    print(f"Done. Extracted {total_claims} candidate claims.")


if __name__ == "__main__":
    main()
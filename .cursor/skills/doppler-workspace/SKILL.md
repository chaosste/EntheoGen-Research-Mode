---
name: doppler-workspace
description: >-
  Stephen’s Doppler-first secrets layout (private GitHub chaosste/doppler, doppler-hub
  templates). Use when wiring env vars, avoiding committed API keys, Doppler CLI
  (login, setup, run, download), local .env.local / exports, Hermes or OpenClaw
  reinstall paths, or emulating “never have to think about API keys again.”
---

# Doppler workspace — keys without brain tax

**Maxim:** Treat **Doppler** as the **only** long-lived store of real API keys and tokens. Git, issues, and chat get **names and shapes** (`env.example`), not values. Prefer **`doppler run`** so shells and scripts inherit secrets **without** writing a dotenv file.

## Canonical layout

| What | Where |
|------|--------|
| Private hub repo | `https://github.com/chaosste/doppler` (clone at `~/Projects/doppler` when present) |
| Variable **schema** only | `doppler-hub/env.example` in that repo — grouped keys, empty values |
| Ignored local exports | Repo root `.gitignore`: `*.env.local`, `*secrets*.env`, `**/Hermes*.env`, `doppler_dev_shared-env.yml`, etc. |
| Machine-only Hermes / OpenClaw files | **Outside** `Projects/doppler` (e.g. `~/.config/chaosste/secrets/`) so clean reinstalls and reclones never delete the only copy |

Longer narrative: `~/Projects/doppler/README.md` on `main`.

## Default workflows (CLI)

1. **One-off command with full env (best default):**  
   `doppler run -- your-command`  
   from a directory where `doppler.yaml` / project linkage exists, or after `doppler setup` for that project.

2. **Need a file for a tool that only reads dotenv:**  
   `doppler secrets download --no-file --format env > ./doppler-dev-shared.env.local`  
   (filename must stay **gitignored**; never stage it.)

3. **First machine / new clone:**  
   `doppler login` → `doppler setup` (pick workplace / project / config) → then `run` or `download` as above.

Prefer **no committed `.env`** anywhere; if a product repo needs `.env.example`, keep it **placeholder-only** and load real values via Doppler or CI secrets.

## Anti-patterns (do not do)

- Committing `*.env`, `*secrets*.env`, `doppler*.env.local`, or YAML/JSON exports that contain values.
- Pasting live keys into PRs, Linear, or agent transcripts “just to test.”
- Relying on repo history to “remove” a leaked key — **rotate** in the provider and Doppler.

## EntheoGen overlap

When this repo needs DB or Supabase URLs for local scripts, use **`.env.local`** (gitignored) populated from Doppler or a one-off download — same rule: **never commit** values. See `AGENTS.md` and `docs/automation/SUPABASE_PHASE1_CSV_PIPELINE.md` for pipeline-specific vars.

## When unsure

- Add or rename a key in **Doppler** first, then update **`doppler-hub/env.example`** on `chaosste/doppler` in a separate commit (names only).
- For library-specific Doppler + framework integration, prefer **current Doppler docs** (Context7 MCP: resolve `dopplerhq/cli` or project docs) rather than guessing flags.

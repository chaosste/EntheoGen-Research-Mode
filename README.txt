ENTHEOGEN HANDOVER NOTES
========================

Project rename
--------------
- SeshGuard -> NTT -> EntheoGen

Core behavior changes
---------------------
- Interaction guidance is now deterministic and evidence-grounded.
- No free-form "combined effects prediction" engine.
- Unknown evidence returns explicit UNK classification instead of guessed output.

Main files
----------
- /src/App.tsx
  UI branding, privacy text, /docs public documentation route, evidence snapshot rendering, links to NewPsychonaut breadcrumbs.
- /src/data/drugData.ts
  Ceremonial entities, risk legend, and pairwise evidence rules.
- /src/services/ruleBasedReadoutService.ts
  Rule-based markdown generation for interaction and substance summaries.
- /docs/DEPLOYMENT.md
  Canonical repository, Azure deployment model, fork cleanup status, and safe-change boundaries.
- /docs/public-documentation.md
  Public-facing documentation rendered by the Vite app at /docs.

Deployment position
-------------------
- Canonical repo: https://github.com/EntheoGen-Development-Hub/EntheoGen-Research-Mode
- Development hub: https://github.com/EntheoGen-Development-Hub
- The same GitHub Actions package deploys to both Azure Web Apps:
  - https://entheogen-research-mode-gpfuhxfae9f8hcgd.swedencentral-01.azurewebsites.net/
  - https://entheogen.azurewebsites.net/
- The old fork deploy path is cleaned up. Do not reconnect fork workflows, secrets, or Azure Deployment Center unless explicitly asked.
- Both Azure apps use node server.js.

Privacy position
----------------
- Accurate claim: local favorites are stored in browser localStorage.
- Do not claim "we store nothing anywhere" without infra proof.
- Transparent wording included: hosting/CDN/provider logs may still exist.

RAG feasibility (practical view)
--------------------------------
- Realistic and strong next step if you want expert-grounded depth without hallucinated pair effects.
- Suggested architecture:
  1) Curate trusted corpus (papers, protocols, expert notes) with citation metadata.
  2) Chunk + embed, store in vector DB.
  3) Retrieval + strict citation requirement for generated output.
  4) Keep final risk classification constrained to your rule layer; use RAG for rationale/context only.
  5) Add confidence gates: if retrieval confidence low -> return "insufficient evidence."

Swiss hosting / anonymity note
------------------------------
- Swiss hosting helps jurisdiction/compliance posture but does not imply anonymity.
- True anonymity requires explicit logging controls, IP handling policy, and infrastructure configuration.
- Keep claims precise and auditable.

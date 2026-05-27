# EntheoGen Research Mode

EntheoGen Research Mode is the beta interaction-guide app for evaluating and
presenting the EntheoGen evidence dataset. It is an educational harm-reduction
tool, not medical advice.

## Source Of Truth

- Canonical repository:
  <https://github.com/EntheoGen-Development-Hub/EntheoGen-Research-Mode>
- Project hub:
  <https://github.com/EntheoGen-Development-Hub>
- Public app URLs:
  - <https://entheogen-research-mode-gpfuhxfae9f8hcgd.swedencentral-01.azurewebsites.net/>
  - <https://entheogen.azurewebsites.net/>

Both Azure Web Apps receive the same package from the canonical repository's
GitHub Actions workflow. The longer Research Mode URL is the current Azure app;
`entheogen.azurewebsites.net` is kept as the legacy/public URL for continuity.

## Local Development

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
npm test
```

`npm run build` refreshes the static dataset bundle before building. Avoid
committing timestamp-only changes in `public/dataset/manifest.json` unless the
dataset artifacts are intentionally being refreshed.

## Deployment Notes

Deployment is currently healthy. Do not rework Azure workflows, secrets,
Deployment Center connections, or app startup unless that is the explicit task.

Future deployable changes should be made from the canonical repository. Before
pushing work intended for deployment, update local `main` from `origin/main`,
run the relevant checks, then push the updated commit to `main`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the current deployment model,
fork cleanup status, and safe-change boundaries.

## Public Documentation

The app serves a public documentation page at `/docs`. The page content lives in
[docs/public-documentation.md](docs/public-documentation.md) and is rendered by
the Vite app, keeping public-facing docs close to the product without adding a
new documentation framework.

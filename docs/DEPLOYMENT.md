# Deployment Notes

This document records the current deployment model so future app, docs, and
dataset changes do not accidentally reopen the old deploy path.

## Current State

- Canonical repository:
  <https://github.com/EntheoGen-Development-Hub/EntheoGen-Research-Mode>
- Latest known good deployment commit: `c789ec4`
- GitHub Actions workflow: `.github/workflows/azure-deploy.yml`
- Startup command for both Azure Web Apps: `node server.js`
- Primary Azure Web App:
  <https://entheogen-research-mode-gpfuhxfae9f8hcgd.swedencentral-01.azurewebsites.net/>
- Legacy/public Azure Web App:
  <https://entheogen.azurewebsites.net/>

Both Azure Web Apps are deployed from the same build artifact produced by the
canonical repository workflow. The legacy app exists for continuity while the
Research Mode app name remains explicit in Azure.

## Fork Cleanup

The `chaosste/EntheoGen-Research-Mode` fork has been removed from the deploy
path:

- Azure secrets were deleted from the fork.
- Fork workflows were disabled.
- Azure Deployment Center was disconnected from the fork.

Do not restore fork-based deployment unless that is the explicit requested
change.

## Package Shape

The workflow builds the Vite app, copies `dist/` into a deploy package, then
adds `package.json` and `server.js`. The deployed app runs with `node server.js`.

`server.js` prefers a root `index.html` when present, then falls back to `dist/`.
That behavior protects Azure `wwwroot` from serving stale `dist/` leftovers.

## Safe Future Deploys

Before pushing a change that should feed deployment:

1. Update local `main` from `origin/main`.
2. Make the smallest focused change.
3. Run checks that cover the touched surface, usually:
   - `npm run typecheck`
   - `npm run build`
   - targeted dataset or validation scripts when data changes are involved
4. Push from the updated canonical checkout to `main`.
5. Confirm the GitHub Actions deployment completed for both Azure Web Apps.

## Do Not Touch Without An Explicit Task

- Azure publish-profile secrets.
- GitHub Actions deployment wiring.
- Azure Deployment Center connections.
- App Service startup command.
- Fork workflow settings.
- `server.js` deploy-root behavior.

Docs, copy, source links, and static public documentation can normally be changed
without touching deployment infrastructure.

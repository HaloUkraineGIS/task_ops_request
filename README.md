# TaskOps Request

A GitHub Pages–hosted, fully static internal web app for HALO Ukraine GIS
staff to bulk-create task requests (points) in an ArcGIS Enterprise
feature service (**WrFS**), copying each point's core attributes from a
reference feature service (**ReFS**), filtered by a mandatory unit
(region) polygon selection, previewed on a map before a single batch
`applyEdits` submission.

## ⚠️ Known open risk — read before assuming an app bug

There is an unresolved, intermittent issue where `created_user` /
`created_date` on WrFS records have sometimes not matched the actual
submitting user / time, even though Editor Tracking is configured
correctly and the client never sends these fields. This looks like an
ArcGIS Enterprise topology/federation issue, not an app bug. **Before**
extensive feature testing on a new deployment, run the identity
diagnostic in the "Deployment checklist" below. See inline comments in
`src/modules/wrfs.ts` for where these fields are deliberately excluded
from every `applyEdits` payload.

## Tech stack

- Vite + TypeScript (vanilla, no framework)
- ArcGIS Maps SDK for JavaScript v4.x (`@arcgis/core`), pinned exact version
- Calcite Design System (dark mode)
- GitHub Actions → GitHub Pages

## Local development

```bash
npm install
npm run dev
```

Requires `http://localhost:5173/` registered as a redirect URI on the
OAuth application (see below).

## Configuration

All ArcGIS Enterprise URLs, IDs, and field mappings live in
`src/config.ts`. Before first use:

1. Verify/re-obtain the WebMap item ID, ReFS/WrFS/Zones URLs in
   `src/config.ts`.
2. Create a **new, dedicated** OAuth 2.0 Application in Portal
   (Authorization Code + PKCE, public client — no secret). Register:
   - `https://<org>.github.io/<REPO_NAME>/`
   - `http://localhost:5173/`
3. Put the Client ID into `oauthAppId` in `src/config.ts`.
4. Confirm CORS on every ArcGIS Server hosting ReFS/WrFS/Zones allows the
   GitHub Pages origin.
5. Confirm Editor Tracking on WrFS maps `creationDateField`→`created_date`,
   `creatorField`→`created_user`, `editDateField`→`last_edited_date`,
   `editorField`→`last_edited_user`, all four `editable:false`.

## Deployment checklist

1. Set `vite.config.ts` → `base: "/<REPO_NAME>/"` to match the repo name
   exactly (case-sensitive).
2. Push to `main`. In repo Settings → Pages, set Source to **"GitHub
   Actions"** (not "Deploy from a branch").
3. Confirm the Actions run is green; open the Pages URL in an incognito
   window; check DevTools console for a clean load (no 404s on
   `/assets/icon/...` or `/assets/*/t9n/...`).
4. Sign in as two different real users and run the identity diagnostic
   described in the code comments at the top of `src/modules/wrfs.ts`
   before extensive feature testing.
5. Walk the full functional flow once end-to-end: pick a unit → add 2+
   rows with different task codes → fill all fields → submit → confirm
   modal → success banner → bottom table shows new rows → collapse/expand
   and resize both side and bottom panels.

## Project structure

```
├── .github/workflows/deploy.yml
├── scripts/copy-calcite-assets.mjs
├── src/
│   ├── config.ts
│   ├── main.ts
│   ├── styles/main.css
│   └── modules/
│       ├── auth.ts
│       ├── refs.ts
│       ├── zones.ts
│       ├── map.ts
│       ├── panel.ts
│       ├── table.ts
│       ├── modal.ts
│       ├── wrfs.ts
│       └── resizable.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

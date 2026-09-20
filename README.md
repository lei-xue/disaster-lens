# DisasterLens

A FEMA disaster data dashboard MVP — a static React + TypeScript SPA that fetches
disaster declarations live from the OpenFEMA v2 API and visualizes them with
recharts. No backend, no API key, no analytics.

## Pages

- `/#/` — Dashboard: year range, state, and incident-type filters; KPI cards; a US
  state choropleth; declarations by state (top 15), per year, and share by
  incident type.
- `/#/disasters` — searchable, sortable table of loaded declarations (25/page)
  with a detail view at `/#/disaster/:disasterNumber`.
- `/#/preparedness` — static before/during/after preparedness guidance.
- `/#/about` — data source, declaration types (DR/EM/FM), disclaimer.

## Commands

```sh
npm install
npm run dev      # local dev server
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm test         # node --test
npm run preview  # serve the production build
```

## Data

Fetched client-side from
`https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries` (CORS open).
Requests page in batches of 1000 and caps at 5000 records; the last successful
result is cached in memory only. Deploy constraints: relative asset paths
(`base: './'`) and a HashRouter — the host has no SPA fallback.

DisasterLens is informational only — in an emergency, follow your local
officials.

# DisasterLens

An English, static React + TypeScript dashboard that fetches disaster declarations online from OpenFEMA v2. No business backend, API key or application analytics. **Online data retrieval is not real-time hazard monitoring**: the app does not poll or push alerts, and freshness depends on FEMA publishing updates.

## Pages

- `/#/` — year/state/type filters, loaded-record KPIs, state map and charts.
- `/#/disasters` — search, sort and paginate loaded records (25 per page).
- `/#/disaster/:disasterNumber` — independently paginated detail query; direct visits and refresh work without a dashboard cache.
- `/#/preparedness` — emergency preparation guidance.
- `/#/about` — source, count definitions, limitations and disclaimer.

## Commands

Use a Node version supporting native TypeScript type stripping (verified with Node 26).

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

Browser regression scenarios are documented in [acceptance](docs/acceptance.md). They distinguish synthetic edge-case fixtures from actual API checks.

## Data and completeness

Queries fetch client-side from `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries`, in 1,000-row batches up to a 5,000-record safety bound. A short final page establishes completion for that request; reaching the bound displays **may be incomplete**, even when exactly 5,000 records exist. It does not claim a known full total. A later-page failure rejects the request instead of presenting partial records as complete. Invalid records are reported, not silently dropped.

Counts represent declaration records for designated areas (usually counties), **not unique disasters**. Map/chart rankings and search cover only loaded records. The successful query snapshot, data and bound status are cached together in memory. Editing draft filters does not relabel existing results; only a successful applied request changes their scope. Details fetch the selected disaster independently of dashboard filters; the same bound and failure behavior apply. Live API paging is not a transactional snapshot and can change while FEMA updates data.

## Build and hosting

`dist/` is a pure static frontend using relative assets and HashRouter; no SPA fallback or server runtime is required. The footer displays package version (`0.1.1`), UTC build time and short commit SHA. CI uses `CF_PAGES_COMMIT_SHA` or `GITHUB_SHA`, with local Git fallback. An uncommitted build's SHA refers to its base commit, not unpublished edits.

English title, description, Open Graph and Twitter text are included. The repository has no confirmed production domain, so canonical/OG URL tags are deliberately deferred rather than invented. No social-image URL is claimed.

DisasterLens is not affiliated with FEMA and is informational only. In an emergency, follow local officials. See [acceptance and remaining limitations](docs/acceptance.md) for what was actually tested and what remains unverified.

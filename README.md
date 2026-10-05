# DisasterLens

An English, static React + TypeScript dashboard for FEMA disaster declaration history and current National Weather Service weather-alert snapshots. No business backend, API key or application analytics. **Online retrieval is not guaranteed real-time hazard monitoring**: FEMA history loads on request; the separate Alerts page offers optional 5-minute polling while visible, not push notifications. Freshness depends on each official source.

## Pages

- `/#/` — year/state/type filters, loaded-record KPIs, state map and charts.
- `/#/disasters` — search, sort and paginate loaded records (25 per page).
- `/#/disaster/:disasterNumber` — independently paginated detail query; direct visits and refresh work without a dashboard cache.
- `/#/preparedness` — emergency preparation guidance.
- `/#/alerts` — current active NWS weather alerts for a user-selected state/territory; nothing loads until a state is chosen and "Load alerts" is clicked.
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

Browser regression scenarios are documented in [acceptance](docs/acceptance.md). They distinguish synthetic edge-case fixtures from actual API checks. The [cross-project cache repair backlog](docs/cross-project-cache-backlog.md) records verified redundant requests, source-specific caching/privacy constraints, and the ordered repair queue; planned items are not completed fixes.

## Data and completeness

Queries fetch client-side from `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries`, in 1,000-row batches up to a 5,000-record safety bound. A short final page establishes completion for that request; reaching the bound displays **may be incomplete**, even when exactly 5,000 records exist. It does not claim a known full total. A later-page failure rejects the request instead of presenting partial records as complete. Invalid records are reported, not silently dropped.

Counts represent declaration records for designated areas (usually counties), **not unique disasters**. Map/chart rankings and search cover only loaded records. Successful exact-query snapshots retain records, query, original UTC retrieval time and bound status together in a schema-versioned IndexedDB cache, with memory fallback when storage is unavailable. Historical snapshots have a 24-hour freshness window; older snapshots are explicitly stale and refresh the same applied query. Storage is bounded to six query snapshots and twenty independently keyed disaster details. Editing draft filters does not relabel existing results. Selecting an actual state shape by click, Enter or Space applies that state's exact query using the loaded year/type scope; the state select remains available for small states and territories. A capped global snapshot never stands in for an uncached state query.

Dashboard **Refresh data** and detail **Refresh details** bypass the successful snapshot cache. Failed refreshes retain the last good records, scope and retrieval time with a stale/error label; Retry targets the failed query rather than draft controls. **Clear cached data** removes browser snapshots without automatically refetching or hiding already displayed results. Browser eviction/private-mode restrictions can prevent persistence; the UI does not promise a durable copy when a write failed. Details still fetch independently of dashboard filters and apply the same paging bound and failure behavior. Live API paging is not a transactional snapshot and can change while FEMA updates data. This historical-data policy is **not** applied to NWS alerts.

The Alerts page is a separate data source: it fetches current active weather alerts client-side from `https://api.weather.gov/alerts/active` for one user-selected state/territory per request (`status=actual`, `message_type=alert,update`; the endpoint supports no pagination, so none is requested, and rendering is capped at 500 records with a visible notice). The query includes only the selected state code plus normal connection information (IP address, browser headers) that NWS receives; the app does not request device geolocation or any browser permission. Snapshots may be delayed or cached and cover official NWS weather alerts only, not all hazards; it is not a guaranteed real-time warning or notification service — optional auto-refresh is a 5-minute poll while the tab is visible, never push. Always follow local officials.

Identical concurrent FEMA queries share the entire active paged request, keyed by exact query/detail ID and transport identity. Each caller keeps its own cancellation: leaving one consumer does not cancel another; the last cancellation aborts upstream and allows an immediate fresh retry. Settled and failed flights are removed, so this is not a second completed-result cache and does not bypass force-refresh behavior. NWS polling is not coalesced by this historical-data module.

## Build and hosting

`dist/` is a pure static frontend using relative assets and HashRouter; no SPA fallback or server runtime is required. The footer displays package version (`0.2.2`), UTC build time and short commit SHA. Pages load on demand, so non-dashboard entries do not download the map/chart chunk; the navigation shell stays available while a page chunk loads. CI uses `CF_PAGES_COMMIT_SHA` or `GITHUB_SHA`, with local Git fallback. An uncommitted build's SHA refers to its base commit, not unpublished edits.

English title, description, Open Graph and Twitter text are included. The user-confirmed production document URL is `https://disasterlens.leixue.dev/`, now used for canonical and Open Graph URL metadata. No social-image URL is claimed. A local build or feature-branch push is not proof this domain serves the new release; the user handles deployment.

DisasterLens is not affiliated with FEMA and is informational only. In an emergency, follow local officials. See [acceptance and remaining limitations](docs/acceptance.md) for what was actually tested and what remains unverified.

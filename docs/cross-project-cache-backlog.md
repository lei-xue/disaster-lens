# Cross-project cache repair backlog

Status: audited scopes recorded at 2026-10-05T07:32:33Z; the DisasterLens exact-snapshot/cache-map milestone is verified in v0.2.1, with safe in-flight request coalescing verified in v0.2.2. Cinemate P1 is verified locally in v0.1.2, committed as `4b9555f04ffbb4bf305293ae2cad6a12a0109e34`; CharityCheck and MindBridge remain queued. This is the canonical cross-project cache queue for this continuation, not a deployment or whole-roadmap completion claim. The user subsequently authorized pushing all verified changes for inspection. Publication is tracked separately from local acceptance; no production deployment is claimed here. Deployment remains the user's responsibility.

## Audited sources and evidence

Remote refs were fetched without changing the other worktrees; their inspected HEAD and fetched origin/main agreed:

- DisasterLens audit baseline: https://github.com/lei-xue/disaster-lens at `dc72cf1`; https://disasterlens.leixue.dev/ rendered an older UI without the release footer/Alerts navigation during the recorded audit. That source baseline also had the caching defect; subsequent v0.2.1/v0.2.2 repairs are documented below, not a claim of a production update.
- Cinemate: https://github.com/lei-xue/cinema-app at `ccfe5bb`; live https://movies.leixue.dev/.
- MindBridge: https://github.com/lei-xue/mindbridge at `7732ad3`; live https://mindbridge.leixue.dev/.
- CharityCheck: https://github.com/lei-xue/charity-check at `5222d2e`; live https://charitycheck.leixue.dev/.

Unmocked production-browser observations:

- DisasterLens: initial Dashboard 5 FEMA requests; Dashboard to Explore 0; Explore Next 0; returning to Dashboard 5; applying identical filters 5; full reload 5. No localStorage entries or IndexedDB databases observed. Each count is browser-initiated requests, not a claim about upstream server/CDN cache hits.
- Cinemate: Home, Popular, Home return, Popular return each initiated 1 TMDB request, with HTTP 200 in every sampled transition. Source `src/hooks/useFetch.js:15–52` always fetches on URL/reload changes; `src/pages/MovieDetail.js:17–53` independently fetches each detail mount. Theme storage is not result caching. API keys and full API URLs were not recorded in the audit.
- CharityCheck: two explicit submissions of the same public organization EIN each initiated 1 lookup request and returned HTTP 200. `src/components/LiveLookup.tsx:30–59` resets state and calls `lookup` every time; `src/lib/lookup.ts:72–80` unconditionally requests the Worker. Worker responses specify `Cache-Control: no-store`. Curated browsing is bundled snapshot data and is not refetched from ProPublica on every local filter/page action. Build-time snapshot downloader caching is a different concern and is already present.
- MindBridge: `CaliforniaFacilitySearch.tsx:5–11` imports public snapshots; county/most postal searches and table pagination filter those local records rather than downloading every directory again. The LA-specific explicit search calls `searchLaCounty` each time (`CaliforniaFacilitySearch.tsx:99–118`, `src/lib/laCountySearch.ts:6–16`) with no shared result cache; its Worker uses no-store responses. This LA subsection is a source-confirmed cache opportunity, not a claim that every MindBridge click fetches all providers. A repeated live LA browser replay remains a required pre-implementation check; no personal search or device location was used for this audit.

The initial Cinemate/Charity browser harness used only network-idle and observed race-prone counts. It was corrected to register a matching response wait before each action and await completion; only the resulting counts above are accepted.

## Ordered repair queue

Priorities express execution order, not invented calendar deadlines. Cache durations below are proposals to validate against source behavior and privacy, not implemented freshness guarantees.

### 1. P0 — DisasterLens historical snapshots and map correctness

- [x] Add bounded, schema-versioned persistent browser caching for successful exact FEMA query snapshots and independent detail IDs, including records, query, fetchedAt and limitReached together.
- [x] Check fresh snapshots on mount, repeated Apply/Reset, route return and reload; restore the successful applied query without relabeling data from draft controls.
- [x] Use a 24-hour historical-data freshness window, show retrieval time, provide force Refresh and Clear cached data. TTL expiry never silently presents a snapshot as fresh.
- [x] Persist successful validated FEMA fetch results; corrupt/schema-mismatched entries, quota failures or unavailable IndexedDB degrade safely. Retain last good results and clearly identify stale/error state after failed refresh.
- [x] Never use a capped global query as if it were a complete different state/year/type query. Preserve the 5,000-area-row safety bound and 'may be incomplete' semantics.
- [x] Coalesce safe identical in-flight work without allowing one consumer's navigation abort to cancel another consumer's request. Verified in v0.2.2 with subscriber-owned cancellation, collision-safe exact keys, per-transport isolation and complete paged-result reuse.
- [x] Keep NWS freshness separate: no historical 24-hour alert policy, no initial inferred-state request, and no claims of guaranteed realtime delivery. Explicit refresh still queries the source.
- [x] Repair real-path activation and accessible state names; browser checks cover click/Enter/Space and path-shaped focus/selected strokes. The practical state-select equivalent remains for small states/DC and touch devices; physical-device touch acceptance is still unverified.
- [x] Verify fresh-cache Dashboard/Explore/back, identical Apply and reload each add **0 FEMA requests**; a new uncached query makes only its required page requests, not an asserted single request. Force Refresh requests the source; failure preserves truthful previous-snapshot labels.

See [v0.2.1 acceptance](acceptance.md#v021-historical-cache-and-state-map-acceptance) and [unmocked request-count evidence](cache-live-evidence-v0.2.1.json). Storage is bounded to six query snapshots plus twenty detail snapshots. Cached A/B/A selections update the last-applied pointer without changing original retrieval time. Expired Dashboard/Explore/detail snapshots survive a failed source refresh with stale labels; writes/evictions/clear are serialized and durable success waits for transaction commit. In-flight **network** coalescing is verified separately in [v0.2.2 acceptance](acceptance.md#v022-subscriber-safe-in-flight-coalescing): no global AbortController was introduced, and completed-result caching remains separate from active request sharing.

The parallel Kimi K3 source/evidence review supports this direction. Its 'exactly one request' new-query criterion is corrected here because FEMA pagination can require multiple pages. The audited baseline UI error hid prior data without erasing the stored entry; the implemented repair addressed the display/state transition rather than falsely describing the in-memory data as destroyed.

### 2. P1 — Cinemate list/search/detail result reuse

- [x] Add a bounded result cache keyed by actual endpoint, submitted search, page and applicable locale/filter parameters; do not persist API keys as cache-key or result metadata. Implemented a versioned 40-entry memory-only LRU; unknown parameters bypass caching.
- [x] Reuse recent successful lists when switching categories/back and successful movie details on revisit. Cache movie results separately from theme settings and image HTTP caching.
- [x] Adopt 15-minute list/search and 6-hour detail freshness for this gate; preserve original retrieval time, label stale fallback and retain explicit force-refresh/retry behavior.
- [x] Cache validated successes only, preserve rapid-query cancellation guards and reject partial/failed responses. Browser persistence was deliberately not adopted, so storage corruption/quota handling is not applicable and searches do not survive reload.
- [x] Verify Home→Popular→Home→Popular and detail revisits add 0 result API requests against both synthetic replay and unmocked TMDB; explicit real detail refresh adds 1. Synthetic search reuse, refresh failures, timestamp retention, retries and 320/390/1440px geometry also pass.

Evidence: Cinemate `docs/cache-acceptance-v0.1.2.md`; clean install, 61/61 Jest tests, lint, optimized production build and 112/112 metadata checks passed. This is local artifact acceptance, not a claim that `https://movies.leixue.dev/` has been updated.

### 3. P2 — CharityCheck explicit live lookup and source-page reuse

- [ ] Keep existing bundled curated search/filter/pagination local; do not add a new fetch pipeline to it.
- [ ] Cache validated live lookup pages by submitted EIN/name plus source page; reuse successful identical submissions and previously visited source pages, with bounded storage and visible retrieval time.
- [ ] Propose 15-minute application freshness initially; any change to Worker no-store/privacy policy requires a separate deliberate review, not a blanket CDN override.
- [ ] Preserve exact EIN validation, source-reported pagination/counts, empty/error meanings and latest-query guards. Retry/Refresh can explicitly bypass cache.
- [ ] A cached ProPublica result is **not current IRS verification**, tax-exempt-status proof, or a live donation-eligibility guarantee. Keep that distinction visible.
- [ ] Verify repeated identical successful lookup/page revisits add 0 requests within freshness; explicit refresh, invalid identifiers and obsolete responses remain correct.

### 4. P2 — MindBridge LA live directory only, privacy-first

- [ ] First replay the explicit LA live-search flow in a real browser; confirm which repeated actions actually request the backend.
- [ ] Leave local facility snapshots, county contacts, ordinary filtering and resource cards alone; those are not the DisasterLens-style redundant-download defect.
- [ ] Prefer a short-lived, bounded **memory-only** live-result cache keyed by search type/submitted value. Do not silently persist mental-health searches, postal inputs or device coordinates in localStorage, IndexedDB, URLs or analytics.
- [ ] Propose a five-minute live-result freshness window with explicit refresh and retrieval-time labeling; retain source attribution and never promise current appointments or provider availability.
- [ ] Preserve cancellation on query/mode changes, opt-in transfer disclosure, local manual browsing, and the existing single-attempt geolocation deadline. Location requests are not a response-cache mechanism.
- [ ] Verify repeated identical explicit LA search uses the recent successful result without a new POST; changed inputs query the appropriate source, failures never become cached successes, and personal search data does not survive reload.

## Shared acceptance and boundaries

- Unit-test TTL boundaries, exact keys, schema changes, failure retention, abort/obsolete responses, storage corruption/quota, clear/reset and force refresh.
- Browser-test completed state transitions and count actual matching requests; do not rely solely on URL changes or a network-idle signal from the previous route.
- Use clearly synthetic records for deterministic error tests, and separately test unmocked official/real backend responses.
- Preserve route paths, current count/coverage disclaimers, privacy, English copy and each project's existing metadata/version behavior.
- Audit findings are not completed fixes. Implement and independently verify one coherent milestone at a time, then commit/push the relevant repository. Do not bundle unrelated dependency changes or deployment.
- The broader DisasterLens cartographic/UI identity redesign is a separate planning/approval milestone, not silently expanded into a cross-project redesign from this cache request.

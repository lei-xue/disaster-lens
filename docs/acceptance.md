# DisasterLens acceptance — v0.1.0 data flow and v0.1.1 page/UIUX

## Scope and authorization

Based on Kimi K3 planning session `20261003_163148_c70e75` (actual `kimi-k3` / `custom`), independently corrected to require detail pagination and avoid treating exactly 5,000 rows as proven truncation. Coordinator implemented after user instructed continuation. Branch: `fix/disasterlens-data-flow`, base `58915d9`; implementation committed as `c2c85d0`. The user subsequently authorized commit/push and prioritized finishing this simple project without extra features. No production merge, DNS changes or deployment performed in this acceptance pass.

## Changes

- Dashboard stores records with their successful query snapshot. Draft changes no longer relabel old results or change the map's selected state before Apply succeeds. Aborted requests cannot publish stale success/errors.
- Dashboard and Explore show the same loaded scope and top-of-results bound warning. Counts/search are explicitly county/area declaration records, not unique disasters or full dataset totals.
- FEMA fetch returns records plus `limitReached`; short-page completion versus bound reached is preserved in the cache. At the bound, UI says **may be incomplete** (including the exact-5,000 case). No extra count query or invented total.
- Details validate IDs, fetch independently and paginate up to the protection bound; direct navigation/refresh no longer depends on dashboard memory. Error/retry, empty and invalid-ID states work. Invalid fields or a later-page error reject the request instead of accepting an undisclosed partial result.
- Package/lock version 0.1.0, automatic footer build/commit metadata, English OG/Twitter text, explicit no-live-alert wording, mobile-safe About endpoint wrapping and updated README.
- Canonical/OG URL tags deferred: GitHub homepage is unset and no verified production URL was supplied. No fabricated URL/image metadata.

## Actual execution results

- `npm ci`: passed; initial installation reported 0 vulnerability findings.
- `npm install --package-lock-only`: version synchronized, audit reported 0 findings.
- `npm test`: **58 passed, 0 failed**, including 13 new bounded-fetch tests for pagination, exact bounds, errors, malformed fields, ID filtering, abort and snapshot cache.
- `npm run lint`: exit 0 with **0 warnings**. The two previous `react(set-state-in-effect)` warnings on Dashboard/Explore mount effects were resolved by a deliberate project decision, not a code workaround. A controlled oxlint probe showed the rule flags any mount effect that calls a local async loader containing setState — even when every setState happens after the first `await` — so restructuring would only appease the linter without fixing any real defect. An intermediate `setTimeout(0)` deferral was tried and then reverted as symptom-level appeasement. Final decision: `"react/set-state-in-effect": "off"` in `.oxlintrc.json`, with the mount-effect data-loading pattern (loading state, abort-on-unmount cleanup, error retry) kept intact.
- `npm run build`: passed, with large-chunk advisory (~897 kB minified JS). This is not a performance certification; future lazy loading remains optional maintenance.
- `git diff --check`: passed.
- Controlled-browser scenarios on the built local artifact: **25 checks passed**. Three viewports (320/390/1440), 8 scenarios each using explicitly synthetic intercepted records, plus one unmocked live detail check. Covered capped view, draft/apply labels, Explore scope/search no-result, 1,001-row detail pagination/direct load/refresh, HTTP failure/retry, empty detail and invalid ID/no request. No page errors were observed.
- Separate unmocked browser run: `scripts/live-smoke.cjs` passed at 320/390/1440. Loaded actual default query to 5,000 rows and confirmed bound warning; exercised Explore 25-row pages, next-page range 26–50, sorting reset, no-match search, About, Preparedness, direct detail, footer version and raw built HTML metadata. Checked no page overflow on dashboard/About/Preparedness and no page errors.
- Actual API test of disaster **4945** returned **7** designated areas: Clermont, Franklin, Hamilton, Licking, Morgan, Muskingum, Perry (County). Both direct Node request and unmocked local-browser detail query agreed. This is a dated live sample, not fixed test data.

## Reproducing browser smoke

Build with `npm run build`, serve `dist` using a static server at `http://127.0.0.1:8792/`, then:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/live-smoke.cjs
```

Playwright/Chromium were installed in active-profile scratch, not added to the application manifest. `BASE_URL` can select another local server; `SCREENSHOT_DIR` chooses capture destination. The live script requires current FEMA connectivity and the sampled disaster's area count may change. Synthetic scenarios were exercised with a task-scoped scratch runner; unit regressions remain in `tests/fetch.test.ts`.

## Captured evidence

Screenshots of the local production artifact, not of a deployed release:
- [320px dashboard](screenshots/dashboard-320.png) / [detail](screenshots/detail-320.png)
- [390px dashboard](screenshots/dashboard-390.png) / [detail](screenshots/detail-390.png)
- [1440px dashboard](screenshots/dashboard-1440.png) / [detail](screenshots/detail-1440.png)

Capture is not subjective visual approval or a manual screen-reader/motion audit. Browser runs used reduced motion.

## Remaining boundaries

- Production deployment and manual user acceptance remain pending. No verified deployed v0.1.0 URL exists in this task; a GitHub branch push alone is not a deployment.
- Fresh post-implementation builds derive metadata from committed HEAD, rather than the old uncommitted base. A documentation commit also requires rebuilding before any later deployment.
- Live FEMA pagination is not a transactional snapshot and the data may change during loading. A bound warning does not prove missing records, only that complete coverage was not established.
- Lint is now warning-free. Bundle-size advisory, subjective visual/keyboard/screen-reader review and production-domain-specific metadata remain explicitly open; do not equate this local check with full production acceptance.

## Fresh continuation check

- Fetched `origin`; no remote-main-only commits required integration.
- Re-ran lint, all 58 tests (0 failures), and production build successfully. The ~897 kB minified chunk advisory remains visible; no warning threshold was increased to hide it.
- Re-ran `scripts/live-smoke.cjs` against the rebuilt artifact using real OpenFEMA requests, with no interception: passed at 320/390/1440px. Dashboard cap disclosure, Explore pagination/sort/empty results, About, Preparedness, direct detail, metadata and version checks all passed, with no page errors.
- Disaster 4945 again returned the seven recorded county areas. This remains a changing source-data sample, not a permanent data guarantee.
- Fresh screenshots were captured in active-profile scratch so the earlier committed evidence was not overwritten. No new features or speculative redesign were introduced.

## v0.1.1 page/UIUX acceptance

The user requested a full Kimi plan followed directly by Kimi K3 implementation. See [page/UIUX plan and implemented/deferred checklist](page-uiux-plan.md). Actual worker routes were `kimi-k3` / billed provider `custom`, verified from session usage. Planning session: `20261004_163007_5240c0`; successful code closeout: `20261004_164537_52b52e`; successful zoom repairs: `20261004_170557_8eb5ec`. Earlier implementation/test workers timed out; their partial work was preserved and checked rather than counted as completion.

- Shared shell: route titles, hash-preserving first-tab skip link, route-navigation focus without initial StrictMode focus theft, consistent focus-visible styling and practical 44px navigation/filter/pagination controls.
- Dashboard: map accessible name plus complete loaded state counts in HTML; year counts in an HTML disclosure; existing type legend retained; chart units/summaries clarified without extra API calls.
- Explore: labeled keyboard-focusable internal scroll region and table caption, keyboard sorting and explicit title links. Detail: structured loading skeleton/status. Preparedness: summary targets and reduced motion. About/Preparedness factual text preserved.
- Coordinator found real default/200% narrow-layout failures. K3 repaired min-content grids, wrapping controls/pagination, long headings/links, brand and detail padding without globally hiding overflow or truncating important content.
- Independent final `npm test`: 58 passed, 0 failed. `npm run lint`: clean. `npm run build`: passed; approximately 902 kB main JS advisory remains disclosed. `git diff --check`: passed. Production-only dependency audit: 0 findings.
- `scripts/uiux-smoke.cjs`: all checks passed using explicitly synthetic intercepted records. Checks cover all five routes at 320/390/1440px and default/200% root text, skip-link hash/focus/title, reduced-motion pending skeleton, actual control targets, keyboard sort, map/year HTML alternatives. The coordinator fixed generated harness errors rather than weakening assertions.
- `scripts/live-smoke.cjs`: passed independently using real FEMA requests at 320/390/1440px, preserving cap warnings, paging, sorting, empty results and direct details; no page errors. Version expectation now derives from the manifest.
- Optional TOC/extra anchors and route/chunk splitting deferred to keep scope simple. No new dependencies or data-library/lint-config changes. Manual screen-reader, physical-phone and subjective visual acceptance remain unverified.
- Commit/push follow this verification; production merge/deployment and canonical-domain metadata remain separate. Rebuild after committing to read the exact footer SHA before announcing any release.

Reproduce the added UIUX checks against a built static preview:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright BASE_URL=http://127.0.0.1:8792/ node scripts/uiux-smoke.cjs
```

## v0.1.2 route-loading acceptance

The previously deferred route-splitting item was advanced after the user instructed continuation. Kimi K3 implemented all five lazy routes with route-local Suspense in the persistent shell. See [performance review](performance-review.md) for the original plan, actual chunk sizes and independent checks.

- Entry JS: 264.98 kB minified / 84.30 kB gzip versus the prior single 902.18 kB / 277.23 kB gzip artifact. Dashboard is a separate 609.29 kB / 184.20 kB gzip chunk; its >500 kB advisory remains visible.
- Browser requests verify non-dashboard direct entries never request the Dashboard chunk. This is not a claim of lower total Dashboard bytes or measured faster loading on every device.
- New `scripts/lazy-smoke.cjs` passed real five-route entries, held-chunk loading status, persistent navigation/skip focus/title and cross-route focus. Re-ran UIUX synthetic checks and separate live FEMA smoke: all passed. Lint, 58 unit tests and build passed.
- No dependency-tree, FEMA data-library, lint-configuration, factual content or route-path changes. Version is 0.1.2; commit/push and post-commit footer readback follow local verification. Production merge/deployment remains separate.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright BASE_URL=http://127.0.0.1:8792/ node scripts/lazy-smoke.cjs
```

## v0.2.0 current NWS alerts acceptance

The user approved continuing the Kimi plan. See [NWS alerts plan](nws-alerts-plan.md). Business-code implementation used Kimi K3; UI session `20261004_215506_b82497` and repair session `20261004_220507_2c0034` were verified as actual `kimi-k3` / billed provider `custom`. The repair worker exceeded its reporting deadline after useful edits; its exit was not counted as acceptance. Coordinator separately inspected and exercised the final artifacts.

- Added independent, lazy `#/alerts`: no initial request or inferred location; state/territory query requires Load. Cards show source text, severity/urgency/certainty, UTC timestamps, plain-text disclosures and validated official JSON links. Unknown/missing information is explicit.
- Successful snapshot area/time/result stay tied together. Draft changes do not relabel old results; Refresh reuses the applied area. Failed refreshes retain the last good snapshot labeled stale. Expired records are visibly no longer current. No synthesized fallback data.
- Auto-refresh is opt-in, five minutes, visible-tab only, paused while hidden and no immediate catch-up request on return. Browser regression covers a CA-to-TX applied-area change with auto-refresh already enabled, so an old area's timer cannot silently reload it.
- Response validation rejects malformed payloads as a whole. Non-Actual/Cancel/Test/Exercise records are not displayed. Newest 500 render at most with an explicit actual returned-record total/cap disclosure. Unsupported API paging params are never sent.
- A 20-second deadline covers request and JSON body, even when a test transport/parser ignores the AbortSignal. Caller abort, navigation cleanup and request-token invalidation prevent obsolete results.
- Fresh `npm ci`: 0 audit findings. `npm test`: **74 passed, 0 failed**. Lint: clean. Production build: passed. `git diff --check`: passed. Dependency tree, FEMA data module and lint configuration unchanged.
- `scripts/nws-smoke.cjs`: synthetic intercepted NWS regression passed for explicit initial action/skip focus, applied-vs-draft refresh, stale/error preservation, expanded content at 320/390/1440 and 100%/200% root text, five-minute boundary, hidden visibility pause, applied-area switch, disabled polling, expired label, empty disclaimer and deadline. Visibility changes are deliberately simulated; this is not physical-device acceptance.
- `scripts/uiux-smoke.cjs`: expanded to all six routes; skip/title/focus and default/200% overflow gates, reduced-motion pending skeleton, existing target/sort/text alternatives passed. `scripts/lazy-smoke.cjs`: all six real route entries passed; Alerts does not download Dashboard's map/chart chunk.
- Real NWS browser sample through the page: CA request to `/alerts/active?area=CA&status=actual&message_type=alert%2Cupdate` returned **HTTP 200**, rendered **22 records**, official JSON links, and no page errors on 2026-10-04 at 22:06 UTC. Counts/content can change. Real FEMA regression separately checked three widths, dashboard bound, Explore pagination/sort/empty, About, Preparedness and independent detail; legacy metadata assertion was updated to require NWS source wording plus the non-guaranteed-real-time disclaimer.
- Initial 320px/200% browser failure measured 513px document width; K3 repaired intrinsic form min-width and long field wrapping without hiding overflow. Coordinator also identified and regression-tested the polling effect's applied-area dependency. Fake-clock freezing before the lazy route was moved after mount to fix a harness-only failure, not bypass layout assertions.
- Version is 0.2.0; English static description/OG/Twitter and source copy distinguish FEMA history from NWS snapshots. Entry JS is 265.66 kB / 84.46 kB gzip; Alerts is 14.51 kB / 4.55 kB gzip. Dashboard's ~609 kB chunk advisory remains disclosed, not suppressed.
- Feature-branch commit/push follows validation; no production merge/deployment or guessed canonical domain. Manual screen-reader, physical-phone, subjective visual approval and production readback remain unverified.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright BASE_URL=http://127.0.0.1:8792/ node scripts/nws-smoke.cjs
```

## v0.2.1 historical cache and state-map acceptance

This milestone follows the approved Kimi cache/map plan and the canonical cross-project backlog. Kimi K3 wrote the cache/map implementation and bounded follow-up code proposals; the coordinator applied reviewed proposals and ran all checks. Tool-enabled workers that timed out are not counted as successful execution. One detail proposal incorrectly treated asynchronous snapshots as synchronous and changed timestamp/result types; it was rejected, corrected on the same K3 route, and only then integrated.

### Implemented behavior

- Schema-versioned IndexedDB snapshots preserve exact query or independent detail ID, records, original numeric retrieval time and `limitReached`; memory fallback keeps retrieval functional when storage fails. Six query snapshots and twenty detail snapshots are retained at most. Cache reuse does not update the original retrieval time.
- Dashboard restores the last successfully applied query before requesting default data. Fresh Apply/Reset, route returns and reloads reuse exact snapshots. Cached A/B/A selection updates application metadata so reload restores A, not the last newly fetched B.
- Expired snapshots are visibly stale while the same scope refreshes. Source failures retain old records, bound status, selected state and UTC retrieval time. Dashboard Retry force-loads the failed query rather than unapplied draft fields. Explore checks TTL even when the synchronous facade already has data; details preserve same-ID cached areas on failed refresh.
- Refresh data/details bypass fresh cache. Clear removes memory/durable snapshots without automatic fetch, while retaining the currently displayed view. Storage writes/evictions/clear are serialized; delayed pre-clear writes cannot recreate deleted entries. Durable success requires transaction commit, not only a successful request callback. New memory data wins over an obsolete durable copy after quota errors.
- Fifty states plus DC remain actual geographic paths, exposed as named button controls in a map group. Click/Enter/Space apply the state with the loaded year/type query, not draft filters. Focus/selected strokes follow the path; the state select remains the practical small-state/territory alternative. Full-name tooltips stay within the page at 320/390/1440px with both 200% text and page zoom.
- NWS alert requests, opt-in polling and privacy are unchanged. A historical cache never stands in for current NWS alerts. A capped global FEMA snapshot never stands in for an uncached state request.
- Version is 0.2.1; user-confirmed `https://disasterlens.leixue.dev/` supplies canonical and OG URL metadata. No social-image URL or guaranteed-real-time claim was invented.

### Actual verification

- Fresh `npm ci`: passed with 0 audit findings; application dependencies and lockfile dependency tree were not changed for this milestone.
- `npm test`: **99 passed, 0 failed**, including exact keys, TTL boundary/expiry, empty cache results, schema/corrupt/future timestamps, mismatched detail IDs, bounded concurrent evictions, dirty-memory quota fallback, last-applied metadata, hanging storage deadlines and serialized clear.
- `scripts/cache-map-smoke.cjs`: passed synthetic fresh navigation/Apply/reload, cached A/B/A restoration, actual SVG click/Enter/Space, visible path focus, independent details/forced refresh/failure, source-targeted Retry, expired Dashboard/Explore/detail stale fallback, font/page-zoom tooltip bounds and durable clear. No page errors. The state fixtures are explicitly synthetic, not source evidence.
- `scripts/live-cache-smoke.cjs`: passed **unmocked** official FEMA requests against the local production build. Initial default query: **5** page requests; Dashboard→Explore **0**; returning to Dashboard **0**; identical Apply **0**; full reload **0**. Uncached California map selection: **1** request in this actual sample, followed by **0** on California reload. Detail 4945: **1**, detail reload **0**, forced detail refresh **1**. This is measured request count, not a universal single-request guarantee or a claim about upstream CDN hits. [Captured JSON evidence](cache-live-evidence-v0.2.1.json).
- The live request harness first failed because `/fresh.*cached/` also matched Refresh/Clear controls; the selector was anchored to the actual Fetched label and the whole live run passed afterward. No API data was replaced to resolve the harness failure.
- An additional unmocked assertion reproduced an actual tooltip defect: hovering a state before its exact query completed retained the old capped-global count. K3 changed tooltip counts to derive from the current applied count map at render time; the live assertion compares tooltip text with the latest state's accessible count and passed after the repair.
- `scripts/uiux-smoke.cjs`, `scripts/lazy-smoke.cjs`, `scripts/nws-smoke.cjs` and unmocked `scripts/live-smoke.cjs`: passed. Six routes retain navigation/title/skip/focus behavior; non-dashboard entries do not fetch the Dashboard chart/map chunk. Real FEMA checks passed at 320/390/1440px, including paging/sort/empty/resource routes and independently queried details. Disaster 4945 again returned the seven county areas captured in the evidence; this dated source sample can change.
- Lint and production build passed; `git diff --check` passed. Entry JS is about 266 kB minified / 84 kB gzip; Dashboard remains about 614 kB / 186 kB gzip and its large-chunk advisory was not hidden. Updated screenshots are local pre-commit captures, not evidence of a deployed release or subjective visual approval.

### Remaining boundaries

- Safe in-flight **network** request coalescing remains scheduled; completed-result reuse and serialized cache mutations are not a claim of shared network cancellation.
- The broader map-first visual identity redesign, Cinemate/CharityCheck/MindBridge cache repairs, manual screen-reader and physical-phone/touch acceptance remain separate. This is not whole-roadmap completion or a production-grade visual certification.
- Browser eviction, inaccessible storage and upstream failures remain possible. Live paging is not transactional; the 5,000-record cap still means **may be incomplete**.
- Commit/feature-branch delivery and the static release archive are distinct from deployment. The user handles hosting; no production merge, DNS change or new deployment was performed. Rebuild from the release commit before packaging, verify the extracted artifact's version/SHA and relative assets, and do not call a GitHub push a live-site update.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright BASE_URL=http://127.0.0.1:8792/ node scripts/cache-map-smoke.cjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright BASE_URL=http://127.0.0.1:8792/ node scripts/live-cache-smoke.cjs
```

## v0.2.2 subscriber-safe in-flight coalescing

Closes the remaining DisasterLens P0 network-sharing item from v0.2.1. Kimi K3 implementation session `20261005_090329_6d01cf` and bounded correction session `20261005_090922_1a10e9` were verified from the usage ledger as actual `kimi-k3` / billed provider `custom`. The coordinator independently reviewed, integrated and exercised the artifacts.

- Identical concurrent FEMA query/detail consumers share the entire validated paged result, with a registry isolated by transport identity. Structured keys preserve literal field/array boundaries, sort copied incident types, and keep query/detail namespaces separate. Caller query values are copied synchronously before deferred work and paging.
- Each subscriber owns its cancellation. Cancelling one subscriber rejects it promptly without aborting others. The last cancellation aborts upstream and immediately removes that flight; late old completion cannot delete its replacement. Listeners and subscriber counts are released on success/failure/cancellation. Pre-aborted callers start no transport request, and ignored transport/body aborts cannot keep cancelled subscribers waiting.
- Settled and failed flights are removed; no completed response or error is retained in this registry. Persistent snapshot TTL, force refresh, bounded paging, detail-ID validation and NWS polling/privacy remain unchanged. There is no global shared AbortController.
- New `tests/inflight.test.ts`: **15 tests** cover complete 1,001-row paging reuse, reordered types, separate queries/transports/IDs, success/error eviction, immutable query values, detail mismatch, pre-abort, one/all cancellations, immediate retry/late cleanup, uncooperative JSON parsing and detached listeners. The initial implementation passed fourteen cases; a new comma-bearing incident-type case exposed a delimiter-key collision, which was fixed and the complete suite rerun. No regression assertion was weakened.
- Fresh `npm ci`: passed with 0 audit findings. Full `npm test`: **114 passed, 0 failed**. Lint, production build and `git diff --check`: passed. Dependency tree and UI/source-route requirements were not changed; package/lock version is 0.2.2.
- `scripts/live-inflight-smoke.cjs`: unmocked Node execution against official FEMA, not synthetic browser evidence. Two concurrent default-query callers shared **5** page requests at skips **0/1000/2000/3000/4000**. One caller cancelled; upstream remained active for the other, which received **5,000 declaration-area records** with `limitReached: true` (**may be incomplete**, not a complete dataset or unique-disaster total). [Captured evidence](inflight-live-evidence-v0.2.2.json).
- `scripts/live-cache-smoke.cjs`: unmocked production-build browser replay passed again: initial **5**, Dashboard→Explore/back **0**, identical Apply **0**, full reload **0**, California selection **1** in this sample then reload **0**, independent detail **1**, detail reload **0**, forced detail refresh **1**. The applied-state tooltip count assertion passed; this remains a dated source sample, not a universal single-request guarantee.
- Synthetic cache/map, six-route UIUX and NWS regression scripts passed, including stale/expired fallbacks, SVG keyboard controls and 200% text/page zoom. Real lazy-route/chunk checks initially timed out once during direct Explore entry; the unchanged script passed on retry. A separate official first-page connectivity check returned HTTP 200 with 1,000 rows. No synthetic data replaced the failed live attempt, and that timeout is not diagnosed as a proven application or upstream defect.
- The Dashboard large-chunk advisory remains visible. Whole-site visual redesign, physical-device/screen-reader acceptance and other projects remain separate. No production deployment, DNS change or main-branch merge was performed; static archive/footer verification follows the release commit.

```sh
node --test tests/inflight.test.ts
node scripts/live-inflight-smoke.cjs
```

# DisasterLens workspace redesign — local draft (pending visual review)

Status: historical implementation notes. The workspace has since been committed
and pushed to `feat/disasterlens-map-first-uiux`, triggering Cloudflare branch
previews. References below to local-only work describe the original review stage,
not the current release state. See `production-readiness.md` for open gates.

## What changed structurally

Header / navigation (src/components/Layout.tsx, src/index.css)
- Desktop: the generic horizontal top bar is replaced by a graphite
  vertical brand/navigation rail (~14rem, in normal flow — not fixed
  height, no nested scroll, not an overlay) left of the page workspace.
- Mobile: the rail collapses into a compact masthead; all five labelled
  destinations stay visible and wrap — no icon-only or hidden menu.
- All five NavLink destinations, the brand home route, aria-current,
  routeTitle, mainRef focus-on-route-change and the skip link are unchanged.
- Reading width of the main shell increased 72rem → 80rem.

Dashboard (src/pages/DashboardPage.tsx)
- Desktop workspace: an integrated ~15rem filter rail (immediate State
  selector, From/To year drafts, all incident-type chips, Apply filters /
  Reset / Refresh data / Clear cached data) beside a dominant map canvas
  that takes the remaining width. The four-KpiCard grid is gone; the same
  four metrics render as a compact, wrap-safe dl stat band under the map.
- Analytics below are full-width headed sections (state bars, year line
  with text-table details, incident-type share) instead of identical
  stacked cards; all titles, qualifiers, legends, text alternatives and
  the loaded-records link are preserved.
- Mobile: State select and a collapsed advanced-filter disclosure precede the map;
  year/type filters live in a native details element in document flow.
  A presentational media-query effect sets the native open attribute on
  desktop; the summary remains visible and keyboard-toggleable. CSS never
  force-displays a closed details body. There is one control instance.
- All data logic (load/cache/cancellation/token guards, draft-vs-applied
  query semantics, selectStateScope/applyFilters/resetFilters/refresh/
  clearCache, stale/cap/error/skeleton/empty states) is untouched.

## Palette (local draft)

- Surfaces: #f3f4f6 page, #ffffff cards; ink #20242b; lines #d8dde3.
- Navigation rail: graphite #20242b with light text.
- Primary action / active nav / pressed chips: orange #9a3412 (white text).
- Focus outline #c2410c on light surfaces, white inside the graphite rail.
- Map: sequential data fills and StateChoropleth constants unchanged; the
  shared keyboard-focus CSS follows the orange accent. Geography and tooltip
  lifecycle remain intact; the map is not a hazard/risk score.
- Amber (.dl-note) and red (error banner) semantics kept distinct.

## Reading-page continuation (local, user-approved direction)

- Explore now puts applied scope, full UTC retrieval time, record count,
  search, sortable table and pagination into one record workspace instead of
  separate scope/search/table cards. All five columns and 25-row paging remain.
- Detail separates declaration facts from a named Designated areas section;
  the real detail4945 capture and live regression enumerate all seven returned
  county names after the semantic markup change. Refresh/source disclaimer remain.
- Mobile header/spacing tightened without hiding navigation or controls;
  actual 390px map top now y603 versus the prior y657. This is measured geometry,
  not a claimed final mobile usability acceptance.
- Integrated snapshot re-passed 114 tests, lint, production build, 36 bounds
  cases including expanded mobile filters, UI/UX, pointer/keyboard/touch state,
  synthetic cache/error/expiry checks and unmocked FEMA cache/detail checks.
- Desktop/mobile reading screenshots captured from unmocked FEMA local build:
  `disasterlens-reading-records-1440.png`, `disasterlens-reading-detail-1440.png`
  and matching 390px captures in the profile scratch directory.
- Subsequent Kimi K3 local phase completed Alerts bulletin records with severity
  styling, Preparedness numbered editorial sections and grouped official resources,
  and About source/cache/privacy reference sections. Source fetching/polling logic
  remains unchanged; layout/helpers only changed in Alerts.
- Integrated phase independently passed 114 tests, lint/build, 36 route/width/text
  bounds cases, UI/UX, NWS synthetic expiry/failure/poll/privacy and state-interaction
  checks. Unmocked local NWS returned HTTP200 FeatureCollection (21 records observed
  at capture, not a current weather bulletin) on desktop/mobile without page errors.
- Preparedness capture verified all 12 disclosures and four exact official links.
  Local screenshots: disasterlens-phase3-alerts/guide/about-{1440,390}.png in scratch.
- All six route interiors now have a structural draft; subjective visual acceptance,
  physical-phone and screen-reader checks remain open. This is not a published release.
- No commit, push or deployment performed in this continuation.

## Verification

- The initial K3 writer timed out after JSX/notes changes but before CSS.
  Its processes were confirmed stopped; a smaller same-route K3 run completed
  CSS and the native disclosure. The premature notes were corrected after
  independently inspecting and exercising the actual integrated artifact.
- Coordinator: 114/114 tests, lint, production build and diff checks passed.
- 36 rendered route/width/text cases passed at 320/390/1440px and 100/200%
  text, including genuinely opened mobile advanced filters and no root clipping.
- Pointer/keyboard/touch-emulation state selection, preserved year/type drafts,
  explicit Apply, Reset, focus-help and coarse-input scaling passed.
- UI/UX, synthetic cache/map failure/expiry/clear and NWS regression suites
  passed. Older cache test helpers initially waited on collapsed Apply;
  they now open the real native disclosure before exercising the same assertions.
- Unmocked local FEMA: initial paging five requests; route revisit, identical
  Apply and reload zero additional; California one; detail 4945 one, cached
  reload zero, forced detail refresh one. No browser page errors observed.
- Actual local desktop map measured 866px wide at x529/y258 on 1440px;
  desktop nav measured 189px wide; the filter lies beside the map. Mobile
  map measured 324px wide at y657 on 390px. Header/mobile first-screen density
  and subjective visual quality remain user-review items, not certified outcomes.
- Local desktop/mobile screenshots and source evidence are in the active
  profile scratch directory with `disasterlens-workspace-` filenames.
  Screenshots use actual FEMA responses, not generated sample records.
- Tested token contrast pairs exceeded 4.5:1; this is not full WCAG or manual
  screen-reader certification. Physical-phone verification remains outstanding.
- Build still advises a ~613kB dashboard chart chunk. No dependency changes.
- Local uncommitted footer SHA 1740914 identifies the base commit, NOT this
  unpublished draft. The website and prior online preview do not contain it.

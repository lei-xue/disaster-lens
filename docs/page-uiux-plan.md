# DisasterLens page-development and UI/UX implementation plan (v0.1.1)

Planning-only document. Prepared by Kimi K3 (planner) for coordinator review before a fresh Kimi K3 implementation run. No application code, dependencies, Git refs, hosting, or remote systems are changed by this document.

Baseline: branch `fix/disasterlens-data-flow`, HEAD `d28a6c6`, package version 0.1.0, React 19 + TypeScript + Tailwind CSS v4 static app, `HashRouter` (src/main.tsx:9), routes in src/App.tsx:13-18. Verification at baseline: 58 tests passing, `npm run lint` exit 0 with 0 warnings, `npm run build` passing (~897 kB minified main JS, advisory only), real-API browser smoke passed at 320/390/1440px (docs/acceptance.md:16-60).

Evidence legend:
- [S] Source-only observation (read from code; not re-verified in a browser in this planning pass).
- [B] Browser evidence supplied by the coordinator/user (acceptance.md browser runs: 25 synthetic checks + live smoke at 320/390/1440).
- [V] Existing verified behavior that must be preserved exactly.
- [P] Proposed change (new in v0.1.1).

---

## 1. Goals

1. Ship a minimal v0.1.1 that improves page legibility, navigation, keyboard accessibility, and state clarity without changing any data semantics.
2. Make every page understandable at 320px width and 200% root text zoom, with visible keyboard focus throughout.
3. Explain what each map/chart/table counts (county/area declaration records, not unique disasters) at the point of viewing, not only on About.
4. Keep the project simple: no new dependencies, no new datasets, no auth, no backend, no realtime features.
5. Preserve all v0.1.0 verified behavior: bounded 5,000-record pagination with `limitReached` disclosure, successful-query snapshots, abort protection, literal disaster-ID validation, English UI/metadata, automatic footer version/time/SHA, HashRouter routes, and the record-cap "may be incomplete" wording.

Non-goals are listed in section 10.

## 2. Audiences and user journeys

Audiences:
- A. Curious resident: wants to know "what disasters were declared near me?" Needs fast path to state filter and plain-language explanations.
- B. Student/journalist/analyst: wants to search, sort, and cite specific declarations. Needs the Explore table, clear count definitions, and stable detail URLs.
- C. Preparedness reader: arrives for guidance content only. Needs a readable, scannable Preparedness page and prominent emergency disclaimer.
- D. Keyboard-only / screen-reader / low-vision user: needs skip link, focus visibility, semantic headings/tables, 200% zoom tolerance, reduced-motion respect.

Primary journeys:
1. Land on Dashboard (`#/`), see national overview, optionally filter by state/year/type, read KPIs and charts. (A, B)
2. Dashboard → "Browse loaded records" → Explore (`#/disasters`), search/sort/paginate, click a row → Detail (`#/disaster/:n`). (A, B)
3. Direct-load or refresh a Detail URL with a valid or invalid disaster number. (B) [V: works today, including invalid-ID EmptyState — DisasterDetailPage.tsx:30]
4. Visit Preparedness (`#/preparedness`) and About (`#/about`) directly for content/definitions. (C)
5. On FEMA failure: see error banner with Retry; on empty results: see actionable empty state. [V: ErrorBanner.tsx, EmptyState.tsx exist and are used on all data pages]

## 3. Current-state inventory (evidence)

### 3.1 Shared shell
- `Layout.tsx:12-83` [S]: header with logo + 4 NavLinks, main, footer. Footer carries the OpenFEMA attribution, "informational only" sentence, and automatic `Version {__APP_VERSION__} · Built ... · SHA` line (Layout.tsx:77-79) [V].
- No skip link exists [S, P].
- `index.html:2-19` [V]: `lang="en"`, viewport meta, English description/OG/Twitter metadata; no canonical/OG URL (deliberately deferred, acceptance.md:14).
- `index.css:1-7` [S]: Tailwind import + base body styling only; no custom focus/motion rules.
- Focus styles: most controls use `focus-visible:outline-2 ... outline-blue-700` [S, V on form controls]; table sort buttons (ExplorePage.tsx:182-195), table row links (217-223), nav links (Layout.tsx:3-8), footer links, Preparedness `<summary>` (PreparednessPage.tsx:117), and Detail back link have no custom focus classes [S]. Coordinator correction: absence of custom classes does NOT prove browser default focus indicators are absent; treat as an UNVERIFIED risk, not a measured failure. Resolution [P]: establish explicit, visible, consistent `:focus-visible` styling globally (base CSS rule) without claiming any measured old failure.
- Skeletons use `animate-pulse` (Skeleton.tsx:2) with no `prefers-reduced-motion` handling [S, P].
- No route-level `<title>` updates; the document title is static for all routes [S, P].

### 3.2 Dashboard (`/`) — DashboardPage.tsx
- [V] Filters (from/to year, state, incident-type toggle chips) are drafts until "Apply filters" succeeds; loaded scope shown by `DataScope` (DashboardPage.tsx:128-139, 328; DataScope.tsx). "Filters have changed" hint at line 297.
- [V] Abort protection: prior request aborted on new load and on unmount (89-126).
- [V] States: skeleton on first load (303), inline "Updating data…" `role="status"` on refresh (320-324), ErrorBanner with Retry (299-301), EmptyState with reset action (305-318).
- [V] KPIs, choropleth (StateChoropleth), top-15 bar chart, per-year line chart, share-by-type donut with text legend (327-447).
- [S] Choropleth is hover-only: no keyboard access to per-state values, no text fallback table, no `role="img"`/accessible name on the SVG (StateChoropleth.tsx:52-92) [P].
- [S] Recharts SVGs have no accessible names; pie has an HTML legend list (416-433) but bar/line charts have no text summary [P].
- [S] Incident-type chips use `aria-pressed` correctly (281) but chip hit area is `px-3 py-1` (~28px tall) — below 44px guidance [P].
- [S] "Updating data…" announcement is not assertive; fine. The draft-changes note (297) is plain text, not linked to the Apply button [P: minor].

### 3.3 Explore (`/disasters`) — ExplorePage.tsx
- [V] Uses session cache snapshot; if none, offers "Load latest declarations" (123-136). Same `DataScope` disclosure as Dashboard (140).
- [V] Search filters loaded records; sort via column header buttons with `aria-sort` (169-197); pagination 25/page with range text (242-269).
- [S] Entire `<tr>` is clickable (209-214) but the row is not keyboard-focusable/activatable; only the title `<Link>` is keyboard-reachable [P]. Sort-header buttons lack focus-visible styling [P]. Pagination buttons are `py-1.5` (~34px) [P: 44px where practical].
- [S] `min-w-3xl` on the table (166) forces horizontal scroll below 768px; acceptable if the scroll container is reachable and labeled [P: add `aria-label`/caption and a visible hint on small screens].
- [S] Search input has a visible label only via `sr-only` (142-144) — acceptable, but placeholder also serves as the visible cue; keep sr-only label [V].

### 3.4 Detail (`/disaster/:disasterNumber`) — DisasterDetailPage.tsx
- [V] Literal ID validation via `parseDisasterNumber` (fema.ts:92-96); invalid IDs render an EmptyState without any network request (DisasterDetailPage.tsx:30).
- [V] Detail fetch is independent of dashboard filters, paginated to the 5,000 bound, abort-on-unmount, with attempt-based retry (17-33).
- [V] `limitReached` warning (64-68), record-type badges, definition list of fields, multi-area grid list, "not a real-time hazard alert" note (127-130).
- [S] Loading state is a bare `<p role="status">` (32) with no layout skeleton — page jumps [P: minor].
- [S] No `<h1>` structure issue — h1 present (78). Back link has no focus style [P].

### 3.5 Preparedness (`/preparedness`) — PreparednessPage.tsx
- [S] Static content; `role="alert"` emergency banner (97-103); three `<details>`-based sections; key-resources link list. Content is pre-vetted static copy — treat as source-accurate and do not rewrite facts [V].
- [S] `<summary>` elements lacked custom focus classes and a reduced-motion guard on the chevron transition (117-124) [P]. Browser default focus was not measured in the source-only review. The static emergency banner's existing `role="alert"` is preserved; manual screen-reader behavior remains unverified.
- [S] External links lack `rel="noopener noreferrer"` (they are `target`-less same-tab, so this is optional) — no change required.

### 3.6 About (`/about`) — AboutPage.tsx
- [S] Data-source explanation including the area-vs-disaster count definition (52-56), 5,000-record bound wording (58-62), declaration-type glossary, amber disclaimer. All copy is factual and must be preserved [V].
- [S] Endpoint URL in `<code>` wraps via `break-all` (47) — verified mobile-safe [B].

## 4. Information architecture and page-by-page plan

Global (Layout):
- [P] CORRECTED (coordinator): bare in-page href fragments are NOT HashRouter-safe. Skip link is an `<a href="#main-content">` (kept for semantics) whose click handler calls `preventDefault()`, then explicitly focuses `<main id="main-content" tabIndex={-1}>` and calls `scrollIntoView()` WITHOUT modifying `location.hash`. Verified on all 5 routes (skip-link focus lands on main; route hash unchanged).
- [P] CORRECTED (coordinator): route-change manager sets per-route `document.title` ("Dashboard — DisasterLens", etc.) and moves focus to `<main>` ONLY after an actual route navigation (first render is skipped via a ref, so it never steals initial skip-link focus and never re-focuses after data refresh). No live-region announcements, no lazy-heading focus risks.
- [P] CORRECTED (coordinator): one explicit global `:focus-visible` rule in `index.css` base layer (2px outline, offset, blue-700) covering nav links, text links, sort buttons, summary elements, pagination, and the Detail back link. Do not change lint config.
- [P] Add `prefers-reduced-motion` handling: disable `animate-pulse` on skeletons and the summary chevron transition via a media query in `index.css` (Tailwind v4 supports `motion-safe:`/`motion-reduce:` variants; prefer `motion-reduce:animate-none`).
- [P] Raise interactive control heights to >=44px where practical: Apply/Reset buttons and selects already `py-2` (~40px — bump to `py-2.5` or `min-h-11`); incident-type chips, pagination buttons, and sort buttons get `min-h-11` (44px) on pointer-capable screens; keep compact styling via `sm:` adjustments only if it does not shrink below 44px touch targets. Where 44px is impractical (in-table sort headers), document the exception.

Dashboard:
- [P] CORRECTED (coordinator): choropleth/chart accessibility — add `role="img"` + `aria-label` summarizing the map, plus a `<details>`-disclosed full HTML table of state counts (derived from the already-loaded aggregate; zero extra requests) so keyboard and screen-reader users get equivalent values. A chart wrapper alone is NOT a WCAG AA certification: adjacent truthful HTML summaries/tables are the equivalent-text mechanism; no human screen-reader testing is claimed. Legend text made explicit ("0 records" … "max N records in this view").
- [P] Chart explanations: extend each `ChartCard` subtitle to state the unit ("county/area declaration records, not unique disasters") once per chart group — map and state bar chart already say "records"; make the year chart and donut subtitles explicit too.
- [P] Add a short text summary line under each chart (e.g. "Highest: Texas with N records") generated from existing aggregates — dependency-free, and gives non-visual users the chart's main takeaway.
- [P] Tie the "Filters have changed" hint (line 297) to the Apply button via `aria-describedby` on the button, or render it as `role="status"`. Minor.

Explore:
- [P] Keyboard access to rows: keep the row-click behavior for pointer users, but ensure each row's primary link is the keyboard path (already true). Add `cursor-pointer` rows a `keydown` Enter/Space handler only if it can be done without breaking the nested link; otherwise add an explicit "View" affordance is NOT required — simplest acceptable fix is to leave row-click as progressive enhancement and make sure the title link is visibly the primary action. Do not add ARIA grid roles.
- [P] Focus-visible style on sort buttons and pagination; 44px pagination buttons.
- [P] Add `aria-label="Declaration records table, scrollable horizontally on narrow screens"` to the scroll container, plus a visible one-line hint under 640px ("Swipe to see all columns").

Detail:
- [P] Replace the bare loading paragraph with a small skeleton block matching the article layout (reuse `SkeletonBlock`), keeping the `role="status"` text for screen readers.
- [P] Focus style on the back link; keep everything else unchanged.

Preparedness:
- [P] Focus-visible outline on `<summary>`; `motion-reduce` for the chevron; evaluate demoting `role="alert"` to a visually strong static banner (decision recorded in implementation notes; default: keep `role="alert"` only if it does not cause repetitive announcements — it renders once per page mount, which is acceptable, so keeping it is the low-risk choice).
- [P] CORRECTED (coordinator): Preparedness TOC DEFERRED as unnecessary clutter — the page is a single short scroll with three adjacent sections; a TOC adds little at 200% zoom. Any in-page anchor links would also need the preventDefault/focus/scrollIntoView treatment (bare fragments are not HashRouter-safe). Deferral recorded here and in acceptance.md.

About:
- No structural change. [P] Add `id` anchors to the three sections only if the Preparedness-style TOC pattern is reused; otherwise leave as-is. Copy unchanged [V].

## 5. Small visual system (no new dependencies)

- Color: CORRECTED (coordinator): keep the simple readable slate/blue-700/amber palette; prioritize actual UI hierarchy, spacing/font sizes, and nav/control ergonomics. Do NOT dump extra disclaimer paragraphs. All new text counts derive from existing successful aggregates — no extra API requests.
- Type: keep Tailwind defaults. Hierarchy today: `text-2xl` h1, `text-lg` section h2, `text-base` chart h2, `text-sm` body, `text-xs` labels [S] — legible; no change except ensuring one `<h1>` per page and logical h2 order [V mostly true already].
- Spacing/components: reuse existing card pattern (`rounded-lg border border-slate-200 bg-white p-4/5`) for any new blocks (chart summaries, state-count list, TOC).
- Motion: only existing transitions (colors, chevron, pulse); all gated behind reduced-motion after this pass. No new animation.

## 6. Accessibility requirements (acceptance-level)

1. Skip link present, first in tab order, visibly appears on focus, lands focus on main content without altering the hash route.
2. Every interactive element shows a visible focus indicator (2px outline, offset, sufficient contrast).
3. One h1 per page; heading levels not skipped.
4. Charts/maps: each has an accessible name plus a text alternative (summary line and/or data list).
5. `aria-sort` retained on the Explore table; search input retains its label.
6. Layout usable at 320px width (no horizontal page overflow except the intentional in-table scroll region) and at 200% root text zoom (no clipped controls, no overlapping text).
7. `prefers-reduced-motion`: no pulse, no transitions that convey state by motion alone.
8. Touch targets >=44x44px where practical; exceptions documented inline.
9. `role="status"`/`role="alert"` usage unchanged except the Preparedness evaluation noted above; loading/error/empty states remain announced.
10. Manual keyboard walkthrough of all 5 routes documented in the implementation report (this is a stated gap in acceptance.md:52 — "subjective visual/keyboard/screen-reader review ... explicitly open").

## 7. Responsive layout

- Breakpoints already in use: base (mobile), `sm` 640, `lg` 1024, `xl` 1280 [S]. Keep them.
- 320px: filters stack (already `grid sm:grid-cols-2`), KPI grid collapses to 1 column [V at baseline: no page overflow at 320 per live smoke]; new elements (state-count list, TOC, summaries) must follow the same single-column stacking.
- Table: retain horizontal scroll within its bordered container only; add the container label/hint (section 4).
- Header nav already wraps (`flex-wrap`); verify no overlap at 320px with the skip link focused.

## 8. Metadata, version, and route handling

- [V] Preserve: `lang="en"`, existing description/OG/Twitter copy in index.html, footer `__APP_VERSION__`/`__BUILD_TIME__`/`__COMMIT_SHA__` (Layout.tsx:77-79), HashRouter routes exactly as in App.tsx:13-18, catch-all redirect to `/`.
- [P] Per-route `document.title` updates (English, same naming pattern as the index title). No canonical/OG URL additions — still no verified production URL (acceptance.md:14, 49); do not fabricate one.
- [P] Version bump to 0.1.1 in package.json and lockfile (package-lock-only sync, no dependency changes, no `npm install` of new packages).
- [P] Rebuild after the doc/version commit so footer metadata reflects committed HEAD (acceptance.md:50).

## 9. Performance scope

- Bundle (~897 kB min) advisory stands (acceptance.md:22). [P] Optional, low-risk only: route-level `React.lazy` for Explore/Preparedness/About/Detail, or manual chunk split of `recharts`/`react-simple-maps` in `vite.config.ts`. This is the single largest perf lever and touches no data logic. If implemented, verify lazy chunks load under HashRouter and skeleton fallbacks render. If any risk appears, defer — bundle size is an advisory, not a defect.
- No other performance work: no service worker, no prefetching, no caching-layer changes. The 5,000-record bound and existing session snapshot cache stay as-is [V].
- All new UI (summary lines, state-count list, TOC) derives from already-loaded aggregates — zero added network requests.

## 10. Risks and non-goals

Non-goals (explicitly out of scope for v0.1.1):
- No auth, database, backend, API keys, realtime alerts, predictions, monetization, new datasets, or design-framework/dependency additions.
- No changes to FEMA query construction, pagination bounds, cache/snapshot semantics, error messages, or ID validation logic (src/lib/fema.ts is untouched).
- No rewriting of factual copy (About, Preparedness, disclaimers, count definitions).
- No lint-config changes to conceal warnings; any new warning is fixed in code.
- No canonical/OG URL metadata until a production URL is verified.

Risks:
- R1: In-page anchors interacting with HashRouter. RESOLVED per coordinator correction: skip link uses preventDefault + explicit focus/scrollIntoView, never touching `location.hash`; Preparedness TOC deferred (clutter). Verified by the browser regression script on all 5 routes.
- R2: Lazy-loading routes could regress direct-hash deep links or the live smoke script. Mitigation: keep lazy loading optional; if smoke fails, revert that item only.
- R3: 44px targets may enlarge the filter bar and chip row noticeably. Acceptable; verify 320px layout still fits.
- R4: Live FEMA data changes between runs; smoke results (e.g., disaster 4945's 7 areas) are dated samples, not guarantees (acceptance.md:26, 59).
- R5: Recharts' SVG internals may resist clean accessible naming; provide equivalent existing-aggregate HTML tables/legends and adjacent summaries. A wrapper role or summary alone does not establish WCAG AA conformance; manual assistive-technology acceptance is still separate.

## 11. Ordered implementation phases (for the fresh K3 run)

Phase 1 — Accessibility foundation (Layout, index.css)
1. Skip link + `main` id/tabindex; route-based `document.title`; h1 focus on route change.
2. Global focus-visible utility; apply to nav, links, sort buttons, summaries, pagination, back link.
3. Reduced-motion rules for skeleton pulse and chevron.
4. Verify: lint, tests, build; keyboard tab-order walkthrough on all 5 routes.

Phase 2 — Page IA improvements
5. Dashboard: chart unit subtitles, per-chart text summary lines, choropleth accessible name + state-count text list (details-disclosure), legend wording.
6. Explore: 44px pagination/sort targets, scroll-region label + small-screen hint, focus styles.
7. Detail: loading skeleton, back-link focus.
8. Preparedness: summary focus/motion, section TOC (after R1 check).
9. Verify: lint, tests, build; 320px + 200% zoom pass on each page.

Phase 3 — Release hygiene
10. Optional route-level lazy loading (R2-gated).
11. Version 0.1.1 bump (package.json + lockfile-only sync), rebuild, update docs/acceptance.md with a v0.1.1 section.
12. Full gate: `npm run test` (58+ passing), `npm run lint` (0 warnings), `npm run build`, `git diff --check`, and the live browser smoke at 320/390/1440 if connectivity allows.

## 12. Measurable acceptance checks (v0.1.1)

1. `npm run test`: all existing 58 tests pass unmodified (plus any new tests added for new pure logic, if any — none anticipated).
2. `npm run lint`: exit 0, 0 warnings, with no config changes.
3. `npm run build`: succeeds; bundle advisory acknowledged (unchanged or improved if lazy loading landed).
4. Keyboard: starting from a fresh load of each route, Tab reaches skip link first; every control operable by keyboard alone; focus indicator visible on every stop; skip link lands focus in main content without route change.
5. Screen-reader spot check (or DOM inspection): one h1 per route; charts have accessible names and adjacent text summaries; choropleth values available without pointer hover; `aria-sort` intact.
6. 320px viewport: no horizontal page overflow on any route (table's internal scroll region excepted); no clipped controls at 200% root zoom.
7. Reduced motion (OS setting): skeletons static, chevron non-animated.
8. Touch targets: measured >=44px on filter buttons, chips, pagination, nav; documented exceptions only.
9. Behavior preservation: dashboard draft/apply semantics, bound warning wording, Explore cache reuse, detail invalid-ID no-request path, footer version/time/SHA all behave exactly as at baseline (re-run the existing synthetic + live smoke scenarios where feasible).
10. Footer shows version 0.1.1 with the new build time/SHA after rebuild.

## 13. Assumptions and blockers

Assumptions:
- The coordinator-supplied baseline (tests/lint/build/smoke results) is accurate; this planning pass re-read source and docs but did not re-run the suite or a browser.
- Tailwind v4 `motion-reduce:`/`motion-safe:` variants and `@utility` are available (tailwindcss ^4.3.3, package.json:28).
- Bare fragments are not assumed safe under HashRouter. Prevent default fragment navigation and explicitly focus/scroll the target while preserving the current route hash.

Blockers:
- None for planning. For release: no verified production URL exists, so deployment, canonical/OG URLs, and "production acceptance" remain out of scope (acceptance.md:47-52).

## 14. Coordinator-reviewed implementation outcome

This plan records the proposed scope, not a claim that every optional suggestion shipped. Kimi K3 performed the application-code implementation and measured zoom repairs; the coordinator corrected the plan and regression harness, reviewed diffs and independently executed the final checks.

- Implemented: all five existing pages retained; hash-preserving skip link; route titles and main focus only on actual pathname changes (including StrictMode safety); explicit focus-visible styling; reduced-motion skeleton/chevron; practical 44px controls; map name and state HTML counts; full year HTML table and type legend; chart summaries; keyboard-operable Explore sorting/title links and labeled internal table scroll; structured detail loading; long-text/grid/pagination/brand reflow fixes.
- Preserved: FEMA library, abort/snapshot/paging/ID semantics and lint configuration unchanged; English factual copy, data limitations and automatic release metadata retained. Dependency tree unchanged; version only advances to 0.1.1.
- Deferred deliberately: Preparedness TOC and extra About anchors (unnecessary for the short pages); route/chunk lazy loading (separate performance milestone); custom production-domain metadata until the domain is verified. These are not silently counted as completed.
- Verification: 58 unit tests; clean lint/build; `scripts/uiux-smoke.cjs` passes five-route skip/title checks, all five pages at three widths and default/200% root text, reduced-motion skeleton, actual control targets, keyboard sort and HTML chart alternatives. Its fixtures are explicitly synthetic. `scripts/live-smoke.cjs` separately passes real OpenFEMA checks at three widths with no page errors.
- Initial checks did fail: narrow/200% layouts overflowed, the generated test initially confused `$select=disasterNumber` with an ID filter, and a sort assertion expected a first-row change even when the fixture was already in that order. Layouts were repaired by K3; the coordinator corrected fixture routing, nonvacuous selectors, explicit sort assertions and final overflow failure gating, then reran.
- No manual screen-reader, physical-phone, vision-based screenshot approval or WCAG certification is claimed. Remaining bundle advisory is approximately 902 kB minified JS; production deployment is a separate gate.

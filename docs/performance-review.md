# DisasterLens performance review — v0.1.2 route-level lazy loading

## Goal

Reduce the single-chunk bundle (~902.18 kB min / 277.23 kB gzip JS) by lazy-loading ALL
five page routes (including the Dashboard), so a non-dashboard entry (About,
Preparedness, Explore, Disaster detail) never downloads the Dashboard chunk containing
the map (react-simple-maps/us-atlas) and Recharts code — only Dashboard uses those.
Entering directly on `/` loads the Dashboard chunk on demand; a static accessible
pending status may display briefly and that is intended. This is the optional low-risk
item in docs/page-uiux-plan.md section 9, not new product scope.

## Smallest change

- `src/App.tsx` only: replace all 5 eager page imports (Dashboard, Explore,
  DisasterDetail, Preparedness, About) with `React.lazy()` dynamic imports. Dashboard
  is lazy too — its pending state is the same static accessible status.
- One route-local `<Suspense>` wraps each lazy route element inside the persistent
  Layout so skip link, nav, page title/focus management stay mounted during lazy load.
  Layout itself is not edited.
- Accessible pending status: a simple `role="status"` text node ("Loading page…"),
  rendered instantly (no timer delays), respecting reduced-motion (static text, no
  spinner animation).

## Non-goals

- No changes to `src/lib/fema.ts`, dependencies, lint config, copy, disclosures, route
  paths, catch-all (`*` → `/`) handling, or build metadata generation.
- No manual chunk config in vite.config.ts and no raising of chunk warning limits.
- No service worker, prefetching, caching changes, or design rewrites.
- Loaded-query/cache state: pages keep their own hooks; session snapshot cache in
  fema.ts is untouched, so re-navigation behaves exactly as in v0.1.1.

## Measurable before/after

- Before: single `assets/index-*.js` of 902.18 kB min / 277.23 kB gzip; CSS 22.97 kB.
## Verification (v0.1.2, actual run)

- `npm install --package-lock-only`: lockfile synced to 0.1.2, 0 vulnerabilities, dependency tree unchanged.
- `npm run lint` (oxlint): exit 0, 0 warnings, no config changes.
- `npm test`: 58 passed, 0 failed (unchanged suite).
- `npm run build`: passed. Chunks:
  - `index-DjUmJ8Qi.js` 264.98 kB min / 84.30 kB gzip (entry shell/router/shared vendor; no Dashboard map/Recharts)
  - `DashboardPage-BYG4QenG.js` 609.29 kB / 184.20 kB gzip (loaded only for dashboard entry/navigation; contains map/Recharts)
  - `ExplorePage-90FPVlhP.js` 6.34 kB / 2.43 kB gzip
  - `PreparednessPage-DehWYNpo.js` 5.84 kB / 2.41 kB gzip
  - `DisasterDetailPage-IHhU4p93.js` 4.28 kB / 1.54 kB gzip
  - `AboutPage-To3uKG8l.js` 3.94 kB / 1.63 kB gzip
  - shared `constants-CNBGxH6p.js` 2.80 kB / 1.30 kB gzip, `fema-BIK1za5r.js` 6.20 kB / 2.49 kB gzip
  - CSS `index-DCWrEctI.css` 23.05 kB / 5.48 kB gzip
  - Before: single 902.18 kB / 277.23 kB gzip JS. The >500 kB chunk advisory remains,
    now on `DashboardPage-*.js`; per plan, no manual chunk config or warning-limit
    changes were made. Do not claim the warning disappears or that total bytes for a
    dashboard entry are reduced; the win is that non-dashboard entries do not request
    the Dashboard chunk.
- `git diff --check`: passed.
- `node /root/.hermes/profiles/dev-mate/cache/scratch/disasterlens-lazy-network.cjs`
  against a local static preview of `dist/` at http://127.0.0.1:8792/ (fresh
  `index-DjUmJ8Qi.js`): PASS — direct entries for `#/about`, `#/preparedness`,
  `#/disasters`, and `#/disaster/4945` requested their own lazy chunks and never
  requested `DashboardPage-*.js`; `#/` requested `DashboardPage-BYG4QenG.js`;
  cross-route click to Dashboard preserved focus/title (`#main-content`,
  `Dashboard — DisasterLens`).
- Pending boundary: route-local `<Suspense>` per lazy route inside the persistent
  Layout; skip link, nav, and title/focus manager stay mounted. Fallback is an
  instant `role="status"` "Loading page…" text — no timers, no animation.
- `scripts/uiux-smoke.cjs` and coordinator live checks were not rerun in this
  correction; no claim is made here beyond lint/build and the lazy-network assertion.

## Risk and rollback

R2 from the plan: lazy routes could regress direct-hash deep links or the smoke script.
Mitigation: Suspense boundary is route-local; catch-all and title/focus logic unchanged.
If smoke fails, revisit the route change rather than accepting a build alone.

## Independent coordinator closeout

- Rebuilt the integrated tree: entry 264.98 kB min / 84.30 kB gzip; Dashboard 609.29 kB / 184.20 kB gzip; page chunks and shared helpers emitted separately. Hashes vary across rebuilds because build metadata changes.
- `scripts/lazy-smoke.cjs`: passed real direct entries on all five routes; actual browser requests confirm no Dashboard chunk on About, Preparedness, Explore or detail. Held the Dashboard chunk on a fresh entry: loading status, persistent navigation, skip-link focus and title passed; release completed successfully. About-to-Dashboard navigation focus/title also passed. React Router transitions may retain the previous screen rather than flash the Suspense fallback; the harness checks the actual contract instead of forcing a flash.
- `scripts/uiux-smoke.cjs`: passed all synthetic five-route, three-width, default/200% text, reduced-motion and keyboard checks.
- `scripts/live-smoke.cjs`: independently passed real FEMA data, paging/sort/empty/direct-detail and metadata/version at 320/390/1440; no page errors.
- Coordinator reran lint, all 58 unit tests and diff checks successfully. Browser tooling was reinstalled in active-profile scratch when its old temporary path disappeared; no application dependency was added.
- This is local verified build evidence, not a production deployment or manual assistive-technology acceptance. The Dashboard chunk still carries the >500 kB advisory.

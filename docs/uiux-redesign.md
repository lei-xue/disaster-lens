# DisasterLens v0.3.0 — map-first UI/UX redesign

Status: implemented and independently checked on the integrated production build; feature-branch preview for user visual review. Production/main publication requires separate approval. This is a tangible six-page redesign, not a declaration of final subjective visual acceptance or complete WCAG certification.

## Before / After / Why

| Before | After | Why |
| --- | --- | --- |
| Slate/blue dashboard, KPI row before geography | Navy/teal/ink on warm paper; coherent shell, headings and reading hierarchy | Give the public-data explorer a deliberate identity |
| Long mobile filter panel before the map | One immediate State selector, map/scope/KPI hero, then full year/type filters and secondary charts | The main task is visible before detailed configuration; no records or controls removed |
| Center-anchored state tooltip persisted after click | Transient pointer-anchored tip; focus information outside geography; pointer/touch leave clears the tip | Fix the exact user-confirmed central box without removing accessible state names |
| Dropdown required Apply; map applied immediately | Both share state-only immediate selection using the applied year/type query | Predictable state selection while preserving unsubmitted year/type drafts |
| Focus help unmounted during pointer-down and moved Apply before pointer-up | Hide the last focus-help slot with visibility/ARIA on blur while retaining its geometry | A single Apply click actually submits; no event-delay workaround |
| Ordinary list/detail/guide/alert card presentation | Refined record toolbar/table, editorial declaration facts, scannable NWS records, numbered preparedness sections and source/glossary reading layout | Carry the shared design through all six routes |
| About incorrectly claimed session-only data storage | Accurate six-query/twenty-detail persistent historical snapshots and 24h freshness explanation | Correct visible documentation without changing cache policy |

## Shared vocabulary and contracts

- Palette: `--dl-paper`, `--dl-surface`, `--dl-ink`, `--dl-ink-soft`, `--dl-navy`, `--dl-navy-deep`, `--dl-teal`, `--dl-teal-soft`, `--dl-amber`, `--dl-line`, `--dl-focus`.
- Shell: `atlas-shell`, `atlas-header`, `atlas-nav-link`, `atlas-footer`.
- Interiors: `dl-page`, `dl-kicker`, `dl-page-title`, `dl-page-lede`, `dl-card`, `dl-note`, `dl-meta`, `dl-hero`, `dl-hero-map`, `dl-hero-aside`, `dl-grid-secondary`.
- Controls: `dl-btn`, primary/secondary/compact variants, `dl-chip`, `dl-field-label`, `dl-select`, `dl-link`.
- Five navigation destinations and six actual HashRouter page types remain. Skip link, route titles, main focus and automatic version/build/SHA footer are retained.
- State selection does not submit draft year/type edits. Apply explicitly commits those drafts; Reset restores the complete default query; cached exact queries reuse source snapshots. Applied scope is bound to results, not relabeled by unfinished requests.
- Real US paths (50 states + DC), state-select equivalents for small states/territories, all existing charts/text alternatives and complete resource/area lists remain.
- Pointer tips and focus help are distinct. On blur, the helper is invisible and aria-hidden, not described by unrelated controls. Retaining its last geometry avoids lost clicks after map interaction. A small reserved help slot after first focus is an intentional tradeoff.
- Historical FEMA freshness/storage bounds and NWS opt-in refresh/privacy/source semantics are unchanged. No GPS inference, new backend, DNS change, dependency upgrade or guaranteed emergency monitoring.

## Independently observed iteration defects

The coordinator did not count worker exits as acceptance. Two initial tool workers timed out after useful edits; their writers were confirmed stopped, partial work preserved and bounded K3 runs completed the requested scope. Actual route ledgers were `kimi-k3` / `custom`; successful page-interior runs used eight API calls each and the final map-priority run used seven. Read-only supplied-evidence/code proposals were integrated and tested separately.

1. The original central-box lifecycle assertion failed on the actual production UI, then passed on the redesign for mouse/leave and touch emulation. Keyboard help remains outside geography.
2. Root `overflow-x: clip` was removed. With clipping removed, 320/390px at 200% text exposed detail-header badge overflow. The specific non-shrinking badge row was fixed, not masked.
3. The first layout still put the map at y=1277px on a 390x1000 viewport. Reordering placed it at y=609px, before detailed filters; measured width 324px and height 169px. These are browser geometry measurements, not timed usability claims.
4. Apply after a map click initially failed: blur removed a 66px helper and shifted the button between pointer-down/up. The regression now requires one click to submit the exact draft query and passes.
5. Coarse-pointer controls measured 14.4px despite a base-layer 16px rule. A utilities-layer, class-qualified rule now uses `max(1rem, 16px)` and the touch regression checks 16px minimum and 32px at 200% text.
6. Alert fields were briefly wrapped in a `dl` containing paragraph children. The wrapper was corrected to a `div` while retaining all labels and values.

## Acceptance exercised

- Clean install: zero npm vulnerabilities; dependency lock entries unchanged apart from root package version.
- 114/114 Node tests, lint, TypeScript/Vite production build and diff checks passed.
- `state-interaction-smoke.cjs`: pointer click/leave, touch emulation, keyboard identity/focus, coarse-font scaling, immediate dropdown/map state, preserved drafts, exact cached nationwide reuse, explicit single-click Apply and Reset.
- `uiux-bounds-smoke.cjs`: 36 actual rendered route/width/text combinations (six routes, 320/390/1440px, 100/200% root text), critical-control bounds, no root clipping, genuine pointer-hover appearance and dismissal.
- `uiux-smoke.cjs`: titles/skip/main focus on six routes, 44px tested controls, reduced-motion pending skeleton, accessible map/chart alternatives, overflow checks.
- `cache-map-smoke.cjs`: synthetic cache reuse, A/B/A restoration, fresh/expired/failure/retry/clear, independent detail, real SVG click/Enter/Space and text/page zoom. Updated focus-help assertions match the new contract rather than requiring the old central box.
- `nws-smoke.cjs`: explicitly synthetic applied-versus-draft area, stale failure, expiry/empty/deadline, opt-in five-minute timer and hidden pause, expanded content and zoom.
- Separately unmocked FEMA: initial bounded global query 5 requests; Dashboard/Explore/back, identical Apply and reload +0 each; uncached California +1 and reload +0; independent detail 4945 +1, reload +0, forced refresh +1. The actual sample returned seven designated areas. Counts are observations, not a universal one-request promise.
- Separately unmocked NWS and all six route types at mobile/desktop: HTTP 200, actual FeatureCollection and rendered state/fetch time, no page errors. Source feature counts varied during this session and were not represented as a current weather bulletin.
- Source AST comparison confirmed Alerts and Explore non-render state/fetch logic matches baseline; `src/lib` is unchanged.
- Calculated token-color contrast for the tested ink/muted/navy/teal/amber combinations exceeded 4.5:1. This does not certify every state or screen reader.

## Remaining gates

- User review of the actual preview and visual direction; screenshots were captured but not falsely claimed as a vision-based subjective audit.
- Physical-phone touch/iOS focus behavior and manual screen-reader acceptance remain unverified; emulation is labelled as such.
- Dashboard still has an approximately 612 kB minified chart chunk advisory. Lazy non-Dashboard entries remain checked; performance optimization is not silently declared finished.
- Main/production publishing remains separately gated. Local uncommitted footer SHA is the base commit, not evidence of a published release; final preview identity is read back after commit/push.

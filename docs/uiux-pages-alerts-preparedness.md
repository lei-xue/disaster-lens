# UI/UX redesign — Alerts & Preparedness pages

Owned files: src/pages/AlertsPage.tsx, src/pages/PreparednessPage.tsx, this doc.
No changes to shared CSS, other pages, libs, fetch/state/timing/caching logic, labels, or control names.

| Area | Before | After | Why |
| --- | --- | --- | --- |
| Page shell | `space-y-6` div, slate-900 h1, slate-600 lede | `dl-page` + `dl-kicker` + `dl-page-title` + `dl-page-lede` (shared atlas classes from src/index.css:102-129) | Consistent hierarchy/palette with the redesigned shared shell; kicker "Live source · api.weather.gov" makes the NWS-only, current-data nature explicit |
| Alerts toolbar | white card, slate borders, blue-700 buttons | `dl-card` surface; navy primary / outlined secondary buttons; privacy disclosure separated by a `border-t` rule | Primary area-selection reads as a distinct toolbar; full privacy/no-GPS/no-realtime disclosure preserved verbatim |
| Alert records | flat white cards, single-column fields, blue links | `dl-card` with teal left accent; severity chip top-right; two-column field grid with section dividers (valid `div` wrapper; paragraph-valued fields are not definition-list children); navy underlined official-record link | Scannable header (event/headline/severity), area+times grouped, wrapping preserved via `[overflow-wrap:anywhere]` |
| Status surfaces | blue-50 / plain white boxes | teal "Updating…" pill, paper-toned empty/auto-refresh panels; amber stale/error semantics unchanged | Applied-area/fetched-time header now sits above a `border-b` divider; error/stale/expired/empty conditionals untouched |
| Preparedness | 3 generic white cards, plain link list | numbered section headers (01/02/03) with rule divider; resources grouped into paper-toned tiles; editorial kicker | Deliberate before/during/after reading order; all 12 tips, 4 resource links, 911 warning, details/summary keyboard behavior retained |

Source evidence: palette/classes from src/index.css (--dl-* tokens, .dl-page/.dl-card/.dl-kicker/.dl-page-title/.dl-page-lede). All original strings, facts, hrefs, and conditional rendering logic diffed and preserved.

Validation limitations: no tests/lint/build run here (coordinator runs after all writers stop). No browser/responsive/screen-reader verification performed; 44px control heights (`min-h-11`) and min-w-0 wrapping kept by construction. No FEMA content exists on these two pages, so no NWS-vs-FEMA cross-source labeling was applicable beyond the NWS-source kicker.

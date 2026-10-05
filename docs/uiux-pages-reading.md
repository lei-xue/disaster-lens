# UI/UX reading notes — Explore, Detail, About pages

Scope: src/pages/ExplorePage.tsx, src/pages/DisasterDetailPage.tsx, src/pages/AboutPage.tsx.
No data logic, caching, fetch, abort, snapshot, pagination, search, or sort behavior changed.
Shared .dl-* classes and palette variables from phase 1 index.css reused; no new CSS written.

| File | Before | After | Why |
|---|---|---|---|
| ExplorePage.tsx | Plain Tailwind slate/blue header + bare snapshot line + cardless table | .dl-page header with kicker/title/lede, snapshot + scope + error grouped in a .dl-card toolbar card, records section in a .dl-card with "Records" heading, labeled search field (dl-field-label), table on paper/surface palette, dl-btn pagination | Geography-first data-browser structure: clear toolbar, refined table, quiet row metadata; palette consistency |
| DisasterDetailPage.tsx | Flat card with pill chips above h1, generic facts grid | Editorial header: kicker + h1 + lede summarizing number/state/date, declaration-type chips moved to header, facts card with dl-kicker labels and separated area-list block, dl-note source footnote, dl-btn refresh | Declaration reads as a document; facts hierarchy clearer; source/fetch/refresh grouped |
| AboutPage.tsx | Three stacked cards; sentence "nothing is stored beyond this session" | Same sections with dl-page header and dl-card sections, dividers between declaration-type entries, section aria-labelledby | Reading layout with section dividers instead of nested-card feel |
| AboutPage.tsx (factual fix) | "no server in between, no API key, and nothing is stored beyond this session" | States bounded IndexedDB persistence: up to 6 query snapshots, 20 detail snapshots, 24h freshness window, Clear cached data action; clarifies snapshot freshness time differs from official record date | Old claim was false; historical FEMA snapshots do persist locally. No 24h-deletion or persistent-NWS-alerts claims added |
| AboutPage.tsx | NWS paragraph ended at "real-time warning" | Added: current alerts and historical declarations are separate views, not merged | Keeps current-vs-historical distinction explicit |

Retained: all IDs, labels, captions, aria-sort, roles, 44px targets (min-h-11 / dl-btn), HashRouter links, 5,000-record cap copy, disclaimer, glossary, resource/source links and counts. Single h1 per page. No new features, no data removal.
Not done: no build/test run (coordinator builds after all writers stop); logic unchanged so npm test not required.

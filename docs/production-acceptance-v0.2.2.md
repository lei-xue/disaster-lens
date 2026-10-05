# DisasterLens v0.2.2 production publication acceptance

Verified 2026-10-05; evidence checkpoint 20:33 UTC. This closes the accepted historical-cache publication milestone, not the whole UI roadmap or a claim of perfect emergency coverage.

## Authorization and identity

- A Kimi K3 read-only release review was independently checked by the coordinator; actual worker usage was `kimi-k3` / `custom` / one API call.
- The user explicitly authorized re-verification, main merge/push and custom-host production acceptance.
- Clean `fix/disasterlens-data-flow` commit `3a7c22532729665bc098f6cc84d77d4b9ee5cabe` was 14 ahead / 0 behind fetched `origin/main`, with no uncommitted application changes.
- `main` was fast-forwarded without force and pushed. Remote readback matched the exact accepted commit.
- Its Cloudflare Pages check completed successfully at `2026-10-05T20:29:17Z`: production deployment `https://d2f8e5b3.disaster-lens.pages.dev/`.
- Direct browser readback on **https://disasterlens.leixue.dev/**: `Version 0.2.2 · Built 2026-10-05 20:29 UTC · 3a7c225`.
- Production entry `/assets/index-D5Fdc41a.js` replaced the old `/assets/index-CVjNh_Uu.js`. The accepted preview `/assets/index-DdA_eqY0.js` has a different build time; asset filenames were not falsely required to match.
- Original production/custom-host and Pages root both served the old entry and no release footer/Alerts link. The accepted branch had not reached main; updating main resolved the live mismatch. No DNS, domain-binding, WAF, origin-policy or infrastructure changes were made.

## Local gates

`npm ci`, 114/114 Node tests, `npm run lint`, TypeScript and Vite production build all passed. npm reported zero vulnerabilities. The known Dashboard chunk >500 kB build warning remains; broader chunk/visual optimization was not added to this publication scope.

## Preview and production browser gates

All six existing scripts were read before execution and rerun against both the immutable accepted preview `https://49514aea.disaster-lens.pages.dev/` and the custom production hostname with explicit `BASE_URL`.

- `uiux-smoke.cjs`: **synthetic FEMA**, six hash routes, titles/skip link/focus, reduced-motion pending skeleton, at least 44px tested navigation/apply/pagination targets, accessible map/chart alternatives, no horizontal page overflow at 320/390/1440px and default/200% root font.
- `cache-map-smoke.cjs`: **synthetic FEMA**, 51 real SVG state/DC paths; click/Enter/Space, selected/path focus, exact cached A/B/A scopes, reload and independent-detail reuse, forced refresh, failed refresh retaining prior data/scope, Retry recovery, expired Dashboard/Explore/detail fallback, durable clear, and 200% text/page zoom including tooltip bounds. No page errors.
- `nws-smoke.cjs`: **synthetic NWS**, not evidence of actual weather: no inferred-area initial query, applied-versus-draft refresh, stale fallback, empty and deadline states, opt-in five-minute auto refresh and hidden pause, expanded-content geometry.
- `live-cache-smoke.cjs`: **unmocked FEMA**, real request counts in the JSON evidence; no response interception.
- `live-smoke.cjs`: **unmocked FEMA**, real list rows, Explore pagination/sort/no-match, About/Preparedness and independent disaster 4945 with seven returned designated areas; footer, no page errors and page overflow at 320/390/1440px. Its final raw metadata assertion reads the local built HTML, not production HTML.
- `lazy-smoke.cjs`: real six hash-route entries and deferred Dashboard chunk requests; the pending-chunk/focus test intentionally intercepts only that JavaScript asset, not FEMA response payloads.

Production actual FEMA request additions:

- Initial bounded global query: **5**.
- Dashboard → Explore, Explore → Dashboard, identical Apply and full reload: **0 each**.
- New uncached California map selection: **1**; California reload: **0**.
- Independent detail 4945: **1**; detail reload: **0**; force detail refresh: **1**.

These are observed requests for this sample, not a promise that every new query needs one request. Pagination and source changes can alter new-query counts. The 5,000-area-row limit and incomplete-view warning remained visible.

## Additional unmocked source acceptance

A separate isolated browser probe verified the actual custom hostname and retained exact persisted `fetchedAt`, records/count, applied query and `limitReached` across Dashboard/Explore/return/full reload, with zero additional FEMA requests. Five initial pages yielded 5,000 records with `limitReached: true`; no complete-US count was claimed.

On `#/alerts`, the actual California NWS request returned HTTP 200 and a FeatureCollection with **19 source features** at this checkpoint. Its UI exposed California and source retrieval time. Explicit Load issued one request; force Refresh added one request. Auto refresh started off; no device location was used. This is a historical verification observation, not a current alert bulletin or a guarantee of real-time availability. No synthetic weather fixtures were substituted for the source response.

## Evidence boundaries and remaining scope

- JSON evidence stores the actual hostname and distinguishes genuine source results from synthetic regressions. The old cache-smoke console label incorrectly said 'local production build' even when parameterized for hosting; its label was corrected to include `baseUrl` and re-exercised against production without changing application behavior.
- A Python urllib root probe received HTTP 403. Browser-based checks on the exact public hostname succeeded without weakening access policy; no direct-client failure was presented as successful evidence.
- Historical FEMA uses the adopted 24h bounded persistent cache; NWS freshness remains separate. No personal location, medical input or API credential was recorded.
- Automated responsive/keyboard acceptance is not physical-device touch acceptance. Broader map visual identity/redesign and future performance work remain separate planning/approval milestones.
- This acceptance documentation and evidence-label fix are delivered on the repair branch after publication. They do not silently advance production beyond the exact verified main commit above.

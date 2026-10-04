# NWS Current Weather Alerts — Plan (v0.2.0)

Status: Phases A–C implemented and independently verified on the local production build. Feature-branch delivery follows acceptance; production merge/deployment remains separate. The original proposal is preserved below, with implementation evidence at the end.

## 1. Scope

Add a lazy-loaded `#/alerts` page that fetches current active U.S. weather alerts from the official NWS API (`https://api.weather.gov/alerts/active?area=XX`) for a user-selected state/territory. English only. Static app: no backend, no new dependencies, no API keys, no geolocation or permissions. Current NWS alerts are distinct from FEMA declaration history; the page states it is not real-time guaranteed and covers weather alerts only, not all hazards.

Out of scope: map redesign, alert detail route, auth, push notifications/monitoring, prediction, any pagination invention (the API supports none — coordinator evidence: `limit=5` returns HTTP 400; openapi.json lists no limit/offset).

## 2. Source evidence and constraints

- `GET https://api.weather.gov/alerts/active?area=CA` returned 200 with `Access-Control-Allow-Origin: *` and 22 GeoJSON features in a dated sample; no pagination.
- Supported filters per official openapi.json: `status,message_type,event,code,area,point,region,region_type,zone,urgency,severity,certainty`. Query uses selected `area`, `status=actual` and `message_type=alert,update` so test/drill/cancellation records are not presented as current warnings.
- Feature shape: `properties` includes `id, areaDesc, sent, effective, onset, expires, ends, status, messageType, category, severity, certainty, urgency, event, headline, description, instruction (nullable), senderName`. `geometry` may legitimately be `null`.
- `properties.web` may be a generic `http://www.weather.gov` — not a reliable per-alert link; do not present it as an alert detail URL.
- Browser CORS reachability must be independently verified with a real browser sample (curl CORS headers are not full proof).
- Never invent alerts: if the source fails, show an error, never synthesized data.

## 3. User journeys and UI states

1. Land on `#/alerts` via new nav link ("Alerts"); document title updates. Initial state: state/territory select blank, no inferred location, a privacy/source disclaimer, and a "Load alerts" button. No fetch occurs before explicit user action.
2. User picks a state/territory (states + DC + territories list from a static constant; NWS `area` accepts postal codes for states and territories). "Load alerts" becomes enabled.
3. Loading: skeleton/spinner with `role="status"`; the select remains editable (changing it is a draft, does not cancel-label old results).
4. Success: header shows "Alerts for XX — fetched <timestamp with timezone>" plus applied-state label; cards render; auto-refresh option appears.
5. Empty: "No active alerts were returned by NWS for XX in this snapshot. This does not mean there is no danger." — never phrased as "no danger".
6. Error: message + retry; if a previous successful snapshot exists, it stays visible and is explicitly labeled "Stale — last updated <timestamp>; refresh failed".
7. Draft state: changing the select after a successful load marks results "Showing results for XX; selection changed to YY — Load alerts to apply." Old results are never relabeled to the new state.
8. Expiry: client-side labeling "expired/ending soon" uses the earliest of known `ends`/`expires`; if neither is present, expiry is shown as "unknown" — never guessed.

## 4. Card content (per alert)

- Event name and headline.
- Area (`areaDesc`), sender (`senderName`).
- Severity, certainty, urgency as text (not color-only; text labels always present for accessibility).
- `sent` and `expires`/`ends` rendered with explicit timezone; missing values labeled "unknown".
- Official `description` and `instruction` as plain text inside a `<details>` disclosure (multiline preserved, no HTML injection — text nodes only).
- "Official record (JSON)" link to `Feature.id` only when it validates as an `https://api.weather.gov/` absolute URL; otherwise no link is rendered. Label states it is raw JSON.

## 5. Data contract and safety

- Module `src/lib/nws.ts` (mirrors `src/lib/fema.ts` patterns): `NWS_BASE_URL`, `buildActiveAlertsUrl(area)`, `fetchActiveAlerts(area, signal, request)`, `NwsError` with friendly HTTP messages (400/404/429/5xx), injectable `fetch` for tests.
- Response validation: payload must be an object with `features` array; each feature must have `properties.event` string and a valid `properties.id` string; other fields tolerated as nullable/unknown with explicit fallbacks. On any structural violation, throw and discard the entire payload — no partial render.
- Client-side cap: render at most 500 alerts; if more arrive, show the newest 500 by `sent` with a visible notice "Showing 500 of N alerts returned." No pagination is requested or implied.
- Abort: each new request cancels the previous via `AbortController`; a stale/aborted response can never publish (guard by comparing the current request token before setting state).
- Deadline: enforce a 20-second deadline covering transport and JSON parsing; combine with caller cancellation and clear deadline/listeners on completion. Aborting on unmount/navigation is mandatory; auto-refresh timers are cleared on unmount.

## 6. Refresh semantics

- Manual "Refresh" always available after first load; re-fetches the applied state (not the draft).
- Optional user-enabled auto-refresh checkbox, off by default, interval fixed at 5 minutes (no more frequent), runs only while the page is visible (`document.visibilityState === 'visible'`); when the tab is hidden the timer pauses and resumes on visibility — it does not fire a catch-up burst.
- On refresh failure with existing data: keep last good view, mark stale with timestamp, keep retry available. On success, stale label clears and `fetchedAt` updates.

## 7. Privacy and disclaimers (at point of action)

Text near the Load button: "Loads current alerts directly from the U.S. National Weather Service (api.weather.gov). The query includes your selected state/territory; NWS also receives normal connection information such as your IP address and browser headers. We do not request device location. Data may be delayed or cached; this is not a guaranteed real-time warning or notification service. Always follow local officials."

## 8. Implementation phases

1. Phase A — `src/lib/nws.ts` + `src/lib/nws.test.ts`: URL builder (only `area` param), fetch/validation, error taxonomy, expiry helper (`earliestEnd(properties)`), link validator (`isOfficialRecordUrl`). Unit tests with injected mock fetch (see §9).
2. Phase B — `src/pages/AlertsPage.tsx` + nav entry in `src/components/Layout.tsx` + lazy route in `src/App.tsx` + title handling; state machine: `idle | loading | success(appliedState, fetchedAt) | error | stale`; draft vs applied select.
3. Phase C — real-browser acceptance: load `#/alerts`, select CA, fetch live API in browser, confirm CORS, rendering, empty/error paths via devtools throttling. Bump version to 0.2.0 only with the feature commit.

## 9. Tests (measurable)

Mocked (node --test, injected fetch):
- URL contains validated `area=XX`, `status=actual` and `message_type=alert,update`; no unsupported `limit`/paging params.
- 200 with valid GeoJSON → parsed alerts; `geometry: null` accepted; `instruction: null` accepted.
- 400/429/500/network failure/invalid JSON/invalid shape → `NwsError` with friendly message; nothing partial returned.
- Expiry helper: ends < expires → ends; only expires → expires; neither → unknown; unparseable → unknown.
- Record-link validator: accepts `https://api.weather.gov/alerts/...`, rejects `http://`, other hosts, and generic `http://www.weather.gov`.
- Cap: 600-feature payload → 500 kept, cap notice flag set.
Regression: existing `npm run test`, `npm run lint`, `npm run build` must pass unchanged; no edits to FEMA code paths.
Live (browser, documented in PR): one real fetch against api.weather.gov for one state; record feature count and CORS success in the acceptance note.

## 10. Risks / open items

- Browser CORS was independently proven from the local app origin: real fetch to `alerts/active?area=CA&status=actual` returned HTTP200/FeatureCollection with22 records in a dated sample. Recheck through the implemented page; do not treat this sample as a fixed count.
- NWS may rate-limit; 429 message tells user to wait; no retry loop beyond manual retry.
- Use official state/territory allowlists; do not infer coverage from a successful empty response or silently remove a requested region on transient HTTP failures. Marine areas and location inference remain out of scope.

## 11. Implemented checkpoint

- A: `src/lib/nws.ts` and `tests/nws.test.ts` implement the filtered URL, full-payload validation, newest-first 500-record cap, safe official record links, earliest known end, and transport/body deadlines with caller cancellation. No dependency or FEMA-module changes.
- B: `src/pages/AlertsPage.tsx`, lazy route, navigation/title, source footer/About/metadata, README, and manifest/lock version 0.2.0 are implemented. The UI preserves applied snapshots, opt-in polling, stale/error/empty states and local expiry labels.
- C: coordinator independently passed 74 unit tests, lint, clean install, production build, six-route UIUX/lazy gates and NWS browser fixtures. A real CA request through the implemented page returned HTTP 200 and rendered 22 weather-alert records on 2026-10-04 at 22:06 UTC; this is a changing source sample, not a fixed count.
- Initial browser acceptance exposed real 200%-text overflow and a polling-area dependency bug. K3 corrections were retained after the repair worker exceeded its reporting deadline; coordinator independently verified the final artifact, including changing CA to TX with polling enabled. The harness freezes time after lazy content mounts, not before navigation.
- Missing card text is explicitly 'Not provided' or 'Unknown'; optional spinners/ending-soon styling were not necessary to the approved minimal UI. The actual module helpers are `getAlertEndMs` and `isOfficialRecordUrl`; the test file lives in `tests/`.
- Production merge/deployment, a verified public hostname, physical-phone and manual screen-reader acceptance remain separate. See [acceptance](acceptance.md) for execution details and remaining boundaries.

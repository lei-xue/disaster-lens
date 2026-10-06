# Production readiness

DisasterLens remains a public beta, not an emergency monitoring system.

## Implemented and locally exercised

- Bounded, validated FEMA pagination; later-page errors never publish partial success.
- Request cancellation and an application-owned 60-second deadline, including body parsing.
- Applied-query snapshots, stale-cache fallback, and explicit record/date scope.
- Optional map chunk isolation and route-level failure recovery with surviving navigation.
- Unit tests and production-browser interaction, recovery, privacy and responsive checks.
- Pinned Playwright dependency and GitHub push/PR verification workflow.

Run the CI-equivalent path locally:

```sh
npm ci
npm audit --audit-level=high
npm test
npm run lint
npm run build
npx playwright install chromium
node scripts/browser-suite.cjs
```

The browser runner starts an isolated Vite production preview, checks HTTP readiness,
uses synthetic source responses in regression suites, and stops the server afterward.
It overrides inherited BASE_URL so a different project's server cannot produce a false pass.
It is not proof of live FEMA/NWS availability or real-device acceptance.

## Open release gates

- [ ] Define and implement complete historical statistics or explicitly retain a bounded-snapshot product scope. Current queries can reach the 5,000-row limit; showing actual dates does not solve completeness.
- [ ] Verify live source behavior and the exact deployment's footer SHA after publication.
- [ ] Set up operational uptime/exception alerting with an authorized provider and privacy review.
- [ ] Exercise a rollback on the actual hosting pipeline with user authorization.
- [ ] Test Firefox, WebKit, physical phones and manual screen-reader navigation.
- [ ] Measure cold-load performance on a constrained connection, not only output chunk sizes.
- [ ] Confirm GitHub verification succeeds remotely; configure required checks only with authorization.

## Release boundaries

The workflow verifies code and the built artifact; it does not deploy, merge main,
or change Cloudflare settings. Existing Git-connected hosting can deploy a push
independently of this check. Merely adding CI does not block such deployment.
No external error telemetry or visitor data transfer is introduced by this milestone.

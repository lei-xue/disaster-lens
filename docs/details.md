# DisasterLens: details

## Data sources

- **FEMA disaster declarations:** [OpenFEMA DisasterDeclarationsSummaries v2](https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries), fetched in the browser in batches of 1,000 (up to 5,000 records per query).
- **Weather alerts:** [NWS active alerts](https://api.weather.gov/alerts/active), loaded only after you pick a state.

## Good to know

- Counts are declaration records per designated area (usually a county), **not unique disasters**.
- If a query reaches 5,000 records, the app marks the results as possibly incomplete.
- FEMA results are cached in the browser for 24 hours; **Refresh data** always reloads.
- Alerts can be delayed and are not a real-time warning service. Always follow local officials.
- DisasterLens is not affiliated with FEMA or NWS.

## Hosting

`npm run build` creates a static site in `dist/` (relative paths, hash-based routes), so it can be hosted anywhere, e.g. Cloudflare Pages. No backend or API key is needed.

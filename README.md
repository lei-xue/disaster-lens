# DisasterLens

A map-first explorer for FEMA disaster declarations, with current National Weather Service alerts.

**Live:** [disasterlens.leixue.dev](https://disasterlens.leixue.dev/)

![DisasterLens screenshot](docs/preview.jpg)

## Features

- Filter declarations by year, state and type on an interactive map with charts
- Search and browse records, with a details page for each disaster
- Check current NWS weather alerts for any state
- Preparedness tips and clear data notes

> Informational only, not a real-time warning service. In an emergency, follow local officials.

**Tech:** React, TypeScript, Vite, Tailwind CSS, Recharts, react-simple-maps

## Run locally

```bash
npm ci
npm run dev     # start
npm test        # tests
npm run build   # production build
```

More detail (data sources, hosting): [docs/details.md](docs/details.md)

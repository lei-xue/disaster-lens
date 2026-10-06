const DECLARATION_TYPES: Array<{ code: string; label: string; meaning: string }> = [
  {
    code: 'DR',
    label: 'Major Disaster Declaration',
    meaning:
      'Declared by the President after a governor’s request. Unlocks the broadest federal help, including individual assistance for households and public assistance for rebuilding infrastructure.',
  },
  {
    code: 'EM',
    label: 'Emergency Declaration',
    meaning:
      'A narrower declaration, often issued ahead of an approaching event, that provides limited federal support to protect life and property — typically for emergency protective measures rather than long-term rebuilding.',
  },
  {
    code: 'FM',
    label: 'Fire Management Assistance',
    meaning:
      'Provides federal funding to state and local agencies for mitigating, managing, and controlling wildfires that threaten to become major disasters.',
  },
]

export default function AboutPage() {
  return (
    <div className="dl-page">
      <header>
        <h1 className="dl-page-title">About DisasterLens</h1>
      </header>

      <div className="dl-reference">
        <section className="dl-reference-section" aria-labelledby="about-data-source">
          <h2 id="about-data-source" className="dl-reference-title">
            Data source
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--dl-ink-soft)]">
            DisasterLens reads the{' '}
            <a
              className="dl-link"
              href="https://www.fema.gov/about/openfema"
            >
              OpenFEMA
            </a>{' '}
            Disaster Declarations Summaries dataset (API v2), fetched directly
            from{' '}
            <code className="break-all rounded bg-[var(--dl-paper)] px-1.5 py-0.5 text-sm">
              www.fema.gov/api/open/v2/DisasterDeclarationsSummaries
            </code>{' '}
            in your browser — no server in between and no API key. The dataset
            covers federally declared disasters back to 1953; this dashboard
            focuses on 2016 onward. Each record represents one declaration for
            one designated area (usually a county), so a single disaster
            covering several counties appears several times, and counts here
            are record counts, not unique disasters.
          </p>
          <dl className="dl-reference-facts mt-4">
            <div>
              <dt>Historical declarations</dt>
              <dd>
                OpenFEMA Disaster Declarations Summaries (API v2) — federal
                declaration history from 1953; this app focuses on 2016
                onward.
              </dd>
            </div>
            <div>
              <dt>Current alerts</dt>
              <dd>
                Separately from FEMA history, the Alerts page loads current
                active weather alerts directly from the National Weather
                Service API (api.weather.gov) for a state or territory you
                select. That snapshot covers official NWS weather alerts only,
                may be delayed or cached, and is not a guaranteed real-time
                warning or notification service. Current alerts and historical
                declarations are separate views and are not merged.
              </dd>
            </div>
            <div>
              <dt>Bounded local cache</dt>
              <dd>
                For accepted historical FEMA queries, the app keeps bounded
                public-record snapshots in your browser’s IndexedDB so
                revisits feel faster: up to 6 query snapshots and 20 detail
                snapshots, refreshed within a 24-hour freshness window, with a
                Clear cached data action available. Snapshot freshness is the
                time since the local copy was fetched; it is different from
                the official record date FEMA assigns.
              </dd>
            </div>
            <div>
              <dt>Privacy</dt>
              <dd>
                Requests go directly from your browser to FEMA and NWS. Each
                service receives the query you make plus normal connection
                information such as your IP address and browser headers. The
                app does not request device location and uses no accounts,
                analytics, or tracking.
              </dd>
            </div>
            <div>
              <dt>Counts and coverage</dt>
              <dd>
                Each query loads at most 5,000 records. At that limit, charts,
                search and area lists may be incomplete. Details query the
                selected disaster independently, including older declarations.
                Counts shown are record counts, not unique disasters.
              </dd>
            </div>
            <div>
              <dt>Limitations</dt>
              <dd>
                Data is fetched on page load or an applied query, not
                continuously monitored; freshness depends on FEMA updates.
                Data may lag real-world events and can be incomplete.
              </dd>
            </div>
          </dl>
        </section>

        <section className="dl-reference-section" aria-labelledby="about-declaration-types">
          <h2 id="about-declaration-types" className="dl-reference-title">
            Declaration types
          </h2>
          <dl className="dl-reference-glossary mt-2">
            {DECLARATION_TYPES.map((type) => (
              <div key={type.code}>
                <dt className="shrink-0">
                  <span className="inline-flex h-8 w-10 items-center justify-center rounded-md bg-[var(--dl-navy)] text-sm font-bold text-[var(--dl-surface)]">
                    {type.code}
                  </span>
                </dt>
                <dd className="min-w-0 text-sm">
                  <p className="font-semibold text-[var(--dl-ink)]">{type.label}</p>
                  <p className="mt-0.5 leading-relaxed text-[var(--dl-ink-soft)]">
                    {type.meaning}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5" aria-labelledby="about-disclaimer">
          <h2 id="about-disclaimer" className="text-lg font-semibold text-amber-900">Disclaimer</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            DisasterLens is an informational project, not an official source of
            emergency information. It is not affiliated with FEMA. Data may lag
            real-world events and can be incomplete. This site will never alert
            you to an imminent threat — in an emergency, call 911 and follow
            instructions from your local officials.
          </p>
        </section>
      </div>
    </div>
  )
}

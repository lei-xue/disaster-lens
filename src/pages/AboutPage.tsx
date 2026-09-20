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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          About DisasterLens
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          What this dashboard shows, where the data comes from, and what it
          does not do.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Data source</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          DisasterLens reads the{' '}
          <a
            className="text-blue-700 hover:underline"
            href="https://www.fema.gov/about/openfema"
          >
            OpenFEMA
          </a>{' '}
          Disaster Declarations Summaries dataset (API v2), fetched directly
          from{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            www.fema.gov/api/open/v2/DisasterDeclarationsSummaries
          </code>{' '}
          in your browser — no server in between, no API key, and nothing is
          stored beyond this session. The dataset covers federally declared
          disasters back to 1953; this dashboard focuses on 2016 onward. Each
          record represents one declaration for one designated area (usually a
          county), so a single disaster covering several counties appears
          several times, and counts here are record counts, not unique
          disasters.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Declaration types
        </h2>
        <dl className="mt-3 space-y-4">
          {DECLARATION_TYPES.map((type) => (
            <div key={type.code} className="flex gap-3">
              <dt className="shrink-0">
                <span className="inline-flex h-8 w-10 items-center justify-center rounded-md bg-blue-700 text-sm font-bold text-white">
                  {type.code}
                </span>
              </dt>
              <dd className="text-sm">
                <p className="font-semibold text-slate-900">{type.label}</p>
                <p className="mt-0.5 leading-relaxed text-slate-600">
                  {type.meaning}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="text-lg font-semibold text-amber-900">Disclaimer</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          DisasterLens is an informational project, not an official source of
          emergency information. It is not affiliated with FEMA. Data may lag
          real-world events and can be incomplete. This site will never alert
          you to an imminent threat — in an emergency, call 911 and follow
          instructions from your local officials.
        </p>
      </section>
    </div>
  )
}

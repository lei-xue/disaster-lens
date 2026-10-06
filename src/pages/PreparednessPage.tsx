interface PreparednessSection {
  title: string
  items: Array<{ summary: string; details: string }>
}

const SECTIONS: PreparednessSection[] = [
  {
    title: 'Before an emergency',
    items: [
      {
        summary: 'Build an emergency kit',
        details:
          'Stock one gallon of water per person per day for at least three days, plus non-perishable food, a flashlight with spare batteries, a first-aid kit, a battery-powered or hand-crank radio, medications, phone chargers and a backup battery, a whistle to signal for help, dust masks, a wrench or pliers to shut off utilities, a manual can opener, local maps, and some cash.',
      },
      {
        summary: 'Gather documents and make copies',
        details:
          'Keep IDs, insurance policies, bank records, and medical information in a waterproof, portable container, and store digital copies somewhere you can reach from any device. Know how to shut off water, gas, and electricity at home.',
      },
      {
        summary: 'Set up alerts and know your routes',
        details:
          'Turn on Wireless Emergency Alerts on your phone, consider a NOAA Weather Radio, and sign up for your county or city alert system. Learn your evacuation routes and the location of nearby shelters, and plan for pets and for family members with access and functional needs.',
      },
      {
        summary: 'Make a family plan',
        details:
          'Agree on meeting points, choose an out-of-area contact everyone can text, and practice your plan at least once a year so children know what to do.',
      },
    ],
  },
  {
    title: 'During an emergency',
    items: [
      {
        summary: 'If you are told to evacuate, leave immediately',
        details:
          'Take your kit, lock your home, and follow posted evacuation routes — never around barricades or into flooded roads. Tell someone where you are going.',
      },
      {
        summary: 'If you shelter in place, pick the right room',
        details:
          'For tornadoes and high winds, go to an interior room on the lowest floor away from windows. For flooding, move to higher ground or an upper level. Text instead of calling to keep phone lines open, and conserve your battery.',
      },
      {
        summary: 'Never drive or walk through floodwater',
        details:
          'Twelve inches of moving water can carry away a car. Turn Around, Don’t Drown — the road bed underneath may be washed out entirely.',
      },
      {
        summary: 'Follow instructions from local officials',
        details:
          'Officials on the ground have the most current information. Do not return home until they say it is safe, even if the storm has passed.',
      },
    ],
  },
  {
    title: 'After a disaster',
    items: [
      {
        summary: 'Check for hazards before anything else',
        details:
          'Stay away from downed power lines, call the gas company if you smell gas, and enter damaged buildings only when officials say it is safe. Photograph damage before you start cleaning up.',
      },
      {
        summary: 'Clean up safely',
        details:
          'Wear gloves, boots, and an N95 mask, and avoid contact with floodwater, which can contain sewage and chemicals. Throw out food that touched floodwater or sat without refrigeration.',
      },
      {
        summary: 'Apply for FEMA assistance if a major disaster was declared',
        details:
          'Apply online at disasterassistance.gov or call 1-800-621-3362. Have your Social Security number, insurance information, bank details, and damage photos ready. There is never a fee to apply.',
      },
      {
        summary: 'Call 211 for local help',
        details:
          'Dial 211 or visit 211.org to find shelters, food, cleanup assistance, and other local resources provided by community organizations.',
      },
    ],
  },
]

export default function PreparednessPage() {
  return (
    <div className="dl-page">
      <header>
        <h1 className="dl-page-title [overflow-wrap:anywhere]">
          Preparedness guide
        </h1>
      </header>

      <div
        role="alert"
        className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900"
      >
        If you are in immediate danger, call 911. Always follow instructions
        from your local emergency officials.
      </div>

      <div className="dl-guide">
        {SECTIONS.map((section, index) => (
          <section key={section.title} className="dl-guide-section">
            <div className="dl-guide-heading">
              <span aria-hidden="true" className="dl-guide-num">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="mt-1 text-base font-bold text-[var(--dl-navy-deep)]">
                {section.title}
              </h2>
            </div>
            <ul className="dl-guide-list">
              {section.items.map((item) => (
                <li key={item.summary} className="dl-guide-item">
                  <details className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-[var(--dl-ink)] marker:hidden hover:text-[var(--dl-teal)] [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block text-[var(--dl-teal)] transition-transform motion-reduce:transition-none group-open:rotate-90"
                      >
                        ▸
                      </span>
                      {item.summary}
                    </summary>
                    <p className="mt-2 pl-5 text-sm leading-relaxed text-[var(--dl-ink-soft)]">
                      {item.details}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section aria-labelledby="prep-resources">
        <h2
          id="prep-resources"
          className="text-base font-bold text-[var(--dl-navy-deep)]"
        >
          Key resources
        </h2>
        <p className="mt-1 text-sm text-[var(--dl-ink-soft)]">
          Official starting points — grouped by what they help you do.
        </p>
        <div className="dl-guide-resources mt-3">
          <div className="dl-guide-resource-group">
            <h3>Prepare</h3>
            <ul>
              <li>
                <a
                  className="dl-link text-sm"
                  href="https://www.ready.gov/kit"
                >
                  ready.gov/kit — build your emergency kit
                </a>
              </li>
              <li>
                <a
                  className="dl-link text-sm"
                  href="https://www.weather.gov"
                >
                  weather.gov — official National Weather Service forecasts
                </a>
              </li>
            </ul>
          </div>
          <div className="dl-guide-resource-group">
            <h3>Recover</h3>
            <ul>
              <li>
                <a
                  className="dl-link text-sm"
                  href="https://www.disasterassistance.gov"
                >
                  disasterassistance.gov — apply for FEMA assistance
                </a>
              </li>
            </ul>
          </div>
          <div className="dl-guide-resource-group">
            <h3>Find local help</h3>
            <ul>
              <li>
                <a
                  className="dl-link text-sm"
                  href="https://www.211.org"
                >
                  211.org — find local community resources
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

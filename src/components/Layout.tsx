import { NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-700 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2" fill="#fbbf24" stroke="none" />
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              DisasterLens
            </span>
          </NavLink>
          <nav aria-label="Main navigation" className="ml-auto">
            <ul className="flex flex-wrap items-center gap-1">
              <li>
                <NavLink to="/" end className={navLinkClass}>
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/disasters" className={navLinkClass}>
                  Explore
                </NavLink>
              </li>
              <li>
                <NavLink to="/preparedness" className={navLinkClass}>
                  Preparedness
                </NavLink>
              </li>
              <li>
                <NavLink to="/about" className={navLinkClass}>
                  About
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500 sm:px-6">
          <p>
            Data from the{' '}
            <a
              className="font-medium text-blue-700 hover:underline"
              href="https://www.fema.gov/about/openfema"
            >
              FEMA OpenFEMA API
            </a>
            . DisasterLens is informational only — in an emergency, follow your
            local officials.
          </p>
        </div>
      </footer>
    </div>
  )
}

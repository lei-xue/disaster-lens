import { useEffect, useRef, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `atlas-nav-link ${isActive ? 'atlas-nav-link--active' : ''}`

function routeTitle(pathname: string): string {
  if (pathname.startsWith('/disaster/')) return 'Declaration details — DisasterLens'
  switch (pathname) {
    case '/alerts':
      return 'Current weather alerts — DisasterLens'
    case '/disasters':
      return 'Explore declarations — DisasterLens'
    case '/preparedness':
      return 'Preparedness guide — DisasterLens'
    case '/about':
      return 'About — DisasterLens'
    default:
      return 'Dashboard — DisasterLens'
  }
}

export default function Layout() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement | null>(null)
  const prevPathnameRef = useRef(location.pathname)

  // Per-route document title on every effect run; move focus to <main> only
  // when the pathname actually changed (a previous-pathname ref survives
  // StrictMode's duplicate initial effect, unlike a first-render flag).
  useEffect(() => {
    document.title = routeTitle(location.pathname)
    if (prevPathnameRef.current === location.pathname) return
    prevPathnameRef.current = location.pathname
    mainRef.current?.focus({ preventScroll: false })
  }, [location.pathname])

  // Hash-safe skip link: preventDefault so location.hash (the HashRouter
  // route) is never modified; explicitly focus main and scroll it into view.
  const skipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const main = mainRef.current
    if (!main) return
    main.focus({ preventScroll: true })
    main.scrollIntoView({ block: 'start' })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:max-w-[calc(100vw-1rem)] focus:rounded-md focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:break-words"
      >
        Skip to main content
      </a>
      <header className="atlas-header">
        <div className="atlas-shell flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
          <NavLink to="/" className="flex min-h-11 min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-700"
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
            <span className="min-w-0">
              <span className="block break-words text-lg font-bold tracking-tight text-white">
                DisasterLens
              </span>
              <span className="block text-[0.65rem] font-semibold tracking-[0.14em] text-teal-200 uppercase">
                Public disaster data explorer
              </span>
            </span>
          </NavLink>
          <nav aria-label="Main navigation" className="ml-auto min-w-0">
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
                <NavLink to="/alerts" className={navLinkClass}>
                  Alerts
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
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="atlas-shell flex-1 py-6 outline-none sm:py-8"
      >
        <Outlet />
      </main>
      <footer className="atlas-footer">
        <div className="atlas-shell py-6">
          <p>
            Historical disaster declarations from the{' '}
            <a
              className="dl-link"
              href="https://www.fema.gov/about/openfema"
            >
              FEMA OpenFEMA API
            </a>
            ; current weather alerts on the Alerts page from the{' '}
            <a
              className="dl-link"
              href="https://www.weather.gov/documentation/services-web-api"
            >
              National Weather Service API
            </a>
            . DisasterLens is informational only — in an emergency, follow your
            local officials.
          </p>
          <p className="mt-3" aria-label="Website build information">
            Version {__APP_VERSION__} · Built {__BUILD_TIME__.replace('T', ' ').slice(0, 16)} UTC · {__COMMIT_SHA__}
          </p>
        </div>
      </footer>
    </div>
  )
}

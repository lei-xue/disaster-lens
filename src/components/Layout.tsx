import { useEffect, useRef, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-700 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

function routeTitle(pathname: string): string {
  if (pathname.startsWith('/disaster/')) return 'Declaration details — DisasterLens'
  switch (pathname) {
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
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:max-w-[calc(100vw-1rem)] focus:rounded-md focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:break-words"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex min-w-0 min-h-11 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700"
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
            <span className="min-w-0 break-words text-lg font-bold tracking-tight text-slate-900">
              DisasterLens
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
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
      >
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
          <p className="mt-3" aria-label="Website build information">
            Version {__APP_VERSION__} · Built {__BUILD_TIME__.replace('T', ' ').slice(0, 16)} UTC · {__COMMIT_SHA__}
          </p>
        </div>
      </footer>
    </div>
  )
}

import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'

const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'))
const ExplorePage = lazy(() => import('./pages/ExplorePage.tsx'))
const DisasterDetailPage = lazy(() => import('./pages/DisasterDetailPage.tsx'))
const PreparednessPage = lazy(() => import('./pages/PreparednessPage.tsx'))
const AlertsPage = lazy(() => import('./pages/AlertsPage.tsx'))
const AboutPage = lazy(() => import('./pages/AboutPage.tsx'))

function RoutePending() {
  return (
    <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-gray-600">
      <svg viewBox="0 0 24 24" className="h-10 w-10 text-[#9a3412]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 3 L21 20 L3 20 Z" />
        <circle cx="12" cy="15" r="2" fill="currentColor" stroke="none" />
      </svg>
      <p>Loading page…</p>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={<RoutePending />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="disasters"
          element={
            <Suspense fallback={<RoutePending />}>
              <ExplorePage />
            </Suspense>
          }
        />
        <Route
          path="disaster/:disasterNumber"
          element={
            <Suspense fallback={<RoutePending />}>
              <DisasterDetailPage />
            </Suspense>
          }
        />
        <Route
          path="preparedness"
          element={
            <Suspense fallback={<RoutePending />}>
              <PreparednessPage />
            </Suspense>
          }
        />
        <Route
          path="alerts"
          element={
            <Suspense fallback={<RoutePending />}>
              <AlertsPage />
            </Suspense>
          }
        />
        <Route
          path="about"
          element={
            <Suspense fallback={<RoutePending />}>
              <AboutPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App

import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'

const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'))
const ExplorePage = lazy(() => import('./pages/ExplorePage.tsx'))
const DisasterDetailPage = lazy(() => import('./pages/DisasterDetailPage.tsx'))
const PreparednessPage = lazy(() => import('./pages/PreparednessPage.tsx'))
const AboutPage = lazy(() => import('./pages/AboutPage.tsx'))

function RoutePending() {
  return (
    <p role="status" className="p-4 text-sm text-gray-600">
      Loading page…
    </p>
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

import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import AboutPage from './pages/AboutPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import DisasterDetailPage from './pages/DisasterDetailPage.tsx'
import ExplorePage from './pages/ExplorePage.tsx'
import PreparednessPage from './pages/PreparednessPage.tsx'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="disasters" element={<ExplorePage />} />
        <Route path="disaster/:disasterNumber" element={<DisasterDetailPage />} />
        <Route path="preparedness" element={<PreparednessPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App

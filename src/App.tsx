import { Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './modules/auth/AuthProvider'
import LoginPage from './modules/auth/LoginPage'
import RegisterPage from './modules/auth/RegisterPage'
import WorkspacePage from './modules/companies/WorkspacePage'
import AdminLayout from './modules/platform-admin/AdminLayout'
import AdminOverviewPage from './modules/platform-admin/AdminOverviewPage'
import AdminCompaniesPage from './modules/platform-admin/AdminCompaniesPage'
import AdminLicencesPage from './modules/platform-admin/AdminLicencesPage'
import AdminFeaturesPage from './modules/platform-admin/AdminFeaturesPage'
import AdminDiagnosticsPage from './modules/platform-admin/AdminDiagnosticsPage'
import AdminCustomizationRequestsPage from './modules/platform-admin/AdminCustomizationRequestsPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="companies" element={<AdminCompaniesPage />} />
          <Route path="licences" element={<AdminLicencesPage />} />
          <Route path="features" element={<AdminFeaturesPage />} />
          <Route path="customization-requests" element={<AdminCustomizationRequestsPage />} />
          <Route path="diagnostics" element={<AdminDiagnosticsPage />} />
        </Route>
        <Route path="/workspace/:slug" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App

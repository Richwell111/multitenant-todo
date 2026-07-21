import { Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './modules/auth/AuthProvider'
import LoginPage from './modules/auth/LoginPage'
import RegisterPage from './modules/auth/RegisterPage'
import WorkspacePage from './modules/companies/WorkspacePage'
import AdminPage from './modules/platform-admin/AdminPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/workspace/:slug" element={<WorkspacePage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App

import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { evaluateAdminAccess } from '../auth/authService'
import { AppPageShell, PageHeader } from '../../shared/ui'
import AdminNavigation from './AdminNavigation'
import PlatformAdminDiagnostics from './PlatformAdminDiagnostics'

function AdminDiagnosticsPage() {
  const { status, account, signOut } = useAuth()
  if (status === 'loading') return <AppPageShell className="auth-layout"><section className="auth-card state-card"><h1>Diagnostics</h1><p className="muted">Checking your session...</p></section></AppPageShell>
  const access = evaluateAdminAccess(account)
  if (access === 'unauthenticated') return <Navigate to="/admin" replace />
  if (access === 'ADMIN_ONLY') return <AppPageShell><section className="auth-card"><p className="alert alert-error" role="alert">{AUTH_MESSAGES.ADMIN_ONLY}</p><div className="form-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div></section></AppPageShell>
  if (!account || account.kind !== 'platform-admin') return null
  return <AppPageShell><PageHeader title="Platform Admin Diagnostics" description="Safe release, lifecycle, and provider configuration information." nav={<AdminNavigation />} /><PlatformAdminDiagnostics account={account} /></AppPageShell>
}

export default AdminDiagnosticsPage
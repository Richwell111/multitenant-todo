import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { useAuth } from '../auth/authContext'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { evaluateAdminAccess } from '../auth/authService'
import { AppPageShell } from '../../shared/ui'
import AdminLoginForm from './AdminLoginForm'
import AdminNavigation from './AdminNavigation'

// One shared, protected Platform Admin layout. The authentication guard lives here
// only; nested route pages render inside <Outlet /> and read the account from the
// outlet context, so no page duplicates the guard.
function AdminLayout() {
  const { status, account, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  if (status === 'loading') {
    return <AppPageShell className="auth-layout"><section className="auth-card state-card"><h1>Platform Admin</h1><p className="muted">Checking your session...</p></section></AppPageShell>
  }

  const access = evaluateAdminAccess(account)
  if (access === 'unauthenticated') {
    return <AppPageShell className="auth-layout"><AdminLoginForm /></AppPageShell>
  }
  if (access === 'ADMIN_ONLY') {
    return (
      <AppPageShell className="auth-layout">
        <section className="auth-card">
          <header><h2>Platform Admin</h2><p className="muted">This area is limited to Platform Admin accounts.</p></header>
          <p className="alert alert-error" role="alert">{AUTH_MESSAGES.ADMIN_ONLY}</p>
          <div className="form-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div>
        </section>
      </AppPageShell>
    )
  }
  if (!account || account.kind !== 'platform-admin') return null

  return (
    <div className={`admin-shell${menuOpen ? ' is-menu-open' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false) }}>
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-menu-button button-ghost"
          aria-controls="admin-sidebar"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span className="sr-only">{menuOpen ? 'Close navigation menu' : 'Open navigation menu'}</span>
        </button>
        <span className="admin-topbar-brand">Todo SaaS · Platform Admin</span>
      </header>

      <div className="admin-scrim" hidden={!menuOpen} onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <aside id="admin-sidebar" className="admin-sidebar" aria-label="Platform Admin sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">T</span>
          <span className="admin-brand-text"><strong>Todo SaaS</strong><span>Platform Admin</span></span>
        </div>
        <AdminNavigation onNavigate={() => setMenuOpen(false)} />
        <div className="admin-sidebar-footer">
          <div className="admin-account">
            <span className="admin-account-avatar" aria-hidden="true">PA</span>
            <span className="admin-account-text"><strong>Platform Admin</strong><span className="muted">Signed in</span></span>
          </div>
          <button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button>
        </div>
      </aside>

      <main className="admin-content" id="admin-content">
        <Outlet context={{ account, signOut }} />
      </main>
    </div>
  )
}

export default AdminLayout

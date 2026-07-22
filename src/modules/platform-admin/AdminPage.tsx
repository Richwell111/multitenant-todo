import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { evaluateAdminAccess, LoginValidationError } from '../auth/authService'
import { LicenceApiError } from '../licensing/licenceRepository'
import { LicenceValidationError } from '../licensing/licenceService'
import { changeCompanyStatus, generateLicence, loadDashboard, type PlatformAdminSnapshot } from './platformAdminService'
import PlatformAdminExtensions from './PlatformAdminExtensions'

function AdminLoginForm() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setFieldErrors({})
    setFormError('')
    try { await signIn({ email, password }); setPassword('') }
    catch (error) {
      if (error instanceof LoginValidationError) setFieldErrors(error.fieldErrors)
      setFormError(error instanceof Error ? error.message : AUTH_MESSAGES.NETWORK_ERROR)
    } finally { setPending(false) }
  }

  return (
    <section className="auth-card">
      <header><h2>Platform Admin Sign In</h2><p className="muted">Manage Companies, licences, and proof extensions.</p></header>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fieldErrors.email)} autoComplete="username" />{fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}</div>
        <div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fieldErrors.password)} autoComplete="current-password" />{fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}</div>
        {formError && <p className="alert alert-error" role="alert">{formError}</p>}
        <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</button></div>
      </form>
    </section>
  )
}

function GenerateLicenceForm({ account, onGenerated }: { account: Extract<NonNullable<ReturnType<typeof useAuth>['account']>, { kind: 'platform-admin' }>; onGenerated: () => void }) {
  const [companyName, setCompanyName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [result, setResult] = useState<{ licenceKey: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true); setResult(null); setCopied(false); setFieldErrors({}); setFormError('')
    try {
      const generated = await generateLicence(account, { companyName, expiryDate, status: 'available' })
      setResult(generated); onGenerated()
    } catch (error) {
      if (error instanceof LicenceValidationError || error instanceof LicenceApiError) setFieldErrors(error.fieldErrors)
      setFormError(error instanceof Error ? error.message : 'The licence could not be generated.')
    } finally { setPending(false) }
  }

  async function copyKey() {
    if (!result) return
    if (navigator.clipboard) await navigator.clipboard.writeText(result.licenceKey)
    setCopied(true)
  }

  return (
    <section className="section-card">
      <div className="section-heading"><h2>Generate Licence</h2><span className="muted">One-time key display</span></div>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field"><label htmlFor="licence-company-name">Company Name</label><input id="licence-company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />{fieldErrors.companyName && <p className="field-error">{fieldErrors.companyName}</p>}</div>
        <div className="field"><label htmlFor="licence-expiry-date">Expiry Date</label><input id="licence-expiry-date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />{fieldErrors.expiryDate && <p className="field-error">{fieldErrors.expiryDate}</p>}</div>
        {formError && <p className="alert alert-error" role="alert">{formError}</p>}
        <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Generating...' : 'Generate licence'}</button></div>
      </form>
      {result && <section className="alert licence-result" aria-live="polite"><h3>Licence generated</h3><p>Copy this key now. It cannot be recovered later.</p><code className="licence-key">{result.licenceKey}</code><div className="form-actions"><button type="button" onClick={copyKey}>{copied ? 'Copied' : 'Copy key'}</button><button className="button-secondary" type="button" onClick={() => setResult(null)}>Dismiss</button></div></section>}
    </section>
  )
}

function AdminDashboard({ account, signOut }: { account: Extract<NonNullable<ReturnType<typeof useAuth>['account']>, { kind: 'platform-admin' }>; signOut: () => Promise<void> }) {
  const [snapshot, setSnapshot] = useState<PlatformAdminSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingId, setPendingId] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try { setSnapshot(await loadDashboard(account)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load Platform Admin data') }
    finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  async function toggle(company: PlatformAdminSnapshot['companies'][number]) {
    const next = company.status === 'active' ? 'suspended' : 'active'
    if (!window.confirm(`Are you sure you want to ${next === 'suspended' ? 'suspend' : 'reactivate'} ${company.name}?`)) return
    setPendingId(company.id); setActionError(''); setSuccess('')
    try { await changeCompanyStatus(account, company, next); setSuccess(`Company ${next === 'suspended' ? 'suspended' : 'reactivated'}.`); await refresh() }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Unable to update Company status') }
    finally { setPendingId('') }
  }

  if (loading && !snapshot) return <div className="stack-gap"><div className="page-header-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div><p className="state">Loading Platform Admin data...</p><GenerateLicenceForm account={account} onGenerated={() => void refresh()} /><PlatformAdminExtensions account={account} /></div>
  if (error && !snapshot) return <div className="stack-gap"><div className="page-header-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div><section className="section-card"><p className="alert alert-error" role="alert">{error}</p><div className="state-actions"><button className="button-secondary" type="button" onClick={() => void refresh()}>Retry</button></div></section><GenerateLicenceForm account={account} onGenerated={() => void refresh()} /><PlatformAdminExtensions account={account} /></div>
  if (!snapshot) return null

  return (
    <div className="stack-gap">
      <div className="page-header-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div>
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {success && <p className="alert alert-success" role="status">{success}</p>}
      <section className="section-card">
        <div className="section-heading"><h2>Overview</h2><span className="muted">Platform snapshot</span></div>
        <div className="summary-grid">
          <div className="summary-card"><span className="summary-label">Total Companies</span><strong className="summary-value">{snapshot.counts.totalCompanies}</strong></div>
          <div className="summary-card"><span className="summary-label">Active</span><strong className="summary-value">{snapshot.counts.activeCompanies}</strong></div>
          <div className="summary-card"><span className="summary-label">Suspended</span><strong className="summary-value">{snapshot.counts.suspendedCompanies}</strong></div>
          <div className="summary-card"><span className="summary-label">Total licences</span><strong className="summary-value">{snapshot.counts.totalLicences}</strong></div>
          <div className="summary-card"><span className="summary-label">Available</span><strong className="summary-value">{snapshot.counts.availableLicences}</strong></div>
          <div className="summary-card"><span className="summary-label">Redeemed</span><strong className="summary-value">{snapshot.counts.redeemedLicences}</strong></div><div className="summary-card"><span className="summary-label">Expired</span><strong className="summary-value">{snapshot.counts.expiredLicences}</strong></div><div className="summary-card"><span className="summary-label">Revoked</span><strong className="summary-value">{snapshot.counts.revokedLicences}</strong></div>
        </div>
      </section>
      <section className="section-card"><div className="section-heading"><h2>Companies</h2><span className="muted">{snapshot.companies.length} registered</span></div>{snapshot.companies.length === 0 ? <p className="state">No Companies found.</p> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Slug</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{snapshot.companies.map((company) => <tr key={company.id}><td>{company.name}</td><td>{company.email}</td><td>{company.slug}</td><td><span className={`status-badge status-${company.status}`}>{company.status}</span></td><td>{new Date(company.createdAt).toLocaleDateString()}</td><td><button className="button-inline" type="button" disabled={pendingId === company.id} onClick={() => void toggle(company)}>{company.status === 'active' ? 'Suspend' : 'Reactivate'}</button></td></tr>)}</tbody></table></div>}</section>
      <section className="section-card"><div className="section-heading"><h2>Licences</h2><span className="muted">{snapshot.licences.length} total</span></div>{snapshot.licences.length === 0 ? <p className="state">No licences found.</p> : <div className="table-scroll"><table><thead><tr><th>Company</th><th>Prefix</th><th>Status</th><th>Expires</th><th>Created</th><th>Redeemed</th></tr></thead><tbody>{snapshot.licences.map((licence) => <tr key={licence.id}><td>{licence.companyName}</td><td><code>{licence.keyPrefix}</code></td><td><span className={`status-badge status-${licence.displayStatus.toLowerCase()}`}>{licence.displayStatus}</span></td><td>{new Date(licence.expiresAt).toLocaleDateString()}</td><td>{new Date(licence.createdAt).toLocaleDateString()}</td><td>{licence.redeemedAt ? new Date(licence.redeemedAt).toLocaleDateString() : '-'}</td></tr>)}</tbody></table></div>}</section>
      <GenerateLicenceForm account={account} onGenerated={() => void refresh()} />
      <PlatformAdminExtensions account={account} />
    </div>
  )
}

function AdminPage() {
  const { status, account, signOut } = useAuth()
  if (status === 'loading') return <main className="auth-layout"><section className="auth-card state-card"><h1>Platform Admin</h1><p className="muted">Checking your session...</p></section></main>
  const access = evaluateAdminAccess(account)
  return <main className="page-shell"><header className="page-header"><div><h1>Platform Admin</h1><p>Manage Companies and licences from one shared platform.</p></div></header>{access === 'unauthenticated' && <AdminLoginForm />}{access === 'ADMIN_ONLY' && <section className="auth-card"><p className="alert alert-error" role="alert">{AUTH_MESSAGES.ADMIN_ONLY}</p><div className="form-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div></section>}{access === 'allowed' && account?.kind === 'platform-admin' && <AdminDashboard account={account} signOut={signOut} />}</main>
}

export default AdminPage

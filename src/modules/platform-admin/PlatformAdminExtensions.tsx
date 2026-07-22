import { useCallback, useEffect, useState } from 'react'
import type { Account } from '../auth/authService'
import { PlatformAdminExtensionServiceError, loadPlatformAdminExtensions, setPlatformAdminPrivateAssignment, PRIVATE_EXTENSION_ID, type PlatformAdminExtensionSnapshot } from './platformAdminExtensionService'

function PlatformAdminExtensions({ account }: { account: Extract<Account, { kind: 'platform-admin' }> }) {
  const [snapshot, setSnapshot] = useState<PlatformAdminExtensionSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingKey, setPendingKey] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setSnapshot(await loadPlatformAdminExtensions(account)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Extension assignments could not be loaded. Try again.') }
    finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  async function toggle(companyId: string, enabled: boolean) {
    if (!window.confirm(`${enabled ? 'Enable' : 'Disable'} Priority Labels Demo for this Company?`)) return
    const key = `${companyId}:${PRIVATE_EXTENSION_ID}`
    setPendingKey(key); setActionError(''); setSuccess('')
    try { await setPlatformAdminPrivateAssignment(account, companyId, PRIVATE_EXTENSION_ID, enabled); setSuccess(`Priority Labels Demo ${enabled ? 'enabled' : 'disabled'}.`); await refresh() }
    catch (e) { setActionError(e instanceof PlatformAdminExtensionServiceError ? e.message : 'The extension assignment could not be changed.') }
    finally { setPendingKey('') }
  }

  if (loading && !snapshot) return <section className="section-card" aria-labelledby="extension-management-heading"><div className="section-heading"><h2 id="extension-management-heading">Extension management</h2></div><p className="state" role="status">Loading extensions...</p></section>
  if (error && !snapshot) return <section className="section-card" aria-labelledby="extension-management-heading"><div className="section-heading"><h2 id="extension-management-heading">Extension management</h2></div><p className="alert alert-error" role="alert">{error}</p><div className="state-actions"><button className="button-secondary" type="button" onClick={() => void refresh()}>Retry</button></div></section>
  if (!snapshot) return null

  const privateExtension = snapshot.extensions.find((extension) => extension.id === PRIVATE_EXTENSION_ID)
  return (
    <section className="section-card" aria-labelledby="extension-management-heading">
      <div className="section-heading"><h2 id="extension-management-heading">Extension management</h2><span className="muted">Proof extension controls</span></div>
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {success && <p className="alert alert-success" role="status">{success}</p>}
      <div><h3>Registered extensions</h3><div className="table-scroll"><table><thead><tr><th>Name</th><th>Key</th><th>Availability</th><th>Active</th></tr></thead><tbody>{snapshot.extensions.map((extension) => <tr key={extension.id}><td>{extension.name}</td><td><code>{extension.key}</code></td><td><span className={`status-badge status-${extension.availabilityType}`}>{extension.availabilityType}</span></td><td><span className={`status-badge status-${extension.isActive ? 'active' : 'disabled'}`}>{extension.isActive ? 'Active' : 'Disabled'}</span></td></tr>)}</tbody></table></div></div>
      {privateExtension && <div><h3>Private assignments</h3><div className="table-scroll"><table><thead><tr><th>Assigned Company</th><th>Extension</th><th>Enabled</th><th>Action</th></tr></thead><tbody>{snapshot.companies.map((company) => { const assignment = snapshot.assignments.find((item) => item.companyId === company.id && item.extensionId === PRIVATE_EXTENSION_ID); const enabled = Boolean(assignment?.enabled); const key = `${company.id}:${PRIVATE_EXTENSION_ID}`; return <tr key={company.id}><td>{company.name} <span className="muted">({company.slug})</span></td><td>{privateExtension.name}</td><td><span className={`status-badge status-${enabled ? 'enabled' : 'disabled'}`}>{enabled ? 'Enabled' : 'Disabled'}</span></td><td><button className="button-inline" type="button" disabled={pendingKey === key} onClick={() => void toggle(company.id, !enabled)}>{enabled ? 'Disable' : 'Enable'}</button></td></tr> })}</tbody></table></div></div>}
    </section>
  )
}

export default PlatformAdminExtensions

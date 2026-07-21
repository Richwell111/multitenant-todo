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
  const refresh = useCallback(async () => { setLoading(true); setError(''); try { setSnapshot(await loadPlatformAdminExtensions(account)) } catch (e) { setError(e instanceof Error ? e.message : 'Extension assignments could not be loaded. Try again.') } finally { setLoading(false) } }, [account])
  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])
  async function toggle(companyId: string, enabled: boolean) {
    if (!window.confirm(`${enabled ? 'Enable' : 'Disable'} Priority Labels Demo for this Company?`)) return
    const key = `${companyId}:${PRIVATE_EXTENSION_ID}`; setPendingKey(key); setActionError(''); setSuccess('')
    try { await setPlatformAdminPrivateAssignment(account, companyId, PRIVATE_EXTENSION_ID, enabled); setSuccess(`Priority Labels Demo ${enabled ? 'enabled' : 'disabled'}.`); await refresh() }
    catch (e) { setActionError(e instanceof PlatformAdminExtensionServiceError ? e.message : 'The extension assignment could not be changed.') }
    finally { setPendingKey('') }
  }
  if (loading && !snapshot) return <section aria-labelledby="extension-management-heading"><h2 id="extension-management-heading">Extensions</h2><p role="status">Loading extensions...</p></section>
  if (error && !snapshot) return <section aria-labelledby="extension-management-heading"><h2 id="extension-management-heading">Extensions</h2><p role="alert">{error}</p><button type="button" onClick={() => void refresh()}>Retry</button></section>
  if (!snapshot) return null
  const privateExtension = snapshot.extensions.find((extension) => extension.id === PRIVATE_EXTENSION_ID)
  return <section aria-labelledby="extension-management-heading"><h2 id="extension-management-heading">Extension management</h2>{actionError && <p role="alert">{actionError}</p>}{success && <p role="status">{success}</p>}
    <h3>Registered extensions</h3><table><thead><tr><th>Name</th><th>Key</th><th>Availability</th><th>Active</th></tr></thead><tbody>{snapshot.extensions.map((extension) => <tr key={extension.id}><td>{extension.name}</td><td>{extension.key}</td><td>{extension.availabilityType}</td><td>{extension.isActive ? 'yes' : 'no'}</td></tr>)}</tbody></table>
    {privateExtension && <><h3>Private assignments</h3><table><thead><tr><th>Assigned Company</th><th>Extension</th><th>Enabled</th><th>Action</th></tr></thead><tbody>{snapshot.companies.map((company) => { const assignment = snapshot.assignments.find((item) => item.companyId === company.id && item.extensionId === PRIVATE_EXTENSION_ID); const enabled = Boolean(assignment?.enabled); const key = `${company.id}:${PRIVATE_EXTENSION_ID}`; return <tr key={company.id}><td>{company.name} ({company.slug})</td><td>{privateExtension.name}</td><td>{enabled ? 'yes' : 'no'}</td><td><button type="button" disabled={pendingKey === key} onClick={() => void toggle(company.id, !enabled)}>{enabled ? 'Disable' : 'Enable'}</button></td></tr> })}</tbody></table></>}
  </section>
}

export default PlatformAdminExtensions

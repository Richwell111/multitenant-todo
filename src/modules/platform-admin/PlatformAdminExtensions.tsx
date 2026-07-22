import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account } from '../auth/authService'
import { CORE_FEATURE_REGISTRY } from './coreFeatureRegistry'
import { captureUsage } from '../diagnostics/diagnosticsService'
import {
  DISABLEMENT_REASONS,
  PlatformAdminExtensionServiceError,
  loadPlatformAdminExtensions,
  setPlatformAdminPrivateAssignment,
  PRIVATE_EXTENSION_ID,
  type DisablementReason,
  type PlatformAdminExtensionSnapshot,
} from './platformAdminExtensionService'


function askDisablementReason(): DisablementReason | null {
  const answer = window.prompt(`Choose a disablement reason: ${DISABLEMENT_REASONS.join(', ')}`, 'temporary_pause')
  if (!answer || !DISABLEMENT_REASONS.includes(answer as DisablementReason)) return null
  return answer as DisablementReason
}

function PlatformAdminExtensions({ account }: { account: Extract<Account, { kind: 'platform-admin' }> }) {
  const [snapshot, setSnapshot] = useState<PlatformAdminExtensionSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingKey, setPendingKey] = useState('')
  const featuresViewed = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = await loadPlatformAdminExtensions(account)
      setSnapshot(loaded)
      if (!featuresViewed.current) {
        featuresViewed.current = true
        captureUsage('admin.features_viewed', { module_key: 'platform-admin', action_name: 'features_viewed', success: true })
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Features could not be loaded. Try again.') }
    finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  async function toggle(companyId: string, enabled: boolean) {
    const reason = enabled ? null : askDisablementReason()
    if (!enabled && !reason) {
      setActionError('Choose a valid disablement reason before continuing.')
      return
    }
    if (!window.confirm(`${enabled ? 'Enable' : 'Disable'} Priority Labels Demo for this Company?`)) return
    const key = `${companyId}:${PRIVATE_EXTENSION_ID}`
    setPendingKey(key); setActionError(''); setSuccess('')
    try {
      await setPlatformAdminPrivateAssignment(account, companyId, PRIVATE_EXTENSION_ID, enabled, reason)
      setSuccess(`Priority Labels Demo ${enabled ? 'enabled' : 'disabled'}.`)
      await refresh()
    } catch (e) {
      setActionError(e instanceof PlatformAdminExtensionServiceError ? e.message : 'The feature access could not be changed.')
    } finally { setPendingKey('') }
  }

  if (loading && !snapshot) return <section id="features" className="section-card" aria-labelledby="features-heading"><div className="section-heading"><h2 id="features-heading">Features</h2></div><p className="state" role="status">Loading features...</p></section>
  if (error && !snapshot) return <section id="features" className="section-card" aria-labelledby="features-heading"><div className="section-heading"><h2 id="features-heading">Features</h2></div><p className="alert alert-error" role="alert">{error}</p><div className="state-actions"><button className="button-secondary" type="button" onClick={() => void refresh()}>Retry</button></div></section>
  if (!snapshot) return null

  const sharedFeatures = snapshot.extensions.filter((extension) => extension.availabilityType === 'shared')
  const privateFeatures = snapshot.extensions.filter((extension) => extension.availabilityType === 'private')
  const activeCompanyCount = snapshot.companies.filter((company) => company.status === 'active').length

  return (
    <section id="features" className="section-card" aria-labelledby="features-heading">
      <div className="section-heading"><h2 id="features-heading">Features</h2><span className="muted">Product capabilities and Company access</span></div>
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {success && <p className="alert alert-success" role="status">{success}</p>}

      <div className="feature-category">
        <div className="section-heading"><h3>Core Features</h3><span className="muted">Included automatically for every active Company</span></div>
        <div className="extension-grid">{CORE_FEATURE_REGISTRY.map((feature) => <article className="extension-card" key={feature.key}><h4>{feature.name}</h4><p>{feature.description}</p><span className="status-badge status-active">Active</span></article>)}</div>
      </div>

      <div className="feature-category">
        <div className="section-heading"><h3>Shared Features</h3><span className="muted">Reusable features available across Companies</span></div>
        {sharedFeatures.length === 0 ? <p className="state">No shared features are registered.</p> : <div className="table-scroll"><table><thead><tr><th>Feature</th><th>Key</th><th>Status</th><th>Eligible Companies</th></tr></thead><tbody>{sharedFeatures.map((feature) => <tr key={feature.id}><td>{feature.name}</td><td><code>{feature.key}</code></td><td><span className={`status-badge status-${feature.isActive ? 'active' : 'disabled'}`}>{feature.isActive ? 'Active' : 'Inactive'}</span></td><td>{feature.isActive ? activeCompanyCount : 0}</td></tr>)}</tbody></table></div>}
      </div>

      <div className="feature-category">
        <div className="section-heading"><h3>Private Customizations</h3><span className="muted">Selective Company access for private features</span></div>
        {privateFeatures.length === 0 ? <p className="state">No private customizations are registered.</p> : <div className="table-scroll"><table><thead><tr><th>Feature</th><th>Key</th><th>Status</th><th>Companies enabled</th></tr></thead><tbody>{privateFeatures.map((feature) => <tr key={feature.id}><td>{feature.name}</td><td><code>{feature.key}</code></td><td><span className={`status-badge status-${feature.isActive ? 'active' : 'disabled'}`}>{feature.isActive ? 'Active' : 'Inactive'}</span></td><td>{snapshot.assignments.filter((assignment) => assignment.extensionId === feature.id && assignment.enabled).length}</td></tr>)}</tbody></table></div>}
        {privateFeatures.some((feature) => feature.id === PRIVATE_EXTENSION_ID) && <div className="table-scroll"><h4>Company Access</h4><table><thead><tr><th>Company</th><th>Feature</th><th>Access status</th><th>Action</th></tr></thead><tbody>{snapshot.companies.map((company) => { const assignment = snapshot.assignments.find((item) => item.companyId === company.id && item.extensionId === PRIVATE_EXTENSION_ID); const enabled = Boolean(assignment?.enabled); const key = `${company.id}:${PRIVATE_EXTENSION_ID}`; return <tr key={company.id}><td>{company.name}</td><td>Priority Labels Demo</td><td><span className={`status-badge status-${enabled ? 'enabled' : 'disabled'}`}>{enabled ? 'Enabled' : 'Not enabled'}</span></td><td><button className="button-inline" type="button" disabled={pendingKey === key} onClick={() => void toggle(company.id, !enabled)}>{enabled ? 'Disable' : 'Enable'}</button></td></tr> })}</tbody></table></div>}
      </div>
    </section>
  )
}

export default PlatformAdminExtensions
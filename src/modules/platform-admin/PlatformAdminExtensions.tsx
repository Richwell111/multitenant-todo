import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account } from '../auth/authService'
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

// User-facing feature type derived from the extension availability model.
function featureTypeLabel(availabilityType: 'shared' | 'private'): string {
  return availabilityType === 'shared' ? 'Shared Extension' : 'Private Customization'
}

function companyAvailability(assignment: { enabled: boolean } | undefined): { label: string; tone: string } {
  if (!assignment) return { label: 'Available — Not Enabled', tone: 'available_not_enabled' }
  return assignment.enabled ? { label: 'Enabled', tone: 'enabled' } : { label: 'Disabled', tone: 'disabled' }
}

// Section B of the Features page: optional, requested, shared, or private features
// that require development, deployment, or per-Company assignment.
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

  if (loading && !snapshot) return <section className="section-card" aria-labelledby="customizations-heading"><div className="section-heading"><h2 id="customizations-heading">Customizations &amp; Extensions</h2></div><p className="state" role="status">Loading customizations...</p></section>
  if (error && !snapshot) return <section className="section-card" aria-labelledby="customizations-heading"><div className="section-heading"><h2 id="customizations-heading">Customizations &amp; Extensions</h2></div><p className="alert alert-error" role="alert">{error}</p><div className="state-actions"><button className="button-secondary" type="button" onClick={() => void refresh()}>Retry</button></div></section>
  if (!snapshot) return null

  const activeCompanyCount = snapshot.companies.filter((company) => company.status === 'active').length
  const hasPrivateAssignable = snapshot.extensions.some((extension) => extension.id === PRIVATE_EXTENSION_ID && extension.availabilityType === 'private')

  return (
    <section className="section-card" aria-labelledby="customizations-heading">
      <div className="section-heading"><div><h2 id="customizations-heading">Customizations &amp; Extensions</h2><span className="muted">Optional, requested, shared, or private features assigned to specific Companies</span></div></div>
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {success && <p className="alert alert-success" role="status">{success}</p>}

      {snapshot.extensions.length === 0 ? <p className="state">No customizations or extensions are registered.</p> : (
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Registered customizations and extensions</caption>
            <thead><tr><th>Feature</th><th>Internal key</th><th>Feature type</th><th>Global status</th><th>Companies enabled</th></tr></thead>
            <tbody>
              {snapshot.extensions.map((feature) => {
                const enabledCount = feature.availabilityType === 'shared'
                  ? (feature.isActive ? activeCompanyCount : 0)
                  : snapshot.assignments.filter((assignment) => assignment.extensionId === feature.id && assignment.enabled).length
                return (
                  <tr key={feature.id}>
                    <td>{feature.name}</td>
                    <td><code>{feature.key}</code></td>
                    <td>{featureTypeLabel(feature.availabilityType)}</td>
                    <td><span className={`status-badge status-${feature.isActive ? 'active' : 'disabled'}`}>{feature.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>{enabledCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasPrivateAssignable && (
        <div className="feature-category">
          <div className="section-heading"><h3>Company Access</h3><span className="muted">Enable Priority Labels Demo for selected Companies</span></div>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Per-Company access for the private customization</caption>
              <thead><tr><th>Company</th><th>Feature</th><th>Company availability</th><th>Action</th></tr></thead>
              <tbody>
                {snapshot.companies.map((company) => {
                  const assignment = snapshot.assignments.find((item) => item.companyId === company.id && item.extensionId === PRIVATE_EXTENSION_ID)
                  const enabled = Boolean(assignment?.enabled)
                  const availability = companyAvailability(assignment)
                  const key = `${company.id}:${PRIVATE_EXTENSION_ID}`
                  return (
                    <tr key={company.id}>
                      <td>{company.name}</td>
                      <td>Priority Labels Demo</td>
                      <td><span className={`status-badge status-${availability.tone}`}>{availability.label}</span></td>
                      <td><button className={enabled ? 'button-danger button-inline' : 'button-inline'} type="button" disabled={pendingKey === key} onClick={() => void toggle(company.id, !enabled)}>{enabled ? 'Disable' : 'Enable'}</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default PlatformAdminExtensions

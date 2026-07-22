import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account } from '../auth/authService'
import { captureUsage } from '../diagnostics/diagnosticsService'
import { loadPlatformAdminDiagnostics, type PlatformAdminDiagnosticsSnapshot } from './platformAdminDiagnosticsService'

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function PlatformAdminDiagnostics({ account }: { account: Extract<Account, { kind: 'platform-admin' }> }) {
  const [snapshot, setSnapshot] = useState<PlatformAdminDiagnosticsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const diagnosticsViewed = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = await loadPlatformAdminDiagnostics(account)
      setSnapshot(loaded)
      if (!diagnosticsViewed.current) {
        diagnosticsViewed.current = true
        captureUsage('admin.diagnostics_viewed', { module_key: 'platform-admin', action_name: 'diagnostics_viewed', success: true })
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Diagnostics could not be loaded. Try again.') }
    finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  if (loading && !snapshot) return <section className="section-card"><h2>Diagnostics</h2><p className="state" role="status">Loading diagnostics...</p></section>
  if (error && !snapshot) return <section className="section-card"><h2>Diagnostics</h2><p className="alert alert-error" role="alert">{error}</p><div className="state-actions"><button className="button-secondary" type="button" onClick={() => void refresh()}>Retry</button></div></section>
  if (!snapshot) return null

  return (
    <section className="section-card" aria-labelledby="diagnostics-heading">
      <div className="section-heading"><h2 id="diagnostics-heading">Diagnostics</h2><span className="muted">Safe platform monitoring information</span></div>
      {error && <p className="alert alert-error" role="alert">{error}<button className="button-inline" type="button" onClick={() => void refresh()}>Retry</button></p>}
      <div className="summary-grid">
        <div className="summary-card"><span className="summary-label">App version</span><strong className="summary-value">{snapshot.appVersion}</strong></div>
        <div className="summary-card"><span className="summary-label">Environment</span><strong className="summary-value">{snapshot.environment}</strong></div>
        <div className="summary-card"><span className="summary-label">Sentry</span><strong className="summary-value">{snapshot.sentryConfigured ? 'Configured' : 'Not configured'}</strong></div>
        <div className="summary-card"><span className="summary-label">PostHog</span><strong className="summary-value">{snapshot.posthogConfigured ? 'Configured' : 'Not configured'}</strong></div>
      </div>
      <p className="muted">Detailed technical errors are viewed in Sentry. Detailed product usage is viewed in PostHog. Provider analytics are not synchronized into the browser.</p>

      <div className="feature-category"><div className="section-heading"><h3>Enabled assignments by feature</h3></div>{snapshot.enabledAssignmentsByFeature.length === 0 ? <p className="state">No features are registered.</p> : <div className="table-scroll"><table><thead><tr><th>Feature</th><th>Companies enabled</th></tr></thead><tbody>{snapshot.enabledAssignmentsByFeature.map((feature) => <tr key={feature.extensionId}><td>{feature.extensionName}</td><td>{feature.enabledCompanyCount}</td></tr>)}</tbody></table></div>}</div>

      <div className="feature-category"><div className="section-heading"><h3>Recent extension lifecycle</h3></div>{snapshot.assignmentEvents.length === 0 ? <p className="state">No extension lifecycle events recorded.</p> : <div className="table-scroll"><table><thead><tr><th>Company</th><th>Feature</th><th>Change</th><th>Reason</th><th>Changed</th></tr></thead><tbody>{snapshot.assignmentEvents.map((event) => <tr key={event.id}><td>{event.companyName}</td><td>{event.extensionName}</td><td><span className={`status-badge status-${event.enabled ? 'enabled' : 'disabled'}`}>{event.enabled ? 'Enabled' : 'Disabled'}</span></td><td>{event.disabledReason ? statusLabel(event.disabledReason) : '-'}</td><td>{new Date(event.changedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}</div>

      <div className="feature-category"><div className="section-heading"><h3>Customization requests</h3></div>{snapshot.featureRequests.length === 0 ? <p className="state">No customization requests recorded.</p> : <div className="table-scroll"><table><thead><tr><th>Company</th><th>Requested feature</th><th>Requested outcome</th><th>Classification</th><th>Request</th><th>Development</th><th>Deployment</th><th>Target release</th><th>Requested</th><th>Updated</th></tr></thead><tbody>{snapshot.featureRequests.map((request) => <tr key={request.id}><td>{request.companyName}</td><td>{request.extensionName ?? 'Unregistered feature'}</td><td>{request.requestedOutcome}</td><td>{statusLabel(request.classification)}</td><td>{statusLabel(request.requestStatus)}</td><td>{statusLabel(request.developmentStatus)}</td><td>{statusLabel(request.deploymentStatus)}</td><td>{request.targetRelease ?? '-'}</td><td>{new Date(request.requestedAt).toLocaleDateString()}</td><td>{new Date(request.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}</div>

      <div className="feature-category"><div className="section-heading"><h3>Release records</h3></div>{snapshot.releaseRecords.length === 0 ? <p className="state">No release records available.</p> : <div className="table-scroll"><table><thead><tr><th>Version</th><th>Environment</th><th>Released</th></tr></thead><tbody>{snapshot.releaseRecords.map((release) => <tr key={release.id}><td>{release.version}</td><td>{release.environment}</td><td>{new Date(release.releasedAt).toLocaleString()}</td></tr>)}</tbody></table></div>}</div>
    </section>
  )
}

export default PlatformAdminDiagnostics
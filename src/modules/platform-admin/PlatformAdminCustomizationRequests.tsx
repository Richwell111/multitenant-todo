import { useCallback, useEffect, useRef, useState } from 'react'
import type { Account } from '../auth/authService'
import { captureUsage } from '../diagnostics/diagnosticsService'
import { loadCustomizationRequests, type CustomizationRequest } from './platformAdminCustomizationRequestService'

function statusLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function RequestDetails({ request }: { request: CustomizationRequest }) {
  return <dl className="request-details">
    <div><dt>Company</dt><dd>{request.companyName}</dd></div>
    <div><dt>Feature</dt><dd>{request.featureName ?? 'Unregistered feature'}</dd></div>
    <div className="request-detail-wide"><dt>Requested outcome</dt><dd>{request.requestedOutcome}</dd></div>
    <div><dt>Classification</dt><dd>{statusLabel(request.classification)}</dd></div>
    <div><dt>Request status</dt><dd>{statusLabel(request.requestStatus)}</dd></div>
    <div><dt>Development status</dt><dd>{statusLabel(request.developmentStatus)}</dd></div>
    <div><dt>Deployment status</dt><dd>{statusLabel(request.deploymentStatus)}</dd></div>
    <div><dt>Target release</dt><dd>{request.targetRelease ?? '-'}</dd></div>
    <div><dt>Availability</dt><dd><span className={`status-badge status-${request.availability}`}>{statusLabel(request.availability)}</span></dd></div>
    <div><dt>Requested</dt><dd>{new Date(request.requestedAt).toLocaleDateString()}</dd></div>
    <div><dt>Updated</dt><dd>{new Date(request.updatedAt).toLocaleDateString()}</dd></div>
  </dl>
}

function PlatformAdminCustomizationRequests({ account }: { account: Extract<Account, { kind: 'platform-admin' }> }) {
  const [requests, setRequests] = useState<CustomizationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const viewed = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = await loadCustomizationRequests(account)
      setRequests(loaded)
      if (!viewed.current) {
        viewed.current = true
        captureUsage('admin.customization_requests_viewed', { module_key: 'platform-admin', action_name: 'customization_requests_viewed', success: true })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Customization requests could not be loaded. Try again.')
    } finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  return (
    <section className="section-card customization-requests-card" aria-labelledby="customization-requests-heading">
      <div className="section-heading"><div><h2 id="customization-requests-heading">Customization Requests</h2><span className="muted">Read-only request and delivery lifecycle</span></div><span className="section-count">{requests.length} {requests.length === 1 ? 'request' : 'requests'}</span></div>
      {loading && requests.length === 0 && <p className="state" role="status">Loading customization requests...</p>}
      {error && <div className="alert alert-error" role="alert"><p>{error}</p><div className="state-actions"><button className="button-secondary" type="button" onClick={() => void refresh()}>Retry</button></div></div>}
      {!loading && !error && requests.length === 0 && <p className="state empty-state">No customization requests have been recorded yet.</p>}
      {requests.length > 0 && <>
        <div className="desktop-request-table table-scroll"><table><caption className="sr-only">Customization request lifecycle</caption><thead><tr><th>Company</th><th>Feature</th><th className="request-outcome-column">Requested outcome</th><th>Classification</th><th>Request</th><th>Development</th><th>Deployment</th><th>Target release</th><th>Availability</th><th>Requested</th><th>Updated</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td>{request.companyName}</td><td>{request.featureName ?? 'Unregistered feature'}</td><td className="request-outcome-cell">{request.requestedOutcome}</td><td><span className="status-badge status-neutral">{statusLabel(request.classification)}</span></td><td><span className="status-badge status-neutral">{statusLabel(request.requestStatus)}</span></td><td><span className="status-badge status-neutral">{statusLabel(request.developmentStatus)}</span></td><td><span className="status-badge status-neutral">{statusLabel(request.deploymentStatus)}</span></td><td>{request.targetRelease ?? '-'}</td><td><span className={`status-badge status-${request.availability}`}>{statusLabel(request.availability)}</span></td><td>{new Date(request.requestedAt).toLocaleDateString()}</td><td>{new Date(request.updatedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>
        <div className="mobile-request-cards">{requests.map((request) => <article className="request-card" key={request.id}><div className="request-card-heading"><h3>{request.featureName ?? 'Unregistered feature'}</h3><span className={`status-badge status-${request.availability}`}>{statusLabel(request.availability)}</span></div><RequestDetails request={request} /></article>)}</div>
      </>}
    </section>
  )
}

export default PlatformAdminCustomizationRequests
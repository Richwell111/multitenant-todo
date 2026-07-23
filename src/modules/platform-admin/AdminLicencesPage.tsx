import { useCallback, useEffect, useRef, useState } from 'react'

import { captureUsage } from '../diagnostics/diagnosticsService'
import { PageHeader, SectionCard, LoadingState, ErrorState, EmptyState, StatusBadge } from '../../shared/ui'
import { LicenceApiError } from '../licensing/licenceRepository'
import { LicenceValidationError } from '../licensing/licenceService'
import { generateLicence, loadDashboard, type PlatformAdminSnapshot } from './platformAdminService'
import { useAdminOutlet } from './adminContext'
import type { PlatformAdminAccount } from './adminContext'

type AdminLicence = PlatformAdminSnapshot['licences'][number]

const OVERVIEW: ReadonlyArray<{ label: string; key: keyof PlatformAdminSnapshot['counts'] }> = [
  { label: 'Total', key: 'totalLicences' },
  { label: 'Available', key: 'availableLicences' },
  { label: 'Redeemed', key: 'redeemedLicences' },
  { label: 'Expired', key: 'expiredLicences' },
  { label: 'Revoked', key: 'revokedLicences' },
]

function GenerateLicenceForm({ account, onGenerated }: { account: PlatformAdminAccount; onGenerated: () => void }) {
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
    <SectionCard>
      <div className="section-heading"><h2>Generate licence</h2><span className="muted">One-time key display</span></div>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field"><label htmlFor="licence-company-name">Company Name</label><input id="licence-company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />{fieldErrors.companyName && <p className="field-error">{fieldErrors.companyName}</p>}</div>
        <div className="field"><label htmlFor="licence-expiry-date">Expiry Date</label><input id="licence-expiry-date" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />{fieldErrors.expiryDate && <p className="field-error">{fieldErrors.expiryDate}</p>}</div>
        {formError && <p className="alert alert-error" role="alert">{formError}</p>}
        <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Generating...' : 'Generate licence'}</button></div>
      </form>
      {result && <section className="alert licence-result" aria-live="polite"><h3>Licence generated</h3><p>Copy this key now. It cannot be recovered later.</p><code className="licence-key">{result.licenceKey}</code><div className="form-actions"><button type="button" onClick={copyKey}>{copied ? 'Copied' : 'Copy key'}</button><button className="button-secondary" type="button" onClick={() => setResult(null)}>Dismiss</button></div></section>}
    </SectionCard>
  )
}

function AdminLicencesPage() {
  const { account } = useAdminOutlet()
  const [snapshot, setSnapshot] = useState<PlatformAdminSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const viewed = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const loaded = await loadDashboard(account)
      setSnapshot(loaded)
      if (!viewed.current) { viewed.current = true; captureUsage('admin.licences_viewed', { module_key: 'platform-admin', action_name: 'licences_viewed', success: true }) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load licences') }
    finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  const licences: AdminLicence[] = snapshot?.licences ?? []

  return (
    <div className="app-page-shell">
      <PageHeader title="Licences" description="Licence inventory and one-time key generation. Revoked licences are read-only." />
      {loading && !snapshot && <LoadingState>Loading licences...</LoadingState>}
      {error && !snapshot && <ErrorState onRetry={() => void refresh()}>{error}</ErrorState>}
      {snapshot && (
        <>
          <SectionCard>
            <div className="section-heading"><h2>Licence overview</h2><span className="muted">Effective status counts</span></div>
            <div className="summary-grid summary-grid-wide" aria-label="Licence counts">
              {OVERVIEW.map((item) => (
                <div className="summary-card" key={item.key}><span className="summary-label">{item.label}</span><strong className="summary-value">{snapshot.counts[item.key]}</strong></div>
              ))}
            </div>
          </SectionCard>

          <SectionCard labelledBy="licence-list-heading">
            <div className="section-heading"><h2 id="licence-list-heading">Licence list</h2><span className="section-count">{licences.length} total</span></div>
            {licences.length === 0 ? <EmptyState>No licences have been generated yet.</EmptyState> : (
              <>
                <div className="desktop-request-table table-scroll">
                  <table>
                    <thead><tr><th>Company</th><th>Prefix</th><th>Status</th><th>Expires</th><th>Created</th><th>Redeemed</th></tr></thead>
                    <tbody>
                      {licences.map((licence) => (
                        <tr key={licence.id}>
                          <td>{licence.companyName}</td>
                          <td><code>{licence.keyPrefix}</code></td>
                          <td><StatusBadge tone={licence.displayStatus.toLowerCase()}>{licence.displayStatus}</StatusBadge></td>
                          <td>{new Date(licence.expiresAt).toLocaleDateString()}</td>
                          <td>{new Date(licence.createdAt).toLocaleDateString()}</td>
                          <td>{licence.redeemedAt ? new Date(licence.redeemedAt).toLocaleDateString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mobile-request-cards">
                  {licences.map((licence) => (
                    <article className="request-card" key={licence.id}>
                      <div className="request-card-heading"><h3>{licence.companyName}</h3><StatusBadge tone={licence.displayStatus.toLowerCase()}>{licence.displayStatus}</StatusBadge></div>
                      <dl className="request-details">
                        <div><dt>Prefix</dt><dd><code>{licence.keyPrefix}</code></dd></div>
                        <div><dt>Expires</dt><dd>{new Date(licence.expiresAt).toLocaleDateString()}</dd></div>
                        <div><dt>Created</dt><dd>{new Date(licence.createdAt).toLocaleDateString()}</dd></div>
                        <div><dt>Redeemed</dt><dd>{licence.redeemedAt ? new Date(licence.redeemedAt).toLocaleDateString() : '-'}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          <GenerateLicenceForm account={account} onGenerated={() => void refresh()} />
        </>
      )}
    </div>
  )
}

export default AdminLicencesPage

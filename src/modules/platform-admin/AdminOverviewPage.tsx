import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { captureUsage } from '../diagnostics/diagnosticsService'
import { PageHeader, SectionCard, LoadingState, ErrorState } from '../../shared/ui'
import { loadDashboard, type PlatformAdminSnapshot } from './platformAdminService'
import { useAdminOutlet } from './adminContext'

const CARDS: ReadonlyArray<{ label: string; key: keyof PlatformAdminSnapshot['counts'] }> = [
  { label: 'Total Companies', key: 'totalCompanies' },
  { label: 'Active Companies', key: 'activeCompanies' },
  { label: 'Suspended Companies', key: 'suspendedCompanies' },
  { label: 'Total Licences', key: 'totalLicences' },
  { label: 'Available Licences', key: 'availableLicences' },
  { label: 'Redeemed Licences', key: 'redeemedLicences' },
  { label: 'Expired Licences', key: 'expiredLicences' },
  { label: 'Revoked Licences', key: 'revokedLicences' },
]

function AdminOverviewPage() {
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
      if (!viewed.current) { viewed.current = true; captureUsage('admin.overview_viewed', { module_key: 'platform-admin', action_name: 'overview_viewed', success: true }) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load Platform Admin data') }
    finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  return (
    <div className="app-page-shell">
      <PageHeader title="Overview" description="Platform snapshot across all Companies and licences." />
      {loading && !snapshot && <LoadingState>Loading Platform Admin data...</LoadingState>}
      {error && !snapshot && <ErrorState onRetry={() => void refresh()}>{error}</ErrorState>}
      {snapshot && (
        <>
          <div className="summary-grid summary-grid-wide" aria-label="Platform counts">
            {CARDS.map((card) => (
              <div className="summary-card" key={card.key}>
                <span className="summary-label">{card.label}</span>
                <strong className="summary-value">{snapshot.counts[card.key]}</strong>
              </div>
            ))}
          </div>
          <SectionCard>
            <div className="section-heading"><h2>Quick links</h2><span className="muted">Jump to management areas</span></div>
            <div className="admin-quick-links">
              <Link className="admin-quick-link" to="/admin/companies">Companies</Link>
              <Link className="admin-quick-link" to="/admin/licences">Licences</Link>
              <Link className="admin-quick-link" to="/admin/features">Features</Link>
              <Link className="admin-quick-link" to="/admin/diagnostics">Diagnostics</Link>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}

export default AdminOverviewPage

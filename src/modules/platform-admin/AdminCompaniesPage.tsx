import { useCallback, useEffect, useRef, useState } from 'react'

import { captureUsage } from '../diagnostics/diagnosticsService'
import { PageHeader, SectionCard, LoadingState, ErrorState, EmptyState, StatusBadge } from '../../shared/ui'
import { changeCompanyStatus, loadDashboard, type PlatformAdminSnapshot } from './platformAdminService'
import { useAdminOutlet } from './adminContext'

type AdminCompany = PlatformAdminSnapshot['companies'][number]

function AdminCompaniesPage() {
  const { account } = useAdminOutlet()
  const [companies, setCompanies] = useState<AdminCompany[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingId, setPendingId] = useState('')
  const viewed = useRef(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const loaded = await loadDashboard(account)
      setCompanies(loaded.companies)
      if (!viewed.current) { viewed.current = true; captureUsage('admin.companies_viewed', { module_key: 'platform-admin', action_name: 'companies_viewed', success: true }) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load Companies') }
    finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  async function toggle(company: AdminCompany) {
    if (pendingId) return
    const next = company.status === 'active' ? 'suspended' : 'active'
    if (!window.confirm(`Are you sure you want to ${next === 'suspended' ? 'suspend' : 'reactivate'} ${company.name}?`)) return
    setPendingId(company.id); setActionError(''); setSuccess('')
    try {
      await changeCompanyStatus(account, company, next)
      setSuccess(`Company ${next === 'suspended' ? 'suspended' : 'reactivated'}.`)
      await refresh()
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Unable to update Company status') }
    finally { setPendingId('') }
  }

  const actionLabel = (company: AdminCompany) => (company.status === 'active' ? 'Suspend' : 'Reactivate')
  const actionClass = (company: AdminCompany) => (company.status === 'active' ? 'button-danger button-inline' : 'button-inline')

  return (
    <div className="app-page-shell">
      <PageHeader title="Companies" description="Suspend or reactivate registered Companies. Names, emails, slugs, and task data are never editable here." />
      {actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      {success && <p className="alert alert-success" role="status">{success}</p>}
      <SectionCard labelledBy="companies-heading">
        <div className="section-heading"><h2 id="companies-heading">Company management</h2><span className="section-count">{companies ? `${companies.length} registered` : ''}</span></div>
        {loading && !companies && <LoadingState>Loading Companies...</LoadingState>}
        {error && !companies && <ErrorState onRetry={() => void refresh()}>{error}</ErrorState>}
        {companies && companies.length === 0 && <EmptyState>No Companies have registered yet.</EmptyState>}
        {companies && companies.length > 0 && (
          <>
            <div className="desktop-request-table table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Workspace slug</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id}>
                      <td>{company.name}</td>
                      <td>{company.email}</td>
                      <td><code>{company.slug}</code></td>
                      <td><StatusBadge tone={company.status}>{company.status === 'active' ? 'Active' : 'Suspended'}</StatusBadge></td>
                      <td>{new Date(company.createdAt).toLocaleDateString()}</td>
                      <td><button className={actionClass(company)} type="button" disabled={pendingId === company.id} onClick={() => void toggle(company)}>{pendingId === company.id ? 'Working...' : actionLabel(company)}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-request-cards">
              {companies.map((company) => (
                <article className="request-card" key={company.id}>
                  <div className="request-card-heading"><h3>{company.name}</h3><StatusBadge tone={company.status}>{company.status === 'active' ? 'Active' : 'Suspended'}</StatusBadge></div>
                  <dl className="request-details">
                    <div className="request-detail-wide"><dt>Email</dt><dd>{company.email}</dd></div>
                    <div><dt>Workspace slug</dt><dd><code>{company.slug}</code></dd></div>
                    <div><dt>Created</dt><dd>{new Date(company.createdAt).toLocaleDateString()}</dd></div>
                  </dl>
                  <div className="task-actions"><button className={actionClass(company)} type="button" disabled={pendingId === company.id} onClick={() => void toggle(company)}>{pendingId === company.id ? 'Working...' : actionLabel(company)}</button></div>
                </article>
              ))}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}

export default AdminCompaniesPage

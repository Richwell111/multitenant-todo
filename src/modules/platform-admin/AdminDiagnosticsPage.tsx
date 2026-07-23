import { PageHeader } from '../../shared/ui'
import PlatformAdminDiagnostics from './PlatformAdminDiagnostics'
import { useAdminOutlet } from './adminContext'

// Auth is enforced by the shared AdminLayout; this page only renders content.
function AdminDiagnosticsPage() {
  const { account } = useAdminOutlet()
  return (
    <div className="app-page-shell">
      <PageHeader title="Diagnostics & Monitoring" description="Safe release, lifecycle, and provider configuration information." />
      <PlatformAdminDiagnostics account={account} />
    </div>
  )
}

export default AdminDiagnosticsPage

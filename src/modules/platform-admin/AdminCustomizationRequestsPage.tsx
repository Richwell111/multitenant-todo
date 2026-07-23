import { PageHeader } from '../../shared/ui'
import PlatformAdminCustomizationRequests from './PlatformAdminCustomizationRequests'
import { useAdminOutlet } from './adminContext'

// Auth is enforced by the shared AdminLayout; this page only renders content.
function AdminCustomizationRequestsPage() {
  const { account } = useAdminOutlet()
  return (
    <div className="app-page-shell">
      <PageHeader title="Customization Requests" description="Read-only request and delivery lifecycle across Companies." />
      <PlatformAdminCustomizationRequests account={account} />
    </div>
  )
}

export default AdminCustomizationRequestsPage

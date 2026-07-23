import { PageHeader, SectionCard } from '../../shared/ui'
import { CORE_FEATURE_REGISTRY } from './coreFeatureRegistry'
import PlatformAdminExtensions from './PlatformAdminExtensions'
import { useAdminOutlet } from './adminContext'

// Section A: features every active Company receives automatically. Read-only, sourced
// from the static Core Feature registry — no enable/disable and no per-Company assignment.
function StandardFeatures() {
  return (
    <SectionCard labelledBy="standard-features-heading">
      <div className="section-heading"><div><h2 id="standard-features-heading">Standard Features</h2><span className="muted">Every active Company receives these automatically</span></div></div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Standard features included for all active Companies</caption>
          <thead><tr><th>Feature</th><th>Description</th><th>Category</th><th>Availability</th><th>Status</th><th>Companies covered</th></tr></thead>
          <tbody>
            {CORE_FEATURE_REGISTRY.map((feature) => (
              <tr key={feature.key}>
                <td>{feature.name}</td>
                <td className="request-outcome-cell">{feature.description}</td>
                <td>Core</td>
                <td>All active Companies</td>
                <td><span className="status-badge status-active">Standard</span></td>
                <td>All active Companies</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

function AdminFeaturesPage() {
  const { account } = useAdminOutlet()
  return (
    <div className="app-page-shell">
      <PageHeader title="Features" description="Standard features included for every Company, and the optional customizations and extensions assigned to specific Companies." />
      <StandardFeatures />
      <PlatformAdminExtensions account={account} />
    </div>
  )
}

export default AdminFeaturesPage

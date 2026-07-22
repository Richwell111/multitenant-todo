import { Link, useLocation } from 'react-router-dom'

const links = [
  { label: 'Overview', to: '/admin#overview', path: '/admin', hash: '#overview' },
  { label: 'Companies', to: '/admin#companies', path: '/admin', hash: '#companies' },
  { label: 'Licences', to: '/admin#licences', path: '/admin', hash: '#licences' },
  { label: 'Features', to: '/admin#features', path: '/admin', hash: '#features' },
  { label: 'Customization Requests', to: '/admin/customization-requests', path: '/admin/customization-requests' },
  { label: 'Diagnostics', to: '/admin/diagnostics', path: '/admin/diagnostics' },
] as const

function AdminNavigation() {
  const location = useLocation()
  const activeHash = location.hash || '#overview'
  return <nav className="admin-nav" aria-label="Platform Admin"><span className="admin-nav-label">Platform Admin</span>{links.map((link) => { const active = location.pathname === link.path && (link.path !== '/admin' || activeHash === link.hash); return <Link key={link.label} to={link.to} className={active ? 'is-active' : undefined} aria-current={active ? 'page' : undefined}>{link.label}</Link> })}</nav>
}

export default AdminNavigation
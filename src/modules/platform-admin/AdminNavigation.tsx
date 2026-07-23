import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

type AdminLink = { label: string; to: string; end?: boolean; icon: ReactNode }

// Simple inline stroke icons keep the shell self-contained (no icon dependency).
function Icon({ paths }: { paths: ReactNode }) {
  return <svg className="admin-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
}

const links: readonly AdminLink[] = [
  { label: 'Overview', to: '/admin', end: true, icon: <Icon paths={<><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>} /> },
  { label: 'Companies', to: '/admin/companies', icon: <Icon paths={<><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></>} /> },
  { label: 'Licences', to: '/admin/licences', icon: <Icon paths={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h5M7 13h3" /><circle cx="17" cy="11" r="2" /></>} /> },
  { label: 'Features', to: '/admin/features', icon: <Icon paths={<><path d="M12 2 4 6v6c0 5 3.4 8 8 10 4.6-2 8-5 8-10V6z" /><path d="m9 12 2 2 4-4" /></>} /> },
  { label: 'Customization Requests', to: '/admin/customization-requests', icon: <Icon paths={<><path d="M4 4h16v12H8l-4 4z" /><path d="M8 9h8M8 12h5" /></>} /> },
  { label: 'Diagnostics', to: '/admin/diagnostics', icon: <Icon paths={<><path d="M3 12h4l2 6 4-14 2 8h6" /></>} /> },
]

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="admin-nav" aria-label="Platform Admin">
      {links.map((link) => (
        <NavLink
          key={link.label}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? 'admin-nav-item is-active' : 'admin-nav-item')}
        >
          {link.icon}
          <span>{link.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default AdminNavigation

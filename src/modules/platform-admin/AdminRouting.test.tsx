import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Shared, mutable auth state so each test can pick admin / company / unauthenticated.
const auth = vi.hoisted(() => ({ value: { status: 'ready' as string, account: null as unknown, signOut: vi.fn() } }))
vi.mock('../auth/authContext', () => ({ useAuth: () => auth.value }))

vi.mock('./platformAdminService', () => ({
  loadDashboard: vi.fn().mockResolvedValue({ companies: [], licences: [], counts: { totalCompanies: 0, activeCompanies: 0, suspendedCompanies: 0, totalLicences: 0, availableLicences: 0, redeemedLicences: 0, expiredLicences: 0, revokedLicences: 0 } }),
  changeCompanyStatus: vi.fn(),
  generateLicence: vi.fn(),
}))
vi.mock('./platformAdminExtensionService', async () => ({
  ...(await vi.importActual<typeof import('./platformAdminExtensionService')>('./platformAdminExtensionService')),
  loadPlatformAdminExtensions: vi.fn().mockResolvedValue({ extensions: [], assignments: [], companies: [] }),
}))
vi.mock('./platformAdminCustomizationRequestService', () => ({ loadCustomizationRequests: vi.fn().mockResolvedValue([]) }))
vi.mock('./platformAdminDiagnosticsService', async () => ({
  ...(await vi.importActual<typeof import('./platformAdminDiagnosticsService')>('./platformAdminDiagnosticsService')),
  loadPlatformAdminDiagnostics: vi.fn().mockResolvedValue({ appVersion: '1', environment: 'test', sentryConfigured: false, posthogConfigured: false, assignmentEvents: [], featureRequests: [], releaseRecords: [], enabledAssignmentsByFeature: [] }),
}))

import AdminLayout from './AdminLayout'
import AdminOverviewPage from './AdminOverviewPage'
import AdminCompaniesPage from './AdminCompaniesPage'
import AdminLicencesPage from './AdminLicencesPage'
import AdminFeaturesPage from './AdminFeaturesPage'
import AdminCustomizationRequestsPage from './AdminCustomizationRequestsPage'
import AdminDiagnosticsPage from './AdminDiagnosticsPage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="companies" element={<AdminCompaniesPage />} />
          <Route path="licences" element={<AdminLicencesPage />} />
          <Route path="features" element={<AdminFeaturesPage />} />
          <Route path="customization-requests" element={<AdminCustomizationRequestsPage />} />
          <Route path="diagnostics" element={<AdminDiagnosticsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.value = { status: 'ready', account: { kind: 'platform-admin' }, signOut: vi.fn() }
})

describe('Admin routing and layout', () => {
  it.each([
    ['/admin', 'Overview'],
    ['/admin/companies', 'Companies'],
    ['/admin/licences', 'Licences'],
    ['/admin/features', 'Features'],
    ['/admin/customization-requests', 'Customization Requests'],
    ['/admin/diagnostics', 'Diagnostics & Monitoring'],
  ])('renders the correct page for %s (direct navigation / refresh)', async (path, title) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('navigates between pages via the sidebar and marks the active item', async () => {
    renderAt('/admin')
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Platform Admin' })
    fireEvent.click(within(nav).getByRole('link', { name: 'Companies' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Companies' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Companies' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the Standard Features table with no assignment controls', async () => {
    renderAt('/admin/features')
    const caption = await screen.findByText('Standard features included for all active Companies')
    const table = caption.closest('table') as HTMLTableElement
    expect(table.querySelectorAll('button')).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Customizations & Extensions' })).toBeInTheDocument()
  })

  it('blocks Company accounts from every Admin route', async () => {
    auth.value = { status: 'ready', account: { kind: 'company', status: 'active', workspaceSlug: 'alpha', name: 'Alpha' }, signOut: vi.fn() }
    renderAt('/admin/companies')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Company management' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('shows the Admin login for unauthenticated access to a nested route', async () => {
    auth.value = { status: 'ready', account: null, signOut: vi.fn() }
    renderAt('/admin/diagnostics')
    expect(await screen.findByRole('heading', { name: 'Platform Admin Sign In' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Diagnostics & Monitoring' })).not.toBeInTheDocument()
  })

  it('shows a session-check state while auth is loading', () => {
    auth.value = { status: 'loading', account: null, signOut: vi.fn() }
    renderAt('/admin')
    expect(screen.getByText('Checking your session...')).toBeInTheDocument()
  })
})

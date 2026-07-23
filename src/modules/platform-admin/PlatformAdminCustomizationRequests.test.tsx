import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlatformAdminCustomizationRequests from './PlatformAdminCustomizationRequests'

const service = vi.hoisted(() => ({ loadCustomizationRequests: vi.fn() }))
vi.mock('./platformAdminCustomizationRequestService', () => service)

const account = { kind: 'platform-admin' } as const
const request = { id: 'request-1', requestingCompanyId: 'company-1', extensionId: 'extension-1', requestedOutcome: 'Need a safe feature', classification: 'private_customization', requestStatus: 'under_review', developmentStatus: 'specification', deploymentStatus: 'not_deployed', targetRelease: null, requestedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', companyName: 'Alpha', featureName: 'Private Proof', availability: 'available_not_enabled' as const }

beforeEach(() => { vi.clearAllMocks(); service.loadCustomizationRequests.mockResolvedValue([]) })

// The component renders the desktop table and the mobile cards at the same time
// (CSS hides one per breakpoint), so populated-state assertions must be scoped to
// a single layout container. jsdom applies no media queries, so both are present.
function desktopTable(): HTMLElement { return document.querySelector('.desktop-request-table') as HTMLElement }
function mobileCards(): HTMLElement { return document.querySelector('.mobile-request-cards') as HTMLElement }

describe('PlatformAdminCustomizationRequests', () => {
  it('shows loading, empty, populated lifecycle, and retry states', async () => {
    service.loadCustomizationRequests.mockResolvedValueOnce([])
    const view = render(<PlatformAdminCustomizationRequests account={account} />)
    await waitFor(() => expect(service.loadCustomizationRequests).toHaveBeenCalled())
    expect(screen.getByText('No customization requests have been recorded yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    view.unmount()

    service.loadCustomizationRequests.mockRejectedValueOnce(new Error('safe failure'))
    render(<PlatformAdminCustomizationRequests account={account} />)
    expect(await screen.findByText('safe failure')).toBeInTheDocument()
    service.loadCustomizationRequests.mockResolvedValueOnce([request])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(desktopTable()).toBeInTheDocument())
    const table = within(desktopTable())
    expect(table.getByText('Need a safe feature')).toBeInTheDocument()
    expect(table.getByText('Private Customization')).toBeInTheDocument()
    expect(table.getByText('Available Not Enabled')).toBeInTheDocument()
    expect(screen.queryByText(/task/i)).not.toBeInTheDocument()
  })

  it('renders the mobile card field labels without task data', async () => {
    service.loadCustomizationRequests.mockResolvedValueOnce([request])
    render(<PlatformAdminCustomizationRequests account={account} />)
    await waitFor(() => expect(mobileCards()).toBeInTheDocument())
    const cards = within(mobileCards())
    expect(cards.getByText('Requested outcome')).toBeInTheDocument()
    expect(cards.getByText('Availability')).toBeInTheDocument()
    expect(screen.queryByText(/task/i)).not.toBeInTheDocument()
  })
})

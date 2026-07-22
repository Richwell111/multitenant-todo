import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlatformAdminCustomizationRequests from './PlatformAdminCustomizationRequests'

const service = vi.hoisted(() => ({ loadCustomizationRequests: vi.fn() }))
vi.mock('./platformAdminCustomizationRequestService', () => service)

const account = { kind: 'platform-admin' } as const
const request = { id: 'request-1', requestingCompanyId: 'company-1', extensionId: 'extension-1', requestedOutcome: 'Need a safe feature', classification: 'private_customization', requestStatus: 'under_review', developmentStatus: 'specification', deploymentStatus: 'not_deployed', targetRelease: null, requestedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', companyName: 'Alpha', featureName: 'Private Proof', availability: 'available_not_enabled' as const }

beforeEach(() => { vi.clearAllMocks(); service.loadCustomizationRequests.mockResolvedValue([]) })

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
    expect(await screen.findByText('Need a safe feature')).toBeInTheDocument()
    expect(screen.getByText('Private Customization')).toBeInTheDocument()
    expect(screen.getByText('Available Not Enabled')).toBeInTheDocument()
    expect(screen.queryByText(/task/i)).not.toBeInTheDocument()
  })

  it('renders the mobile card field labels without task data', async () => {
    service.loadCustomizationRequests.mockResolvedValueOnce([request])
    render(<PlatformAdminCustomizationRequests account={account} />)
    expect(await screen.findByText('Requested outcome')).toBeInTheDocument()
    expect(screen.getByText('Availability')).toBeInTheDocument()
    expect(screen.queryByText(/task/i)).not.toBeInTheDocument()
  })
})
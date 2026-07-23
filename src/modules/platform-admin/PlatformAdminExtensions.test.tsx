import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlatformAdminExtensions from './PlatformAdminExtensions'

const service = vi.hoisted(() => ({ loadPlatformAdminExtensions: vi.fn(), setPlatformAdminPrivateAssignment: vi.fn() }))
vi.mock('./platformAdminExtensionService', async () => ({
  ...(await vi.importActual<typeof import('./platformAdminExtensionService')>('./platformAdminExtensionService')),
  ...service,
}))

const account = { kind: 'platform-admin' } as const
const company = { id: '10000000-0000-0000-0000-000000000001', name: 'Alpha', email: 'alpha@example.test', slug: 'alpha', status: 'active' as const, createdAt: '2026-01-01T00:00:00Z' }
const snapshot = { extensions: [{ id: '11111111-1111-4111-8111-111111111111', key: 'task-notes-summary', name: 'Task Notes Summary', description: null, availabilityType: 'shared' as const, isActive: true }, { id: '22222222-2222-4222-8222-222222222222', key: 'priority-labels-demo', name: 'Priority Labels Demo', description: null, availabilityType: 'private' as const, isActive: true }], assignments: [], companies: [company] }

beforeEach(() => { vi.clearAllMocks(); service.loadPlatformAdminExtensions.mockResolvedValue(snapshot); service.setPlatformAdminPrivateAssignment.mockResolvedValue({ companyId: company.id, extensionId: snapshot.extensions[0].id, enabled: true, createdAt: '2026-01-01T00:00:00Z' }); vi.stubGlobal('confirm', vi.fn(() => true)) })

describe('PlatformAdminExtensions', () => {
  it('renders customizations & extensions with user-facing feature types and Company Access', async () => {
    render(<PlatformAdminExtensions account={account} />)
    expect(await screen.findByText('Shared Extension')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Customizations & Extensions/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Company Access' })).toBeInTheDocument()
    expect(screen.getByText('Private Customization')).toBeInTheDocument()
    expect(screen.getByText('Available — Not Enabled')).toBeInTheDocument()
    expect(screen.queryByText(/task title|task content/i)).not.toBeInTheDocument()
  })

  it('enables a private assignment after confirmation', async () => {
    render(<PlatformAdminExtensions account={account} />)
    expect((await screen.findAllByText('Priority Labels Demo')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }))
    await waitFor(() => expect(service.setPlatformAdminPrivateAssignment).toHaveBeenCalledWith(account, company.id, snapshot.extensions[1].id, true, null))
  })
})

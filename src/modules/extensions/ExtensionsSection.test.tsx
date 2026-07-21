import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExtensionsSection from './ExtensionsSection'

const service = vi.hoisted(() => ({ listCompanyExtensions: vi.fn(), loadTaskNotesSummary: vi.fn() }))
vi.mock('./extensionService', async () => ({ ...(await vi.importActual<typeof import('./extensionService')>('./extensionService')), ...service }))

const account = { kind: 'company', name: 'Alpha', workspaceSlug: 'alpha', status: 'active' } as const
const shared = { id: '1', key: 'task-notes-summary', name: 'Task Notes Summary', description: 'Summary', availabilityType: 'shared', isActive: true } as const
const privateExtension = { id: '2', key: 'priority-labels-demo', name: 'Priority Labels Demo', description: 'Private', availabilityType: 'private', isActive: true } as const

beforeEach(() => { vi.clearAllMocks(); service.listCompanyExtensions.mockResolvedValue([shared]); service.loadTaskNotesSummary.mockResolvedValue({ totalWithDescriptions: 1, totalWithoutDescriptions: 2, completedWithDescriptions: 1 }) })

describe('ExtensionsSection', () => {
  it('shows the shared summary and private empty state', async () => {
    render(<ExtensionsSection account={account} />)
    expect(await screen.findByText('Task Notes Summary')).toBeInTheDocument()
    expect(screen.getByText('Tasks with descriptions: 1')).toBeInTheDocument()
    expect(screen.getByText('No private extensions are enabled for this Company.')).toBeInTheDocument()
  })

  it('shows the private panel only when assigned and supports retry', async () => {
    service.listCompanyExtensions.mockRejectedValueOnce(new Error('failure')).mockResolvedValueOnce([shared, privateExtension])
    render(<ExtensionsSection account={account} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Extensions could not be loaded. Try again.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Private extension proof enabled for this Company.')).toBeInTheDocument()
    await waitFor(() => expect(service.listCompanyExtensions).toHaveBeenCalledTimes(2))
  })
})

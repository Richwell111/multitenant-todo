import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlatformAdminDiagnostics from './PlatformAdminDiagnostics'

const service = vi.hoisted(() => ({ loadPlatformAdminDiagnostics: vi.fn() }))
vi.mock('./platformAdminDiagnosticsService', async () => ({
  ...(await vi.importActual<typeof import('./platformAdminDiagnosticsService')>('./platformAdminDiagnosticsService')),
  ...service,
}))

const account = { kind: 'platform-admin' } as const
const snapshot = {
  appVersion: '2026.08',
  environment: 'test',
  sentryConfigured: true,
  posthogConfigured: false,
  assignmentEvents: [],
  featureRequests: [],
  releaseRecords: [],
  enabledAssignmentsByFeature: [{ extensionId: 'ext', extensionName: 'Private Feature', enabledCompanyCount: 1 }],
}

beforeEach(() => { vi.clearAllMocks(); service.loadPlatformAdminDiagnostics.mockResolvedValue(snapshot) })

describe('PlatformAdminDiagnostics', () => {
  it('renders safe provider, lifecycle, request, and release states', async () => {
    render(<PlatformAdminDiagnostics account={account} />)
    await waitFor(() => expect(service.loadPlatformAdminDiagnostics).toHaveBeenCalled())
    expect(await screen.findByText('Safe platform monitoring information')).toBeInTheDocument()
    expect(screen.getByText('Configured')).toBeInTheDocument()
    expect(screen.getByText('Not configured')).toBeInTheDocument()
    expect(screen.getByText('No extension lifecycle events recorded.')).toBeInTheDocument()
    expect(screen.getByText('No customization requests recorded.')).toBeInTheDocument()
    expect(screen.getByText('No release records available.')).toBeInTheDocument()
    expect(screen.queryByText(/task/i)).not.toBeInTheDocument()
  })

  it('shows retry when the initial load fails', async () => {
    service.loadPlatformAdminDiagnostics.mockRejectedValueOnce(new Error('safe failure'))
    render(<PlatformAdminDiagnostics account={account} />)
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument()
    await waitFor(() => expect(service.loadPlatformAdminDiagnostics).toHaveBeenCalledTimes(1))
  })
})
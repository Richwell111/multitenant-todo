import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({ listCustomizationRequests: vi.fn() }))
const companies = vi.hoisted(() => ({ listCompanies: vi.fn() }))
const extensions = vi.hoisted(() => ({ listExtensions: vi.fn(), listCompanyExtensionAssignments: vi.fn() }))
vi.mock('./platformAdminCustomizationRequestRepository', () => repository)
vi.mock('./platformAdminRepository', () => companies)
vi.mock('./platformAdminExtensionRepository', () => extensions)

import { loadCustomizationRequests } from './platformAdminCustomizationRequestService'

const admin = { kind: 'platform-admin' } as const
const company = { id: '10000000-0000-0000-0000-000000000001', name: 'Alpha', email: 'alpha@example.test', slug: 'alpha', status: 'active' as const, createdAt: '2026-01-01T00:00:00Z' }
const privateExtension = { id: '20000000-0000-0000-0000-000000000001', key: 'private-proof', name: 'Private Proof', description: null, availabilityType: 'private' as const, isActive: true }

beforeEach(() => {
  vi.clearAllMocks()
  repository.listCustomizationRequests.mockResolvedValue([{ id: 'request-1', requestingCompanyId: company.id, extensionId: privateExtension.id, requestedOutcome: '  Safe outcome  ', classification: 'private_customization', requestStatus: 'approved', developmentStatus: 'in_development', deploymentStatus: 'not_deployed', targetRelease: '2026.08', requestedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }])
  companies.listCompanies.mockResolvedValue([company])
  extensions.listExtensions.mockResolvedValue([privateExtension])
  extensions.listCompanyExtensionAssignments.mockResolvedValue([])
})

describe('Platform Admin customization request service', () => {
  it('derives private availability without duplicating it in feature_requests', async () => {
    const result = await loadCustomizationRequests(admin)
    expect(result[0]).toMatchObject({ requestedOutcome: 'Safe outcome', availability: 'available_not_enabled' })
    extensions.listCompanyExtensionAssignments.mockResolvedValue([{ companyId: company.id, extensionId: privateExtension.id, enabled: true, createdAt: '2026-01-01T00:00:00Z' }])
    await expect(loadCustomizationRequests(admin)).resolves.toMatchObject([{ availability: 'enabled' }])
  })

  it('rejects unknown lifecycle enums safely and blocks Companies', async () => {
    await expect(loadCustomizationRequests({ kind: 'company', id: company.id } as never)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    repository.listCustomizationRequests.mockResolvedValue([{ id: 'request-2', requestingCompanyId: null, extensionId: null, requestedOutcome: 'Outcome', classification: 'unknown', requestStatus: 'requested', developmentStatus: 'not_started', deploymentStatus: 'not_deployed', targetRelease: null, requestedAt: '2026-01-01', updatedAt: '2026-01-01' }])
    await expect(loadCustomizationRequests(admin)).rejects.toMatchObject({ code: 'LOAD_FAILED' })
  })
})
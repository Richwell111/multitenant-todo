import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  listExtensions: vi.fn(),
  listCompanyExtensionAssignments: vi.fn(),
  setPrivateExtensionAssignment: vi.fn(),
}))
const companies = vi.hoisted(() => ({ listCompanies: vi.fn() }))

vi.mock('./platformAdminExtensionRepository', () => repository)
vi.mock('./platformAdminRepository', async () => ({
  ...(await vi.importActual<typeof import('./platformAdminRepository')>('./platformAdminRepository')),
  ...companies,
}))

import { PRIVATE_EXTENSION_ID, loadPlatformAdminExtensions, setPlatformAdminPrivateAssignment } from './platformAdminExtensionService'

const admin = { kind: 'platform-admin' } as const
const company = { id: '10000000-0000-0000-0000-000000000001', name: 'Alpha', email: 'alpha@example.test', slug: 'alpha', status: 'active' as const, createdAt: '2026-01-01T00:00:00Z' }

beforeEach(() => vi.clearAllMocks())

describe('Platform Admin extension service', () => {
  it('loads registry, assignments, and safe Company display fields', async () => {
    repository.listExtensions.mockResolvedValue([]); repository.listCompanyExtensionAssignments.mockResolvedValue([]); companies.listCompanies.mockResolvedValue([company])
    await expect(loadPlatformAdminExtensions(admin)).resolves.toMatchObject({ extensions: [], assignments: [], companies: [company] })
  })

  it('only permits the fixed private extension and upserts enabled state', async () => {
    companies.listCompanies.mockResolvedValue([company]); repository.setPrivateExtensionAssignment.mockResolvedValue({ companyId: company.id, extensionId: PRIVATE_EXTENSION_ID, enabled: true, createdAt: '2026-01-01T00:00:00Z' })
    await setPlatformAdminPrivateAssignment(admin, company.id, PRIVATE_EXTENSION_ID, true)
    expect(repository.setPrivateExtensionAssignment).toHaveBeenCalledWith(company.id, PRIVATE_EXTENSION_ID, true)
    await expect(setPlatformAdminPrivateAssignment(admin, company.id, '11111111-1111-4111-8111-111111111111', true)).rejects.toMatchObject({ code: 'INVALID_ASSIGNMENT' })
  })
})

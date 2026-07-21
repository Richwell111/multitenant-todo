import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  listLicences: vi.fn(),
  updateCompanyStatus: vi.fn(),
}))

vi.mock('./platformAdminRepository', () => repository)
vi.mock('../licensing/licenceService', () => ({ submitLicence: vi.fn() }))

import { changeCompanyStatus, loadDashboard } from './platformAdminService'

const admin = { kind: 'platform-admin' } as const
const company = { id: 'c1', name: 'Alpha', email: 'alpha@example.test', slug: 'alpha', status: 'active' as const, createdAt: '2026-01-01T00:00:00Z' }

beforeEach(() => vi.clearAllMocks())

describe('Platform Admin service', () => {
  it('derives counts and expired display status without mutating rows', async () => {
    repository.listCompanies.mockResolvedValue([company])
    repository.listLicences.mockResolvedValue([
      { id: 'l1', companyName: 'Alpha', keyPrefix: 'TDO-AAAA', status: 'available', expiresAt: '2020-01-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', redeemedAt: null },
      { id: 'l2', companyName: 'Beta', keyPrefix: 'TDO-BBBB', status: 'revoked', expiresAt: '2030-01-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', redeemedAt: null },
    ])
    const result = await loadDashboard(admin, new Date('2026-01-01T00:00:00Z'))
    expect(result.counts).toMatchObject({ totalCompanies: 1, activeCompanies: 1, totalLicences: 2, expiredLicences: 1, revokedLicences: 1 })
    expect(result.licences[0].displayStatus).toBe('expired')
    expect(repository.listLicences.mock.calls).toHaveLength(1)
  })

  it('rejects non-admins and invalid or duplicate transitions', async () => {
    await expect(loadDashboard(null)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(changeCompanyStatus(admin, company, 'pending')).rejects.toMatchObject({ code: 'INVALID_STATUS' })
    await expect(changeCompanyStatus(admin, company, 'active')).rejects.toMatchObject({ code: 'STATUS_UNCHANGED' })
    expect(repository.updateCompanyStatus).not.toHaveBeenCalled()
  })

  it('updates only an approved status transition', async () => {
    repository.updateCompanyStatus.mockResolvedValue({ ...company, status: 'suspended' })
    await changeCompanyStatus(admin, company, 'suspended')
    expect(repository.updateCompanyStatus).toHaveBeenCalledWith('c1', 'suspended')
  })
})

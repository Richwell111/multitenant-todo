import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  listVisibleExtensions: vi.fn(),
  loadTaskNotesSummary: vi.fn(),
}))

vi.mock('./extensionRepository', () => repository)

import { ExtensionServiceError, listCompanyExtensions, loadTaskNotesSummary } from './extensionService'

const company = { kind: 'company', name: 'Alpha', workspaceSlug: 'alpha', status: 'active' } as const

beforeEach(() => vi.clearAllMocks())

describe('extension service', () => {
  it('maps only supported active extensions', async () => {
    repository.listVisibleExtensions.mockResolvedValue([
      { id: '1', key: 'task-notes-summary', name: 'Task Notes Summary', description: null, availabilityType: 'shared', isActive: true },
      { id: '2', key: 'unknown', name: 'Unknown', description: null, availabilityType: 'shared', isActive: true },
      { id: '3', key: 'priority-labels-demo', name: 'Priority Labels Demo', description: null, availabilityType: 'private', isActive: false },
    ])
    const result = await listCompanyExtensions(company)
    expect(result.map((extension) => extension.key)).toEqual(['task-notes-summary'])
  })

  it('rejects suspended Companies before querying', async () => {
    await expect(listCompanyExtensions({ ...company, status: 'suspended' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(repository.listVisibleExtensions).not.toHaveBeenCalled()
  })

  it('loads the Company-scoped summary and maps failures safely', async () => {
    repository.loadTaskNotesSummary.mockResolvedValue({ totalWithDescriptions: 1, totalWithoutDescriptions: 2, completedWithDescriptions: 1 })
    await expect(loadTaskNotesSummary(company)).resolves.toEqual({ totalWithDescriptions: 1, totalWithoutDescriptions: 2, completedWithDescriptions: 1 })
    repository.loadTaskNotesSummary.mockRejectedValue(new Error('raw database detail'))
    await expect(loadTaskNotesSummary(company)).rejects.toMatchObject({ code: 'LOAD_FAILED', message: 'Task Notes Summary could not be loaded. Try again.' } satisfies Partial<ExtensionServiceError>)
  })
})

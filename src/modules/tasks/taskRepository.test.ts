import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  auth: { getSession: vi.fn() },
  from: vi.fn(),
}))
vi.mock('../../infrastructure/supabase/client', () => ({ getSupabaseClient: () => client }))

import { createTask, deleteTask, listCurrentCompanyTasks, updateTask } from './taskRepository'

function builder(result: Record<string, unknown>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'insert', 'update', 'delete']) chain[method] = vi.fn(() => chain)
  chain.order = vi.fn(async () => result)
  chain.single = vi.fn(async () => result)
  chain.maybeSingle = vi.fn(async () => result)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'company-1' } } }, error: null })
})

describe('task repository', () => {
  it('uses the authenticated user id and selects current company task fields', async () => {
    const chain = builder({ data: [{ id: 't1', company_id: 'company-1', title: 'Task', description: null, status: 'pending', created_at: '2026-01-01' }], error: null })
    client.from.mockReturnValue(chain)
    await expect(listCurrentCompanyTasks()).resolves.toEqual([{
      id: 't1', companyId: 'company-1', title: 'Task', description: null, status: 'pending', createdAt: '2026-01-01',
    }])
    expect(chain.eq).toHaveBeenCalledWith('company_id', 'company-1')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('sets company_id from the authenticated session when creating', async () => {
    const chain = builder({ data: { id: 't1', company_id: 'company-1', title: 'Task', description: null, status: 'pending', created_at: '2026-01-01' }, error: null })
    client.from.mockReturnValue(chain)
    await createTask({ title: 'Task', description: null })
    expect(chain.insert).toHaveBeenCalledWith({ company_id: 'company-1', title: 'Task', description: null })
  })

  it('updates and deletes by task id without mutable tenant fields', async () => {
    const chain = builder({ data: { id: 't1', company_id: 'company-1', title: 'Updated', description: null, status: 'pending', created_at: '2026-01-01' }, error: null })
    client.from.mockReturnValue(chain)
    await updateTask('t1', { title: 'Updated', description: null })
    expect(chain.update).toHaveBeenCalledWith({ title: 'Updated', description: null })
    expect(chain.eq).toHaveBeenCalledWith('id', 't1')
    expect(chain.eq).toHaveBeenCalledWith('company_id', 'company-1')

    const deleteChain = builder({ data: { id: 't1' }, error: null })
    client.from.mockReturnValue(deleteChain)
    await deleteTask('t1')
    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 't1')
    expect(deleteChain.eq).toHaveBeenCalledWith('company_id', 'company-1')
  })
})

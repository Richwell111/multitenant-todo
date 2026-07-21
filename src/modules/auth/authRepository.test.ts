import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../infrastructure/supabase/client', () => ({
  getSupabaseClient: () => supabase,
}))

const { findCompany } = await import('./authRepository')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('findCompany', () => {
  it('reads the approved companies.slug database column and maps it to workspaceSlug', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'company-uuid', name: 'Alpha Limited', slug: 'alpha', status: 'active' },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    supabase.from.mockReturnValue({ select })

    await expect(findCompany('company-uuid')).resolves.toEqual({
      id: 'company-uuid',
      name: 'Alpha Limited',
      workspaceSlug: 'alpha',
      status: 'active',
    })
    expect(supabase.from).toHaveBeenCalledWith('companies')
    expect(select).toHaveBeenCalledWith('id, name, slug, status')
    expect(eq).toHaveBeenCalledWith('id', 'company-uuid')
  })
})
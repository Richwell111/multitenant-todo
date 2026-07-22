import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../infrastructure/supabase/client', () => ({ getSupabaseClient: () => client }))

import { listCustomizationRequests } from './platformAdminCustomizationRequestRepository'

function builder(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'order']) chain[method] = vi.fn(() => chain)
  chain.order = vi.fn(async () => result)
  return chain
}

beforeEach(() => vi.clearAllMocks())

describe('customization request repository', () => {
  it('selects only request lifecycle fields and never queries tasks', async () => {
    const chain = builder({ data: [{ id: 'r1', requesting_company_id: 'c1', extension_id: null, requested_outcome: '  Safe outcome  ', classification: 'core', request_status: 'requested', development_status: 'not_started', deployment_status: 'not_deployed', target_release: null, requested_at: '2026-01-01', updated_at: '2026-01-01' }], error: null })
    client.from.mockReturnValue(chain)
    await expect(listCustomizationRequests()).resolves.toMatchObject([{ requestedOutcome: 'Safe outcome' }])
    expect(client.from).toHaveBeenCalledWith('feature_requests')
    expect(client.from).not.toHaveBeenCalledWith('tasks')
    expect(chain.select).toHaveBeenCalledWith('id, requesting_company_id, extension_id, requested_outcome, classification, request_status, development_status, deployment_status, target_release, requested_at, updated_at')
  })
})
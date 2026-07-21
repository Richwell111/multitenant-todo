import { describe, expect, it } from 'vitest'
import { handleGenerateLicence, handleRegisterCompany } from '../_shared/handlers.ts'

const request = (body: unknown, method = 'POST') => new Request('https://example.test/function', {
  method,
  headers: { 'content-type': 'application/json' },
  body: method === 'POST' ? JSON.stringify(body) : undefined,
})

describe('edge function handlers', () => {
  it('requires a Platform Admin and returns a generated key once', async () => {
    const inserted: Array<{ keyHash: string; keyPrefix: string }> = []
    const response = await handleGenerateLicence(request({
      companyName: ' Alpha Limited ', expiryDate: '2030-01-01', status: 'available',
    }), {
      authorize: async () => 'authorized',
      fillRandom: (bytes) => { bytes.fill(0xab); return bytes },
      insert: async (input) => {
        inserted.push({ keyHash: input.keyHash, keyPrefix: input.keyPrefix })
        return { kind: 'created', licence: { id: 'synthetic-id' } }
      },
      logger: () => undefined,
      now: () => new Date('2029-01-01T00:00:00Z'),
    })
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.licenceKey).toMatch(/^TDO-[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/)
    expect(inserted[0].keyHash).toHaveLength(64)
    expect(inserted[0].keyPrefix).toBe(body.licence.keyPrefix)
  })

  it('cleans up an Auth user after a definite database rejection', async () => {
    const deleted: string[] = []
    const response = await handleRegisterCompany(request({
      companyName: 'Alpha Limited', companyEmail: 'ALPHA@example.com', password: 'secret1',
      workspaceSlug: 'Alpha', licenceKey: 'TDO-00010203-04050607-08090A0B-0C0D0E0F',
    }), {
      preflight: async () => 'ok',
      createAuthUser: async () => ({ kind: 'created', userId: 'synthetic-user' }),
      complete: async () => ({ kind: 'rejected', code: 'SLUG_IN_USE' }),
      reconcile: async () => ({ kind: 'absent' }),
      deleteAuthUser: async (id) => { deleted.push(id); return true },
      logger: () => undefined,
    })
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('SLUG_IN_USE')
    expect(deleted).toEqual(['synthetic-user'])
  })

  it('reconciles an ambiguous RPC result without deleting a successful registration', async () => {
    const deleted: string[] = []
    const response = await handleRegisterCompany(request({
      companyName: 'Alpha Limited', companyEmail: 'alpha@example.com', password: 'secret1',
      workspaceSlug: 'alpha', licenceKey: 'TDO-00010203-04050607-08090A0B-0C0D0E0F',
    }), {
      preflight: async () => 'ok',
      createAuthUser: async () => ({ kind: 'created', userId: 'synthetic-user' }),
      complete: async () => ({ kind: 'ambiguous' }),
      reconcile: async () => ({ kind: 'completed', workspaceSlug: 'alpha' }),
      deleteAuthUser: async (id) => { deleted.push(id); return true },
      logger: () => undefined,
    })
    expect(response.status).toBe(201)
    expect((await response.json()).company.workspaceSlug).toBe('alpha')
    expect(deleted).toHaveLength(0)
  })
})

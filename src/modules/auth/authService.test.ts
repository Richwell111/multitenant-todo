import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  signOut: vi.fn(),
  findPlatformAdmin: vi.fn(),
  findCompany: vi.fn(),
}))

vi.mock('./authRepository', async () => {
  const actual = await vi.importActual<typeof import('./authRepository')>('./authRepository')
  return { ...actual, ...repository }
})

const {
  evaluateAdminAccess,
  evaluateWorkspaceAccess,
  LoginValidationError,
  resolveAccount,
  restoreSession,
  signIn,
} = await import('./authService')
const { AuthApiError } = await import('./authRepository')

const activeCompany = {
  id: 'company-uuid',
  name: 'Alpha Limited',
  workspaceSlug: 'alpha',
  status: 'active' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  repository.signOut.mockResolvedValue(undefined)
  repository.findPlatformAdmin.mockResolvedValue(false)
  repository.findCompany.mockResolvedValue(null)
})

describe('resolveAccount', () => {
  it('detects a Platform Admin from the platform_admins self-row', async () => {
    repository.findPlatformAdmin.mockResolvedValue(true)

    await expect(resolveAccount('admin-uuid')).resolves.toEqual({ kind: 'platform-admin' })
    // The companies table is never consulted for an admin.
    expect(repository.findCompany).not.toHaveBeenCalled()
  })

  it('detects a Company from the companies self-row', async () => {
    repository.findCompany.mockResolvedValue(activeCompany)

    await expect(resolveAccount('company-uuid')).resolves.toEqual({
      kind: 'company',
      name: 'Alpha Limited',
      workspaceSlug: 'alpha',
      status: 'active',
    })
  })

  it('checks platform_admins before companies', async () => {
    repository.findPlatformAdmin.mockResolvedValue(true)
    repository.findCompany.mockResolvedValue(activeCompany)

    await expect(resolveAccount('both-uuid')).resolves.toEqual({ kind: 'platform-admin' })
  })

  it('returns null when neither row exists', async () => {
    await expect(resolveAccount('orphan-uuid')).resolves.toBeNull()
  })
})

describe('signIn', () => {
  it('returns the Platform Admin account for valid credentials', async () => {
    repository.signInWithPassword.mockResolvedValue('admin-uuid')
    repository.findPlatformAdmin.mockResolvedValue(true)

    await expect(signIn({ email: 'admin@example.com', password: 'secret' }))
      .resolves.toEqual({ kind: 'platform-admin' })
  })

  it('returns the Company account for valid credentials', async () => {
    repository.signInWithPassword.mockResolvedValue('company-uuid')
    repository.findCompany.mockResolvedValue(activeCompany)

    await expect(signIn({ email: 'alpha@example.com', password: 'secret' }))
      .resolves.toMatchObject({ kind: 'company', workspaceSlug: 'alpha' })
  })

  it('surfaces a safe generic error for invalid credentials', async () => {
    repository.signInWithPassword.mockRejectedValue(new AuthApiError('INVALID_CREDENTIALS'))

    await expect(signIn({ email: 'alpha@example.com', password: 'wrong' }))
      .rejects.toThrow('Incorrect email or password.')
  })

  it('denies and signs out an authenticated account in neither table', async () => {
    repository.signInWithPassword.mockResolvedValue('orphan-uuid')

    await expect(signIn({ email: 'orphan@example.com', password: 'secret' }))
      .rejects.toThrow('This account is not set up correctly. Contact support.')
    expect(repository.signOut).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid form without contacting Supabase', async () => {
    await expect(signIn({ email: 'not-an-email', password: '' }))
      .rejects.toBeInstanceOf(LoginValidationError)
    expect(repository.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('restoreSession', () => {
  it('restores an existing session', async () => {
    repository.getAuthenticatedUserId.mockResolvedValue('company-uuid')
    repository.findCompany.mockResolvedValue(activeCompany)

    await expect(restoreSession()).resolves.toMatchObject({ kind: 'company', name: 'Alpha Limited' })
  })

  it('returns null when there is no session', async () => {
    repository.getAuthenticatedUserId.mockResolvedValue(null)

    await expect(restoreSession()).resolves.toBeNull()
  })

  it('signs out a restored session whose account no longer resolves', async () => {
    repository.getAuthenticatedUserId.mockResolvedValue('orphan-uuid')

    await expect(restoreSession()).resolves.toBeNull()
    expect(repository.signOut).toHaveBeenCalledTimes(1)
  })

  it('treats an unreachable backend as signed out', async () => {
    repository.getAuthenticatedUserId.mockRejectedValue(new Error('offline'))

    await expect(restoreSession()).resolves.toBeNull()
  })
})

describe('evaluateAdminAccess', () => {
  it('allows a Platform Admin', () => {
    expect(evaluateAdminAccess({ kind: 'platform-admin' })).toBe('allowed')
  })

  it('blocks a Company', () => {
    expect(evaluateAdminAccess({ kind: 'company', ...activeCompany })).toBe('ADMIN_ONLY')
  })

  it('blocks a suspended Company', () => {
    expect(evaluateAdminAccess({ kind: 'company', ...activeCompany, status: 'suspended' }))
      .toBe('ADMIN_ONLY')
  })

  it('reports no session', () => {
    expect(evaluateAdminAccess(null)).toBe('unauthenticated')
  })
})

describe('evaluateWorkspaceAccess', () => {
  const company = { kind: 'company', ...activeCompany } as const

  it('admits a Company to its own workspace', () => {
    expect(evaluateWorkspaceAccess(company, 'alpha')).toBe('allowed')
  })

  it('blocks a slug mismatch', () => {
    expect(evaluateWorkspaceAccess(company, 'beta')).toBe('WORKSPACE_FORBIDDEN')
  })

  it('blocks a missing slug parameter', () => {
    expect(evaluateWorkspaceAccess(company, undefined)).toBe('WORKSPACE_FORBIDDEN')
  })

  it('blocks a Platform Admin from a Company workspace', () => {
    expect(evaluateWorkspaceAccess({ kind: 'platform-admin' }, 'alpha')).toBe('WORKSPACE_FORBIDDEN')
  })

  it('blocks a suspended Company from its own workspace', () => {
    expect(evaluateWorkspaceAccess({ ...company, status: 'suspended' }, 'alpha'))
      .toBe('COMPANY_SUSPENDED')
  })

  it('reports no session', () => {
    expect(evaluateWorkspaceAccess(null, 'alpha')).toBe('unauthenticated')
  })
})

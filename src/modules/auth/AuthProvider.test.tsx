import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './authContext'
import AuthProvider from './AuthProvider'

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}))
const service = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  resolveAccount: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../../infrastructure/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: { onAuthStateChange: auth.onAuthStateChange } }),
}))

vi.mock('./authService', async () => {
  const actual = await vi.importActual<typeof import('./authService')>('./authService')
  return { ...actual, ...service }
})

type SessionEvent = (event: string, session: { user: { id: string } } | null) => void
let emit: SessionEvent | undefined

function Probe() {
  const { status, account } = useAuth()
  return (
    <output>
      {status}:{account?.kind ?? 'none'}:{account?.kind === 'company' ? account.workspaceSlug : ''}
    </output>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  emit = undefined
  auth.unsubscribe.mockReset()
  auth.onAuthStateChange.mockImplementation((callback: SessionEvent) => {
    emit = callback
    return { data: { subscription: { unsubscribe: auth.unsubscribe } } }
  })
  service.restoreSession.mockResolvedValue(null)
  service.resolveAccount.mockResolvedValue(null)
  service.signOut.mockResolvedValue(undefined)
})

describe('AuthProvider Supabase auth state subscription', () => {
  it('resolves a Platform Admin after SIGNED_IN', async () => {
    service.restoreSession.mockReturnValue(new Promise(() => undefined))
    service.resolveAccount.mockResolvedValue({ kind: 'platform-admin' })
    renderProvider()

    emit?.('SIGNED_IN', { user: { id: 'admin-uuid' } })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:platform-admin:'))
    expect(service.resolveAccount).toHaveBeenCalledWith('admin-uuid')
  })

  it('resolves a Company after SIGNED_IN using its workspace slug', async () => {
    service.restoreSession.mockReturnValue(new Promise(() => undefined))
    service.resolveAccount.mockResolvedValue({
      kind: 'company', name: 'Alpha Limited', workspaceSlug: 'alpha', status: 'active',
    })
    renderProvider()

    emit?.('SIGNED_IN', { user: { id: 'company-uuid' } })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:company:alpha'))
    expect(service.resolveAccount).toHaveBeenCalledWith('company-uuid')
  })

  it('clears the account after SIGNED_OUT', async () => {
    service.restoreSession.mockResolvedValue({ kind: 'platform-admin' })
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:platform-admin:'))

    emit?.('SIGNED_OUT', null)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:none:'))
  })

  it('re-resolves a TOKEN_REFRESHED session without losing the account', async () => {
    const company = { kind: 'company', name: 'Alpha Limited', workspaceSlug: 'alpha', status: 'active' } as const
    service.restoreSession.mockResolvedValue(company)
    service.resolveAccount.mockResolvedValue(company)
    renderProvider()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:company:alpha'))

    emit?.('TOKEN_REFRESHED', { user: { id: 'company-uuid' } })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:company:alpha'))
    expect(service.resolveAccount).toHaveBeenCalledWith('company-uuid')
  })

  it('unsubscribes on unmount', () => {
    const view = renderProvider()
    view.unmount()
    expect(auth.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('restores the current session before rendering the account', async () => {
    service.restoreSession.mockResolvedValue({
      kind: 'company', name: 'Alpha Limited', workspaceSlug: 'alpha', status: 'active',
    })
    renderProvider()
    expect(screen.getByRole('status')).toHaveTextContent('loading:none:')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:company:alpha'))
  })
})
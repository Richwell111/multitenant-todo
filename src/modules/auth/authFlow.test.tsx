import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'

const service = vi.hoisted(() => ({
  restoreSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))
const authClient = vi.hoisted(() => ({ onAuthStateChange: vi.fn() }))

vi.mock('../../infrastructure/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: { onAuthStateChange: authClient.onAuthStateChange } }),
}))

vi.mock('./authService', async () => {
  const actual = await vi.importActual<typeof import('./authService')>('./authService')
  return { ...actual, ...service }
})

const adminAccount = { kind: 'platform-admin' } as const
const alphaAccount = {
  kind: 'company',
  name: 'Alpha Limited',
  workspaceSlug: 'alpha',
  status: 'active',
} as const
const suspendedAccount = { ...alphaAccount, status: 'suspended' } as const

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function signInAs(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText('Company Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  service.restoreSession.mockResolvedValue(null)
  service.signOut.mockResolvedValue(undefined)
  authClient.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

describe('Company login', () => {
  it('signs a Company in and redirects to its workspace', async () => {
    service.signIn.mockResolvedValue(alphaAccount)
    renderAt('/login')

    await signInAs('alpha@example.com', 'correct-password')

    expect(await screen.findByRole('heading', { name: 'Alpha Limited' })).toBeInTheDocument()
    expect(screen.getByText('You are signed in to the Alpha Limited workspace.')).toBeInTheDocument()
    expect(service.signIn).toHaveBeenCalledWith({
      email: 'alpha@example.com',
      password: 'correct-password',
    })
  })

  it('shows a safe generic message for invalid credentials', async () => {
    const { AuthApiError } = await import('./authRepository')
    service.signIn.mockRejectedValue(new AuthApiError('INVALID_CREDENTIALS'))
    renderAt('/login')

    await signInAs('alpha@example.com', 'wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    expect(screen.getByRole('heading', { name: 'Company Login' })).toBeInTheDocument()
  })

  it('signs out an authenticated account that is in neither table', async () => {
    const { AuthApiError } = await import('./authRepository')
    service.signIn.mockRejectedValue(new AuthApiError('ACCOUNT_INVALID'))
    renderAt('/login')

    await signInAs('orphan@example.com', 'correct-password')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This account is not set up correctly. Contact support.')
  })

  it('blocks a suspended Company at login', async () => {
    service.signIn.mockResolvedValue(suspendedAccount)
    renderAt('/login')

    await signInAs('alpha@example.com', 'correct-password')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This Company account is suspended. Contact support.')
  })
})

describe('Registration hand-off', () => {
  it('tells a newly registered Company to sign in', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { registered: true } }]}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('status'))
      .toHaveTextContent('Company registration completed. Sign in to access your workspace.')
  })

  it('does not show the message on a normal visit to /login', async () => {
    renderAt('/login')

    expect(await screen.findByLabelText('Company Email')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Platform Admin login', () => {
  it('signs a Platform Admin in at /admin and shows licence generation', async () => {
    service.signIn.mockResolvedValue(adminAccount)
    renderAt('/admin')

    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Generate Licence' })).toBeInTheDocument()
  })

  it('redirects a Platform Admin who signs in at /login to /admin', async () => {
    service.restoreSession.mockResolvedValue(adminAccount)
    renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'Generate Licence' })).toBeInTheDocument()
  })

  it('shows the admin sign-in state when unauthenticated', async () => {
    renderAt('/admin')

    expect(await screen.findByRole('heading', { name: 'Platform Admin Sign In' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Generate Licence' })).not.toBeInTheDocument()
  })
})

describe('Route guards', () => {
  it('blocks a Company from /admin', async () => {
    service.restoreSession.mockResolvedValue(alphaAccount)
    renderAt('/admin')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This account cannot access the Platform Admin area.')
    expect(screen.queryByRole('heading', { name: 'Generate Licence' })).not.toBeInTheDocument()
  })

  it('blocks a Platform Admin from a Company workspace', async () => {
    service.restoreSession.mockResolvedValue(adminAccount)
    renderAt('/workspace/alpha')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This account cannot access this workspace.')
    expect(screen.queryByText(/signed in to/)).not.toBeInTheDocument()
  })

  it('blocks a Company from another Company workspace slug', async () => {
    service.restoreSession.mockResolvedValue(alphaAccount)
    renderAt('/workspace/beta')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This account cannot access this workspace.')
  })

  it('blocks a suspended Company from its own workspace', async () => {
    service.restoreSession.mockResolvedValue(suspendedAccount)
    renderAt('/workspace/alpha')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('This Company account is suspended. Contact support.')
  })

  it('sends an unauthenticated visitor from the workspace to /login', async () => {
    renderAt('/workspace/alpha')

    expect(await screen.findByRole('heading', { name: 'Company Login' })).toBeInTheDocument()
    expect(screen.getByLabelText('Company Email')).toBeInTheDocument()
  })
})

describe('Session restoration and logout', () => {
  it('restores a Company session without re-entering credentials', async () => {
    service.restoreSession.mockResolvedValue(alphaAccount)
    renderAt('/workspace/alpha')

    expect(await screen.findByRole('heading', { name: 'Alpha Limited' })).toBeInTheDocument()
    expect(service.signIn).not.toHaveBeenCalled()
  })

  it('logs a Company out and returns to the login form', async () => {
    service.restoreSession.mockResolvedValue(alphaAccount)
    renderAt('/workspace/alpha')

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(service.signOut).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: 'Company Login' })).toBeInTheDocument()
  })

  it('logs a Platform Admin out', async () => {
    service.restoreSession.mockResolvedValue(adminAccount)
    renderAt('/admin')

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(service.signOut).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('heading', { name: 'Platform Admin Sign In' })).toBeInTheDocument()
  })
})

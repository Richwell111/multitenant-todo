import { fireEvent, render as renderComponent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from './authContext'
import type { Account } from './authService'
import RegisterPage from './RegisterPage'

const registration = vi.hoisted(() => ({ submitRegistration: vi.fn() }))

vi.mock('./registrationService', async () => {
  const actual = await vi.importActual<typeof import('./registrationService')>('./registrationService')
  return { ...actual, ...registration }
})

const adminAccount = { kind: 'platform-admin' } as const
const companyAccount = {
  kind: 'company', name: 'Alpha Limited', workspaceSlug: 'alpha', status: 'active',
} as const

function LoginStub() {
  const registered = (useLocation().state as { registered?: boolean } | null)?.registered === true
  return (
    <>
      <h1>{registered ? 'Login after registration' : 'Login'}</h1>
      {registered && <p role="status">Company registration completed. Sign in to access your workspace.</p>}
    </>
  )
}

function AuthHarness({ initialAccount, onSignOut, children }: { initialAccount: Account | null; onSignOut: () => void; children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(initialAccount)
  const value: AuthState = {
    status: 'ready',
    account,
    signIn: vi.fn(),
    signOut: async () => { onSignOut(); setAccount(null) },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function renderPage(initialAccount: Account | null = null, onSignOut = vi.fn()) {
  return renderComponent(
    <AuthHarness initialAccount={initialAccount} onSignOut={onSignOut}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginStub />} />
          <Route path="/admin" element={<h1>Admin destination</h1>} />
          <Route path="/workspace/alpha" element={<h1>Workspace destination</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthHarness>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  registration.submitRegistration.mockReset()
})

function fields() {
  return {
    companyName: screen.getByLabelText('Company Name') as HTMLInputElement,
    workspaceSlug: screen.getByLabelText('Workspace Slug') as HTMLInputElement,
  }
}

function type(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

describe('RegisterPage account gating', () => {
  it('shows the registration form to an unauthenticated visitor', () => {
    renderPage()
    expect(screen.getByLabelText('Company Name')).toBeInTheDocument()
  })

  it('blocks a Platform Admin and permits explicit logout before registration', async () => {
    const onSignOut = vi.fn()
    renderPage(adminAccount, onSignOut)
    expect(screen.getByText('You are currently signed in as a Platform Admin.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to Admin' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Company Name')).not.toBeInTheDocument()
    expect(onSignOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Log out and register a Company' }))
    expect(await screen.findByLabelText('Company Name')).toBeInTheDocument()
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('returns a Platform Admin to /admin', () => {
    renderPage(adminAccount)
    fireEvent.click(screen.getByRole('button', { name: 'Return to Admin' }))
    expect(screen.getByRole('heading', { name: 'Admin destination' })).toBeInTheDocument()
  })

  it('blocks a Company and permits explicit logout before registration', async () => {
    const onSignOut = vi.fn()
    renderPage(companyAccount, onSignOut)
    expect(screen.getByText('You are already signed in to a Company account.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to Workspace' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Company Name')).not.toBeInTheDocument()
    expect(onSignOut).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Log out and register another Company' }))
    expect(await screen.findByLabelText('Company Name')).toBeInTheDocument()
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('returns a Company to its workspace', () => {
    renderPage(companyAccount)
    fireEvent.click(screen.getByRole('button', { name: 'Return to Workspace' }))
    expect(screen.getByRole('heading', { name: 'Workspace destination' })).toBeInTheDocument()
  })
})

describe('RegisterPage workspace slug auto-fill', () => {
  it('fills and updates the slug from the Company Name', () => {
    renderPage()
    const { companyName, workspaceSlug } = fields()
    type(companyName, 'Alpha Limited')
    expect(workspaceSlug.value).toBe('alpha-limited')
    type(companyName, 'Alpha Limited Holdings')
    expect(workspaceSlug.value).toBe('alpha-limited-holdings')
  })

  it('stops auto-filling once the slug is edited manually', () => {
    renderPage()
    const { companyName, workspaceSlug } = fields()
    type(companyName, 'Alpha Limited')
    type(workspaceSlug, 'alpha-hq')
    type(companyName, 'Alpha Limited Holdings')
    expect(workspaceSlug.value).toBe('alpha-hq')
  })

  it('resumes suggestions when the visitor clears the slug', () => {
    renderPage()
    const { companyName, workspaceSlug } = fields()
    type(companyName, 'Alpha')
    type(workspaceSlug, 'alpha-hq')
    type(workspaceSlug, '')
    type(companyName, 'Alpha Limited')
    expect(workspaceSlug.value).toBe('alpha-limited')
  })
})

describe('RegisterPage success redirect', () => {
  it('redirects exactly to /login and preserves the safe success message', async () => {
    registration.submitRegistration.mockResolvedValue({
      company: { name: 'Alpha Limited', email: 'alpha@example.com', workspaceSlug: 'alpha' },
    })
    const onSignOut = vi.fn()
    renderPage(null, onSignOut)
    type(fields().companyName, 'Alpha Limited')
    type(screen.getByLabelText('Company Email') as HTMLInputElement, 'alpha@example.com')
    type(screen.getByLabelText('Password') as HTMLInputElement, 'correct-password')
    type(screen.getByLabelText('Licence Key') as HTMLInputElement,
      'TDO-0123ABCD-4567EF89-0123ABCD-4567EF89')
    fireEvent.click(screen.getByRole('button', { name: 'Register Company' }))

    expect(await screen.findByRole('heading', { name: 'Login after registration' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Company registration completed. Sign in to access your workspace.',
    )
    expect(onSignOut).not.toHaveBeenCalled()
  })

  it('prevents duplicate submission while registration is pending', async () => {
    let resolve: (() => void) | undefined
    registration.submitRegistration.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    renderPage()
    type(fields().companyName, 'Alpha Limited')
    fireEvent.click(screen.getByRole('button', { name: 'Register Company' }))
    fireEvent.click(screen.getByRole('button', { name: /Registering/ }))
    expect(registration.submitRegistration).toHaveBeenCalledTimes(1)
    resolve?.()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Register Company' })).toBeEnabled())
  })
})
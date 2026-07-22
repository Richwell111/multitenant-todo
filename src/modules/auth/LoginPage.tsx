import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './authContext'
import { AUTH_MESSAGES } from './authRepository'
import { LoginValidationError, type Account } from './authService'
import { AppPageShell } from '../../shared/ui'
import { buildWorkspaceUrl, isSameOriginPath } from './workspaceUrl'

function workspaceDestination(account: Extract<Account, { kind: 'company' }>): string {
  return buildWorkspaceUrl(account.workspaceSlug)
}

function LoginPage() {
  const { status, account, signIn, signOut } = useAuth()
  const registered = (useLocation().state as { registered?: boolean } | null)?.registered === true
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setFieldErrors({})
    setFormError('')
    try {
      const resolved = await signIn({ email, password })
      setPassword('')
      if (resolved.kind === 'company' && resolved.status === 'active') {
        const destination = workspaceDestination(resolved)
        if (!isSameOriginPath(destination)) window.location.replace(destination)
      }
    } catch (error) {
      if (error instanceof LoginValidationError) setFieldErrors(error.fieldErrors)
      setFormError(error instanceof Error ? error.message : AUTH_MESSAGES.NETWORK_ERROR)
    } finally {
      setPending(false)
    }
  }

  if (status === 'loading') {
    return <AppPageShell className="auth-layout"><section className="auth-card state-card"><h1>Company Login</h1><p className="muted">Checking your session...</p></section></AppPageShell>
  }

  if (account?.kind === 'platform-admin') return <Navigate to="/admin" replace />

  if (account?.kind === 'company') {
    if (account.status === 'suspended') {
      return (
        <AppPageShell className="auth-layout">
          <section className="auth-card">
            <header><h1>Company Login</h1><p className="muted">Your account needs attention before you can continue.</p></header>
            <p className="alert alert-error" role="alert">{AUTH_MESSAGES.COMPANY_SUSPENDED}</p>
            <div className="form-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div>
          </section>
        </AppPageShell>
      )
    }
    const destination = workspaceDestination(account)
    if (isSameOriginPath(destination)) return <Navigate to={destination} replace />
    return <AppPageShell className="auth-layout"><section className="auth-card state-card"><h1>Company Login</h1><p>Opening your workspace...</p></section></AppPageShell>
  }

  return (
    <AppPageShell className="auth-layout">
      <section className="auth-card">
        <header><h1>Company Login</h1><p>Sign in to continue to your Company workspace.</p></header>
        {registered && <p className="alert alert-success" role="status">Company registration completed. Sign in to access your workspace.</p>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">Company Email</label>
            <input id="login-email" name="email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: '' })); setFormError('') }} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'login-email-error' : undefined} autoComplete="username" />
            {fieldErrors.email && <p className="field-error" id="login-email-error">{fieldErrors.email}</p>}
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: '' })); setFormError('') }} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined} autoComplete="current-password" />
            {fieldErrors.password && <p className="field-error" id="login-password-error">{fieldErrors.password}</p>}
          </div>
          {formError && <p className="alert alert-error" role="alert">{formError}</p>}
          <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</button></div>
        </form>
      </section>
    </AppPageShell>
  )
}

export default LoginPage

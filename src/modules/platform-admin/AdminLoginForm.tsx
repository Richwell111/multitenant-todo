import { useState } from 'react'

import { useAuth } from '../auth/authContext'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { LoginValidationError } from '../auth/authService'

// The Platform Admin sign-in experience is unchanged; it is now shared by the
// protected Admin layout so every /admin/* route presents the same login.
function AdminLoginForm() {
  const { signIn } = useAuth()
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
    try { await signIn({ email, password }); setPassword('') }
    catch (error) {
      if (error instanceof LoginValidationError) setFieldErrors(error.fieldErrors)
      setFormError(error instanceof Error ? error.message : AUTH_MESSAGES.NETWORK_ERROR)
    } finally { setPending(false) }
  }

  return (
    <section className="auth-card">
      <header><h2>Platform Admin Sign In</h2><p className="muted">Manage Companies, licences, and proof extensions.</p></header>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(fieldErrors.email)} autoComplete="username" />{fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}</div>
        <div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fieldErrors.password)} autoComplete="current-password" />{fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}</div>
        {formError && <p className="alert alert-error" role="alert">{formError}</p>}
        <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</button></div>
      </form>
    </section>
  )
}

export default AdminLoginForm

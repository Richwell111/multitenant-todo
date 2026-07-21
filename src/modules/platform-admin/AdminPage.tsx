import { useState } from 'react'
import { useAuth } from '../auth/authContext'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { evaluateAdminAccess, LoginValidationError } from '../auth/authService'
import { LicenceApiError } from '../licensing/licenceRepository'
import { LicenceValidationError, submitLicence } from '../licensing/licenceService'

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
    try {
      await signIn({ email, password })
      setPassword('')
    } catch (error) {
      if (error instanceof LoginValidationError) setFieldErrors(error.fieldErrors)
      setFormError(error instanceof Error ? error.message : AUTH_MESSAGES.NETWORK_ERROR)
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h2>Platform Admin Sign In</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            autoComplete="username"
          />
          {fieldErrors.email && <p>{fieldErrors.email}</p>}
        </div>
        <div>
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            autoComplete="current-password"
          />
          {fieldErrors.password && <p>{fieldErrors.password}</p>}
        </div>
        {formError && <p role="alert">{formError}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  )
}

function GenerateLicenceForm() {
  const [companyName, setCompanyName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [status, setStatus] = useState<'available' | 'revoked'>('available')
  const [result, setResult] = useState<Awaited<ReturnType<typeof submitLicence>> | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setResult(null)
    setCopied(false)
    setFieldErrors({})
    setFormError('')
    try {
      setResult(await submitLicence({ companyName, expiryDate, status }))
    } catch (error) {
      if (error instanceof LicenceValidationError || error instanceof LicenceApiError) setFieldErrors(error.fieldErrors)
      setFormError(error instanceof Error ? error.message : 'The licence could not be generated.')
    } finally {
      setPending(false)
    }
  }

  async function copyKey() {
    if (!result) return
    if (navigator.clipboard) await navigator.clipboard.writeText(result.licenceKey)
    setCopied(true)
  }

  return (
    <>
      <h2>Generate Licence</h2>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="licence-company-name">Company Name</label>
        <input id="licence-company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        {fieldErrors.companyName && <p>{fieldErrors.companyName}</p>}
        <label htmlFor="licence-expiry-date">Expiry Date</label>
        <input id="licence-expiry-date" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
        {fieldErrors.expiryDate && <p>{fieldErrors.expiryDate}</p>}
        <label htmlFor="licence-status">Status</label>
        <select id="licence-status" value={status} onChange={(event) => setStatus(event.target.value as 'available' | 'revoked')}>
          <option value="available">Available</option>
          <option value="revoked">Revoked</option>
        </select>
        {formError && <p role="alert">{formError}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Generating…' : 'Generate Licence'}</button>
      </form>
      {result && (
        <section aria-live="polite">
          <h2>Licence generated</h2>
          <p>Copy this key now. It cannot be recovered later.</p>
          <code>{result.licenceKey}</code>
          <button type="button" onClick={copyKey}>{copied ? 'Copied' : 'Copy key'}</button>
          <button type="button" onClick={() => setResult(null)}>Dismiss</button>
        </section>
      )}
    </>
  )
}

function AdminPage() {
  const { status, account, signOut } = useAuth()

  if (status === 'loading') {
    return (
      <main>
        <h1>Platform Admin</h1>
        <p>Checking your session…</p>
      </main>
    )
  }

  const access = evaluateAdminAccess(account)

  return (
    <main>
      <h1>Platform Admin</h1>
      {access === 'unauthenticated' && <AdminLoginForm />}
      {access === 'ADMIN_ONLY' && (
        <>
          <p role="alert">{AUTH_MESSAGES.ADMIN_ONLY}</p>
          <button type="button" onClick={() => void signOut()}>Log out</button>
        </>
      )}
      {access === 'allowed' && (
        <>
          <button type="button" onClick={() => void signOut()}>Log out</button>
          <GenerateLicenceForm />
        </>
      )}
    </main>
  )
}

export default AdminPage

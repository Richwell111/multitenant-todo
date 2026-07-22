import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './authContext'
import { RegistrationApiError } from './registrationRepository'
import { suggestWorkspaceSlug } from './registrationSchemas'
import { RegistrationValidationError, submitRegistration } from './registrationService'
import { buildWorkspaceUrl } from './workspaceUrl'

const initialForm = {
  companyName: '', companyEmail: '', password: '', workspaceSlug: '', licenceKey: '',
}

function RegisterPage() {
  const navigate = useNavigate()
  const { status, account, signOut } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'companyName' && !slugEdited) next.workspaceSlug = suggestWorkspaceSlug(value)
      return next
    })
    if (field === 'workspaceSlug') setSlugEdited(value !== '')
    setFieldErrors((current) => ({ ...current, [field]: '', ...(field === 'companyName' && !slugEdited ? { workspaceSlug: '' } : {}) }))
    setFormError('')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setFieldErrors({})
    setFormError('')
    try {
      await submitRegistration(form)
      setForm(initialForm)
      setSlugEdited(false)
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (error) {
      if (error instanceof RegistrationValidationError || error instanceof RegistrationApiError) setFieldErrors(error.fieldErrors)
      setFormError(error instanceof RegistrationApiError && error.code === 'REGISTRATION_INCOMPLETE'
        ? 'Registration could not be completed; contact support with the request ID.'
        : error instanceof Error ? error.message : 'Registration could not be completed.')
    } finally {
      setPending(false)
    }
  }

  function returnToWorkspace() {
    if (account?.kind !== 'company') return
    const destination = buildWorkspaceUrl(account.workspaceSlug)
    if (destination.startsWith('/')) navigate(destination)
    else window.location.assign(destination)
  }

  if (status === 'loading') {
    return <main className="auth-layout"><section className="auth-card state-card"><h1>Company Registration</h1><p className="muted">Checking your session...</p></section></main>
  }

  if (account?.kind === 'platform-admin') {
    return (
      <main className="auth-layout">
        <section className="auth-card">
          <header><h1>Company Registration</h1><p className="muted">Sign out of the current account before registering another Company.</p></header>
          <p className="alert alert-error">You are currently signed in as a Platform Admin.</p>
          <div className="form-actions"><button className="button-secondary" type="button" onClick={() => navigate('/admin')}>Return to Admin</button><button type="button" onClick={() => void signOut()}>Log out and register a Company</button></div>
        </section>
      </main>
    )
  }

  if (account?.kind === 'company') {
    return (
      <main className="auth-layout">
        <section className="auth-card">
          <header><h1>Company Registration</h1><p className="muted">Sign out of the current account before registering another Company.</p></header>
          <p className="alert alert-error">You are already signed in to a Company account.</p>
          <div className="form-actions"><button className="button-secondary" type="button" onClick={returnToWorkspace}>Return to Workspace</button><button type="button" onClick={() => void signOut()}>Log out and register another Company</button></div>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <header><h1>Company Registration</h1><p>Use a valid licence to create a new Company workspace.</p></header>
        <form onSubmit={handleSubmit} noValidate>
          {(['companyName', 'companyEmail', 'password', 'workspaceSlug', 'licenceKey'] as const).map((field) => {
            const labels = { companyName: 'Company Name', companyEmail: 'Company Email', password: 'Password', workspaceSlug: 'Workspace Slug', licenceKey: 'Licence Key' }
            return (
              <div className="field" key={field}>
                <label htmlFor={`registration-${field}`}>{labels[field]}</label>
                <input id={`registration-${field}`} name={field} type={field === 'password' ? 'password' : field === 'companyEmail' ? 'email' : 'text'} value={form[field]} onChange={(event) => updateField(field, event.target.value)} aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field] ? `${field}-error` : undefined} autoComplete={field === 'password' ? 'new-password' : undefined} />
                {fieldErrors[field] && <p className="field-error" id={`${field}-error`}>{fieldErrors[field]}</p>}
                {field === 'workspaceSlug' && <p className="helper-text">Lowercase letters, numbers, and hyphens are supported.</p>}
              </div>
            )
          })}
          {formError && <p className="alert alert-error" role="alert">{formError}</p>}
          <div className="form-actions"><button type="submit" disabled={pending}>{pending ? 'Registering...' : 'Register Company'}</button></div>
        </form>
      </section>
    </main>
  )
}

export default RegisterPage

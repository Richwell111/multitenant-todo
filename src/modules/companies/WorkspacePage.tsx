import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { evaluateWorkspaceAccess } from '../auth/authService'

/**
 * Phase 4 placeholder. Phase 5 replaces the body with the Todo dashboard.
 */
function WorkspacePage() {
  const { slug } = useParams<{ slug: string }>()
  const { status, account, signOut } = useAuth()

  if (status === 'loading') {
    return (
      <main>
        <h1>Workspace</h1>
        <p>Checking your session…</p>
      </main>
    )
  }

  const access = evaluateWorkspaceAccess(account, slug)
  if (access === 'unauthenticated') return <Navigate to="/login" replace />

  if (access !== 'allowed') {
    return (
      <main>
        <h1>Workspace</h1>
        <p role="alert">{AUTH_MESSAGES[access]}</p>
        <button type="button" onClick={() => void signOut()}>Log out</button>
      </main>
    )
  }

  const company = account as Extract<NonNullable<typeof account>, { kind: 'company' }>
  return (
    <main>
      <h1>{company.name}</h1>
      <p>You are signed in to the {company.name} workspace.</p>
      <button type="button" onClick={() => void signOut()}>Log out</button>
    </main>
  )
}

export default WorkspacePage

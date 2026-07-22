import {
  AuthApiError,
  findCompany,
  findPlatformAdmin,
  getAuthenticatedUserId,
  signInWithPassword,
  signOut as repositorySignOut,
} from './authRepository'
import { captureUsage, clearIdentity, identifyAccount } from '../diagnostics/diagnosticsService'
import { validateLoginForm, type LoginFormInput } from './loginSchemas'

export type Account =
  | { kind: 'platform-admin' }
  | { kind: 'company'; name: string; workspaceSlug: string; status: 'active' | 'suspended' }

export class LoginValidationError extends Error {
  readonly fieldErrors: Record<string, string>
  constructor(fieldErrors: Record<string, string>) {
    super('Correct the highlighted fields.')
    this.fieldErrors = fieldErrors
  }
}

export async function resolveAccount(userId: string): Promise<Account | null> {
  if (await findPlatformAdmin(userId)) return { kind: 'platform-admin' }
  const company = await findCompany(userId)
  if (!company) return null
  return { kind: 'company', name: company.name, workspaceSlug: company.workspaceSlug, status: company.status }
}

export async function signIn(input: LoginFormInput): Promise<Account> {
  try {
    const validation = validateLoginForm(input)
    if (!validation.ok) throw new LoginValidationError(validation.errors)
    const userId = await signInWithPassword(validation.value.email, validation.value.password)
    const account = await resolveAccount(userId)
    if (!account) {
      await repositorySignOut()
      throw new AuthApiError('ACCOUNT_INVALID')
    }
    identifyAccount(account.kind, userId)
    captureUsage('auth.login_succeeded', { module_key: 'auth', action_name: 'sign_in', success: true })
    return account
  } catch (error) {
    const safeErrorCode = error instanceof LoginValidationError
      ? 'VALIDATION_ERROR'
      : error instanceof AuthApiError ? error.code : 'NETWORK_ERROR'
    captureUsage('auth.login_failed', {
      module_key: 'auth',
      action_name: 'sign_in',
      safe_error_code: safeErrorCode,
      success: false,
    })
    throw error
  }
}

export async function restoreSession(): Promise<Account | null> {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) return null
    const account = await resolveAccount(userId)
    if (!account) {
      await repositorySignOut()
      return null
    }
    identifyAccount(account.kind, userId)
    captureUsage('auth.session_restored', { module_key: 'auth', action_name: 'restore_session', success: true })
    return account
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  await repositorySignOut()
  clearIdentity()
  captureUsage('auth.logout', { module_key: 'auth', action_name: 'sign_out', success: true })
}

export type AdminAccess = 'allowed' | 'unauthenticated' | 'ADMIN_ONLY'
export function evaluateAdminAccess(account: Account | null): AdminAccess {
  if (!account) return 'unauthenticated'
  return account.kind === 'platform-admin' ? 'allowed' : 'ADMIN_ONLY'
}

export type WorkspaceAccess = 'allowed' | 'unauthenticated' | 'WORKSPACE_FORBIDDEN' | 'COMPANY_SUSPENDED'
export function evaluateWorkspaceAccess(account: Account | null, requestedSlug: string | undefined): WorkspaceAccess {
  if (!account) return 'unauthenticated'
  if (account.kind === 'platform-admin') return 'WORKSPACE_FORBIDDEN'
  if (account.status === 'suspended') return 'COMPANY_SUSPENDED'
  return requestedSlug === account.workspaceSlug ? 'allowed' : 'WORKSPACE_FORBIDDEN'
}

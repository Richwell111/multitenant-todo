import {
  AuthApiError,
  findCompany,
  findPlatformAdmin,
  getAuthenticatedUserId,
  signInWithPassword,
  signOut as repositorySignOut,
} from './authRepository'
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

/**
 * Account kind comes from which table owns the authenticated user id. There is
 * no role column and no custom JWT claim. Both reads run under the existing RLS
 * self-read policies, so a caller can only ever resolve its own row.
 */
export async function resolveAccount(userId: string): Promise<Account | null> {
  if (await findPlatformAdmin(userId)) return { kind: 'platform-admin' }
  const company = await findCompany(userId)
  if (!company) return null
  return {
    kind: 'company',
    name: company.name,
    workspaceSlug: company.workspaceSlug,
    status: company.status,
  }
}

export async function signIn(input: LoginFormInput): Promise<Account> {
  const validation = validateLoginForm(input)
  if (!validation.ok) throw new LoginValidationError(validation.errors)

  const userId = await signInWithPassword(validation.value.email, validation.value.password)
  const account = await resolveAccount(userId)
  if (!account) {
    // An Auth user in neither table is an orphan; deny access and end the session.
    await repositorySignOut()
    throw new AuthApiError('ACCOUNT_INVALID')
  }
  return account
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
    return account
  } catch {
    // An unreachable or unconfigured backend must not break the whole app; the
    // visitor is simply treated as signed out.
    return null
  }
}

export async function signOut(): Promise<void> {
  await repositorySignOut()
}

export type AdminAccess = 'allowed' | 'unauthenticated' | 'ADMIN_ONLY'

export function evaluateAdminAccess(account: Account | null): AdminAccess {
  if (!account) return 'unauthenticated'
  return account.kind === 'platform-admin' ? 'allowed' : 'ADMIN_ONLY'
}

export type WorkspaceAccess =
  | 'allowed'
  | 'unauthenticated'
  | 'WORKSPACE_FORBIDDEN'
  | 'COMPANY_SUSPENDED'

export function evaluateWorkspaceAccess(
  account: Account | null,
  requestedSlug: string | undefined,
): WorkspaceAccess {
  if (!account) return 'unauthenticated'
  if (account.kind === 'platform-admin') return 'WORKSPACE_FORBIDDEN'
  if (account.status === 'suspended') return 'COMPANY_SUSPENDED'
  // The requested slug is only ever compared with the value the database
  // returned for auth.uid(); it is never used to look a Company up.
  return requestedSlug === account.workspaceSlug ? 'allowed' : 'WORKSPACE_FORBIDDEN'
}

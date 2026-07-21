import { getSupabaseClient } from '../../infrastructure/supabase/client'

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'COMPANY_SUSPENDED'
  | 'ADMIN_ONLY'
  | 'WORKSPACE_FORBIDDEN'
  | 'ACCOUNT_INVALID'
  | 'NETWORK_ERROR'

export const AUTH_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  COMPANY_SUSPENDED: 'This Company account is suspended. Contact support.',
  ADMIN_ONLY: 'This account cannot access the Platform Admin area.',
  WORKSPACE_FORBIDDEN: 'This account cannot access this workspace.',
  ACCOUNT_INVALID: 'This account is not set up correctly. Contact support.',
  NETWORK_ERROR: 'Sign-in could not be completed. Try again.',
}

export class AuthApiError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(AUTH_MESSAGES[code])
    this.code = code
  }
}

export interface CompanyRecord {
  id: string
  name: string
  workspaceSlug: string
  status: 'active' | 'suspended'
}

// A failed sign-in is always reported as INVALID_CREDENTIALS so /login cannot be
// used to tell an unknown email apart from a wrong password.
function isNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { name, status } = error as { name?: string; status?: number }
  return name === 'AuthRetryableFetchError' || status === 0 || status === undefined
}

export async function signInWithPassword(email: string, password: string): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    throw new AuthApiError(isNetworkFailure(error) ? 'NETWORK_ERROR' : 'INVALID_CREDENTIALS')
  }
  return data.user.id
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession()
  return data.session?.user.id ?? null
}

export async function signOut(): Promise<void> {
  try {
    await getSupabaseClient().auth.signOut()
  } catch {
    // Local state is cleared by the caller regardless of the network result.
  }
}

export async function findPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
    .from('platform_admins')
    .select('id')
    .eq('id', userId)
    .maybeSingle()
  // A query failure must not be mistaken for a missing row, which would sign a
  // valid account out.
  if (error) throw new AuthApiError('NETWORK_ERROR')
  return Boolean(data)
}

export async function findCompany(userId: string): Promise<CompanyRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('companies')
    .select('id, name, slug, status')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new AuthApiError('NETWORK_ERROR')
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    workspaceSlug: data.slug,
    status: data.status,
  }
}

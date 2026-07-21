import {
  canonicalizeLicenceKey,
  companyNamesMatch,
  expiryDateToInstant,
  generateLicenceKey,
  licenceKeyPrefix,
  sha256Hex,
  validateCompanyName,
  validateEmail,
  validateWorkspaceSlug,
} from './licence.ts'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_LICENCE'
  | 'LICENCE_EXPIRED'
  | 'LICENCE_UNAVAILABLE'
  | 'COMPANY_NAME_MISMATCH'
  | 'EMAIL_IN_USE'
  | 'SLUG_IN_USE'
  | 'RESERVED_SLUG'
  | 'REGISTRATION_INCOMPLETE'
  | 'INTERNAL_ERROR'

const ERRORS: Record<ErrorCode, { status: number; message: string }> = {
  VALIDATION_ERROR: { status: 400, message: 'Correct the highlighted fields.' },
  UNAUTHENTICATED: { status: 401, message: 'Platform Admin authentication is required.' },
  FORBIDDEN: { status: 403, message: 'This account is not a Platform Admin.' },
  INVALID_LICENCE: { status: 422, message: 'The licence key is invalid.' },
  LICENCE_EXPIRED: { status: 422, message: 'The licence has expired.' },
  LICENCE_UNAVAILABLE: { status: 422, message: 'The licence is revoked, redeemed, or unavailable.' },
  COMPANY_NAME_MISMATCH: { status: 422, message: 'Company Name does not match the licence.' },
  EMAIL_IN_USE: { status: 409, message: 'The Company email is already registered.' },
  SLUG_IN_USE: { status: 409, message: 'The workspace slug is unavailable.' },
  RESERVED_SLUG: { status: 400, message: 'Choose another workspace slug.' },
  REGISTRATION_INCOMPLETE: { status: 500, message: 'Registration could not be completed; contact support with the request ID.' },
  INTERNAL_ERROR: { status: 500, message: 'The request could not be completed.' },
}

type Logger = (event: string, details: { requestId: string; authUserId?: string }) => void

function response(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  })
}

function failure(code: ErrorCode, requestId: string, fieldErrors?: Record<string, string>): Response {
  const error = ERRORS[code]
  return response({ code, message: error.message, ...(fieldErrors ? { fieldErrors } : {}), requestId }, error.status)
}

async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 16_384) return null
  try {
    const value: unknown = await request.json()
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export interface GenerateLicenceDependencies {
  authorize(request: Request): Promise<'authorized' | 'unauthenticated' | 'forbidden'>
  insert(input: {
    companyName: string
    keyHash: string
    keyPrefix: string
    status: 'available' | 'revoked'
    expiresAt: string
  }): Promise<
    | { kind: 'created'; licence: { id: string } }
    | { kind: 'collision' }
    | { kind: 'error' }
  >
  logger: Logger
  requestId?: () => string
  fillRandom?: (bytes: Uint8Array) => Uint8Array
  now?: () => Date
}

export async function handleGenerateLicence(
  request: Request,
  dependencies: GenerateLicenceDependencies,
): Promise<Response> {
  const requestId = dependencies.requestId?.() ?? crypto.randomUUID()
  if (request.method !== 'POST') return response({ code: 'METHOD_NOT_ALLOWED', requestId }, 405)

  const authorization = await dependencies.authorize(request)
  if (authorization !== 'authorized') {
    const code = authorization === 'unauthenticated' ? 'UNAUTHENTICATED' : 'FORBIDDEN'
    dependencies.logger(code, { requestId })
    return failure(code, requestId)
  }

  const body = await jsonBody(request)
  const companyName = typeof body?.companyName === 'string'
    ? validateCompanyName(body.companyName)
    : null
  const expiresAt = typeof body?.expiryDate === 'string'
    ? expiryDateToInstant(body.expiryDate, dependencies.now?.() ?? new Date())
    : null
  const status = body?.status === 'available' || body?.status === 'revoked'
    ? body.status
    : null

  const fieldErrors: Record<string, string> = {}
  if (!companyName) fieldErrors.companyName = 'Enter a Company Name of 1 to 200 characters.'
  if (!expiresAt) fieldErrors.expiryDate = 'Choose today or a future date.'
  if (!status) fieldErrors.status = 'Choose Available or Revoked.'
  if (Object.keys(fieldErrors).length > 0) return failure('VALIDATION_ERROR', requestId, fieldErrors)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const licenceKey = generateLicenceKey(dependencies.fillRandom)
    const keyHash = await sha256Hex(licenceKey)
    const result = await dependencies.insert({
      companyName: companyName!, keyHash, keyPrefix: licenceKeyPrefix(licenceKey),
      status: status!, expiresAt: expiresAt!,
    })
    if (result.kind === 'created') {
      dependencies.logger('LICENCE_CREATED', { requestId })
      return response({
        licence: {
          id: result.licence.id,
          companyName,
          keyPrefix: licenceKeyPrefix(licenceKey),
          status,
          expiresAt,
        },
        licenceKey,
      }, 201)
    }
    if (result.kind === 'error') break
  }

  dependencies.logger('LICENCE_CREATE_FAILED', { requestId })
  return failure('INTERNAL_ERROR', requestId)
}

export type RegistrationBusinessCode = Extract<ErrorCode,
  'INVALID_LICENCE' | 'LICENCE_EXPIRED' | 'LICENCE_UNAVAILABLE' |
  'COMPANY_NAME_MISMATCH' | 'EMAIL_IN_USE' | 'SLUG_IN_USE' | 'RESERVED_SLUG'>

interface RegistrationInput {
  companyName: string
  companyEmail: string
  password: string
  workspaceSlug: string
  licenceKeyHash: string
}

export interface RegisterCompanyDependencies {
  preflight(input: Omit<RegistrationInput, 'password'>): Promise<'ok' | RegistrationBusinessCode | 'error'>
  createAuthUser(email: string, password: string): Promise<
    | { kind: 'created'; userId: string }
    | { kind: 'email-in-use' }
    | { kind: 'invalid-password' }
    | { kind: 'error' }
  >
  complete(input: RegistrationInput & { authUserId: string }): Promise<
    | { kind: 'completed'; workspaceSlug: string }
    | { kind: 'rejected'; code: RegistrationBusinessCode }
    | { kind: 'ambiguous' }
  >
  reconcile(authUserId: string, licenceKeyHash: string): Promise<
    | { kind: 'completed'; workspaceSlug: string }
    | { kind: 'absent' }
    | { kind: 'inconsistent' }
  >
  deleteAuthUser(userId: string): Promise<boolean>
  logger: Logger
  requestId?: () => string
}

async function cleanupOrIncomplete(
  dependencies: RegisterCompanyDependencies,
  userId: string,
  requestId: string,
  code: ErrorCode,
): Promise<Response> {
  if (await dependencies.deleteAuthUser(userId)) return failure(code, requestId)
  dependencies.logger('AUTH_CLEANUP_FAILED', { requestId, authUserId: userId })
  return failure('REGISTRATION_INCOMPLETE', requestId)
}

export async function handleRegisterCompany(
  request: Request,
  dependencies: RegisterCompanyDependencies,
): Promise<Response> {
  const requestId = dependencies.requestId?.() ?? crypto.randomUUID()
  if (request.method !== 'POST') return response({ code: 'METHOD_NOT_ALLOWED', requestId }, 405)

  const body = await jsonBody(request)
  const companyName = typeof body?.companyName === 'string' ? validateCompanyName(body.companyName) : null
  const companyEmail = typeof body?.companyEmail === 'string' ? validateEmail(body.companyEmail) : null
  const slugResult = typeof body?.workspaceSlug === 'string'
    ? validateWorkspaceSlug(body.workspaceSlug)
    : { ok: false as const, reason: 'invalid' as const }
  const licenceKey = typeof body?.licenceKey === 'string' ? canonicalizeLicenceKey(body.licenceKey) : null
  const password = typeof body?.password === 'string' ? body.password : ''

  const fieldErrors: Record<string, string> = {}
  if (!companyName) fieldErrors.companyName = 'Enter a Company Name of 1 to 200 characters.'
  if (!companyEmail) fieldErrors.companyEmail = 'Enter a valid email address.'
  if (!slugResult.ok) fieldErrors.workspaceSlug = slugResult.reason === 'reserved'
    ? 'Choose another workspace slug.' : 'Use 3 to 63 letters, digits, or single hyphens.'
  if (!licenceKey) fieldErrors.licenceKey = 'Enter a valid licence key.'
  if (password.length < 6) fieldErrors.password = 'Password must contain at least 6 characters.'
  if (Object.keys(fieldErrors).length > 0) {
    const code = !slugResult.ok && slugResult.reason === 'reserved' && Object.keys(fieldErrors).length === 1
      ? 'RESERVED_SLUG' : 'VALIDATION_ERROR'
    return failure(code, requestId, fieldErrors)
  }

  const licenceKeyHash = await sha256Hex(licenceKey!)
  const input: RegistrationInput = {
    companyName: companyName!, companyEmail: companyEmail!, password,
    workspaceSlug: slugResult.ok ? slugResult.value : '', licenceKeyHash,
  }
  const preflight = await dependencies.preflight({
    companyName: input.companyName,
    companyEmail: input.companyEmail,
    workspaceSlug: input.workspaceSlug,
    licenceKeyHash,
  })
  if (preflight !== 'ok') {
    const code = preflight === 'error' ? 'INTERNAL_ERROR' : preflight
    dependencies.logger('REGISTRATION_PREFLIGHT_REJECTED', { requestId })
    return failure(code, requestId)
  }

  const auth = await dependencies.createAuthUser(companyEmail!, password)
  if (auth.kind !== 'created') {
    const code = auth.kind === 'email-in-use' ? 'EMAIL_IN_USE'
      : auth.kind === 'invalid-password' ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'
    return failure(code, requestId, auth.kind === 'invalid-password'
      ? { password: 'Password does not satisfy the configured policy.' } : undefined)
  }

  const completion = await dependencies.complete({ ...input, authUserId: auth.userId })
  if (completion.kind === 'completed') {
    dependencies.logger('REGISTRATION_COMPLETED', { requestId, authUserId: auth.userId })
    return response({ company: { name: companyName, email: companyEmail, workspaceSlug: completion.workspaceSlug } }, 201)
  }
  if (completion.kind === 'rejected') {
    return cleanupOrIncomplete(dependencies, auth.userId, requestId, completion.code)
  }

  const reconciled = await dependencies.reconcile(auth.userId, licenceKeyHash)
  if (reconciled.kind === 'completed') {
    dependencies.logger('REGISTRATION_RECONCILED', { requestId, authUserId: auth.userId })
    return response({ company: { name: companyName, email: companyEmail, workspaceSlug: reconciled.workspaceSlug } }, 201)
  }
  if (reconciled.kind === 'absent') {
    return cleanupOrIncomplete(dependencies, auth.userId, requestId, 'INTERNAL_ERROR')
  }

  dependencies.logger('REGISTRATION_INCONSISTENT', { requestId, authUserId: auth.userId })
  return failure('REGISTRATION_INCOMPLETE', requestId)
}

export { companyNamesMatch }

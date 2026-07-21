import { getSupabaseClient } from '../../infrastructure/supabase/client'
import type { NormalizedRegistrationInput } from './registrationSchemas'

export interface RegistrationResult {
  company: { name: string; email: string; workspaceSlug: string }
}

const SAFE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Correct the highlighted fields.',
  INVALID_LICENCE: 'The licence key is invalid.',
  LICENCE_EXPIRED: 'The licence has expired.',
  LICENCE_UNAVAILABLE: 'The licence is revoked, redeemed, or unavailable.',
  COMPANY_NAME_MISMATCH: 'Company Name does not match the licence.',
  EMAIL_IN_USE: 'The Company email is already registered.',
  SLUG_IN_USE: 'The workspace slug is unavailable.',
  RESERVED_SLUG: 'Choose another workspace slug.',
  REGISTRATION_INCOMPLETE: 'Registration could not be completed; contact support with the request ID.',
}

export class RegistrationApiError extends Error {
  readonly code: string
  readonly fieldErrors: Record<string, string>

  constructor(code: string, fieldErrors: Record<string, string> = {}) {
    super(SAFE_MESSAGES[code] ?? 'Registration could not be completed.')
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export async function registerCompany(input: NormalizedRegistrationInput): Promise<RegistrationResult> {
  const { data, error } = await getSupabaseClient().functions.invoke<RegistrationResult>('register-company', {
    body: input,
  })
  if (error || !data) {
    let code = 'INTERNAL_ERROR'
    let fieldErrors: Record<string, string> = {}
    const context = error && 'context' in error ? (error as { context?: unknown }).context : undefined
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { code?: string; fieldErrors?: Record<string, string> }
        if (body.code && SAFE_MESSAGES[body.code]) code = body.code
        if (body.fieldErrors) fieldErrors = body.fieldErrors
      } catch {
        // Keep a safe generic error when the function response is not JSON.
      }
    }
    throw new RegistrationApiError(code, fieldErrors)
  }
  return data
}

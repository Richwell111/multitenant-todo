import { getSupabaseClient } from '../../infrastructure/supabase/client'
import type { GenerateLicenceInput } from './licenceSchemas'

export interface GeneratedLicence {
  licence: {
    id: string
    companyName: string
    keyPrefix: string
    status: 'available' | 'revoked'
    expiresAt: string
  }
  licenceKey: string
}

const SAFE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Platform Admin authentication is required.',
  FORBIDDEN: 'This account is not a Platform Admin.',
  VALIDATION_ERROR: 'Correct the highlighted fields.',
}

export class LicenceApiError extends Error {
  readonly code: string
  readonly fieldErrors: Record<string, string>

  constructor(code: string, fieldErrors: Record<string, string> = {}) {
    super(SAFE_MESSAGES[code] ?? 'The licence could not be generated.')
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export async function generateLicence(input: GenerateLicenceInput): Promise<GeneratedLicence> {
  const { data, error } = await getSupabaseClient().functions.invoke<GeneratedLicence>('generate-licence', {
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
    throw new LicenceApiError(code, fieldErrors)
  }
  return data
}

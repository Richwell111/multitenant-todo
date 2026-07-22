import { captureUsage } from '../diagnostics/diagnosticsService'
import { registerCompany, RegistrationApiError, type RegistrationResult } from './registrationRepository'
import { validateRegistrationForm, type RegistrationFormInput } from './registrationSchemas'

export async function submitRegistration(input: RegistrationFormInput): Promise<RegistrationResult> {
  try {
    const validation = validateRegistrationForm(input)
    if (!validation.ok) throw new RegistrationValidationError(validation.errors)
    const result = await registerCompany(validation.value)
    captureUsage('company.registration_succeeded', { module_key: 'registration', action_name: 'register_company', success: true })
    return result
  } catch (error) {
    const safeErrorCode = error instanceof RegistrationValidationError
      ? 'VALIDATION_ERROR'
      : error instanceof RegistrationApiError ? error.code : 'REGISTRATION_FAILED'
    captureUsage('company.registration_failed', {
      module_key: 'registration',
      action_name: 'register_company',
      safe_error_code: safeErrorCode,
      success: false,
    })
    if (error instanceof RegistrationApiError) {
      captureUsage('licence.redemption_failed', {
        module_key: 'licensing',
        action_name: 'redeem_licence',
        safe_error_code: error.code,
        success: false,
      })
    }
    throw error
  }
}

export class RegistrationValidationError extends Error {
  readonly fieldErrors: Record<string, string>
  constructor(fieldErrors: Record<string, string>) {
    super('Correct the highlighted fields.')
    this.fieldErrors = fieldErrors
  }
}

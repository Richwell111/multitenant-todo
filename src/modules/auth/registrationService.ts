import { registerCompany, type RegistrationResult } from './registrationRepository'
import { validateRegistrationForm, type RegistrationFormInput } from './registrationSchemas'

export async function submitRegistration(input: RegistrationFormInput): Promise<RegistrationResult> {
  const validation = validateRegistrationForm(input)
  if (!validation.ok) throw new RegistrationValidationError(validation.errors)
  return registerCompany(validation.value)
}

export class RegistrationValidationError extends Error {
  readonly fieldErrors: Record<string, string>

  constructor(fieldErrors: Record<string, string>) {
    super('Correct the highlighted fields.')
    this.fieldErrors = fieldErrors
  }
}

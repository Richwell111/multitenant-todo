import {
  canonicalizeLicenceKey,
  validateCompanyName,
  validateEmail,
  validateWorkspaceSlug,
} from '../../../supabase/functions/_shared/licence.ts'

export { suggestWorkspaceSlug } from '../../../supabase/functions/_shared/licence.ts'

export interface RegistrationFormInput {
  companyName: string
  companyEmail: string
  password: string
  workspaceSlug: string
  licenceKey: string
}

export type NormalizedRegistrationInput = RegistrationFormInput

export function validateRegistrationForm(input: RegistrationFormInput):
  | { ok: true; value: NormalizedRegistrationInput }
  | { ok: false; errors: Record<string, string> } {
  const companyName = validateCompanyName(input.companyName)
  const companyEmail = validateEmail(input.companyEmail)
  const workspaceSlug = validateWorkspaceSlug(input.workspaceSlug)
  const licenceKey = canonicalizeLicenceKey(input.licenceKey)
  const errors: Record<string, string> = {}
  if (!companyName) errors.companyName = 'Enter a Company Name of 1 to 200 characters.'
  if (!companyEmail) errors.companyEmail = 'Enter a valid email address.'
  if (!workspaceSlug.ok) errors.workspaceSlug = workspaceSlug.reason === 'reserved'
    ? 'Choose another workspace slug.' : 'Use 3 to 63 letters, digits, or single hyphens.'
  if (!licenceKey) errors.licenceKey = 'Enter a valid licence key.'
  if (input.password.length < 6) errors.password = 'Password must contain at least 6 characters.'
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      companyName: companyName!, companyEmail: companyEmail!, password: input.password,
      workspaceSlug: workspaceSlug.ok ? workspaceSlug.value : '', licenceKey: licenceKey!,
    },
  }
}


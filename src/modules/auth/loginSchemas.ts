import { validateEmail } from '../../../supabase/functions/_shared/licence.ts'

export interface LoginFormInput {
  email: string
  password: string
}

export function validateLoginForm(input: LoginFormInput):
  | { ok: true; value: LoginFormInput }
  | { ok: false; errors: Record<string, string> } {
  const email = validateEmail(input.email)
  const errors: Record<string, string> = {}
  if (!email) errors.email = 'Enter a valid email address.'
  if (input.password.length === 0) errors.password = 'Enter your password.'
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { email: email!, password: input.password } }
}

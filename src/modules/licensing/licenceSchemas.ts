import {
  expiryDateToInstant,
  validateCompanyName,
} from '../../../supabase/functions/_shared/licence.ts'

export interface GenerateLicenceInput {
  companyName: string
  expiryDate: string
  status: 'available' | 'revoked'
}

export function validateLicenceForm(input: GenerateLicenceInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!validateCompanyName(input.companyName)) errors.companyName = 'Enter a Company Name of 1 to 200 characters.'
  if (!expiryDateToInstant(input.expiryDate)) errors.expiryDate = 'Choose today or a future date.'
  if (!['available', 'revoked'].includes(input.status)) errors.status = 'Choose Available or Revoked.'
  return errors
}

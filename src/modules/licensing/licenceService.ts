import { normalizeCompanyName } from '../../../supabase/functions/_shared/licence.ts'
import { captureUsage } from '../diagnostics/diagnosticsService'
import { generateLicence, type GeneratedLicence } from './licenceRepository'
import { validateLicenceForm, type GenerateLicenceInput } from './licenceSchemas'

export async function submitLicence(input: GenerateLicenceInput): Promise<GeneratedLicence> {
  const errors = validateLicenceForm(input)
  if (Object.keys(errors).length > 0) throw new LicenceValidationError(errors)
  const generated = await generateLicence({ ...input, companyName: normalizeCompanyName(input.companyName) })
  captureUsage('licence.generated', { module_key: 'licensing', action_name: 'generate_licence', success: true })
  return generated
}

export class LicenceValidationError extends Error {
  readonly fieldErrors: Record<string, string>
  constructor(fieldErrors: Record<string, string>) {
    super('Correct the highlighted fields.')
    this.fieldErrors = fieldErrors
  }
}

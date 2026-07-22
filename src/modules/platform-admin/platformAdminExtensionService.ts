import type { Account } from '../auth/authService'
import { captureUsage } from '../diagnostics/diagnosticsService'
import { listCompanies, type PlatformAdminCompany } from './platformAdminRepository'
import { listCompanyExtensionAssignments, listExtensions, setPrivateExtensionAssignment, type CompanyExtensionAssignment } from './platformAdminExtensionRepository'
import type { ExtensionRecord } from '../extensions/extensionRepository'

export type PlatformAdminExtensionSnapshot = {
  extensions: ExtensionRecord[]
  assignments: CompanyExtensionAssignment[]
  companies: PlatformAdminCompany[]
}

export class PlatformAdminExtensionServiceError extends Error {
  readonly code: 'FORBIDDEN' | 'LOAD_FAILED' | 'INVALID_ASSIGNMENT' | 'ASSIGNMENT_FAILED'
  constructor(code: PlatformAdminExtensionServiceError['code'], message: string) {
    super(message); this.name = 'PlatformAdminExtensionServiceError'; this.code = code
  }
}

export const PRIVATE_EXTENSION_ID = '22222222-2222-4222-8222-222222222222'

export const DISABLEMENT_REASONS = [
  'no_longer_needed',
  'too_complex',
  'performance_problem',
  'missing_expected_functionality',
  'replaced_by_other_process',
  'cost_concern',
  'temporary_pause',
  'other',
] as const

export type DisablementReason = (typeof DISABLEMENT_REASONS)[number]

function requireAdmin(account: Account | null): asserts account is Extract<Account, { kind: 'platform-admin' }> {
  if (!account || account.kind !== 'platform-admin') throw new PlatformAdminExtensionServiceError('FORBIDDEN', 'Platform Admin access is required.')
}

export async function loadPlatformAdminExtensions(account: Account | null): Promise<PlatformAdminExtensionSnapshot> {
  requireAdmin(account)
  try {
    const [extensions, assignments, companies] = await Promise.all([listExtensions(), listCompanyExtensionAssignments(), listCompanies()])
    return { extensions, assignments, companies }
  } catch { throw new PlatformAdminExtensionServiceError('LOAD_FAILED', 'Extension assignments could not be loaded. Try again.') }
}

export async function setPlatformAdminPrivateAssignment(account: Account | null, companyId: string, extensionId: string, enabled: boolean, disabledReason: DisablementReason | null = null): Promise<CompanyExtensionAssignment> {
  requireAdmin(account)
  if (extensionId !== PRIVATE_EXTENSION_ID || !/^[0-9a-f-]{36}$/i.test(companyId)) throw new PlatformAdminExtensionServiceError('INVALID_ASSIGNMENT', 'That extension assignment is not available.')
  if (!enabled && !disabledReason) throw new PlatformAdminExtensionServiceError('INVALID_ASSIGNMENT', 'A disablement reason is required.')
  if (enabled && disabledReason) throw new PlatformAdminExtensionServiceError('INVALID_ASSIGNMENT', 'An enabled assignment cannot include a disablement reason.')
  if (disabledReason && !DISABLEMENT_REASONS.includes(disabledReason)) throw new PlatformAdminExtensionServiceError('INVALID_ASSIGNMENT', 'That disablement reason is not available.')
  try {
    const companies = await listCompanies()
    if (!companies.some((company) => company.id === companyId)) throw new PlatformAdminExtensionServiceError('INVALID_ASSIGNMENT', 'That Company is not available.')
    const assignment = await setPrivateExtensionAssignment(companyId, extensionId, enabled, disabledReason)
    captureUsage(enabled ? 'feature.assignment_enabled' : 'feature.assignment_disabled', {
      module_key: 'extensions',
      extension_key: 'priority-labels-demo',
      action_name: enabled ? 'enable_assignment' : 'disable_assignment',
      success: true,
    })
    return assignment
  } catch (error) {
    if (error instanceof PlatformAdminExtensionServiceError) throw error
    captureUsage('extension.action_failed', { module_key: 'extensions', extension_key: 'priority-labels-demo', action_name: 'set_assignment', safe_error_code: 'ASSIGNMENT_FAILED', success: false })
    throw new PlatformAdminExtensionServiceError('ASSIGNMENT_FAILED', 'The extension assignment could not be changed.')
  }
}

import type { Account } from '../auth/authService'
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
  constructor(code: 'FORBIDDEN' | 'LOAD_FAILED' | 'INVALID_ASSIGNMENT' | 'ASSIGNMENT_FAILED', message: string) {
    super(message)
    this.name = 'PlatformAdminExtensionServiceError'
    this.code = code
  }
}

export const PRIVATE_EXTENSION_ID = '22222222-2222-4222-8222-222222222222'

function requireAdmin(account: Account | null): asserts account is Extract<Account, { kind: 'platform-admin' }> {
  if (!account || account.kind !== 'platform-admin') throw new PlatformAdminExtensionServiceError('FORBIDDEN', 'Platform Admin access is required.')
}

export async function loadPlatformAdminExtensions(account: Account | null): Promise<PlatformAdminExtensionSnapshot> {
  requireAdmin(account)
  try {
    const [extensions, assignments, companies] = await Promise.all([listExtensions(), listCompanyExtensionAssignments(), listCompanies()])
    return { extensions, assignments, companies }
  } catch {
    throw new PlatformAdminExtensionServiceError('LOAD_FAILED', 'Extension assignments could not be loaded. Try again.')
  }
}

export async function setPlatformAdminPrivateAssignment(account: Account | null, companyId: string, extensionId: string, enabled: boolean): Promise<CompanyExtensionAssignment> {
  requireAdmin(account)
  if (extensionId !== PRIVATE_EXTENSION_ID || !/^[0-9a-f-]{36}$/i.test(companyId)) throw new PlatformAdminExtensionServiceError('INVALID_ASSIGNMENT', 'That extension assignment is not available.')
  try {
    const companies = await listCompanies()
    if (!companies.some((company) => company.id === companyId)) throw new PlatformAdminExtensionServiceError('INVALID_ASSIGNMENT', 'That Company is not available.')
    return await setPrivateExtensionAssignment(companyId, extensionId, enabled)
  } catch (error) {
    if (error instanceof PlatformAdminExtensionServiceError) throw error
    throw new PlatformAdminExtensionServiceError('ASSIGNMENT_FAILED', 'The extension assignment could not be changed.')
  }
}

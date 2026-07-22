import type { Account } from '../auth/authService'
import { captureUsage } from '../diagnostics/diagnosticsService'
import { submitLicence } from '../licensing/licenceService'
import type { GenerateLicenceInput } from '../licensing/licenceSchemas'
import type { GeneratedLicence } from '../licensing/licenceRepository'
import { listCompanies, listLicences, updateCompanyStatus, type CompanyStatus, type PlatformAdminCompany, type PlatformAdminLicence } from './platformAdminRepository'

export type PlatformAdminSnapshot = {
  companies: PlatformAdminCompany[]
  licences: Array<PlatformAdminLicence & { displayStatus: PlatformAdminLicence['status'] }>
  counts: {
    totalCompanies: number
    activeCompanies: number
    suspendedCompanies: number
    totalLicences: number
    availableLicences: number
    redeemedLicences: number
    expiredLicences: number
    revokedLicences: number
  }
}

export class PlatformAdminServiceError extends Error {
  readonly code: 'FORBIDDEN' | 'LOAD_FAILED' | 'INVALID_STATUS' | 'STATUS_UNCHANGED' | 'STATUS_UPDATE_FAILED'
  constructor(code: PlatformAdminServiceError['code'], message: string) {
    super(message); this.code = code; this.name = 'PlatformAdminServiceError'
  }
}

function requireAdmin(account: Account | null): asserts account is Extract<Account, { kind: 'platform-admin' }> {
  if (!account || account.kind !== 'platform-admin') throw new PlatformAdminServiceError('FORBIDDEN', 'Platform Admin access is required')
}

function displayStatus(licence: PlatformAdminLicence, now: Date): PlatformAdminLicence['status'] {
  return licence.status === 'available' && Date.parse(licence.expiresAt) <= now.getTime() ? 'expired' : licence.status
}

export async function loadDashboard(account: Account | null, now = new Date()): Promise<PlatformAdminSnapshot> {
  requireAdmin(account)
  try {
    const [companies, licences] = await Promise.all([listCompanies(), listLicences()])
    const displayed = licences.map((licence) => ({ ...licence, displayStatus: displayStatus(licence, now) }))
    return {
      companies,
      licences: displayed,
      counts: {
        totalCompanies: companies.length,
        activeCompanies: companies.filter((company) => company.status === 'active').length,
        suspendedCompanies: companies.filter((company) => company.status === 'suspended').length,
        totalLicences: displayed.length,
        availableLicences: displayed.filter((licence) => licence.displayStatus === 'available').length,
        redeemedLicences: displayed.filter((licence) => licence.displayStatus === 'redeemed').length,
        expiredLicences: displayed.filter((licence) => licence.displayStatus === 'expired').length,
        revokedLicences: displayed.filter((licence) => licence.displayStatus === 'revoked').length,
      },
    }
  } catch { throw new PlatformAdminServiceError('LOAD_FAILED', 'Unable to load Platform Admin data') }
}

export async function changeCompanyStatus(account: Account | null, company: PlatformAdminCompany, nextStatus: string): Promise<PlatformAdminCompany> {
  requireAdmin(account)
  if (nextStatus !== 'active' && nextStatus !== 'suspended') throw new PlatformAdminServiceError('INVALID_STATUS', 'Invalid Company status')
  if (company.status === nextStatus) throw new PlatformAdminServiceError('STATUS_UNCHANGED', 'Company already has that status')
  try {
    const updated = await updateCompanyStatus(company.id, nextStatus as CompanyStatus)
    captureUsage(nextStatus === 'suspended' ? 'admin.company_suspended' : 'admin.company_reactivated', {
      module_key: 'platform-admin',
      action_name: nextStatus === 'suspended' ? 'suspend_company' : 'reactivate_company',
      success: true,
    })
    return updated
  } catch { throw new PlatformAdminServiceError('STATUS_UPDATE_FAILED', 'Unable to update Company status') }
}

export async function generateLicence(account: Account | null, input: GenerateLicenceInput): Promise<GeneratedLicence> {
  requireAdmin(account)
  const generated = await submitLicence(input)
  captureUsage('admin.licence_generated', { module_key: 'platform-admin', action_name: 'generate_licence', success: true })
  return generated
}

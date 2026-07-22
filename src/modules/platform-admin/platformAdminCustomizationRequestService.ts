import type { Account } from '../auth/authService'
import { CORE_FEATURE_REGISTRY } from './coreFeatureRegistry'
import { listCompanies, type PlatformAdminCompany } from './platformAdminRepository'
import { listCompanyExtensionAssignments, listExtensions, type CompanyExtensionAssignment } from './platformAdminExtensionRepository'
import { listCustomizationRequests, type CustomizationRequestRecord } from './platformAdminCustomizationRequestRepository'
import type { ExtensionRecord } from '../extensions/extensionRepository'

export type CompanyAvailability = 'not_available' | 'available' | 'available_not_enabled' | 'enabled' | 'disabled'
export type CustomizationRequestStatus = 'requested' | 'under_review' | 'approved' | 'rejected' | 'postponed'
export type CustomizationDevelopmentStatus = 'not_started' | 'specification' | 'in_development' | 'testing' | 'completed'
export type CustomizationDeploymentStatus = 'not_deployed' | 'ready_to_deploy' | 'deployed' | 'failed'
export type CustomizationClassification = 'core' | 'shared_feature' | 'private_customization' | 'configuration' | 'rejected_or_postponed'

export type CustomizationRequest = CustomizationRequestRecord & {
  companyName: string
  featureName: string | null
  availability: CompanyAvailability
  classification: CustomizationClassification
  requestStatus: CustomizationRequestStatus
  developmentStatus: CustomizationDevelopmentStatus
  deploymentStatus: CustomizationDeploymentStatus
}

export class PlatformAdminCustomizationRequestServiceError extends Error {
  readonly code: 'FORBIDDEN' | 'LOAD_FAILED'
  constructor(code: PlatformAdminCustomizationRequestServiceError['code'], message: string) {
    super(message)
    this.name = 'PlatformAdminCustomizationRequestServiceError'
    this.code = code
  }
}

const CLASSIFICATIONS = new Set<CustomizationClassification>(['core', 'shared_feature', 'private_customization', 'configuration', 'rejected_or_postponed'])
const REQUEST_STATUSES = new Set<CustomizationRequestStatus>(['requested', 'under_review', 'approved', 'rejected', 'postponed'])
const DEVELOPMENT_STATUSES = new Set<CustomizationDevelopmentStatus>(['not_started', 'specification', 'in_development', 'testing', 'completed'])
const DEPLOYMENT_STATUSES = new Set<CustomizationDeploymentStatus>(['not_deployed', 'ready_to_deploy', 'deployed', 'failed'])

function requireAdmin(account: Account | null): asserts account is Extract<Account, { kind: 'platform-admin' }> {
  if (!account || account.kind !== 'platform-admin') throw new PlatformAdminCustomizationRequestServiceError('FORBIDDEN', 'Platform Admin access is required.')
}

function safeEnum<T extends string>(value: string, allowed: Set<T>): T {
  if (!allowed.has(value as T)) throw new PlatformAdminCustomizationRequestServiceError('LOAD_FAILED', 'Customization requests could not be loaded. Try again.')
  return value as T
}

function deriveAvailability(request: CustomizationRequestRecord, extension: ExtensionRecord | undefined, assignments: CompanyExtensionAssignment[]): CompanyAvailability {
  const coreMatch = request.classification === 'core' && CORE_FEATURE_REGISTRY.some((feature) => feature.status === 'active')
  if (coreMatch) return 'available'
  if (!extension || !extension.isActive) return 'not_available'
  if (extension.availabilityType === 'shared') return 'available'
  const assignment = request.requestingCompanyId
    ? assignments.find((candidate) => candidate.companyId === request.requestingCompanyId && candidate.extensionId === extension.id)
    : undefined
  if (!assignment) return 'available_not_enabled'
  return assignment.enabled ? 'enabled' : 'disabled'
}

export async function loadCustomizationRequests(account: Account | null): Promise<CustomizationRequest[]> {
  requireAdmin(account)
  try {
    const [requests, companies, extensions, assignments] = await Promise.all([
      listCustomizationRequests(),
      listCompanies(),
      listExtensions(),
      listCompanyExtensionAssignments(),
    ])
    const companyNameById = new Map(companies.map((company) => [company.id, company.name]))
    const extensionById = new Map(extensions.map((extension) => [extension.id, extension]))
    return requests.map((request) => {
      const extension = request.extensionId ? extensionById.get(request.extensionId) : undefined
      return {
        ...request,
        requestedOutcome: request.requestedOutcome.trim(),
        targetRelease: request.targetRelease?.trim() || null,
        companyName: request.requestingCompanyId ? companyNameById.get(request.requestingCompanyId) ?? 'Unknown Company' : 'Platform request',
        featureName: extension?.name ?? null,
        availability: deriveAvailability(request, extension, assignments),
        classification: safeEnum(request.classification, CLASSIFICATIONS),
        requestStatus: safeEnum(request.requestStatus, REQUEST_STATUSES),
        developmentStatus: safeEnum(request.developmentStatus, DEVELOPMENT_STATUSES),
        deploymentStatus: safeEnum(request.deploymentStatus, DEPLOYMENT_STATUSES),
      }
    })
  } catch (error) {
    if (error instanceof PlatformAdminCustomizationRequestServiceError) throw error
    throw new PlatformAdminCustomizationRequestServiceError('LOAD_FAILED', 'Customization requests could not be loaded. Try again.')
  }
}

export type { PlatformAdminCompany }
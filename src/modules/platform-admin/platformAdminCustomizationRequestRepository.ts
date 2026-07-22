import { getSupabaseClient } from '../../infrastructure/supabase/client'

export type CustomizationRequestRecord = {
  id: string
  requestingCompanyId: string | null
  extensionId: string | null
  requestedOutcome: string
  classification: string
  requestStatus: string
  developmentStatus: string
  deploymentStatus: string
  targetRelease: string | null
  requestedAt: string
  updatedAt: string
}

export class PlatformAdminCustomizationRequestRepositoryError extends Error {
  readonly code = 'QUERY_FAILED' as const
  constructor() {
    super('Customization requests could not be loaded.')
    this.name = 'PlatformAdminCustomizationRequestRepositoryError'
  }
}

export async function listCustomizationRequests(): Promise<CustomizationRequestRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('feature_requests')
    .select('id, requesting_company_id, extension_id, requested_outcome, classification, request_status, development_status, deployment_status, target_release, requested_at, updated_at')
    .order('requested_at', { ascending: false })
  if (error) throw new PlatformAdminCustomizationRequestRepositoryError()
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    requestingCompanyId: row.requesting_company_id == null ? null : String(row.requesting_company_id),
    extensionId: row.extension_id == null ? null : String(row.extension_id),
    requestedOutcome: String(row.requested_outcome).trim(),
    classification: String(row.classification),
    requestStatus: String(row.request_status),
    developmentStatus: String(row.development_status),
    deploymentStatus: String(row.deployment_status),
    targetRelease: row.target_release == null ? null : String(row.target_release).trim(),
    requestedAt: String(row.requested_at),
    updatedAt: String(row.updated_at),
  }))
}
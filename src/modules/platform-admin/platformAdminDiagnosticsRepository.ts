import { getSupabaseClient } from '../../infrastructure/supabase/client'

export type ExtensionAssignmentEventRecord = {
  id: string
  companyId: string
  extensionId: string
  enabled: boolean
  changedAt: string
  disabledReason: string | null
  actorId: string | null
}

export type FeatureRequestRecord = {
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

export type ReleaseRecord = {
  id: string
  version: string
  environment: string
  releasedAt: string
}

export class PlatformAdminDiagnosticsRepositoryError extends Error {
  readonly code = 'QUERY_FAILED' as const
  constructor() {
    super('Diagnostics data could not be loaded.')
    this.name = 'PlatformAdminDiagnosticsRepositoryError'
  }
}

export async function listExtensionAssignmentEvents(): Promise<ExtensionAssignmentEventRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('extension_assignment_events')
    .select('id, company_id, extension_id, enabled, changed_at, disabled_reason, actor_id')
    .order('changed_at', { ascending: false })
    .limit(25)
  if (error) throw new PlatformAdminDiagnosticsRepositoryError()
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    companyId: String(row.company_id),
    extensionId: String(row.extension_id),
    enabled: Boolean(row.enabled),
    changedAt: String(row.changed_at),
    disabledReason: row.disabled_reason == null ? null : String(row.disabled_reason),
    actorId: row.actor_id == null ? null : String(row.actor_id),
  }))
}

export async function listFeatureRequests(): Promise<FeatureRequestRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('feature_requests')
    .select('id, requesting_company_id, extension_id, requested_outcome, classification, request_status, development_status, deployment_status, target_release, requested_at, updated_at')
    .order('requested_at', { ascending: false })
  if (error) throw new PlatformAdminDiagnosticsRepositoryError()
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    requestingCompanyId: row.requesting_company_id == null ? null : String(row.requesting_company_id),
    extensionId: row.extension_id == null ? null : String(row.extension_id),
    requestedOutcome: String(row.requested_outcome),
    classification: String(row.classification),
    requestStatus: String(row.request_status),
    developmentStatus: String(row.development_status),
    deploymentStatus: String(row.deployment_status),
    targetRelease: row.target_release == null ? null : String(row.target_release),
    requestedAt: String(row.requested_at),
    updatedAt: String(row.updated_at),
  }))
}

export async function listReleaseRecords(): Promise<ReleaseRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('release_records')
    .select('id, version, environment, released_at')
    .order('released_at', { ascending: false })
    .limit(25)
  if (error) throw new PlatformAdminDiagnosticsRepositoryError()
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    version: String(row.version),
    environment: String(row.environment),
    releasedAt: String(row.released_at),
  }))
}
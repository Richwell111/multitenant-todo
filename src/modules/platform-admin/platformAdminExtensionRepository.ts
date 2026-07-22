import { getSupabaseClient } from '../../infrastructure/supabase/client'
import type { ExtensionAvailability, ExtensionRecord } from '../extensions/extensionRepository'

export type CompanyExtensionAssignment = {
  companyId: string
  extensionId: string
  enabled: boolean
  createdAt: string
}

export class PlatformAdminExtensionRepositoryError extends Error {
  readonly code: 'QUERY_FAILED' | 'NOT_FOUND'
  constructor(code: 'QUERY_FAILED' | 'NOT_FOUND') {
    super(code)
    this.name = 'PlatformAdminExtensionRepositoryError'
    this.code = code
  }
}

const EXTENSION_COLUMNS = 'id, key, name, description, availability_type, is_active'
const ASSIGNMENT_COLUMNS = 'company_id, extension_id, enabled, created_at'

function mapExtension(row: Record<string, unknown>): ExtensionRecord {
  return { id: String(row.id), key: String(row.key), name: String(row.name), description: row.description == null ? null : String(row.description), availabilityType: row.availability_type as ExtensionAvailability, isActive: Boolean(row.is_active) }
}

function mapAssignment(row: Record<string, unknown>): CompanyExtensionAssignment {
  return { companyId: String(row.company_id), extensionId: String(row.extension_id), enabled: Boolean(row.enabled), createdAt: String(row.created_at) }
}

export async function listExtensions(): Promise<ExtensionRecord[]> {
  const { data, error } = await getSupabaseClient().from('extensions').select(EXTENSION_COLUMNS).order('created_at', { ascending: true })
  if (error) throw new PlatformAdminExtensionRepositoryError('QUERY_FAILED')
  return ((data ?? []) as Record<string, unknown>[]).map(mapExtension)
}

export async function listCompanyExtensionAssignments(): Promise<CompanyExtensionAssignment[]> {
  const { data, error } = await getSupabaseClient().from('company_extensions').select(ASSIGNMENT_COLUMNS).order('created_at', { ascending: true })
  if (error) throw new PlatformAdminExtensionRepositoryError('QUERY_FAILED')
  return ((data ?? []) as Record<string, unknown>[]).map(mapAssignment)
}

export async function setPrivateExtensionAssignment(
  companyId: string,
  extensionId: string,
  enabled: boolean,
  disabledReason: string | null,
): Promise<CompanyExtensionAssignment> {
  const { data, error } = await getSupabaseClient().rpc('set_private_extension_assignment', {
    p_company_id: companyId,
    p_extension_id: extensionId,
    p_enabled: enabled,
    p_disabled_reason: disabledReason,
  }).single()
  if (error || !data) throw new PlatformAdminExtensionRepositoryError(error ? 'QUERY_FAILED' : 'NOT_FOUND')
  return mapAssignment(data as Record<string, unknown>)
}
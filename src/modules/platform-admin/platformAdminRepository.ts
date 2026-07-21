import { getSupabaseClient } from '../../infrastructure/supabase/client'

export type CompanyStatus = 'active' | 'suspended'
export type StoredLicenceStatus = 'available' | 'redeemed' | 'expired' | 'revoked'

export type PlatformAdminCompany = {
  id: string
  name: string
  email: string
  slug: string
  status: CompanyStatus
  createdAt: string
}

export type PlatformAdminLicence = {
  id: string
  companyName: string
  keyPrefix: string
  status: StoredLicenceStatus
  expiresAt: string
  createdAt: string
  redeemedAt: string | null
}

export class PlatformAdminRepositoryError extends Error {
  readonly code: 'QUERY_FAILED' | 'NOT_FOUND'
  constructor(code: 'QUERY_FAILED' | 'NOT_FOUND', message: string) {
    super(message)
    this.code = code
    this.name = 'PlatformAdminRepositoryError'
  }
}

const COMPANY_COLUMNS = 'id, name, email, slug, status, created_at'
const LICENCE_COLUMNS = 'id, company_name, key_prefix, status, expires_at, created_at, redeemed_at'

function mapCompany(row: Record<string, unknown>): PlatformAdminCompany {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    slug: String(row.slug),
    status: row.status as CompanyStatus,
    createdAt: String(row.created_at),
  }
}

function mapLicence(row: Record<string, unknown>): PlatformAdminLicence {
  return {
    id: String(row.id),
    companyName: String(row.company_name),
    keyPrefix: String(row.key_prefix),
    status: row.status as StoredLicenceStatus,
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    redeemedAt: row.redeemed_at ? String(row.redeemed_at) : null,
  }
}

export async function listCompanies(): Promise<PlatformAdminCompany[]> {
  const { data, error } = await getSupabaseClient()
    .from('companies')
    .select(COMPANY_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw new PlatformAdminRepositoryError('QUERY_FAILED', 'Unable to load Companies')
  return (data ?? []).map((row) => mapCompany(row as Record<string, unknown>))
}

export async function listLicences(): Promise<PlatformAdminLicence[]> {
  const { data, error } = await getSupabaseClient()
    .from('licences')
    .select(LICENCE_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw new PlatformAdminRepositoryError('QUERY_FAILED', 'Unable to load licences')
  return (data ?? []).map((row) => mapLicence(row as Record<string, unknown>))
}

export async function updateCompanyStatus(companyId: string, status: CompanyStatus): Promise<PlatformAdminCompany> {
  const { data, error } = await getSupabaseClient()
    .from('companies')
    .update({ status })
    .eq('id', companyId)
    .select(COMPANY_COLUMNS)
    .maybeSingle()
  if (error) throw new PlatformAdminRepositoryError('QUERY_FAILED', 'Unable to update Company status')
  if (!data) throw new PlatformAdminRepositoryError('NOT_FOUND', 'Company not found')
  return mapCompany(data as Record<string, unknown>)
}

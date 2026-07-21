import { getSupabaseClient } from '../../infrastructure/supabase/client'
import { listCurrentCompanyTasks, type TaskRecord } from '../tasks/taskRepository'

export type ExtensionAvailability = 'shared' | 'private'

export type ExtensionRecord = {
  id: string
  key: string
  name: string
  description: string | null
  availabilityType: ExtensionAvailability
  isActive: boolean
}

export type TaskNotesSummary = {
  totalWithDescriptions: number
  totalWithoutDescriptions: number
  completedWithDescriptions: number
}

export type ExtensionRepositoryErrorCode = 'AUTH_REQUIRED' | 'QUERY_FAILED' | 'NOT_FOUND'

export class ExtensionRepositoryError extends Error {
  readonly code: ExtensionRepositoryErrorCode
  constructor(code: ExtensionRepositoryErrorCode) {
    super(code)
    this.name = 'ExtensionRepositoryError'
    this.code = code
  }
}

const EXTENSION_COLUMNS = 'id, key, name, description, availability_type, is_active'

function mapExtension(row: Record<string, unknown>): ExtensionRecord {
  return {
    id: String(row.id),
    key: String(row.key),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    availabilityType: row.availability_type as ExtensionAvailability,
    isActive: Boolean(row.is_active),
  }
}

export async function listVisibleExtensions(): Promise<ExtensionRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('extensions')
    .select(EXTENSION_COLUMNS)
    .order('created_at', { ascending: true })
  if (error) throw new ExtensionRepositoryError('QUERY_FAILED')
  return ((data ?? []) as Record<string, unknown>[]).map(mapExtension)
}

export async function loadTaskNotesSummary(): Promise<TaskNotesSummary> {
  let tasks: TaskRecord[]
  try {
    tasks = await listCurrentCompanyTasks()
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') throw new ExtensionRepositoryError('AUTH_REQUIRED')
    throw new ExtensionRepositoryError('QUERY_FAILED')
  }
  const withDescriptions = tasks.filter((task) => Boolean(task.description?.trim()))
  return {
    totalWithDescriptions: withDescriptions.length,
    totalWithoutDescriptions: tasks.length - withDescriptions.length,
    completedWithDescriptions: withDescriptions.filter((task) => task.status === 'completed').length,
  }
}

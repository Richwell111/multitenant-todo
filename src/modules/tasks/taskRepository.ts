import { getSupabaseClient } from '../../infrastructure/supabase/client'
import type { TaskStatus } from './taskSchemas'

export interface TaskRecord {
  id: string
  companyId: string
  title: string
  description: string | null
  status: TaskStatus
  createdAt: string
}

export interface TaskWriteInput {
  title: string
  description: string | null
}

export type TaskRepositoryErrorCode = 'AUTH_REQUIRED' | 'QUERY_FAILED' | 'NOT_FOUND'

export class TaskRepositoryError extends Error {
  readonly code: TaskRepositoryErrorCode
  readonly cause?: unknown

  constructor(code: TaskRepositoryErrorCode, cause?: unknown) {
    super(code)
    this.name = 'TaskRepositoryError'
    this.code = code
    this.cause = cause
  }
}

const TASK_COLUMNS = 'id, company_id, title, description, status, created_at'

async function currentCompanyId(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error || !data.session?.user.id) throw new TaskRepositoryError('AUTH_REQUIRED', error)
  return data.session.user.id
}

function mapTask(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    status: row.status as TaskStatus,
    createdAt: String(row.created_at),
  }
}

export async function listCurrentCompanyTasks(): Promise<TaskRecord[]> {
  const companyId = await currentCompanyId()
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw new TaskRepositoryError('QUERY_FAILED', error)
  return ((data ?? []) as Record<string, unknown>[]).map(mapTask)
}

export async function createTask(input: TaskWriteInput): Promise<TaskRecord> {
  const companyId = await currentCompanyId()
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .insert({ company_id: companyId, title: input.title, description: input.description })
    .select(TASK_COLUMNS)
    .single()
  if (error || !data) throw new TaskRepositoryError('QUERY_FAILED', error)
  return mapTask(data as Record<string, unknown>)
}

export async function updateTask(taskId: string, input: TaskWriteInput): Promise<TaskRecord> {
  const companyId = await currentCompanyId()
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .update({ title: input.title, description: input.description })
    .eq('id', taskId)
    .eq('company_id', companyId)
    .select(TASK_COLUMNS)
    .maybeSingle()
  if (error) throw new TaskRepositoryError('QUERY_FAILED', error)
  if (!data) throw new TaskRepositoryError('NOT_FOUND')
  return mapTask(data as Record<string, unknown>)
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<TaskRecord> {
  const companyId = await currentCompanyId()
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .eq('company_id', companyId)
    .select(TASK_COLUMNS)
    .maybeSingle()
  if (error) throw new TaskRepositoryError('QUERY_FAILED', error)
  if (!data) throw new TaskRepositoryError('NOT_FOUND')
  return mapTask(data as Record<string, unknown>)
}

export async function deleteTask(taskId: string): Promise<void> {
  const companyId = await currentCompanyId()
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('company_id', companyId)
    .select('id')
    .maybeSingle()
  if (error) throw new TaskRepositoryError('QUERY_FAILED', error)
  if (!data) throw new TaskRepositoryError('NOT_FOUND')
}

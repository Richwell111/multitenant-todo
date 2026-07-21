import {
  createTask as repositoryCreateTask,
  deleteTask as repositoryDeleteTask,
  listCurrentCompanyTasks as repositoryListTasks,
  TaskRepositoryError,
  updateTask as repositoryUpdateTask,
  updateTaskStatus as repositoryUpdateTaskStatus,
  type TaskRecord,
} from './taskRepository'
import {
  normalizeTaskInput,
  validateTaskStatus,
  type NormalizedTaskInput,
  type TaskInput,
  type TaskStatus,
} from './taskSchemas'

export type TaskServiceErrorCode = 'TASK_ACCESS_DENIED' | 'TASK_NOT_FOUND' | 'TASK_LOAD_FAILED' | 'TASK_CREATE_FAILED' | 'TASK_UPDATE_FAILED' | 'TASK_DELETE_FAILED'

export class TaskServiceError extends Error {
  readonly code: TaskServiceErrorCode

  constructor(code: TaskServiceErrorCode) {
    super({
      TASK_ACCESS_DENIED: 'You cannot access these tasks.',
      TASK_NOT_FOUND: 'That task is no longer available.',
      TASK_LOAD_FAILED: 'Tasks could not be loaded. Try again.',
      TASK_CREATE_FAILED: 'The task could not be created. Try again.',
      TASK_UPDATE_FAILED: 'The task could not be updated. Try again.',
      TASK_DELETE_FAILED: 'The task could not be deleted. Try again.',
    }[code])
    this.name = 'TaskServiceError'
    this.code = code
  }
}

function mapError(error: unknown, fallback: TaskServiceErrorCode): TaskServiceError {
  if (error instanceof TaskRepositoryError) {
    if (error.code === 'AUTH_REQUIRED') return new TaskServiceError('TASK_ACCESS_DENIED')
    if (error.code === 'NOT_FOUND') return new TaskServiceError('TASK_NOT_FOUND')
  }
  return new TaskServiceError(fallback)
}

export function normalizeTask(task: TaskInput): NormalizedTaskInput {
  return normalizeTaskInput(task)
}

export async function listTasks(): Promise<TaskRecord[]> {
  try {
    return await repositoryListTasks()
  } catch (error) {
    throw mapError(error, 'TASK_LOAD_FAILED')
  }
}

export async function createTask(input: TaskInput): Promise<TaskRecord> {
  const normalized = normalizeTaskInput(input)
  try {
    return await repositoryCreateTask(normalized)
  } catch (error) {
    throw mapError(error, 'TASK_CREATE_FAILED')
  }
}

export async function updateTask(taskId: string, input: TaskInput): Promise<TaskRecord> {
  const normalized = normalizeTaskInput(input)
  try {
    return await repositoryUpdateTask(taskId, normalized)
  } catch (error) {
    throw mapError(error, 'TASK_UPDATE_FAILED')
  }
}

export async function updateTaskStatus(taskId: string, status: string): Promise<TaskRecord> {
  validateTaskStatus(status)
  try {
    return await repositoryUpdateTaskStatus(taskId, status as TaskStatus)
  } catch (error) {
    throw mapError(error, 'TASK_UPDATE_FAILED')
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  try {
    await repositoryDeleteTask(taskId)
  } catch (error) {
    throw mapError(error, 'TASK_DELETE_FAILED')
  }
}

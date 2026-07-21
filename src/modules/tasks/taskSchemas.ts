export const TASK_STATUSES = ['pending', 'completed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export interface TaskInput {
  title: string
  description?: string | null
}

export interface NormalizedTaskInput {
  title: string
  description: string | null
}

export interface TaskFieldErrors {
  title?: string
  description?: string
  status?: string
}

export class TaskValidationError extends Error {
  readonly fieldErrors: TaskFieldErrors

  constructor(fieldErrors: TaskFieldErrors) {
    super('Correct the highlighted task fields.')
    this.name = 'TaskValidationError'
    this.fieldErrors = fieldErrors
  }
}

export function normalizeTaskInput(input: TaskInput): NormalizedTaskInput {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const errors: TaskFieldErrors = {}

  if (!title) errors.title = 'Title is required.'
  else if (title.length > 120) errors.title = 'Title must be 120 characters or fewer.'
  if (description.length > 1000) errors.description = 'Description must be 1000 characters or fewer.'
  if (Object.keys(errors).length) throw new TaskValidationError(errors)

  return { title, description: description || null }
}

export function validateTaskStatus(status: string): asserts status is TaskStatus {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    throw new TaskValidationError({ status: 'Choose a valid task status.' })
  }
}

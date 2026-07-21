import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({
  listCurrentCompanyTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('./taskRepository', async () => ({
  ...(await vi.importActual<typeof import('./taskRepository')>('./taskRepository')),
  ...repository,
}))

import { createTask, listTasks, TaskServiceError, updateTaskStatus } from './taskService'

beforeEach(() => vi.clearAllMocks())

describe('task service', () => {
  it('normalizes input before creating', async () => {
    repository.createTask.mockResolvedValue({ id: 't1' })
    await createTask({ title: '  Task  ', description: '  details  ' })
    expect(repository.createTask).toHaveBeenCalledWith({ title: 'Task', description: 'details' })
  })

  it('rejects an invalid status before calling the repository', async () => {
    await expect(updateTaskStatus('t1', 'invalid')).rejects.toMatchObject({ fieldErrors: { status: 'Choose a valid task status.' } })
    expect(repository.updateTaskStatus).not.toHaveBeenCalled()
  })

  it('maps repository failures to safe messages', async () => {
    const { TaskRepositoryError } = await import('./taskRepository')
    repository.listCurrentCompanyTasks.mockRejectedValue(new TaskRepositoryError('QUERY_FAILED'))
    await expect(listTasks()).rejects.toMatchObject({
      code: 'TASK_LOAD_FAILED',
      message: 'Tasks could not be loaded. Try again.',
    })
    repository.createTask.mockRejectedValue(new TaskRepositoryError('AUTH_REQUIRED'))
    await expect(createTask({ title: 'Task' })).rejects.toMatchObject({
      code: 'TASK_ACCESS_DENIED',
    } satisfies Partial<TaskServiceError>)
  })
})


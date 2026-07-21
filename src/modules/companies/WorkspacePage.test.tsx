import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspacePage from './WorkspacePage'

const taskService = vi.hoisted(() => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
}))
const auth = vi.hoisted(() => ({
  account: { kind: 'company', name: 'Alpha Limited', workspaceSlug: 'alpha', status: 'active' } as const,
  signOut: vi.fn(),
}))

vi.mock('../auth/authContext', () => ({ useAuth: () => ({ status: 'ready', account: auth.account, signOut: auth.signOut, signIn: vi.fn() }) }))
vi.mock('../tasks/taskService', async () => ({ ...(await vi.importActual<typeof import('../tasks/taskService')>('../tasks/taskService')), ...taskService }))

const initialTasks = [
  { id: 't1', companyId: 'company-1', title: 'First task', description: 'Details', status: 'pending', createdAt: '2026-01-01T00:00:00Z' },
  { id: 't2', companyId: 'company-1', title: 'Done task', description: null, status: 'completed', createdAt: '2026-01-02T00:00:00Z' },
] as const

function renderWorkspace() {
  return render(<MemoryRouter initialEntries={['/workspace/alpha']}><Routes><Route path="/workspace/:slug" element={<WorkspacePage />} /></Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  taskService.listTasks.mockResolvedValue([...initialTasks])
  taskService.createTask.mockResolvedValue(initialTasks[0])
  taskService.updateTask.mockResolvedValue(initialTasks[0])
  taskService.updateTaskStatus.mockResolvedValue(initialTasks[0])
  taskService.deleteTask.mockResolvedValue(undefined)
  vi.stubGlobal('confirm', vi.fn(() => true))
})

describe('Workspace Todo dashboard', () => {
  it('loads tasks and displays total, pending, and completed counts', async () => {
    renderWorkspace()
    expect(await screen.findByText('First task')).toBeInTheDocument()
    expect(screen.getByText('Total: 2')).toBeInTheDocument()
    expect(screen.getByText('Pending: 1')).toBeInTheDocument()
    expect(screen.getByText('Completed: 1')).toBeInTheDocument()
  })

  it('creates a trimmed task and refreshes the list', async () => {
    renderWorkspace()
    await screen.findByText('First task')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  New task  ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '  Description  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))
    await waitFor(() => expect(taskService.createTask).toHaveBeenCalledWith({ title: '  New task  ', description: '  Description  ' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Task created.')
    expect(taskService.listTasks).toHaveBeenCalledTimes(2)
  })

  it('supports edit, completion toggle, and delete actions', async () => {
    renderWorkspace()
    await screen.findByText('First task')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    fireEvent.change(screen.getByLabelText('Title', { selector: '#edit-title-t1' }), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(taskService.updateTask).toHaveBeenCalledWith('t1', { title: 'Updated', description: 'Details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }))
    await waitFor(() => expect(taskService.updateTaskStatus).toHaveBeenCalledWith('t1', 'completed'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => expect(taskService.deleteTask).toHaveBeenCalledWith('t1'))
  })

  it('shows a safe retry state when loading fails', async () => {
    taskService.listTasks.mockRejectedValueOnce(new Error('database details'))
    renderWorkspace()
    expect(await screen.findByRole('alert')).toHaveTextContent('Tasks could not be loaded. Try again.')
    expect(screen.queryByText('database details')).not.toBeInTheDocument()
    taskService.listTasks.mockResolvedValueOnce([])
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/No tasks yet/)).toBeInTheDocument()
  })
})


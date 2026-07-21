import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { evaluateWorkspaceAccess } from '../auth/authService'
import {
  createTask,
  deleteTask,
  listTasks,
  TaskServiceError,
  updateTask,
  updateTaskStatus,
} from '../tasks/taskService'
import type { TaskRecord } from '../tasks/taskRepository'
import ExtensionsSection from '../extensions/ExtensionsSection'

function WorkspacePage() {
  const { slug } = useParams<{ slug: string }>()
  const { status, account, signOut } = useAuth()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pendingAction, setPendingAction] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({})
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)

  const access = evaluateWorkspaceAccess(account, slug)

  useEffect(() => {
    if (status !== 'ready' || access !== 'allowed') return
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      setLoadError(null)
      try {
        const loaded = await listTasks()
        if (active) setTasks(loaded)
      } catch (error: unknown) {
        if (active) setLoadError(error instanceof TaskServiceError ? error.message : 'Tasks could not be loaded. Try again.')
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [access, account, status])

  const counts = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
  }), [tasks])

  if (status === 'loading') return <main><h1>Workspace</h1><p>Checking your session…</p></main>
  if (access === 'unauthenticated') return <Navigate to="/login" replace />
  if (access !== 'allowed') {
    return (
      <main>
        <h1>Workspace</h1>
        <p role="alert">{AUTH_MESSAGES[access]}</p>
        <button type="button" onClick={() => void signOut()}>Log out</button>
      </main>
    )
  }

  const company = account as Extract<NonNullable<typeof account>, { kind: 'company' }>

  async function refreshTasks() {
    setLoadError(null)
    try { setTasks(await listTasks()) }
    catch (error: unknown) { setLoadError(error instanceof TaskServiceError ? error.message : 'Tasks could not be loaded. Try again.') }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setActionError(null); setSuccess(null); setFieldErrors({}); setPendingAction(true)
    try {
      await createTask({ title, description })
      setTitle(''); setDescription(''); setSuccess('Task created.'); await refreshTasks()
    } catch (error: unknown) {
      if (error instanceof TaskServiceError) setActionError(error.message)
      else if (error && typeof error === 'object' && 'fieldErrors' in error) setFieldErrors((error as { fieldErrors: Record<string, string> }).fieldErrors)
      else setActionError('The task could not be created. Try again.')
    } finally { setPendingAction(false) }
  }

  function beginEdit(task: TaskRecord) {
    setEditingId(task.id); setEditTitle(task.title); setEditDescription(task.description ?? ''); setEditFieldErrors({}); setActionError(null); setSuccess(null)
  }

  async function handleEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingId) return
    setActionError(null); setSuccess(null); setEditFieldErrors({}); setPendingTaskId(editingId)
    try {
      await updateTask(editingId, { title: editTitle, description: editDescription })
      setEditingId(null); setSuccess('Task updated.'); await refreshTasks()
    } catch (error: unknown) {
      if (error instanceof TaskServiceError) setActionError(error.message)
      else if (error && typeof error === 'object' && 'fieldErrors' in error) setEditFieldErrors((error as { fieldErrors: Record<string, string> }).fieldErrors)
      else setActionError('The task could not be updated. Try again.')
    } finally { setPendingTaskId(null) }
  }

  async function changeStatus(task: TaskRecord) {
    setActionError(null); setSuccess(null); setPendingTaskId(task.id)
    try {
      await updateTaskStatus(task.id, task.status === 'pending' ? 'completed' : 'pending')
      setSuccess(task.status === 'pending' ? 'Task completed.' : 'Task returned to pending.')
      await refreshTasks()
    } catch (error: unknown) { setActionError(error instanceof TaskServiceError ? error.message : 'The task could not be updated. Try again.') }
    finally { setPendingTaskId(null) }
  }

  async function removeTask(task: TaskRecord) {
    if (!window.confirm(`Delete “${task.title}”?`)) return
    setActionError(null); setSuccess(null); setPendingTaskId(task.id)
    try { await deleteTask(task.id); setSuccess('Task deleted.'); await refreshTasks() }
    catch (error: unknown) { setActionError(error instanceof TaskServiceError ? error.message : 'The task could not be deleted. Try again.') }
    finally { setPendingTaskId(null) }
  }

  return (
    <main>
      <header>
        <h1>{company.name}</h1>
        <p>You are signed in to the {company.name} workspace.</p>
        <button type="button" onClick={() => void signOut()}>Log out</button>
      </header>
      <section aria-labelledby="dashboard-heading">
        <h2 id="dashboard-heading">Todo dashboard</h2>
        <div aria-label="Task counts">
          <span>Total: {counts.total}</span>{' '}<span>Pending: {counts.pending}</span>{' '}<span>Completed: {counts.completed}</span>
        </div>
      </section>
      <section aria-labelledby="create-task-heading">
        <h2 id="create-task-heading">Create Task</h2>
        <form onSubmit={(event) => void handleCreate(event)}>
          <label htmlFor="task-title">Title</label>
          <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={pendingAction} />
          {fieldErrors.title && <p role="alert">{fieldErrors.title}</p>}
          <label htmlFor="task-description">Description</label>
          <textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={pendingAction} />
          {fieldErrors.description && <p role="alert">{fieldErrors.description}</p>}
          <button type="submit" disabled={pendingAction}>{pendingAction ? 'Creating…' : 'Create Task'}</button>
        </form>
      </section>
      {success && <p role="status">{success}</p>}
      {actionError && <p role="alert">{actionError}</p>}
      <ExtensionsSection account={company} />
      <section aria-labelledby="tasks-heading">
        <h2 id="tasks-heading">Tasks</h2>
        {loading && <p role="status">Loading tasks…</p>}
        {loadError && <div role="alert"><p>{loadError}</p><button type="button" onClick={() => void refreshTasks()}>Retry</button></div>}
        {!loading && !loadError && tasks.length === 0 && <p>No tasks yet. Create your first task above.</p>}
        {!loading && !loadError && tasks.length > 0 && <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              {editingId === task.id ? (
                <form onSubmit={(event) => void handleEdit(event)}>
                  <label htmlFor={`edit-title-${task.id}`}>Title</label>
                  <input id={`edit-title-${task.id}`} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={pendingTaskId === task.id} />
                  {editFieldErrors.title && <p role="alert">{editFieldErrors.title}</p>}
                  <label htmlFor={`edit-description-${task.id}`}>Description</label>
                  <textarea id={`edit-description-${task.id}`} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} disabled={pendingTaskId === task.id} />
                  {editFieldErrors.description && <p role="alert">{editFieldErrors.description}</p>}
                  <button type="submit" disabled={pendingTaskId === task.id}>Save</button>
                  <button type="button" onClick={() => setEditingId(null)} disabled={pendingTaskId === task.id}>Cancel</button>
                </form>
              ) : (
                <>
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                  <p>Status: {task.status}</p>
                  <button type="button" onClick={() => beginEdit(task)}>Edit</button>{' '}
                  <button type="button" onClick={() => void changeStatus(task)} disabled={pendingTaskId === task.id}>{task.status === 'pending' ? 'Mark completed' : 'Return to pending'}</button>{' '}
                  <button type="button" onClick={() => void removeTask(task)} disabled={pendingTaskId === task.id}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>}
      </section>
    </main>
  )
}

export default WorkspacePage

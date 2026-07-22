import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { captureUsage } from '../diagnostics/diagnosticsService'
import { AUTH_MESSAGES } from '../auth/authRepository'
import { evaluateWorkspaceAccess } from '../auth/authService'
import { createTask, deleteTask, listTasks, TaskServiceError, updateTask, updateTaskStatus } from '../tasks/taskService'
import type { TaskRecord } from '../tasks/taskRepository'
import ExtensionsSection from '../extensions/ExtensionsSection'
import { AppPageShell, PageHeader } from '../../shared/ui'

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
  const workspaceViewed = useRef(false)
  const access = evaluateWorkspaceAccess(account, slug)

  useEffect(() => {
    if (status !== 'ready' || access !== 'allowed') return
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true); setLoadError(null)
      try { const loaded = await listTasks(); if (active) { setTasks(loaded); if (!workspaceViewed.current) { workspaceViewed.current = true; captureUsage('todo.workspace_viewed', { module_key: 'todo', action_name: 'workspace_viewed', success: true }) } } }
      catch (error: unknown) { if (active) setLoadError(error instanceof TaskServiceError ? error.message : 'Tasks could not be loaded. Try again.') }
      finally { if (active) setLoading(false) }
    })
    return () => { active = false }
  }, [access, account, status])

  const counts = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
  }), [tasks])

  if (status === 'loading') return <main className="auth-layout"><section className="auth-card state-card"><h1>Workspace</h1><p className="muted">Checking your session...</p></section></main>
  if (access === 'unauthenticated') return <Navigate to="/login" replace />
  if (access !== 'allowed') return <main className="auth-layout"><section className="auth-card"><header><h1>Workspace</h1><p className="muted">This workspace is not available for the current account.</p></header><p className="alert alert-error" role="alert">{AUTH_MESSAGES[access]}</p><div className="form-actions"><button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button></div></section></main>

  const company = account as Extract<NonNullable<typeof account>, { kind: 'company' }>

  async function refreshTasks() {
    setLoadError(null)
    try { setTasks(await listTasks()) }
    catch (error: unknown) { setLoadError(error instanceof TaskServiceError ? error.message : 'Tasks could not be loaded. Try again.') }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setActionError(null); setSuccess(null); setFieldErrors({}); setPendingAction(true)
    try { await createTask({ title, description }); setTitle(''); setDescription(''); setSuccess('Task created.'); await refreshTasks() }
    catch (error: unknown) {
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
    try { await updateTask(editingId, { title: editTitle, description: editDescription }); setEditingId(null); setSuccess('Task updated.'); await refreshTasks() }
    catch (error: unknown) {
      if (error instanceof TaskServiceError) setActionError(error.message)
      else if (error && typeof error === 'object' && 'fieldErrors' in error) setEditFieldErrors((error as { fieldErrors: Record<string, string> }).fieldErrors)
      else setActionError('The task could not be updated. Try again.')
    } finally { setPendingTaskId(null) }
  }

  async function changeStatus(task: TaskRecord) {
    setActionError(null); setSuccess(null); setPendingTaskId(task.id)
    try { await updateTaskStatus(task.id, task.status === 'pending' ? 'completed' : 'pending'); setSuccess(task.status === 'pending' ? 'Task completed.' : 'Task returned to pending.'); await refreshTasks() }
    catch (error: unknown) { setActionError(error instanceof TaskServiceError ? error.message : 'The task could not be updated. Try again.') }
    finally { setPendingTaskId(null) }
  }

  async function removeTask(task: TaskRecord) {
    if (!window.confirm('Delete this task?')) return
    setActionError(null); setSuccess(null); setPendingTaskId(task.id)
    try { await deleteTask(task.id); setSuccess('Task deleted.'); await refreshTasks() }
    catch (error: unknown) { setActionError(error instanceof TaskServiceError ? error.message : 'The task could not be deleted. Try again.') }
    finally { setPendingTaskId(null) }
  }

  return (
    <AppPageShell>
      <PageHeader title={company.name} description={`You are signed in to the ${company.name} workspace.`} actions={<button className="button-secondary" type="button" onClick={() => void signOut()}>Log out</button>} />
      <section className="section-card" aria-labelledby="dashboard-heading">
        <div className="section-heading"><h2 id="dashboard-heading">Todo dashboard</h2><span className="muted">Your current workload</span></div>
        <div className="summary-grid" aria-label="Task counts"><div className="summary-card"><span className="summary-label">Total: {counts.total}</span></div><div className="summary-card"><span className="summary-label">Pending: {counts.pending}</span></div><div className="summary-card"><span className="summary-label">Completed: {counts.completed}</span></div></div>
      </section>
      <section className="section-card" aria-labelledby="create-task-heading">
        <div className="section-heading"><h2 id="create-task-heading">Create task</h2><span className="muted">Keep it focused and actionable.</span></div>
        <form className="form-stack" onSubmit={(event) => void handleCreate(event)}>
          <div className="field"><label htmlFor="task-title">Title</label><input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={pendingAction} />{fieldErrors.title && <p className="field-error" role="alert">{fieldErrors.title}</p>}</div>
          <div className="field"><label htmlFor="task-description">Description</label><textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={pendingAction} />{fieldErrors.description && <p className="field-error" role="alert">{fieldErrors.description}</p>}</div>
          <div className="form-actions"><button type="submit" disabled={pendingAction}>{pendingAction ? 'Creating...' : 'Create Task'}</button></div>
        </form>
      </section>
      {success && <p className="alert alert-success" role="status">{success}</p>}{actionError && <p className="alert alert-error" role="alert">{actionError}</p>}
      <ExtensionsSection account={company} />
      <section className="section-card" aria-labelledby="tasks-heading">
        <div className="section-heading"><h2 id="tasks-heading">Tasks</h2><span className="muted">{tasks.length} total</span></div>
        {loading && <p className="state" role="status">Loading tasks...</p>}
        {loadError && <div className="alert alert-error" role="alert"><p>{loadError}</p><div className="state-actions"><button className="button-secondary" type="button" onClick={() => void refreshTasks()}>Retry</button></div></div>}
        {!loading && !loadError && tasks.length === 0 && <p className="state">No tasks yet. Create your first task above.</p>}
        {!loading && !loadError && tasks.length > 0 && <ul className="task-list">{tasks.map((task) => <li className="task-card" key={task.id}>{editingId === task.id ? <form className="form-stack" onSubmit={(event) => void handleEdit(event)}><div className="field"><label htmlFor={'edit-title-' + task.id}>Title</label><input id={'edit-title-' + task.id} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} disabled={pendingTaskId === task.id} />{editFieldErrors.title && <p className="field-error" role="alert">{editFieldErrors.title}</p>}</div><div className="field"><label htmlFor={'edit-description-' + task.id}>Description</label><textarea id={'edit-description-' + task.id} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} disabled={pendingTaskId === task.id} />{editFieldErrors.description && <p className="field-error" role="alert">{editFieldErrors.description}</p>}</div><div className="task-actions"><button type="submit" disabled={pendingTaskId === task.id}>Save</button><button className="button-secondary" type="button" onClick={() => setEditingId(null)} disabled={pendingTaskId === task.id}>Cancel</button></div></form> : <><div className="task-card-header"><h3>{task.title}</h3></div>{task.description && <p className="task-description">{task.description}</p>}<p className="task-meta">Created {new Date(task.createdAt).toLocaleDateString()}</p><p className="task-meta"><span className="status-badge">Status: {task.status}</span></p><div className="task-actions"><button className="button-secondary button-inline" type="button" onClick={() => beginEdit(task)}>Edit</button><button className="button-inline" type="button" onClick={() => void changeStatus(task)} disabled={pendingTaskId === task.id}>{task.status === 'pending' ? 'Mark completed' : 'Return to pending'}</button><button className="button-danger button-inline" type="button" onClick={() => void removeTask(task)} disabled={pendingTaskId === task.id}>Delete</button></div></>}</li>)}</ul>}
      </section>
    </AppPageShell>
  )
}

export default WorkspacePage

import { useCallback, useEffect, useState } from 'react'
import type { Account } from '../auth/authService'
import { ExtensionServiceError, listCompanyExtensions, loadTaskNotesSummary } from './extensionService'
import type { TaskNotesSummary, VisibleExtension } from './extensionService'

function ExtensionsSection({ account }: { account: Extract<Account, { kind: 'company' }> }) {
  const [extensions, setExtensions] = useState<VisibleExtension[]>([])
  const [summary, setSummary] = useState<TaskNotesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const visible = await listCompanyExtensions(account)
      setExtensions(visible)
      if (visible.some((extension) => extension.key === 'task-notes-summary')) setSummary(await loadTaskNotesSummary(account))
      else setSummary(null)
    } catch (error: unknown) {
      setError(error instanceof ExtensionServiceError ? error.message : 'Extensions could not be loaded. Try again.')
    } finally { setLoading(false) }
  }, [account])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  if (loading) return <section aria-labelledby="extensions-heading"><h2 id="extensions-heading">Extensions</h2><p aria-live="polite">Loading extensions...</p></section>
  if (error) return <section aria-labelledby="extensions-heading"><h2 id="extensions-heading">Extensions</h2><p role="alert">{error}</p><button type="button" onClick={() => void refresh()}>Retry</button></section>

  const shared = extensions.find((extension) => extension.key === 'task-notes-summary')
  const privateExtension = extensions.find((extension) => extension.key === 'priority-labels-demo')
  return <section aria-labelledby="extensions-heading"><h2 id="extensions-heading">Extensions</h2>
    {shared && <article><h3>{shared.name}</h3><p>{shared.description}</p>{summary && summary.totalWithDescriptions + summary.totalWithoutDescriptions === 0 ? <p>No tasks yet.</p> : summary && <ul><li>Tasks with descriptions: {summary.totalWithDescriptions}</li><li>Tasks without descriptions: {summary.totalWithoutDescriptions}</li><li>Completed tasks with descriptions: {summary.completedWithDescriptions}</li></ul>}</article>}
    {privateExtension ? <article><h3>{privateExtension.name}</h3><p>Private extension proof enabled for this Company.</p><p>This read-only demonstration does not change Todo data.</p></article> : <p>No private extensions are enabled for this Company.</p>}
    {!shared && !privateExtension && <p>No extensions are available.</p>}
  </section>
}

export default ExtensionsSection

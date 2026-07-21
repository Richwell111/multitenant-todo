import type { Account } from '../auth/authService'
import { loadTaskNotesSummary as repositoryLoadSummary, listVisibleExtensions, type ExtensionRecord, type TaskNotesSummary } from './extensionRepository'

export type { TaskNotesSummary } from './extensionRepository'

export type SupportedExtensionKey = 'task-notes-summary' | 'priority-labels-demo'
export type VisibleExtension = ExtensionRecord & { key: SupportedExtensionKey }

export class ExtensionServiceError extends Error {
  readonly code: 'FORBIDDEN' | 'LOAD_FAILED' | 'UNKNOWN_EXTENSION'
  constructor(code: 'FORBIDDEN' | 'LOAD_FAILED' | 'UNKNOWN_EXTENSION', message: string) {
    super(message)
    this.name = 'ExtensionServiceError'
    this.code = code
  }
}

const SUPPORTED_KEYS = new Set<SupportedExtensionKey>(['task-notes-summary', 'priority-labels-demo'])

function requireActiveCompany(account: Account | null): asserts account is Extract<Account, { kind: 'company' }> {
  if (!account || account.kind !== 'company' || account.status !== 'active') throw new ExtensionServiceError('FORBIDDEN', 'Extensions are not available for this account.')
}

function mapSupported(record: ExtensionRecord): VisibleExtension | null {
  if (!SUPPORTED_KEYS.has(record.key as SupportedExtensionKey)) return null
  if (!record.isActive) return null
  return { ...record, key: record.key as SupportedExtensionKey }
}

export async function listCompanyExtensions(account: Account | null): Promise<VisibleExtension[]> {
  requireActiveCompany(account)
  try {
    return (await listVisibleExtensions()).map(mapSupported).filter((extension): extension is VisibleExtension => extension !== null)
  } catch {
    throw new ExtensionServiceError('LOAD_FAILED', 'Extensions could not be loaded. Try again.')
  }
}

export async function loadTaskNotesSummary(account: Account | null): Promise<TaskNotesSummary> {
  requireActiveCompany(account)
  try {
    return await repositoryLoadSummary()
  } catch {
    throw new ExtensionServiceError('LOAD_FAILED', 'Task Notes Summary could not be loaded. Try again.')
  }
}

import type { Account } from '../auth/authService'
import { getPostHogConfig } from '../diagnostics/posthogAdapter'
import { getSentryConfig } from '../diagnostics/sentryAdapter'
import { loadPlatformAdminExtensions, type PlatformAdminExtensionSnapshot } from './platformAdminExtensionService'
import {
  listExtensionAssignmentEvents,
  listFeatureRequests,
  listReleaseRecords,
  type ExtensionAssignmentEventRecord,
  type FeatureRequestRecord,
  type ReleaseRecord,
} from './platformAdminDiagnosticsRepository'

export type PlatformAdminDiagnosticsSnapshot = {
  appVersion: string
  environment: string
  sentryConfigured: boolean
  posthogConfigured: boolean
  assignmentEvents: Array<ExtensionAssignmentEventRecord & { companyName: string; extensionName: string }>
  featureRequests: Array<FeatureRequestRecord & { companyName: string; extensionName: string | null }>
  releaseRecords: ReleaseRecord[]
  enabledAssignmentsByFeature: Array<{ extensionId: string; extensionName: string; enabledCompanyCount: number }>
}

export class PlatformAdminDiagnosticsServiceError extends Error {
  readonly code: 'FORBIDDEN' | 'LOAD_FAILED'
  constructor(code: PlatformAdminDiagnosticsServiceError['code'], message: string) {
    super(message)
    this.name = 'PlatformAdminDiagnosticsServiceError'
    this.code = code
  }
}

function requireAdmin(account: Account | null): asserts account is Extract<Account, { kind: 'platform-admin' }> {
  if (!account || account.kind !== 'platform-admin') throw new PlatformAdminDiagnosticsServiceError('FORBIDDEN', 'Platform Admin access is required.')
}

export async function loadPlatformAdminDiagnostics(account: Account | null): Promise<PlatformAdminDiagnosticsSnapshot> {
  requireAdmin(account)
  try {
    const [events, requests, releases, extensions] = await Promise.all([
      listExtensionAssignmentEvents(),
      listFeatureRequests(),
      listReleaseRecords(),
      loadPlatformAdminExtensions(account),
    ])
    return mapSnapshot(events, requests, releases, extensions)
  } catch {
    throw new PlatformAdminDiagnosticsServiceError('LOAD_FAILED', 'Diagnostics could not be loaded. Try again.')
  }
}

export function mapSnapshot(
  events: ExtensionAssignmentEventRecord[],
  requests: FeatureRequestRecord[],
  releases: ReleaseRecord[],
  extensions: PlatformAdminExtensionSnapshot,
): PlatformAdminDiagnosticsSnapshot {
  const companyNameById = new Map(extensions.companies.map((company) => [company.id, company.name]))
  const extensionNameById = new Map(extensions.extensions.map((extension) => [extension.id, extension.name]))
  const enabledCounts = new Map<string, number>()
  for (const assignment of extensions.assignments) {
    if (assignment.enabled) enabledCounts.set(assignment.extensionId, (enabledCounts.get(assignment.extensionId) ?? 0) + 1)
  }

  return {
    appVersion: import.meta.env.VITE_APP_VERSION || 'local',
    environment: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
    sentryConfigured: Boolean(getSentryConfig().enabled && getSentryConfig().dsn),
    posthogConfigured: Boolean(getPostHogConfig().enabled && getPostHogConfig().key && getPostHogConfig().host),
    assignmentEvents: events.map((event) => ({
      ...event,
      companyName: companyNameById.get(event.companyId) ?? 'Unknown Company',
      extensionName: extensionNameById.get(event.extensionId) ?? 'Unknown feature',
    })),
    featureRequests: requests.map((request) => ({
      ...request,
      companyName: request.requestingCompanyId ? companyNameById.get(request.requestingCompanyId) ?? 'Unknown Company' : 'Platform request',
      extensionName: request.extensionId ? extensionNameById.get(request.extensionId) ?? 'Unknown feature' : null,
    })),
    releaseRecords: releases,
    enabledAssignmentsByFeature: extensions.extensions.map((extension) => ({
      extensionId: extension.id,
      extensionName: extension.name,
      enabledCompanyCount: enabledCounts.get(extension.id) ?? 0,
    })),
  }
}
export const DIAGNOSTICS_EVENTS = [
  'auth.login_succeeded',
  'auth.login_failed',
  'auth.logout',
  'auth.session_restored',
  'company.registration_succeeded',
  'company.registration_failed',
  'licence.generated',
  'licence.redemption_failed',
  'todo.workspace_viewed',
  'todo.task_created',
  'todo.task_updated',
  'todo.task_completed',
  'todo.task_reopened',
  'todo.task_deleted',
  'admin.dashboard_viewed',
  'admin.overview_viewed',
  'admin.companies_viewed',
  'admin.licences_viewed',
  'admin.features_viewed',
  'admin.diagnostics_viewed',
  'admin.customization_requests_viewed',
  'feature.assignment_enabled',
  'feature.assignment_disabled',
  'admin.company_suspended',
  'admin.company_reactivated',
  'admin.licence_generated',
  'extension.visible',
  'extension.opened',
  'extension.assignment_enabled',
  'extension.assignment_disabled',
  'extension.load_failed',
  'extension.action_failed',
] as const

export type DiagnosticsEventName = (typeof DIAGNOSTICS_EVENTS)[number]
export type AccountKind = 'company' | 'platform-admin'

export type DiagnosticsPrimitive = string | number | boolean
export type DiagnosticsProperties = Record<string, DiagnosticsPrimitive>

export interface DiagnosticsProvider {
  identify: (distinctId: string, properties: DiagnosticsProperties) => void
  reset: () => void
  capture: (event: DiagnosticsEventName, properties: DiagnosticsProperties) => void
  captureFailure?: (error: Error, properties: DiagnosticsProperties) => void
}

const ALLOWED_PROPERTY_KEYS = new Set([
  'account_kind',
  'route_name',
  'module_key',
  'extension_key',
  'action_name',
  'safe_error_code',
  'success',
  'duration_ms',
  'release_version',
  'environment',
  'timestamp',
])

export function sanitizeDiagnosticsProperties(input: Record<string, unknown>): DiagnosticsProperties {
  const output: DiagnosticsProperties = {}
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
    output[key] = value
  }
  return output
}

export function noOpDiagnosticsProvider(): DiagnosticsProvider {
  return {
    identify: () => undefined,
    reset: () => undefined,
    capture: () => undefined,
    captureFailure: () => undefined,
  }
}

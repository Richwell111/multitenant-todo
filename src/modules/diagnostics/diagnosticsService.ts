import { createPostHogAdapter } from './posthogAdapter'
import { createSentryAdapter } from './sentryAdapter'
import {
  noOpDiagnosticsProvider,
  sanitizeDiagnosticsProperties,
  type AccountKind,
  type DiagnosticsEventName,
  type DiagnosticsProperties,
  type DiagnosticsProvider,
} from './diagnosticsTypes'

let providers: DiagnosticsProvider[] = [noOpDiagnosticsProvider()]
let initialized = false

function runtimeIsTest(): boolean {
  const env = import.meta.env as ImportMetaEnv & { VITEST?: boolean | string }
  return env.MODE === 'test' || env.VITEST === true || env.VITEST === 'true'
}

function releaseMetadata(): DiagnosticsProperties {
  return {
    release_version: import.meta.env.VITE_APP_VERSION || 'local',
    environment: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
  }
}

export function initializeDiagnostics(): void {
  if (initialized) return
  initialized = true
  if (runtimeIsTest()) return
  const configuredProviders = [createPostHogAdapter(), createSentryAdapter()].filter(
    (candidate): candidate is DiagnosticsProvider => candidate !== null,
  )
  providers = configuredProviders.length > 0 ? configuredProviders : [noOpDiagnosticsProvider()]
}

function forEachProvider(callback: (provider: DiagnosticsProvider) => void): void {
  for (const provider of providers) {
    try { callback(provider) } catch { /* diagnostics must never affect application behavior */ }
  }
}

export function identifyAccount(accountKind: AccountKind, authUserId: string): void {
  initializeDiagnostics()
  const distinctId = (accountKind === 'company' ? 'company' : 'platform-admin') + ':' + authUserId
  const properties = sanitizeDiagnosticsProperties({
    account_kind: accountKind,
    ...releaseMetadata(),
  })
  forEachProvider((provider) => provider.identify(distinctId, properties))
}

export function clearIdentity(): void {
  initializeDiagnostics()
  forEachProvider((provider) => provider.reset())
}

export function captureUsage(event: DiagnosticsEventName, properties: Record<string, unknown> = {}): void {
  initializeDiagnostics()
  const safeProperties = sanitizeDiagnosticsProperties({
    ...properties,
    ...releaseMetadata(),
    timestamp: new Date().toISOString(),
  })
  forEachProvider((provider) => provider.capture(event, safeProperties))
}

export function captureFailure(moduleKey: string, safeErrorCode: string, actionName?: string): void {
  initializeDiagnostics()
  const safeProperties = sanitizeDiagnosticsProperties({
    module_key: moduleKey,
    safe_error_code: safeErrorCode,
    ...(actionName ? { action_name: actionName } : {}),
    success: false,
    timestamp: new Date().toISOString(),
    ...releaseMetadata(),
  })
  const safeError = new Error('diagnostics failure')
  forEachProvider((provider) => provider.captureFailure?.(safeError, safeProperties))
}

export function captureSafeFailure(moduleKey: string, safeErrorCode: string, actionName?: string): void {
  captureFailure(moduleKey, safeErrorCode, actionName)
  captureUsage('extension.action_failed', {
    module_key: moduleKey,
    safe_error_code: safeErrorCode,
    ...(actionName ? { action_name: actionName } : {}),
    success: false,
  })
}

export function configureDiagnosticsForTests(nextProvider: DiagnosticsProvider | null): void {
  initialized = true
  providers = [nextProvider ?? noOpDiagnosticsProvider()]
}

export function resetDiagnosticsForTests(): void {
  initialized = false
  providers = [noOpDiagnosticsProvider()]
}
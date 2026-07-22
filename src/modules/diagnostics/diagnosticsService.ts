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

// External providers must never receive the raw account UUID (spec 008 §7). The
// distinct id is a stable SHA-256 digest of a diagnostics-namespaced UUID.
const DIAGNOSTICS_IDENTITY_NAMESPACE = 'todo-saas.diagnostics.v1'

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function pseudonymousDistinctId(accountKind: AccountKind, authUserId: string): Promise<string> {
  const prefix = accountKind === 'company' ? 'company' : 'platform-admin'
  const digest = await sha256Hex(`${DIAGNOSTICS_IDENTITY_NAMESPACE}:${authUserId}`)
  return `${prefix}:${digest}`
}

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

export async function identifyAccount(accountKind: AccountKind, authUserId: string): Promise<void> {
  initializeDiagnostics()
  try {
    const distinctId = await pseudonymousDistinctId(accountKind, authUserId)
    const properties = sanitizeDiagnosticsProperties({
      account_kind: accountKind,
      ...releaseMetadata(),
    })
    forEachProvider((provider) => provider.identify(distinctId, properties))
  } catch {
    /* diagnostics must never affect application behavior */
  }
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
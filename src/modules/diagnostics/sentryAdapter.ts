import * as Sentry from '@sentry/react'
import type { ErrorEvent, Event } from '@sentry/react'
import type { DiagnosticsEventName, DiagnosticsProperties, DiagnosticsProvider } from './diagnosticsTypes'

export interface SentryConfig {
  enabled: boolean
  dsn: string
  releaseVersion: string
  environment: string
  supabaseOrigin: string
  isTestEnvironment?: boolean
}

const SAFE_TAG_KEYS = new Set([
  'account_kind',
  'module_key',
  'extension_key',
  'route_name',
  'safe_error_code',
  'release_version',
  'environment',
])

const SAFE_EXTRA_KEYS = new Set([
  ...SAFE_TAG_KEYS,
  'action_name',
  'success',
  'duration_ms',
  'timestamp',
])

const FORBIDDEN_KEYS = new Set([
  'password',
  'email',
  'username',
  'companyname',
  'workspace',
  'slug',
  'title',
  'description',
  'task',
  'licence',
  'license',
  'licencekey',
  'licensekey',
  'keyhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'setcookie',
  'requestbody',
  'responsebody',
  'rawerror',
  'ip',
  'ipaddress',
  'query',
  'querystring',
  'headers',
  'url',
  'href',
  'stack',
  'message',
  'value',
])

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '')
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function sanitizeRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeRecord)
  if (!value || typeof value !== 'object') return isPrimitive(value) ? value : undefined
  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizedKey(key))) continue
    const sanitized = sanitizeRecord(child)
    if (sanitized !== undefined) output[key] = sanitized
  }
  return output
}

function sanitizeSafeProperties(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (!SAFE_EXTRA_KEYS.has(key) || !isPrimitive(child)) continue
    output[key] = child
  }
  return output
}

function sanitizeException(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const output: Record<string, unknown> = {}
  const values = Array.isArray(source.values) ? source.values : []
  const first = values[0]
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    const firstValue = first as Record<string, unknown>
    const safeValue: Record<string, unknown> = {}
    if (typeof firstValue.type === 'string') safeValue.type = firstValue.type.slice(0, 80)
    if (firstValue.mechanism && typeof firstValue.mechanism === 'object' && !Array.isArray(firstValue.mechanism)) {
      const mechanism = firstValue.mechanism as Record<string, unknown>
      safeValue.mechanism = {
        ...(typeof mechanism.type === 'string' ? { type: mechanism.type.slice(0, 80) } : {}),
        ...(typeof mechanism.handled === 'boolean' ? { handled: mechanism.handled } : {}),
      }
    }
    if (Object.keys(safeValue).length > 0) output.values = [safeValue]
  }
  return output
}

/** Removes sensitive request and free-form values while preserving safe grouping metadata. */
export function sanitizeSentryEvent(event: Event): Event | null {
  const output: Event = { ...event }
  delete output.request
  delete output.message

  if (event.user?.id && typeof event.user.id === 'string') {
    output.user = { id: event.user.id }
  } else {
    delete output.user
  }

  output.tags = sanitizeSafeProperties(event.tags) as Event['tags']
  output.extra = sanitizeSafeProperties(event.extra)
  output.contexts = sanitizeRecord(event.contexts) as Event['contexts']
  output.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    timestamp: breadcrumb.timestamp,
    ...(typeof breadcrumb.category === 'string' ? { category: breadcrumb.category.slice(0, 80) } : {}),
    ...(typeof breadcrumb.type === 'string' ? { type: breadcrumb.type.slice(0, 80) } : {}),
  }))
  output.exception = sanitizeException(event.exception) as Event['exception']
  return output
}

function runtimeIsTest(): boolean {
  const env = import.meta.env as ImportMetaEnv & { VITEST?: boolean | string }
  return env.MODE === 'test' || env.VITEST === true || env.VITEST === 'true'
}

function supabaseOriginFromEnvironment(): string {
  const configured = import.meta.env.VITE_SUPABASE_URL ?? ''
  try {
    const parsed = new URL(configured)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : ''
  } catch {
    return ''
  }
}

export function getSentryConfig(): SentryConfig {
  return {
    enabled: import.meta.env.VITE_DIAGNOSTICS_ENABLED === 'true',
    dsn: import.meta.env.VITE_SENTRY_DSN ?? '',
    releaseVersion: import.meta.env.VITE_APP_VERSION || 'local',
    environment: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
    supabaseOrigin: supabaseOriginFromEnvironment(),
  }
}

function applySafeScope(scope: Sentry.Scope, properties: DiagnosticsProperties): void {
  for (const [key, value] of Object.entries(properties)) {
    if (SAFE_TAG_KEYS.has(key)) scope.setTag(key, String(value))
  }
}

export function createSentryAdapter(config = getSentryConfig()): DiagnosticsProvider | null {
  if (!config.enabled || !config.dsn || (config.isTestEnvironment ?? runtimeIsTest())) return null
  try {
    Sentry.init({
      dsn: config.dsn,
      sendDefaultPii: false,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1,
      tracePropagationTargets: ['localhost', ...(config.supabaseOrigin ? [config.supabaseOrigin] : [])],
      release: config.releaseVersion,
      environment: config.environment,
      beforeSend: (event: ErrorEvent) => sanitizeSentryEvent(event) as ErrorEvent | null,
      beforeSendTransaction: (event) => sanitizeSentryEvent(event) as typeof event | null,
    })
  } catch {
    return null
  }

  return {
    identify(distinctId: string, properties: DiagnosticsProperties) {
      try {
        Sentry.setUser({ id: distinctId })
        for (const [key, value] of Object.entries(properties)) {
          if (SAFE_TAG_KEYS.has(key)) Sentry.setTag(key, String(value))
        }
      } catch { /* provider failure is isolated */ }
    },
    reset() {
      try { Sentry.setUser(null) } catch { /* provider failure is isolated */ }
    },
    capture(event: DiagnosticsEventName, properties: DiagnosticsProperties) {
      try {
        Sentry.withScope((scope) => {
          applySafeScope(scope, properties)
          Sentry.captureMessage(event)
        })
      } catch { /* provider failure is isolated */ }
    },
    captureFailure(error: Error, properties: DiagnosticsProperties) {
      try {
        Sentry.withScope((scope) => {
          applySafeScope(scope, properties)
          const safeError = new Error(properties.safe_error_code ? `diagnostics:${properties.safe_error_code}` : 'diagnostics:failure')
          safeError.name = 'DiagnosticsFailure'
          Sentry.captureException(safeError)
        })
      } catch { /* provider failure is isolated */ }
      void error
    },
  }
}
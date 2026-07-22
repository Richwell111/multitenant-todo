import posthog from 'posthog-js'
import type { DiagnosticsProperties, DiagnosticsProvider, DiagnosticsEventName } from './diagnosticsTypes'

export interface PostHogConfig {
  enabled: boolean
  key: string
  host: string
  releaseVersion: string
  environment: string
  isTestEnvironment?: boolean
}

const runtimeIsTest = (): boolean => {
  const env = import.meta.env as ImportMetaEnv & { VITEST?: boolean | string }
  return env.MODE === 'test' || env.VITEST === true || env.VITEST === 'true'
}

export function getPostHogConfig(): PostHogConfig {
  return {
    enabled: import.meta.env.VITE_DIAGNOSTICS_ENABLED === 'true',
    key: import.meta.env.VITE_POSTHOG_KEY ?? '',
    host: import.meta.env.VITE_POSTHOG_HOST ?? '',
    releaseVersion: import.meta.env.VITE_APP_VERSION || 'local',
    environment: import.meta.env.VITE_APP_ENVIRONMENT || 'development',
  }
}

export function createPostHogAdapter(config = getPostHogConfig()): DiagnosticsProvider | null {
  if (!config.enabled || !config.key || !config.host || (config.isTestEnvironment ?? runtimeIsTest())) return null
  try {
    posthog.init(config.key, {
      api_host: config.host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    })
  } catch {
    return null
  }

  return {
    identify(distinctId: string, properties: DiagnosticsProperties) {
      try { posthog.identify(distinctId, properties) } catch { /* provider failure is isolated */ }
    },
    reset() {
      try { posthog.reset() } catch { /* provider failure is isolated */ }
    },
    capture(event: DiagnosticsEventName, properties: DiagnosticsProperties) {
      try { posthog.capture(event, properties) } catch { /* provider failure is isolated */ }
    },
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import posthog from 'posthog-js'
import { createPostHogAdapter } from './posthogAdapter'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('PostHog adapter', () => {
  it('does not initialize during tests or when configuration is incomplete', () => {
    expect(createPostHogAdapter({ enabled: true, key: 'key', host: 'host', releaseVersion: '1', environment: 'test', isTestEnvironment: true })).toBeNull()
    expect(createPostHogAdapter({ enabled: true, key: '', host: 'host', releaseVersion: '1', environment: 'test', isTestEnvironment: false })).toBeNull()
    expect(vi.mocked(posthog.init)).not.toHaveBeenCalled()
  })

  it('initializes with privacy-safe explicit event settings', () => {
    const adapter = createPostHogAdapter({ enabled: true, key: 'key', host: 'host', releaseVersion: '1', environment: 'production', isTestEnvironment: false })
    expect(adapter).not.toBeNull()
    expect(posthog.init).toHaveBeenCalledWith('key', expect.objectContaining({
      api_host: 'host',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    }))
    adapter?.capture('auth.login_succeeded', { success: true })
    expect(posthog.capture).toHaveBeenCalledWith('auth.login_succeeded', { success: true })
  })
})

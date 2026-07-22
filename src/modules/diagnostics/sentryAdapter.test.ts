import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/react'
import { createSentryAdapter, sanitizeSentryEvent } from './sentryAdapter'
import type { Event } from '@sentry/react'

const sentryMocks = vi.hoisted(() => ({ setTag: vi.fn() }))

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'browser-tracing' })),
  replayIntegration: vi.fn((options: unknown) => ({ name: 'replay', options })),
  setUser: vi.fn(),
  setTag: sentryMocks.setTag,
  withScope: vi.fn((callback: (scope: { setTag: typeof sentryMocks.setTag }) => void) => callback({ setTag: sentryMocks.setTag })),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sentry adapter', () => {
  it('does not initialize when disabled, incomplete, or running in tests', () => {
    expect(createSentryAdapter({ enabled: false, dsn: 'dsn', releaseVersion: '1', environment: 'test', supabaseOrigin: '', isTestEnvironment: false })).toBeNull()
    expect(createSentryAdapter({ enabled: true, dsn: '', releaseVersion: '1', environment: 'test', supabaseOrigin: '', isTestEnvironment: false })).toBeNull()
    expect(createSentryAdapter({ enabled: true, dsn: 'dsn', releaseVersion: '1', environment: 'test', supabaseOrigin: '', isTestEnvironment: true })).toBeNull()
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('initializes tracing and masked replay with conservative sampling', () => {
    const adapter = createSentryAdapter({ enabled: true, dsn: 'dsn', releaseVersion: '1.2.3', environment: 'production', supabaseOrigin: 'https://project.supabase.co', isTestEnvironment: false })
    expect(adapter).not.toBeNull()
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1,
      release: '1.2.3',
      sendDefaultPii: false,
      environment: 'production',
      tracePropagationTargets: ['localhost', 'https://project.supabase.co'],
      beforeSend: expect.any(Function),
    }))
    expect(Sentry.replayIntegration).toHaveBeenCalledWith({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })
  })

  it('fails open when Sentry initialization throws', () => {
    vi.mocked(Sentry.init).mockImplementationOnce(() => { throw new Error('provider unavailable') })
    expect(createSentryAdapter({ enabled: true, dsn: 'dsn', releaseVersion: '1', environment: 'test', supabaseOrigin: '', isTestEnvironment: false })).toBeNull()
  })

  it('uses pseudonymous identity, safe tags, and resets on logout', () => {
    const adapter = createSentryAdapter({ enabled: true, dsn: 'dsn', releaseVersion: '1', environment: 'test', supabaseOrigin: '', isTestEnvironment: false })
    adapter?.identify('company:user-123', { account_kind: 'company', release_version: '1', environment: 'test', email: 'blocked' } as never)
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'company:user-123' })
    expect(sentryMocks.setTag).toHaveBeenCalledWith('account_kind', 'company')
    adapter?.reset()
    expect(Sentry.setUser).toHaveBeenCalledWith(null)
  })

  it('captures only a safe diagnostic error', () => {
    const adapter = createSentryAdapter({ enabled: true, dsn: 'dsn', releaseVersion: '1', environment: 'test', supabaseOrigin: '', isTestEnvironment: false })
    adapter?.captureFailure?.(new Error('password=secret'), { safe_error_code: 'NETWORK_FAILURE', module_key: 'todo' })
    const captured = vi.mocked(Sentry.captureException).mock.calls[0]?.[0]
    expect(captured).toBeInstanceOf(Error)
    expect((captured as Error).message).toBe('diagnostics:NETWORK_FAILURE')
    expect((captured as Error).message).not.toContain('password')
  })

  it('sanitizes request data and forbidden values recursively', () => {
    const sanitized = sanitizeSentryEvent({
      message: 'raw password secret',
      request: { url: 'https://example.test?token=secret', headers: { authorization: 'secret' }, data: { password: 'secret' } },
      user: { id: 'company:user-123', email: 'person@example.test', username: 'person' },
      tags: { account_kind: 'company', email: 'person@example.test', nested: { password: 'secret' } },
      extra: { module_key: 'todo', description: 'private task', nested: { token: 'secret', safe: true } },
      contexts: { nested: { licence_key: 'secret', safe: 'yes' } },
      breadcrumbs: [{ message: 'private', data: { password: 'secret' }, category: 'ui', timestamp: 1 }],
      exception: { values: [{ type: 'Error', value: 'raw password secret', stacktrace: { frames: [] } }] },
    } as unknown as Event)
    expect(sanitized).not.toBeNull()
    expect(sanitized).not.toHaveProperty('request')
    expect(sanitized).not.toHaveProperty('message')
    expect(sanitized?.user).toEqual({ id: 'company:user-123' })
    expect(sanitized?.tags).toEqual({ account_kind: 'company' })
    expect(sanitized?.extra).toEqual({ module_key: 'todo' })
    expect(JSON.stringify(sanitized)).not.toContain('secret')
    expect(JSON.stringify(sanitized)).not.toContain('person@example.test')
  })
})
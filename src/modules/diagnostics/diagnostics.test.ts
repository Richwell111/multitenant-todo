import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureUsage,
  clearIdentity,
  configureDiagnosticsForTests,
  identifyAccount,
  resetDiagnosticsForTests,
} from './diagnosticsService'
import type { DiagnosticsProvider } from './diagnosticsTypes'

function providerFixture() {
  return {
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  } satisfies DiagnosticsProvider
}

beforeEach(() => resetDiagnosticsForTests())

describe('diagnostics service', () => {
  it('uses a namespaced pseudonymous identity and safe release metadata', async () => {
    const provider = providerFixture()
    configureDiagnosticsForTests(provider)
    await identifyAccount('company', 'user-123')
    const [distinctId, properties] = provider.identify.mock.calls[0]
    // The raw UUID must never leave: identity is a company-prefixed SHA-256 digest.
    expect(distinctId).toMatch(/^company:[0-9a-f]{64}$/)
    expect(distinctId).not.toContain('user-123')
    expect(properties).toEqual(expect.objectContaining({
      account_kind: 'company',
      release_version: expect.any(String),
      environment: expect.any(String),
    }))
  })

  it('strips forbidden and unknown event properties', () => {
    const provider = providerFixture()
    configureDiagnosticsForTests(provider)
    captureUsage('todo.task_created', {
      module_key: 'todo',
      action_name: 'create_task',
      success: true,
      title: 'secret task',
      description: 'private details',
      email: 'person@example.test',
      password: 'not allowed',
      raw_error: 'database response',
      request_body: '{}',
    })
    const properties = provider.capture.mock.calls[0][1]
    expect(properties).toEqual(expect.objectContaining({ module_key: 'todo', action_name: 'create_task', success: true }))
    expect(properties).not.toHaveProperty('title')
    expect(properties).not.toHaveProperty('description')
    expect(properties).not.toHaveProperty('email')
    expect(properties).not.toHaveProperty('password')
    expect(properties).not.toHaveProperty('raw_error')
    expect(properties).not.toHaveProperty('request_body')
  })

  it('swallows provider failures and resets identity safely', () => {
    const provider = providerFixture()
    provider.capture.mockImplementation(() => { throw new Error('provider unavailable') })
    provider.identify.mockImplementation(() => { throw new Error('provider unavailable') })
    configureDiagnosticsForTests(provider)
    expect(() => identifyAccount('platform-admin', 'admin-123')).not.toThrow()
    expect(() => captureUsage('auth.login_succeeded', { success: true })).not.toThrow()
    clearIdentity()
    expect(provider.reset).toHaveBeenCalledTimes(1)
  })
})

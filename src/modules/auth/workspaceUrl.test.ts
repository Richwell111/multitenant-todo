import { describe, expect, it } from 'vitest'
import { buildWorkspaceUrl, isSameOriginPath } from './workspaceUrl'

const local = { protocol: 'http:', hostname: 'localhost', port: '5173' }
const production = { protocol: 'https:', hostname: 'todoapp.com', port: '' }

describe('buildWorkspaceUrl', () => {
  it('returns a same-origin path locally', () => {
    expect(buildWorkspaceUrl('alpha', local, 'todoapp.com')).toBe('/workspace/alpha')
  })

  it('uses the same local path for loopback addresses', () => {
    expect(buildWorkspaceUrl('alpha', { ...local, hostname: '127.0.0.1' }, 'todoapp.com'))
      .toBe('/workspace/alpha')
  })

  it('returns the configured Company subdomain in production', () => {
    expect(buildWorkspaceUrl('alpha', production, 'todoapp.com')).toBe('https://alpha.todoapp.com')
  })

  it('normalizes a base domain with stray dots and case', () => {
    expect(buildWorkspaceUrl('alpha', production, '.TodoApp.com.')).toBe('https://alpha.todoapp.com')
  })

  it('rejects an invalid slug', () => {
    expect(() => buildWorkspaceUrl('Not A Slug', local, 'todoapp.com')).toThrow('Invalid workspace slug')
  })

  it('rejects a reserved slug', () => {
    expect(() => buildWorkspaceUrl('admin', local, 'todoapp.com')).toThrow('Invalid workspace slug')
  })

  it('rejects a missing production base domain', () => {
    expect(() => buildWorkspaceUrl('alpha', production, '')).toThrow('Workspace base domain')
  })

  it('rejects an invalid production base domain', () => {
    expect(() => buildWorkspaceUrl('alpha', production, 'not a domain')).toThrow('Workspace base domain')
  })
})

describe('isSameOriginPath', () => {
  it('recognizes a local workspace path', () => {
    expect(isSameOriginPath('/workspace/alpha')).toBe(true)
  })

  it('recognizes a production workspace URL', () => {
    expect(isSameOriginPath('https://alpha.todoapp.com')).toBe(false)
  })
})

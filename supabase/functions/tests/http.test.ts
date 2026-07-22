import { describe, expect, it } from 'vitest'
import { corsPreflight, withCors } from '../_shared/http.ts'

describe('Edge Function CORS headers', () => {
  it('allows Supabase and Sentry tracing headers during preflight', () => {
    const response = corsPreflight()
    const allowedHeaders = response.headers.get('Access-Control-Allow-Headers')

    expect(response.status).toBe(204)
    expect(allowedHeaders).toContain('authorization')
    expect(allowedHeaders).toContain('apikey')
    expect(allowedHeaders).toContain('content-type')
    expect(allowedHeaders).toContain('sentry-trace')
    expect(allowedHeaders).toContain('baggage')
  })

  it('preserves CORS headers on function responses', () => {
    const response = withCors(new Response('ok', { status: 200 }))

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('baggage')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
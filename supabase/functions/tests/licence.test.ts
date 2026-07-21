import { describe, expect, it } from 'vitest'
import {
  RESERVED_WORKSPACE_SLUGS,
  canonicalizeLicenceKey,
  companyNamesMatch,
  expiryDateToInstant,
  generateLicenceKey,
  licenceKeyPrefix,
  normalizeCompanyName,
  normalizeEmail,
  sha256Hex,
  validateWorkspaceSlug,
} from '../_shared/licence.ts'

describe('licence primitives', () => {
  it('formats exactly 128 supplied random bits', () => {
    const key = generateLicenceKey((bytes) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index))
      return bytes
    })
    expect(key).toBe('TDO-00010203-04050607-08090A0B-0C0D0E0F')
    expect(licenceKeyPrefix(key)).toBe('TDO-00010203')
  })

  it('canonicalizes only an exact key format', () => {
    expect(canonicalizeLicenceKey(' tdo-00010203-04050607-08090a0b-0c0d0e0f '))
      .toBe('TDO-00010203-04050607-08090A0B-0C0D0E0F')
    expect(canonicalizeLicenceKey('TDO000102030405060708090A0B0C0D0E0F')).toBeNull()
  })

  it('uses a stable SHA-256 vector', async () => {
    expect(await sha256Hex('TDO-00010203-04050607-08090A0B-0C0D0E0F'))
      .toBe('bb79061455068aebd820770056bf17d4baa9b81f71b14b4aa0215a6f400e6212')
  })

  it('normalizes names and emails and compares normalized names', () => {
    expect(normalizeCompanyName('  Alpha\t Limited  ')).toBe('Alpha Limited')
    expect(normalizeEmail(' Admin@Example.COM ')).toBe('admin@example.com')
    expect(companyNamesMatch('Ａlpha  Limited', 'alpha Limited')).toBe(true)
  })

  it('accepts valid slugs and rejects every reserved slug', () => {
    expect(validateWorkspaceSlug(' Alpha-1 ')).toEqual({ ok: true, value: 'alpha-1' })
    for (const slug of RESERVED_WORKSPACE_SLUGS) {
      expect(validateWorkspaceSlug(slug)).toEqual({ ok: false, reason: 'reserved' })
    }
    for (const slug of ['ab', '-abc', 'abc-', 'a--b', 'xn--name', 'has space']) {
      expect(validateWorkspaceSlug(slug)).toEqual({ ok: false, reason: 'invalid' })
    }
  })

  it('stores expiry at next UTC midnight and rejects past or invalid dates', () => {
    const now = new Date('2026-07-21T12:00:00.000Z')
    expect(expiryDateToInstant('2026-07-21', now)).toBe('2026-07-22T00:00:00.000Z')
    expect(expiryDateToInstant('2026-07-20', now)).toBeNull()
    expect(expiryDateToInstant('2026-02-30', now)).toBeNull()
  })
})



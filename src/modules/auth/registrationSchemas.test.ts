import { describe, expect, it } from 'vitest'
import { suggestWorkspaceSlug } from './registrationSchemas'
import { validateWorkspaceSlug } from '../../../supabase/functions/_shared/licence.ts'

describe('suggestWorkspaceSlug', () => {
  it('lowercases ASCII letters', () => {
    expect(suggestWorkspaceSlug('Alpha')).toBe('alpha')
  })

  it('replaces spaces and punctuation with single hyphens', () => {
    expect(suggestWorkspaceSlug('Alpha  Limited')).toBe('alpha-limited')
    expect(suggestWorkspaceSlug('Alpha, Beta & Co.')).toBe('alpha-beta-co')
    expect(suggestWorkspaceSlug('Alpha___Beta')).toBe('alpha-beta')
  })

  it('removes leading and trailing hyphens', () => {
    expect(suggestWorkspaceSlug('  -Alpha Limited-  ')).toBe('alpha-limited')
    expect(suggestWorkspaceSlug('!!!Alpha!!!')).toBe('alpha')
  })

  it('strips diacritics to ASCII', () => {
    expect(suggestWorkspaceSlug('Café Zürich')).toBe('cafe-zurich')
  })

  it('drops non-ASCII scripts that have no ASCII form', () => {
    expect(suggestWorkspaceSlug('株式会社')).toBe('')
  })

  it('returns an empty slug for input with no usable characters', () => {
    expect(suggestWorkspaceSlug('')).toBe('')
    expect(suggestWorkspaceSlug('   ')).toBe('')
    expect(suggestWorkspaceSlug('---')).toBe('')
  })

  it('truncates to 63 characters without a trailing hyphen', () => {
    const suggestion = suggestWorkspaceSlug('a'.repeat(62) + ' ' + 'b'.repeat(10))
    expect(suggestion).toBe('a'.repeat(62))
    expect(suggestion.length).toBeLessThanOrEqual(63)
  })

  it('produces slugs the authoritative validator accepts', () => {
    expect(validateWorkspaceSlug(suggestWorkspaceSlug('Alpha Limited'))).toEqual({
      ok: true,
      value: 'alpha-limited',
    })
  })

  it('does not bypass reserved-slug rejection', () => {
    expect(validateWorkspaceSlug(suggestWorkspaceSlug('Admin'))).toEqual({
      ok: false,
      reason: 'reserved',
    })
  })
})

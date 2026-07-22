import { describe, expect, it } from 'vitest'
import { CORE_FEATURE_REGISTRY } from './coreFeatureRegistry'

describe('core feature registry', () => {
  it('contains only static active core features', () => {
    expect(CORE_FEATURE_REGISTRY.length).toBeGreaterThan(0)
    expect(CORE_FEATURE_REGISTRY.every((feature) => feature.category === 'core' && feature.status === 'active')).toBe(true)
    expect(CORE_FEATURE_REGISTRY.map((feature) => feature.key)).toContain('tenant-isolation')
  })
})
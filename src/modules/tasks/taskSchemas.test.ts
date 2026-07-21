import { describe, expect, it } from 'vitest'
import { normalizeTaskInput, TaskValidationError, validateTaskStatus } from './taskSchemas'

describe('task schemas', () => {
  it('trims title and turns a blank description into null', () => {
    expect(normalizeTaskInput({ title: '  Write docs  ', description: '   ' }))
      .toEqual({ title: 'Write docs', description: null })
  })

  it('enforces title and description limits', () => {
    expect(() => normalizeTaskInput({ title: '', description: 'x'.repeat(1001) }))
      .toThrow(TaskValidationError)
    try { normalizeTaskInput({ title: '', description: 'x'.repeat(1001) }) }
    catch (error) {
      expect((error as TaskValidationError).fieldErrors).toEqual({
        title: 'Title is required.',
        description: 'Description must be 1000 characters or fewer.',
      })
    }
  })

  it('accepts only pending and completed statuses', () => {
    expect(() => validateTaskStatus('pending')).not.toThrow()
    expect(() => validateTaskStatus('completed')).not.toThrow()
    expect(() => validateTaskStatus('deleted')).toThrow(TaskValidationError)
  })
})

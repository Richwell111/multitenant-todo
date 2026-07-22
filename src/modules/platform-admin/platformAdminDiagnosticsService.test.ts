import { describe, expect, it } from 'vitest'
import { mapSnapshot } from './platformAdminDiagnosticsService'

const extensions = {
  extensions: [
    { id: 'ext-shared', key: 'shared', name: 'Shared Feature', description: null, availabilityType: 'shared' as const, isActive: true },
    { id: 'ext-private', key: 'private', name: 'Private Feature', description: null, availabilityType: 'private' as const, isActive: true },
  ],
  assignments: [{ companyId: 'company-a', extensionId: 'ext-private', enabled: true, createdAt: '2026-01-01T00:00:00Z' }],
  companies: [{ id: 'company-a', name: 'Alpha', email: 'hidden@example.test', slug: 'alpha', status: 'active' as const, createdAt: '2026-01-01T00:00:00Z' }],
}

describe('Platform Admin diagnostics service', () => {
  it('maps safe Company and feature labels without task data', () => {
    const snapshot = mapSnapshot(
      [{ id: 'event-1', companyId: 'company-a', extensionId: 'ext-private', enabled: false, changedAt: '2026-01-02T00:00:00Z', disabledReason: 'temporary_pause', actorId: 'admin' }],
      [{ id: 'request-1', requestingCompanyId: 'company-a', extensionId: 'ext-private', requestedOutcome: 'A safe request', classification: 'private_customization', requestStatus: 'approved', developmentStatus: 'in_development', deploymentStatus: 'not_deployed', targetRelease: '2026.08', requestedAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }],
      [{ id: 'release-1', version: '2026.08', environment: 'production', releasedAt: '2026-01-02T00:00:00Z' }],
      extensions,
    )
    expect(snapshot.assignmentEvents[0]).toMatchObject({ companyName: 'Alpha', extensionName: 'Private Feature', disabledReason: 'temporary_pause' })
    expect(snapshot.featureRequests[0]).toMatchObject({ companyName: 'Alpha', extensionName: 'Private Feature' })
    expect(snapshot.enabledAssignmentsByFeature).toContainEqual({ extensionId: 'ext-private', extensionName: 'Private Feature', enabledCompanyCount: 1 })
    expect(JSON.stringify(snapshot)).not.toContain('task')
    expect(JSON.stringify(snapshot)).not.toContain('hidden@example.test')
  })
})
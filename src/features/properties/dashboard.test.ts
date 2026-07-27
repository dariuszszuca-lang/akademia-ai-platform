import { describe, expect, it } from 'vitest'
import type {
  PropertyFactStatus,
  PropertyProject,
  PropertyStage,
} from './domain'
import { buildPropertyDashboard } from './dashboard'

describe('property dashboard', () => {
  it('counts active projects and unresolved facts', () => {
    const result = buildPropertyDashboard(
      [
        project('one', 'verification', new Date('2026-07-26')),
        project('two', 'ready', new Date('2026-07-27')),
        project('three', 'archived', new Date('2026-07-25')),
      ],
      new Map([
        ['one', [fact('missing'), fact('conflicting')]],
        ['two', [fact('confirmed')]],
        ['three', [fact('missing')]],
      ]),
    )

    expect(result.activeCount).toBe(2)
    expect(result.missingCount).toBe(1)
    expect(result.conflictingCount).toBe(1)
    expect(result.recentProjects.map((item) => item.id)).toEqual([
      'two',
      'one',
    ])
  })
})

function project(
  id: string,
  stage: PropertyStage,
  updatedAt: Date,
): PropertyProject {
  return {
    id,
    organizationId: 'org',
    createdByUserId: 'user',
    title: `Teczka ${id}`,
    propertyType: 'apartment',
    transactionType: 'sale',
    stage,
    city: 'Poznań',
    addressMode: 'hidden',
    createdAt: new Date('2026-07-01'),
    updatedAt,
    archivedAt: stage === 'archived' ? updatedAt : null,
  }
}

function fact(status: PropertyFactStatus) {
  return { status }
}

import { describe, expect, it, vi } from 'vitest'
import type { PropertySource } from '../property-sources/domain'
import {
  deleteAccountData,
  exportAccountData,
  getAccountKeys,
} from './account-data'

describe('property studio account data workflows', () => {
  it('includes property truth and source review data in account export', async () => {
    const propertyTruth = {
      projects: [{ id: 'project-1' }],
      facts: [{ id: 'fact-1' }],
      audit: [{ id: 'audit-1' }],
    }
    const propertySources = {
      sources: [{ id: 'source-1' }],
      sourceJobs: [{ id: 'job-1' }],
      factProposals: [
        {
          id: 'proposal-1',
          evidenceText: 'Powierzchnia użytkowa: 83,40 m²',
          decision: { action: 'accept' },
        },
      ],
    }
    const getValue = vi.fn(async (key: string) => `value:${key}`)
    const exportForUser = vi.fn(async () => propertyTruth)
    const exportSourcesForUser = vi.fn(async () => propertySources)
    const productEvents = [{ id: 'event-1', name: 'account.exported' }]
    const recordAccountExported = vi.fn()
    const exportProductEventsForUser = vi.fn(async () => productEvents)

    const result = await exportAccountData('user-a', {
      getValue,
      exportForUser,
      exportSourcesForUser,
      recordAccountExported,
      exportProductEventsForUser,
    })

    expect(result.propertyStudio).toEqual({
      ...propertyTruth,
      ...propertySources,
      productEvents,
    })
    expect(recordAccountExported).toHaveBeenCalledWith('user-a')
    expect(exportForUser).toHaveBeenCalledWith('user-a')
    expect(exportSourcesForUser).toHaveBeenCalledWith('user-a')
    expect(getValue).toHaveBeenCalledTimes(5)
  })

  it('deletes source versions before PostgreSQL and any KV key', async () => {
    const operations: string[] = []
    const sources = [sourceFixture()]

    const deleted = await deleteAccountData('user-a', {
      listSourcesForUser: async () => sources,
      recordAccountDeleted: async () => {
        operations.push('event')
      },
      purgeSourceObjects: async (listedSources) => {
        expect(listedSources).toEqual(sources)
        operations.push('s3')
        return { deletedVersions: 3 }
      },
      deletePropertiesForUser: async () => {
        operations.push('postgres')
      },
      deleteValue: async (key) => {
        operations.push(key)
      },
    })

    expect(operations).toEqual([
      'event',
      's3',
      'postgres',
      ...getAccountKeys('user-a'),
    ])
    expect(deleted).toEqual({
      sourceObjects: 3,
      propertyStudio: 1,
      accountKeys: 5,
    })
  })

  it('does not delete PostgreSQL or KV data when S3 purge fails', async () => {
    const deletePropertiesForUser = vi.fn()
    const deleteValue = vi.fn()

    await expect(
      deleteAccountData('user-a', {
        listSourcesForUser: async () => [sourceFixture()],
        recordAccountDeleted: async () => {},
        purgeSourceObjects: async () => {
          throw new Error('s3_unavailable')
        },
        deletePropertiesForUser,
        deleteValue,
      }),
    ).rejects.toThrow('s3_unavailable')

    expect(deletePropertiesForUser).not.toHaveBeenCalled()
    expect(deleteValue).not.toHaveBeenCalled()
  })
})

function sourceFixture(): PropertySource {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    organizationId: '11111111-1111-4111-8111-111111111111',
    propertyProjectId: '22222222-2222-4222-8222-222222222222',
    storageKey:
      'originals/organizations/11111111-1111-4111-8111-111111111111/properties/22222222-2222-4222-8222-222222222222/sources/33333333-3333-4333-8333-333333333333/original',
    fileName: 'synthetic.pdf',
    mediaType: 'application/pdf',
    sizeBytes: 1200,
    checksumSha256: 'a'.repeat(64),
    status: 'review_ready',
    errorCode: null,
    errorMessage: null,
    uploadedAt: new Date(),
    processedAt: new Date(),
    createdByUserId: 'user-a',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

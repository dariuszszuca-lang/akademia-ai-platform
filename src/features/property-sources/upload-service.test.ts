import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryPropertyRepository } from '../properties/memory-repository'
import { PropertyService } from '../properties/service'
import { MemoryPropertySourceRepository } from './memory-repository'
import type { PropertySourceObjectStore } from './object-store'
import { PropertySourceService } from './service'
import { PropertySourceUploadService } from './upload-service'

const uploadGrant = {
  method: 'POST' as const,
  url: 'https://upload.example.test',
  fields: { policy: 'signed' },
  expiresAt: '2026-07-27T12:05:00.000Z',
}

describe('PropertySourceUploadService', () => {
  let propertyRepository: MemoryPropertyRepository
  let sourceRepository: MemoryPropertySourceRepository
  let propertyService: PropertyService
  let sourceService: PropertySourceService
  let createUploadGrant: ReturnType<
    typeof vi.fn<PropertySourceObjectStore['createUploadGrant']>
  >
  let createCleanDownloadUrl: ReturnType<
    typeof vi.fn<PropertySourceObjectStore['createCleanDownloadUrl']>
  >
  let uploadService: PropertySourceUploadService

  beforeEach(() => {
    propertyRepository = new MemoryPropertyRepository()
    sourceRepository = new MemoryPropertySourceRepository(propertyRepository)
    propertyService = new PropertyService(propertyRepository)
    sourceService = new PropertySourceService(
      propertyRepository,
      sourceRepository,
    )
    createUploadGrant = vi.fn<
      PropertySourceObjectStore['createUploadGrant']
    >(async () => uploadGrant)
    createCleanDownloadUrl = vi.fn<
      PropertySourceObjectStore['createCleanDownloadUrl']
    >(async () => ({
      url: 'https://download.example.test',
      expiresAt: '2026-07-27T12:01:00.000Z',
    }))
    uploadService = new PropertySourceUploadService(
      sourceService,
      sourceRepository,
      { createUploadGrant, createCleanDownloadUrl },
    )
  })

  it('registers one trusted source and returns its exact upload grant', async () => {
    const project = await createProject('user-a')

    const result = await uploadService.initiateUpload(
      'user-a',
      project.id,
      sourceInput(),
    )

    expect(result.upload).toEqual(uploadGrant)
    expect(result.source.storageKey).toBe(
      `originals/organizations/${project.organizationId}/properties/${project.id}/sources/${result.source.id}/original`,
    )
    expect(createUploadGrant).toHaveBeenCalledWith(result.source)
    expect(
      await propertyService.listFacts('user-a', project.id),
    ).toEqual([])
  })

  it('stores only a safe failure when grant signing fails', async () => {
    const project = await createProject('user-a')
    createUploadGrant.mockRejectedValueOnce(
      new Error(
        'bucket-name arn:aws:kms:eu-central-1:111122223333:key/secret',
      ),
    )

    await expect(
      uploadService.initiateUpload(
        'user-a',
        project.id,
        sourceInput(),
      ),
    ).rejects.toThrow('UPLOAD_GRANT_FAILED')

    const [source] = await sourceService.listSources('user-a', project.id)
    expect(source).toMatchObject({
      status: 'failed',
      errorCode: 'upload_grant_failed',
      errorMessage: 'Nie udało się przygotować bezpiecznego uploadu.',
    })
    expect(JSON.stringify(source)).not.toContain('bucket-name')
    expect(JSON.stringify(source)).not.toContain('arn:aws:kms')
  })

  it('enforces allowed transitions and terminal states', async () => {
    const project = await createProject('user-a')
    const source = await sourceService.registerSource(
      'user-a',
      project.id,
      sourceInput(),
    )

    for (const status of [
      'uploaded',
      'scanning',
      'validating',
      'queued',
      'processing',
      'review_ready',
      'completed',
    ] as const) {
      await expect(
        sourceRepository.updateSourceStatusInternal(source.id, { status }),
      ).resolves.toMatchObject({ status })
    }
    await expect(
      sourceRepository.updateSourceStatusInternal(source.id, {
        status: 'processing',
      }),
    ).rejects.toThrow('INVALID_SOURCE_STATUS_TRANSITION')

    const second = await sourceService.registerSource(
      'user-a',
      project.id,
      sourceInput({ checksumSha256: 'b'.repeat(64) }),
    )
    for (const status of ['uploaded', 'scanning', 'quarantined'] as const) {
      await sourceRepository.updateSourceStatusInternal(second.id, { status })
    }
    await expect(
      sourceRepository.updateSourceStatusInternal(second.id, {
        status: 'review_ready',
      }),
    ).rejects.toThrow('INVALID_SOURCE_STATUS_TRANSITION')

    await sourceRepository.updateSourceStatusInternal(source.id, {
      status: 'deleted',
    })
    await expect(
      sourceRepository.updateSourceStatusInternal(source.id, {
        status: 'processing',
      }),
    ).rejects.toThrow('INVALID_SOURCE_STATUS_TRANSITION')
  })

  it('authorizes tenant and source before signing a download', async () => {
    const project = await createProject('user-a')
    const source = await sourceService.registerSource(
      'user-a',
      project.id,
      sourceInput(),
    )

    await expect(
      uploadService.createDownloadUrl('user-b', project.id, source.id),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
    expect(createCleanDownloadUrl).not.toHaveBeenCalled()

    await expect(
      uploadService.createDownloadUrl('user-a', project.id, source.id),
    ).rejects.toThrow('SOURCE_NOT_READY')
    expect(createCleanDownloadUrl).not.toHaveBeenCalled()

    for (const status of [
      'uploaded',
      'scanning',
      'validating',
      'queued',
      'processing',
      'review_ready',
    ] as const) {
      await sourceRepository.updateSourceStatusInternal(source.id, { status })
    }

    await expect(
      uploadService.createDownloadUrl('user-a', project.id, source.id),
    ).resolves.toEqual({
      url: 'https://download.example.test',
      expiresAt: '2026-07-27T12:01:00.000Z',
    })
    expect(createCleanDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: source.id, status: 'review_ready' }),
      'attachment',
    )
  })

  it('allows inline preview only for PDF and image sources', async () => {
    const project = await createProject('user-a')
    const source = await sourceService.registerSource(
      'user-a',
      project.id,
      sourceInput(),
    )
    for (const status of [
      'uploaded',
      'scanning',
      'validating',
      'queued',
      'processing',
      'review_ready',
    ] as const) {
      await sourceRepository.updateSourceStatusInternal(source.id, { status })
    }

    await uploadService.createDownloadUrl(
      'user-a',
      project.id,
      source.id,
      'preview',
    )

    expect(createCleanDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: source.id }),
      'inline',
    )
  })

  it('does not create a source or grant outside the tenant', async () => {
    const project = await createProject('user-a')

    await expect(
      uploadService.initiateUpload(
        'user-b',
        project.id,
        sourceInput(),
      ),
    ).rejects.toThrow('PROPERTY_NOT_FOUND')
    expect(createUploadGrant).not.toHaveBeenCalled()
    expect(
      await sourceService.listSources('user-a', project.id),
    ).toEqual([])
  })

  async function createProject(userId: string) {
    return propertyService.createProject(userId, {
      title: 'Mieszkanie testowe',
      propertyType: 'apartment',
      transactionType: 'sale',
      city: 'Poznań',
      addressMode: 'hidden',
    })
  }
})

function sourceInput(
  overrides: Partial<{
    fileName: string
    mediaType: 'application/pdf'
    sizeBytes: number
    checksumSha256: string
  }> = {},
) {
  return {
    fileName: 'operat.pdf',
    mediaType: 'application/pdf' as const,
    sizeBytes: 12_000,
    checksumSha256: 'a'.repeat(64),
    ...overrides,
  }
}

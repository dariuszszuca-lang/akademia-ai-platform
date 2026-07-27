import type { PropertySourceObjectStore } from './object-store'
import type { PropertySourceRepository } from './repository'
import type { PropertySourceService } from './service'

export class PropertySourceUploadService {
  constructor(
    private readonly sourceService: PropertySourceService,
    private readonly sourceRepository: PropertySourceRepository,
    private readonly objectStore: PropertySourceObjectStore,
  ) {}

  async initiateUpload(
    userId: string,
    propertyProjectId: string,
    rawInput: unknown,
  ) {
    const source = await this.sourceService.registerSource(
      userId,
      propertyProjectId,
      rawInput,
    )

    try {
      const upload = await this.objectStore.createUploadGrant(source)
      return { source, upload }
    } catch {
      try {
        await this.sourceRepository.updateSourceStatusInternal(source.id, {
          status: 'failed',
          errorCode: 'upload_grant_failed',
          errorMessage: 'Nie udało się przygotować bezpiecznego uploadu.',
        })
      } catch {
        // API response must remain safe even if persistence is unavailable.
      }
      throw new Error('UPLOAD_GRANT_FAILED')
    }
  }

  async createDownloadUrl(
    userId: string,
    propertyProjectId: string,
    sourceId: string,
    mode: 'download' | 'preview' = 'download',
  ) {
    const source = await this.sourceService.getSource(
      userId,
      propertyProjectId,
      sourceId,
    )
    if (!['review_ready', 'completed'].includes(source.status)) {
      throw new Error('SOURCE_NOT_READY')
    }

    const inlineSafe =
      source.mediaType === 'application/pdf' ||
      source.mediaType.startsWith('image/')
    return this.objectStore.createCleanDownloadUrl(
      source,
      mode === 'preview' && inlineSafe ? 'inline' : 'attachment',
    )
  }
}

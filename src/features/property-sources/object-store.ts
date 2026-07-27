import { z } from 'zod'
import type { PropertySource } from './domain'

const sourceStorageIdentitySchema = z.object({
  organizationId: z.string().uuid(),
  propertyProjectId: z.string().uuid(),
  sourceId: z.string().uuid(),
})

export type SourceUploadGrant = {
  method: 'POST'
  url: string
  fields: Record<string, string>
  expiresAt: string
}

export interface PropertySourceObjectStore {
  createUploadGrant(source: PropertySource): Promise<SourceUploadGrant>
  createCleanDownloadUrl(
    source: PropertySource,
    disposition?: 'attachment' | 'inline',
  ): Promise<{
    url: string
    expiresAt: string
  }>
}

export function createPropertySourceStorageKey(rawInput: {
  organizationId: string
  propertyProjectId: string
  sourceId: string
}): string {
  const input = sourceStorageIdentitySchema.parse(rawInput)

  return [
    'originals',
    'organizations',
    input.organizationId,
    'properties',
    input.propertyProjectId,
    'sources',
    input.sourceId,
    'original',
  ].join('/')
}

export function assertExpectedPropertySourceStorageKey(
  source: PropertySource,
): void {
  const expected = createPropertySourceStorageKey({
    organizationId: source.organizationId,
    propertyProjectId: source.propertyProjectId,
    sourceId: source.id,
  })

  if (source.storageKey !== expected) {
    throw new Error('SOURCE_STORAGE_KEY_INVALID')
  }
}

export function createAttachmentContentDisposition(
  fileName: string,
): string {
  return createContentDisposition(fileName, 'attachment')
}

export function createContentDisposition(
  fileName: string,
  disposition: 'attachment' | 'inline',
): string {
  const safeAscii =
    fileName
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/[\r\n"\\;:]/g, '_')
      .trim()
      .slice(0, 180) || 'source'
  const encoded = encodeURIComponent(
    fileName
      .replace(/[\r\n"\\]/g, '_')
      .trim()
      .slice(0, 180) || 'source',
  )

  return `${disposition}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`
}

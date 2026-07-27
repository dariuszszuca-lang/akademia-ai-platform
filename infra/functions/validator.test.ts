import { describe, expect, it, vi } from 'vitest'
import { createValidatorHandler } from './validator'

const cleanChecksumHex = 'ab'.repeat(32)
const cleanChecksumBase64 = Buffer.from(cleanChecksumHex, 'hex').toString(
  'base64',
)

function event(mediaType = 'text/plain') {
  return {
    sourceId: '00000000-0000-4000-8000-000000000003',
    bucketName: 'property-studio-dev-sources',
    objectKey:
      'originals/organizations/00000000-0000-4000-8000-000000000001/properties/00000000-0000-4000-8000-000000000002/sources/00000000-0000-4000-8000-000000000003/original',
    versionId: 'source-version-1',
    scanResultStatus: 'NO_THREATS_FOUND',
    attempt: 1,
    pipelineVersion: 'property-source-v1',
    context: {
      jobId: '00000000-0000-4000-8000-000000000004',
      source: {
        id: '00000000-0000-4000-8000-000000000003',
        checksumSha256: cleanChecksumHex,
        sizeBytes: 5,
        mediaType,
        storageKey:
          'originals/organizations/00000000-0000-4000-8000-000000000001/properties/00000000-0000-4000-8000-000000000002/sources/00000000-0000-4000-8000-000000000003/original',
      },
      property: {
        propertyType: 'apartment',
        transactionType: 'sale',
      },
      factCatalog: [],
    },
  }
}

describe('property source validator worker', () => {
  it('uses trusted Studio metadata and returns a bounded route', async () => {
    const inspectObject = vi.fn().mockResolvedValue({
      mediaType: 'text/plain',
      expectedSizeBytes: 5,
      objectSizeBytes: 5,
      expectedChecksumSha256Hex: cleanChecksumHex,
      checksumSha256Base64: cleanChecksumBase64,
      guardDutyScanTag: 'NO_THREATS_FOUND',
      headerBytes: new TextEncoder().encode('hello'),
    })
    const handler = createValidatorHandler({ inspectObject })

    await expect(handler(event())).resolves.toMatchObject({
      validation: {
        kind: 'document',
        strategy: 'direct',
      },
    })
    expect(inspectObject).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChecksumSha256Hex: cleanChecksumHex,
        expectedSizeBytes: 5,
        mediaType: 'text/plain',
      }),
    )
  })

  it('fails closed when S3 identity differs from the signed Studio context', async () => {
    const inspectObject = vi.fn()
    const handler = createValidatorHandler({ inspectObject })
    const mismatched = event()
    mismatched.context.source.storageKey = 'originals/other'

    await expect(handler(mismatched)).rejects.toThrow(
      'SOURCE_CONTEXT_MISMATCH',
    )
    expect(inspectObject).not.toHaveBeenCalled()
  })

  it('routes audio to manual review without calling Amazon Transcribe', async () => {
    const inspectObject = vi.fn().mockResolvedValue({
      mediaType: 'audio/mpeg',
      expectedSizeBytes: 5,
      objectSizeBytes: 5,
      expectedChecksumSha256Hex: cleanChecksumHex,
      checksumSha256Base64: cleanChecksumBase64,
      guardDutyScanTag: 'NO_THREATS_FOUND',
      headerBytes: new TextEncoder().encode('ID3xx'),
    })
    const handler = createValidatorHandler({ inspectObject })

    await expect(handler(event('audio/mpeg'))).resolves.toMatchObject({
      result: {
        outcome: 'needs_manual_review',
        errorCode: 'TRANSCRIPTION_FAILED',
        provider: 'amazon-transcribe',
      },
      validation: {
        kind: 'audio',
        strategy: 'manual_review_policy_gate',
      },
    })
  })

  it('prepares and writes derived document parts under a deterministic work prefix', async () => {
    const docxEvent = event(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const inspectObject = vi.fn().mockResolvedValue({
      mediaType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      expectedSizeBytes: 5,
      objectSizeBytes: 5,
      expectedChecksumSha256Hex: cleanChecksumHex,
      checksumSha256Base64: cleanChecksumBase64,
      guardDutyScanTag: 'NO_THREATS_FOUND',
      headerBytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]),
      archiveEntries: ['[Content_Types].xml', 'word/document.xml'],
      bodyBytes: new Uint8Array([1, 2, 3]),
    })
    const prepareObject = vi.fn().mockResolvedValue([
      {
        kind: 'document',
        format: 'txt',
        bytes: new TextEncoder().encode('Powierzchnia 120 m2'),
        pageOffset: 0,
      },
    ])
    const writePart = vi
      .fn()
      .mockResolvedValue(
        's3://property-studio-dev-sources/work/sources/source/part-001.txt',
      )
    const handler = createValidatorHandler({
      inspectObject,
      prepareObject,
      writePart,
    })

    const result = await handler(docxEvent)

    expect(prepareObject).toHaveBeenCalledOnce()
    expect(writePart).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketName: docxEvent.bucketName,
        sourceId: docxEvent.sourceId,
        partNumber: 1,
        extension: 'txt',
      }),
    )
    expect(result).toMatchObject({
      preparedParts: [
        {
          kind: 'document',
          format: 'txt',
          s3Uri:
            's3://property-studio-dev-sources/work/sources/source/part-001.txt',
          pageOffset: 0,
        },
      ],
    })
  })

  it('passes a validated direct image to Bedrock without a public URL', async () => {
    const imageEvent = event('image/jpeg')
    const inspectObject = vi.fn().mockResolvedValue({
      mediaType: 'image/jpeg',
      expectedSizeBytes: 5,
      objectSizeBytes: 5,
      expectedChecksumSha256Hex: cleanChecksumHex,
      checksumSha256Base64: cleanChecksumBase64,
      guardDutyScanTag: 'NO_THREATS_FOUND',
      headerBytes: new Uint8Array([0xff, 0xd8, 0xff, 0, 0]),
      image: { width: 100, height: 100 },
    })
    const handler = createValidatorHandler({ inspectObject })

    await expect(handler(imageEvent)).resolves.toMatchObject({
      preparedParts: [
        {
          kind: 'image',
          format: 'jpeg',
          s3Uri: expect.stringMatching(/^s3:\/\/[^/]+\/originals\//),
        },
      ],
    })
  })

  it('maps a preparation limit failure to a safe callback result', async () => {
    const inspectObject = vi.fn().mockResolvedValue({
      mediaType: 'text/plain',
      expectedSizeBytes: 5_000_000,
      objectSizeBytes: 5_000_000,
      expectedChecksumSha256Hex: cleanChecksumHex,
      checksumSha256Base64: cleanChecksumBase64,
      guardDutyScanTag: 'NO_THREATS_FOUND',
      headerBytes: new TextEncoder().encode('hello'),
      bodyBytes: new TextEncoder().encode('hello'),
    })
    const limitedEvent = event()
    limitedEvent.context.source.sizeBytes = 5_000_000
    const handler = createValidatorHandler({
      inspectObject,
      prepareObject: vi
        .fn()
        .mockRejectedValue(new Error('DOCUMENT_LIMIT_EXCEEDED')),
      writePart: vi.fn(),
    })

    await expect(handler(limitedEvent)).resolves.toMatchObject({
      result: {
        outcome: 'failed',
        errorCode: 'DOCUMENT_LIMIT_EXCEEDED',
      },
    })
  })
})

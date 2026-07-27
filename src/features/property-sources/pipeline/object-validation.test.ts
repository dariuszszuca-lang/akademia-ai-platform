import { describe, expect, it } from 'vitest'
import {
  NEUTRAL_BEDROCK_DOCUMENT_NAME,
  PropertySourceObjectValidationError,
  mapObjectValidationErrorCode,
  validatePropertySourceObject,
} from './object-validation'
import type { PropertySourceObjectInspection } from './object-validation'

const checksumHex = 'ab'.repeat(32)
const checksumBase64 = Buffer.from(checksumHex, 'hex').toString('base64')

describe('property source object validation', () => {
  it('accepts only the exact bytes, base64 checksum and clean scan tag', () => {
    expect(validatePropertySourceObject(pdfInspection())).toMatchObject({
      kind: 'document',
      strategy: 'direct',
      bedrockDocumentName: NEUTRAL_BEDROCK_DOCUMENT_NAME,
    })

    expectValidationCode(
      pdfInspection({ objectSizeBytes: 11_999 }),
      'OBJECT_SIZE_MISMATCH',
    )
    expectValidationCode(
      pdfInspection({ checksumSha256Base64: Buffer.from('c'.repeat(64), 'hex').toString('base64') }),
      'OBJECT_CHECKSUM_MISMATCH',
    )
    expectValidationCode(
      pdfInspection({ guardDutyScanTag: 'THREATS_FOUND' }),
      'OBJECT_NOT_CLEAN',
    )
  })

  it.each([
    ['application/pdf', bytes('not-a-pdf'), { pdf: { encrypted: false, pageCount: 1 } }],
    ['image/jpeg', bytes('not-a-jpeg'), { image: { width: 1200, height: 800 } }],
    ['image/png', bytes('not-a-png'), { image: { width: 1200, height: 800 } }],
    ['image/webp', bytes('not-a-webp'), { image: { width: 1200, height: 800 } }],
    ['audio/mpeg', bytes('not-an-mp3'), {}],
    ['audio/mp4', bytes('not-an-mp4'), {}],
    ['audio/wav', bytes('not-a-wav'), {}],
    ['audio/webm', bytes('not-a-webm'), {}],
  ] as const)('rejects magic bytes that disagree with %s', (
    mediaType,
    headerBytes,
    inspection,
  ) => {
    expectValidationCode(
      baseInspection({ mediaType, headerBytes, ...inspection }),
      'MEDIA_TYPE_MISMATCH',
    )
  })

  it('rejects encrypted and over-limit PDFs, then selects bounded splitting', () => {
    expectValidationCode(
      pdfInspection({ pdf: { encrypted: true, pageCount: 2 } }),
      'PDF_ENCRYPTED',
    )
    expectValidationCode(
      pdfInspection({ pdf: { encrypted: false, pageCount: 101 } }),
      'DOCUMENT_LIMIT_EXCEEDED',
    )
    expect(
      validatePropertySourceObject(
        pdfInspection({
          objectSizeBytes: 5 * 1024 * 1024,
          expectedSizeBytes: 5 * 1024 * 1024,
          pdf: { encrypted: false, pageCount: 41 },
        }),
      ),
    ).toEqual({
      kind: 'document',
      strategy: 'split_pdf',
      bedrockDocumentName: NEUTRAL_BEDROCK_DOCUMENT_NAME,
      pageCount: 41,
      maximumPagesPerPart: 20,
      maximumParts: 5,
    })
  })

  it('requires the expected internal entries for DOCX and XLSX packages', () => {
    const zipHeader = Uint8Array.from([0x50, 0x4b, 0x03, 0x04])

    expect(
      validatePropertySourceObject(
        baseInspection({
          mediaType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          headerBytes: zipHeader,
          archiveEntries: ['[Content_Types].xml', 'word/document.xml'],
        }),
      ),
    ).toMatchObject({ kind: 'document', strategy: 'extract_text' })
    expect(
      validatePropertySourceObject(
        baseInspection({
          mediaType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          headerBytes: zipHeader,
          archiveEntries: ['[Content_Types].xml', 'xl/workbook.xml'],
        }),
      ),
    ).toMatchObject({ kind: 'document', strategy: 'extract_values' })
    expectValidationCode(
      baseInspection({
        mediaType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        headerBytes: zipHeader,
        archiveEntries: ['[Content_Types].xml', 'xl/workbook.xml'],
      }),
      'MEDIA_TYPE_MISMATCH',
    )
  })

  it('validates UTF-8 text and routes CSV values separately', () => {
    expect(
      validatePropertySourceObject(
        baseInspection({
          mediaType: 'text/plain',
          headerBytes: bytes('Opis nieruchomości'),
        }),
      ),
    ).toMatchObject({ kind: 'document', strategy: 'direct' })
    expect(
      validatePropertySourceObject(
        baseInspection({
          mediaType: 'text/csv',
          headerBytes: bytes('pole;wartość\npokoje;3'),
        }),
      ),
    ).toMatchObject({ kind: 'document', strategy: 'extract_values' })
    expectValidationCode(
      baseInspection({
        mediaType: 'text/plain',
        headerBytes: Uint8Array.from([0xc3, 0x28]),
      }),
      'MEDIA_TYPE_MISMATCH',
    )
  })

  it('routes oversized model images through normalization and caps dimensions', () => {
    const direct = validatePropertySourceObject(
      baseInspection({
        mediaType: 'image/png',
        headerBytes: Uint8Array.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]),
        image: { width: 1600, height: 1200 },
      }),
    )
    const normalized = validatePropertySourceObject(
      baseInspection({
        mediaType: 'image/png',
        objectSizeBytes: 4 * 1024 * 1024,
        expectedSizeBytes: 4 * 1024 * 1024,
        headerBytes: Uint8Array.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]),
        image: { width: 9000, height: 6000 },
      }),
    )

    expect(direct).toMatchObject({ kind: 'image', strategy: 'direct' })
    expect(normalized).toEqual({
      kind: 'image',
      strategy: 'normalize',
      maximumOutputBytes: 3_750_000,
      maximumOutputDimension: 8000,
    })
  })

  it('routes supported audio to bounded Polish transcription', () => {
    expect(
      validatePropertySourceObject(
        baseInspection({
          mediaType: 'audio/mpeg',
          headerBytes: bytes('ID3fixture'),
        }),
      ),
    ).toEqual({
      kind: 'audio',
      strategy: 'transcribe',
      languageCode: 'pl-PL',
    })
  })

  it('uses a neutral Bedrock name and safe validation errors', () => {
    expect(NEUTRAL_BEDROCK_DOCUMENT_NAME).toBe('property-source')
    expect(NEUTRAL_BEDROCK_DOCUMENT_NAME).not.toContain(
      'ignore-all-instructions',
    )

    try {
      validatePropertySourceObject(
        pdfInspection({
          guardDutyScanTag:
            'THREATS_FOUND:arn:aws:s3:::secret/document-content',
        }),
      )
      throw new Error('Expected validation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(PropertySourceObjectValidationError)
      expect(error instanceof Error ? error.message : String(error)).toBe(
        'OBJECT_NOT_CLEAN',
      )
      expect(JSON.stringify(error)).not.toContain('arn:aws')
      expect(JSON.stringify(error)).not.toContain('document-content')
    }
  })

  it('maps detailed validation failures to a bounded product error', () => {
    expect(mapObjectValidationErrorCode('OBJECT_CHECKSUM_MISMATCH')).toBe(
      'OBJECT_VALIDATION_FAILED',
    )
    expect(mapObjectValidationErrorCode('PDF_ENCRYPTED')).toBe(
      'UNSUPPORTED_MEDIA',
    )
    expect(mapObjectValidationErrorCode('DOCUMENT_LIMIT_EXCEEDED')).toBe(
      'DOCUMENT_LIMIT_EXCEEDED',
    )
  })

  it('rejects any object beyond the product upload limit', () => {
    expectValidationCode(
      pdfInspection({
        objectSizeBytes: 25 * 1024 * 1024 + 1,
        expectedSizeBytes: 25 * 1024 * 1024 + 1,
      }),
      'DOCUMENT_LIMIT_EXCEEDED',
    )
  })
})

function pdfInspection(
  overrides: Partial<PropertySourceObjectInspection> = {},
): PropertySourceObjectInspection {
  return baseInspection({
    mediaType: 'application/pdf',
    headerBytes: bytes('%PDF-1.7'),
    pdf: { encrypted: false, pageCount: 2 },
    ...overrides,
  })
}

function baseInspection(
  overrides: Partial<PropertySourceObjectInspection> = {},
): PropertySourceObjectInspection {
  return {
    mediaType: 'application/pdf',
    expectedSizeBytes: 12_000,
    objectSizeBytes: 12_000,
    expectedChecksumSha256Hex: checksumHex,
    checksumSha256Base64: checksumBase64,
    guardDutyScanTag: 'NO_THREATS_FOUND',
    headerBytes: bytes('%PDF-1.7'),
    pdf: { encrypted: false, pageCount: 2 },
    ...overrides,
  }
}

function expectValidationCode(
  inspection: PropertySourceObjectInspection,
  code: string,
) {
  expect(() => validatePropertySourceObject(inspection)).toThrow(code)
}

function bytes(value: string) {
  return new TextEncoder().encode(value)
}

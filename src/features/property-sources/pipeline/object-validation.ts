import crypto from 'node:crypto'
import type { supportedSourceMediaTypes } from '../domain'

const MAX_PRODUCT_BYTES = 25 * 1024 * 1024
const MAX_BEDROCK_DOCUMENT_BYTES = 4_500_000
const MAX_BEDROCK_IMAGE_BYTES = 3_750_000
const MAX_BEDROCK_IMAGE_DIMENSION = 8000
const MAX_PDF_PAGES = 100
const MAX_PDF_PAGES_PER_PART = 20
const MAX_PDF_PARTS = 5

export const NEUTRAL_BEDROCK_DOCUMENT_NAME = 'property-source'

type SourceMediaType = (typeof supportedSourceMediaTypes)[number]

export type PropertySourceObjectInspection = {
  mediaType: SourceMediaType
  expectedSizeBytes: number
  objectSizeBytes: number
  expectedChecksumSha256Hex: string
  checksumSha256Base64: string
  guardDutyScanTag: string | undefined
  headerBytes: Uint8Array
  pdf?: {
    encrypted: boolean
    pageCount: number
  }
  image?: {
    width: number
    height: number
  }
  archiveEntries?: string[]
}

export type ObjectValidationErrorCode =
  | 'DOCUMENT_LIMIT_EXCEEDED'
  | 'MEDIA_TYPE_MISMATCH'
  | 'OBJECT_CHECKSUM_MISMATCH'
  | 'OBJECT_NOT_CLEAN'
  | 'OBJECT_SIZE_MISMATCH'
  | 'OBJECT_VALIDATION_FAILED'
  | 'PDF_ENCRYPTED'

export class PropertySourceObjectValidationError extends Error {
  constructor(readonly code: ObjectValidationErrorCode) {
    super(code)
    this.name = 'PropertySourceObjectValidationError'
  }
}

export function mapObjectValidationErrorCode(
  code: ObjectValidationErrorCode,
) {
  if (code === 'DOCUMENT_LIMIT_EXCEEDED') {
    return 'DOCUMENT_LIMIT_EXCEEDED' as const
  }
  if (code === 'PDF_ENCRYPTED') {
    return 'UNSUPPORTED_MEDIA' as const
  }
  return 'OBJECT_VALIDATION_FAILED' as const
}

export function validatePropertySourceObject(
  inspection: PropertySourceObjectInspection,
) {
  validateObjectIdentity(inspection)
  validateMediaSignature(inspection)

  switch (inspection.mediaType) {
    case 'application/pdf':
      return routePdf(inspection)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      validateArchive(
        inspection.archiveEntries,
        'word/document.xml',
      )
      return documentRoute('extract_text')
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      validateArchive(
        inspection.archiveEntries,
        'xl/workbook.xml',
      )
      return documentRoute('extract_values')
    case 'text/csv':
      return documentRoute('extract_values')
    case 'text/plain':
      return inspection.objectSizeBytes <= MAX_BEDROCK_DOCUMENT_BYTES
        ? documentRoute('direct')
        : documentRoute('extract_text')
    case 'image/jpeg':
    case 'image/png':
    case 'image/webp':
      return routeImage(inspection)
    case 'audio/mpeg':
    case 'audio/mp4':
    case 'audio/wav':
    case 'audio/webm':
      return {
        kind: 'audio' as const,
        strategy: 'transcribe' as const,
        languageCode: 'pl-PL' as const,
      }
  }
}

function validateObjectIdentity(
  inspection: PropertySourceObjectInspection,
) {
  if (
    !Number.isSafeInteger(inspection.expectedSizeBytes) ||
    !Number.isSafeInteger(inspection.objectSizeBytes) ||
    inspection.expectedSizeBytes <= 0 ||
    inspection.objectSizeBytes <= 0
  ) {
    fail('OBJECT_VALIDATION_FAILED')
  }
  if (inspection.objectSizeBytes !== inspection.expectedSizeBytes) {
    fail('OBJECT_SIZE_MISMATCH')
  }
  if (inspection.objectSizeBytes > MAX_PRODUCT_BYTES) {
    fail('DOCUMENT_LIMIT_EXCEEDED')
  }
  if (inspection.guardDutyScanTag !== 'NO_THREATS_FOUND') {
    fail('OBJECT_NOT_CLEAN')
  }

  const expectedChecksum = parseHexChecksum(
    inspection.expectedChecksumSha256Hex,
  )
  const objectChecksum = parseBase64Checksum(
    inspection.checksumSha256Base64,
  )
  if (!crypto.timingSafeEqual(expectedChecksum, objectChecksum)) {
    fail('OBJECT_CHECKSUM_MISMATCH')
  }
}

function validateMediaSignature(
  inspection: PropertySourceObjectInspection,
) {
  const header = inspection.headerBytes
  let matches = false

  switch (inspection.mediaType) {
    case 'application/pdf':
      matches = startsWithAscii(header, '%PDF-')
      break
    case 'image/jpeg':
      matches =
        header.length >= 3 &&
        header[0] === 0xff &&
        header[1] === 0xd8 &&
        header[2] === 0xff
      break
    case 'image/png':
      matches = startsWithBytes(
        header,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      )
      break
    case 'image/webp':
      matches =
        startsWithAscii(header, 'RIFF') &&
        asciiAt(header, 8, 'WEBP')
      break
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      matches = startsWithBytes(header, [0x50, 0x4b, 0x03, 0x04])
      break
    case 'text/plain':
    case 'text/csv':
      matches = isValidTextPrefix(header)
      break
    case 'audio/mpeg':
      matches =
        startsWithAscii(header, 'ID3') ||
        (header.length >= 2 &&
          header[0] === 0xff &&
          (header[1] & 0xe0) === 0xe0)
      break
    case 'audio/mp4':
      matches = asciiAt(header, 4, 'ftyp')
      break
    case 'audio/wav':
      matches =
        startsWithAscii(header, 'RIFF') &&
        asciiAt(header, 8, 'WAVE')
      break
    case 'audio/webm':
      matches = startsWithBytes(header, [0x1a, 0x45, 0xdf, 0xa3])
      break
  }

  if (!matches) fail('MEDIA_TYPE_MISMATCH')
}

function routePdf(inspection: PropertySourceObjectInspection) {
  const pdf = inspection.pdf
  if (
    !pdf ||
    !Number.isSafeInteger(pdf.pageCount) ||
    pdf.pageCount <= 0
  ) {
    fail('OBJECT_VALIDATION_FAILED')
  }
  if (pdf.encrypted) fail('PDF_ENCRYPTED')
  if (pdf.pageCount > MAX_PDF_PAGES) {
    fail('DOCUMENT_LIMIT_EXCEEDED')
  }

  if (
    pdf.pageCount <= MAX_PDF_PAGES_PER_PART &&
    inspection.objectSizeBytes <= MAX_BEDROCK_DOCUMENT_BYTES
  ) {
    return {
      ...documentRoute('direct'),
      pageCount: pdf.pageCount,
    }
  }

  return {
    kind: 'document' as const,
    strategy: 'split_pdf' as const,
    bedrockDocumentName: NEUTRAL_BEDROCK_DOCUMENT_NAME,
    pageCount: pdf.pageCount,
    maximumPagesPerPart: MAX_PDF_PAGES_PER_PART,
    maximumParts: MAX_PDF_PARTS,
  }
}

function routeImage(inspection: PropertySourceObjectInspection) {
  const image = inspection.image
  if (
    !image ||
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  ) {
    fail('OBJECT_VALIDATION_FAILED')
  }

  if (
    inspection.objectSizeBytes <= MAX_BEDROCK_IMAGE_BYTES &&
    image.width <= MAX_BEDROCK_IMAGE_DIMENSION &&
    image.height <= MAX_BEDROCK_IMAGE_DIMENSION
  ) {
    return { kind: 'image' as const, strategy: 'direct' as const }
  }

  return {
    kind: 'image' as const,
    strategy: 'normalize' as const,
    maximumOutputBytes: MAX_BEDROCK_IMAGE_BYTES,
    maximumOutputDimension: MAX_BEDROCK_IMAGE_DIMENSION,
  }
}

function documentRoute(
  strategy: 'direct' | 'extract_text' | 'extract_values',
) {
  return {
    kind: 'document' as const,
    strategy,
    bedrockDocumentName: NEUTRAL_BEDROCK_DOCUMENT_NAME,
  }
}

function validateArchive(
  entries: string[] | undefined,
  requiredEntry: string,
) {
  if (
    !entries ||
    entries.some(
      (entry) =>
        entry.includes('..') ||
        entry.includes('\\') ||
        entry.startsWith('/'),
    ) ||
    !entries.includes('[Content_Types].xml') ||
    !entries.includes(requiredEntry)
  ) {
    fail('MEDIA_TYPE_MISMATCH')
  }
}

function parseHexChecksum(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    fail('OBJECT_VALIDATION_FAILED')
  }
  return Buffer.from(value, 'hex')
}

function parseBase64Checksum(value: string) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    fail('OBJECT_VALIDATION_FAILED')
  }
  const decoded = Buffer.from(value, 'base64')
  if (decoded.length !== 32 || decoded.toString('base64') !== value) {
    fail('OBJECT_VALIDATION_FAILED')
  }
  return decoded
}

function startsWithAscii(value: Uint8Array, prefix: string) {
  return asciiAt(value, 0, prefix)
}

function asciiAt(value: Uint8Array, offset: number, expected: string) {
  return startsWithBytes(
    value.slice(offset),
    Array.from(expected).map((character) => character.charCodeAt(0)),
  )
}

function startsWithBytes(value: Uint8Array, expected: number[]) {
  return (
    value.length >= expected.length &&
    expected.every((byte, index) => value[index] === byte)
  )
}

function isValidTextPrefix(value: Uint8Array) {
  if (value.length === 0 || value.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(value)
    return true
  } catch {
    return false
  }
}

function fail(code: ObjectValidationErrorCode): never {
  throw new PropertySourceObjectValidationError(code)
}

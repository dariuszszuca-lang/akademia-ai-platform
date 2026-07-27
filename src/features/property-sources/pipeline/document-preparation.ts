import { strFromU8, unzipSync, type UnzipFileInfo } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import type { supportedSourceMediaTypes } from '../domain'

const MAX_ARCHIVE_EXPANDED_BYTES = 50 * 1024 * 1024
const MAX_PREPARED_PART_BYTES = 4_200_000
const MAX_PREPARED_PARTS = 5
const MAX_LOCATOR_RANGES_PER_PART = 100_000
const MAX_IMAGE_PIXELS = 100_000_000

type SourceMediaType = (typeof supportedSourceMediaTypes)[number]

type PreparationRoute =
  | {
      kind: 'document'
      strategy:
        | 'direct'
        | 'extract_text'
        | 'extract_values'
        | 'split_pdf'
      bedrockDocumentName: string
      pageCount?: number
      maximumPagesPerPart?: number
      maximumParts?: number
    }
  | {
      kind: 'image'
      strategy: 'direct' | 'normalize'
      maximumOutputBytes?: number
      maximumOutputDimension?: number
    }

export type PreparedLocatorRange = {
  start: number
  end: number
  sheet: string
  row: number
  column: string
}

export type PreparedSourcePart =
  | {
      kind: 'document'
      format: 'pdf' | 'txt'
      bytes: Uint8Array
      pageOffset: number
      locatorMap?: PreparedLocatorRange[]
    }
  | {
      kind: 'image'
      format: 'webp'
      bytes: Uint8Array
    }

export async function inspectPropertySourceBytes(
  mediaType: SourceMediaType,
  bytes: Uint8Array,
) {
  switch (mediaType) {
    case 'application/pdf': {
      const pdf = await PDFDocument.load(bytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      })
      return {
        pdf: {
          encrypted: pdf.isEncrypted,
          pageCount: pdf.getPageCount(),
        },
      }
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      const archive = openOfficeArchive(mediaType, bytes)
      return { archiveEntries: Object.keys(archive) }
    }
    case 'image/jpeg':
    case 'image/png':
    case 'image/webp': {
      const metadata = await sharp(bytes, {
        failOn: 'error',
        limitInputPixels: MAX_IMAGE_PIXELS,
      }).metadata()
      if (!metadata.width || !metadata.height) {
        throw new Error('IMAGE_METADATA_INVALID')
      }
      return {
        image: {
          width: metadata.width,
          height: metadata.height,
        },
      }
    }
    default:
      return {}
  }
}

export async function preparePropertySourceBytes({
  mediaType,
  bytes,
  route,
}: {
  mediaType: SourceMediaType
  bytes: Uint8Array
  route: PreparationRoute
}): Promise<PreparedSourcePart[]> {
  if (route.kind === 'image') {
    if (route.strategy === 'direct') {
      throw new Error('DIRECT_IMAGE_REUSES_ORIGINAL')
    }
    return [
      await normalizeImage(
        bytes,
        route.maximumOutputBytes ?? 3_750_000,
        route.maximumOutputDimension ?? 8000,
      ),
    ]
  }
  if (route.strategy === 'direct') {
    throw new Error('DIRECT_DOCUMENT_REUSES_ORIGINAL')
  }
  if (
    mediaType === 'application/pdf' &&
    route.strategy === 'split_pdf'
  ) {
    return splitPdf(
      bytes,
      route.maximumPagesPerPart ?? 20,
      route.maximumParts ?? MAX_PREPARED_PARTS,
    )
  }
  if (
    mediaType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    route.strategy === 'extract_text'
  ) {
    return chunkText(extractDocx(bytes))
  }
  if (
    mediaType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
    route.strategy === 'extract_values'
  ) {
    return chunkLocatedLines(extractXlsx(bytes))
  }
  if (
    mediaType === 'text/csv' &&
    route.strategy === 'extract_values'
  ) {
    return chunkLocatedLines(extractCsv(bytes))
  }
  if (
    mediaType === 'text/plain' &&
    route.strategy === 'extract_text'
  ) {
    return chunkText(decodeUtf8(bytes))
  }
  throw new Error('UNSUPPORTED_PREPARATION_ROUTE')
}

async function splitPdf(
  bytes: Uint8Array,
  maximumPagesPerPart: number,
  maximumParts: number,
) {
  const source = await PDFDocument.load(bytes, {
    updateMetadata: false,
  })
  const ranges = []
  for (
    let start = 0;
    start < source.getPageCount();
    start += maximumPagesPerPart
  ) {
    ranges.push({
      start,
      end: Math.min(
        start + maximumPagesPerPart,
        source.getPageCount(),
      ),
    })
  }
  const output: PreparedSourcePart[] = []
  for (const range of ranges) {
    await appendPdfRange(source, range.start, range.end, output)
  }
  if (output.length > maximumParts) {
    throw new Error('DOCUMENT_LIMIT_EXCEEDED')
  }
  return output
}

async function appendPdfRange(
  source: PDFDocument,
  start: number,
  end: number,
  output: PreparedSourcePart[],
): Promise<void> {
  const target = await PDFDocument.create()
  const indexes = Array.from(
    { length: end - start },
    (_, index) => start + index,
  )
  const pages = await target.copyPages(source, indexes)
  pages.forEach((page) => target.addPage(page))
  const bytes = await target.save({
    addDefaultPage: false,
    useObjectStreams: true,
    objectsPerTick: 50,
  })
  if (bytes.byteLength <= MAX_PREPARED_PART_BYTES) {
    output.push({
      kind: 'document',
      format: 'pdf',
      bytes,
      pageOffset: start,
    })
    return
  }
  if (end - start <= 1) throw new Error('DOCUMENT_LIMIT_EXCEEDED')
  const middle = start + Math.ceil((end - start) / 2)
  await appendPdfRange(source, start, middle, output)
  await appendPdfRange(source, middle, end, output)
}

function extractDocx(bytes: Uint8Array) {
  const archive = openOfficeArchive(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes,
  )
  const document = requireArchiveEntry(
    archive,
    'word/document.xml',
  )
  assertSafeXml(document)
  const withoutEmbeddedObjects = document
    .replace(/<w:object\b[\s\S]*?<\/w:object>/gi, '')
    .replace(/<w:pict\b[\s\S]*?<\/w:pict>/gi, '')
  return decodeXmlText(
    withoutEmbeddedObjects
      .replace(/<\/w:tc>/gi, '\t')
      .replace(/<\/w:tr>/gi, '\n')
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<w:tab\s*\/>/gi, '\t')
      .replace(/<w:br\s*\/>/gi, '\n')
      .replace(/<(?!\/?w:t\b)[^>]+>/gi, '')
      .replace(/<\/?w:t\b[^>]*>/gi, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractXlsx(bytes: Uint8Array): LocatedLine[] {
  const archive = openOfficeArchive(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    bytes,
  )
  const workbook = requireArchiveEntry(archive, 'xl/workbook.xml')
  const relationships = requireArchiveEntry(
    archive,
    'xl/_rels/workbook.xml.rels',
  )
  assertSafeXml(workbook)
  assertSafeXml(relationships)
  const relationTargets = new Map(
    [...relationships.matchAll(/<Relationship\b([^>]*)\/?>/gi)]
      .map((match) => [
        readXmlAttribute(match[1], 'Id'),
        readXmlAttribute(match[1], 'Target'),
      ])
      .filter(
        (pair): pair is [string, string] => Boolean(pair[0] && pair[1]),
      ),
  )
  const sharedStrings = archive['xl/sharedStrings.xml']
    ? extractSharedStrings(archive['xl/sharedStrings.xml'])
    : []
  const lines: LocatedLine[] = []

  for (const sheetMatch of workbook.matchAll(/<sheet\b([^>]*)\/?>/gi)) {
    const attributes = sheetMatch[1]
    const state = readXmlAttribute(attributes, 'state')
    if (state && state !== 'visible') continue
    const sheet = readXmlAttribute(attributes, 'name')
    const relationId =
      readXmlAttribute(attributes, 'r:id') ??
      readXmlAttribute(attributes, 'id')
    const target = relationId
      ? relationTargets.get(relationId)
      : undefined
    if (!sheet || !target || target.includes('..')) continue
    const normalizedTarget = target.startsWith('/')
      ? target.slice(1)
      : target.startsWith('xl/')
        ? target
        : `xl/${target}`
    const sheetXml = archive[normalizedTarget]
    if (!sheetXml) continue
    assertSafeXml(sheetXml)

    for (const cellMatch of sheetXml.matchAll(
      /<c\b([^>]*)>([\s\S]*?)<\/c>/gi,
    )) {
      const reference = readXmlAttribute(cellMatch[1], 'r')
      const coordinates = reference
        ? parseCellReference(reference)
        : undefined
      if (!coordinates) continue
      const type = readXmlAttribute(cellMatch[1], 't')
      const body = cellMatch[2]
      const value =
        type === 'inlineStr'
          ? extractTextNodes(body).join('')
          : firstTagValue(body, 'v')
      if (value === undefined || value === '') continue
      const decodedValue =
        type === 's'
          ? sharedStrings[Number(value)] ?? ''
          : decodeXmlText(value)
      if (!decodedValue) continue
      lines.push({
        text: `${reference}\t${decodedValue}`,
        sheet,
        ...coordinates,
      })
    }
  }
  return lines
}

function extractSharedStrings(xml: string) {
  assertSafeXml(xml)
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(
    (match) => extractTextNodes(match[1]).join(''),
  )
}

function extractTextNodes(xml: string) {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(
    (match) => decodeXmlText(match[1]),
  )
}

function firstTagValue(xml: string, tagName: string) {
  const match = new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'i',
  ).exec(xml)
  return match ? match[1] : undefined
}

type LocatedLine = {
  text: string
  sheet: string
  row: number
  column: string
}

function extractCsv(bytes: Uint8Array): LocatedLine[] {
  const rows = parseCsv(decodeUtf8(bytes))
  const lines: LocatedLine[] = []
  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value.trim()) return
      lines.push({
        text: `${columnName(columnIndex + 1)}${rowIndex + 1}\t${value}`,
        sheet: 'CSV',
        row: rowIndex + 1,
        column: columnName(columnIndex + 1),
      })
    })
  })
  return lines
}

function parseCsv(text: string) {
  const delimiter = detectCsvDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
      continue
    }
    if (character === '"') quoted = true
    else if (character === delimiter) {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }
  if (quoted) throw new Error('MALFORMED_CSV')
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

function detectCsvDelimiter(text: string) {
  const counts = new Map([
    [',', 0],
    [';', 0],
    ['\t', 0],
  ])
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (!quoted && (character === '\n' || character === '\r')) break
    if (!quoted && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort(
    ([delimiterA, countA], [delimiterB, countB]) =>
      countB - countA || delimiterA.localeCompare(delimiterB),
  )[0][0]
}

function chunkText(text: string): PreparedSourcePart[] {
  return chunkLocatedLines(
    text
      .split('\n')
      .filter((line) => line.trim())
      .map((line, index) => ({
        text: line,
        sheet: 'TEXT',
        row: index + 1,
        column: 'A',
      })),
    false,
  )
}

function chunkLocatedLines(
  lines: LocatedLine[],
  includeLocatorMap = true,
): PreparedSourcePart[] {
  const encoder = new TextEncoder()
  const parts: PreparedSourcePart[] = []
  let currentText = ''
  let currentMap: PreparedLocatorRange[] = []

  const flush = () => {
    if (!currentText) return
    parts.push({
      kind: 'document',
      format: 'txt',
      bytes: encoder.encode(currentText),
      pageOffset: 0,
      ...(includeLocatorMap ? { locatorMap: currentMap } : {}),
    })
    currentText = ''
    currentMap = []
  }

  for (const line of lines) {
    const normalized = `${line.text.replace(/\u0000/g, '')}\n`
    if (encoder.encode(normalized).byteLength > MAX_PREPARED_PART_BYTES) {
      throw new Error('DOCUMENT_LIMIT_EXCEEDED')
    }
    if (
      currentText &&
      (encoder.encode(currentText + normalized).byteLength >
        MAX_PREPARED_PART_BYTES ||
        currentMap.length >= MAX_LOCATOR_RANGES_PER_PART)
    ) {
      flush()
    }
    const start = currentText.length
    currentText += normalized
    currentMap.push({
      start,
      end: currentText.length,
      sheet: line.sheet,
      row: line.row,
      column: line.column,
    })
  }
  flush()
  if (parts.length > MAX_PREPARED_PARTS) {
    throw new Error('DOCUMENT_LIMIT_EXCEEDED')
  }
  return parts
}

async function normalizeImage(
  bytes: Uint8Array,
  maximumOutputBytes: number,
  maximumOutputDimension: number,
): Promise<PreparedSourcePart> {
  for (const quality of [82, 70, 55, 40]) {
    const output = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate()
      .resize({
        width: maximumOutputDimension,
        height: maximumOutputDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer()
    if (output.byteLength <= maximumOutputBytes) {
      return {
        kind: 'image',
        format: 'webp',
        bytes: output,
      }
    }
  }
  throw new Error('DOCUMENT_LIMIT_EXCEEDED')
}

function openOfficeArchive(
  mediaType:
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  bytes: Uint8Array,
) {
  let expandedBytes = 0
  const isAllowed =
    mediaType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ? (name: string) => name === 'word/document.xml'
      : (name: string) =>
          name === 'xl/workbook.xml' ||
          name === 'xl/_rels/workbook.xml.rels' ||
          name === 'xl/sharedStrings.xml' ||
          /^xl\/worksheets\/[^/]+\.xml$/.test(name)
  const shouldExtract = (name: string) =>
    name === '[Content_Types].xml' || isAllowed(name)
  const unzipped = unzipSync(bytes, {
    filter: (file: UnzipFileInfo) => {
      if (!shouldExtract(file.name)) return false
      expandedBytes += file.originalSize
      if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
        throw new Error('DOCUMENT_LIMIT_EXCEEDED')
      }
      return true
    },
  })
  return Object.fromEntries(
    Object.entries(unzipped).map(([name, value]) => [
      name,
      strFromU8(value),
    ]),
  )
}

function requireArchiveEntry(
  archive: Record<string, string>,
  name: string,
) {
  const value = archive[name]
  if (!value) throw new Error('MALFORMED_DOCUMENT')
  return value
}

function assertSafeXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('UNSAFE_XML')
}

function readXmlAttribute(
  attributes: string,
  name: string,
) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(
    `(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    'i',
  ).exec(attributes)
  return match ? decodeXmlText(match[1] ?? match[2]) : undefined
}

function decodeXmlText(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('MALFORMED_DOCUMENT')
  }
}

function parseCellReference(reference: string) {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(reference)
  if (!match) return undefined
  const row = Number(match[2])
  if (row > 1_048_576) return undefined
  return { column: match[1], row }
}

function columnName(index: number) {
  let value = index
  let name = ''
  while (value > 0) {
    value -= 1
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }
  if (name.length > 3) throw new Error('DOCUMENT_LIMIT_EXCEEDED')
  return name
}

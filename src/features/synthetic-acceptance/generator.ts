import { createHash } from 'node:crypto'
import { strToU8, zipSync, type Zippable } from 'fflate'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { resolveFactDefinition } from '../property-sources/catalog'
import type {
  SyntheticCase,
  SyntheticCorpus,
  SyntheticMaterial,
  SyntheticMaterialKind,
  SupportedSourceMediaType,
} from './domain'
import { syntheticCorpusSchema } from './domain'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_CORPUS_BYTES = 100 * 1024 * 1024
const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z')
const ZIP_DATE = new Date('1980-01-01T00:00:00.000Z')

export type GeneratedSyntheticMaterial = {
  caseCode: SyntheticCase['code']
  materialId: string
  fileName: string
  kind: SyntheticMaterialKind
  mediaType: SupportedSourceMediaType
  bytes: Uint8Array
  checksumSha256: string
}

export async function generateSyntheticCorpus(
  corpus: SyntheticCorpus,
): Promise<GeneratedSyntheticMaterial[]> {
  const parsed = syntheticCorpusSchema.parse(corpus)
  const generated: GeneratedSyntheticMaterial[] = []

  for (const item of parsed.cases) {
    for (const source of item.materials) {
      const bytes = await generateMaterial(item, source)
      generated.push({
        caseCode: item.code,
        materialId: source.id,
        fileName: source.fileName,
        kind: source.kind,
        mediaType: source.mediaType,
        bytes,
        checksumSha256: createHash('sha256')
          .update(bytes)
          .digest('hex'),
      })
    }
  }

  assertGeneratedCorpusLimits(generated)
  return generated
}

async function generateMaterial(
  item: SyntheticCase,
  source: SyntheticMaterial,
): Promise<Uint8Array> {
  switch (source.kind) {
    case 'pdf':
      return generatePdf(item, source)
    case 'jpeg':
    case 'png':
      return generateImage(item, source)
    case 'docx':
      return generateDocx(item, source)
    case 'xlsx':
      return generateXlsx(item, source)
    case 'csv':
      return encode(generateCsv(item, source))
    case 'txt':
      return encode(generatePlainText(item, source))
  }
}

async function generatePdf(
  item: SyntheticCase,
  source: SyntheticMaterial,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(source.id)
  document.setAuthor('Property Intelligence Studio')
  document.setSubject('Deterministyczny materiał syntetyczny')
  document.setCreator('Property Intelligence Studio')
  document.setProducer('Property Intelligence Studio')
  document.setCreationDate(FIXED_DATE)
  document.setModificationDate(FIXED_DATE)

  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([595, 842])
  const lines = materialLines(item, source).map(toPdfAscii)

  page.drawText('PROPERTY INTELLIGENCE STUDIO', {
    x: 48,
    y: 790,
    size: 12,
    font,
    color: rgb(0.07, 0.14, 0.16),
  })

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 48,
      y: 750 - index * 28,
      size: 10,
      font,
      color: rgb(0.12, 0.18, 0.2),
      maxWidth: 500,
    })
  })

  return document.save({
    addDefaultPage: false,
    useObjectStreams: false,
    updateFieldAppearances: false,
  })
}

async function generateImage(
  item: SyntheticCase,
  source: SyntheticMaterial,
): Promise<Uint8Array> {
  const lines = materialLines(item, source)
  const svg = [
    '<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">',
    '<rect width="1200" height="800" fill="#f2ede3"/>',
    '<rect x="48" y="48" width="1104" height="704" rx="28" fill="#fffdf8" stroke="#bd9360" stroke-width="3"/>',
    '<text x="88" y="115" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#162026">PROPERTY INTELLIGENCE STUDIO</text>',
    ...lines.map(
      (line, index) =>
        `<text x="88" y="${175 + index * 58}" font-family="Arial, sans-serif" font-size="24" fill="#26383c">${escapeXml(line)}</text>`,
    ),
    '</svg>',
  ].join('')
  const pipeline = sharp(Buffer.from(svg))

  return source.kind === 'jpeg'
    ? new Uint8Array(
        await pipeline
          .jpeg({
            quality: 90,
            chromaSubsampling: '4:4:4',
            mozjpeg: false,
          })
          .toBuffer(),
      )
    : new Uint8Array(
        await pipeline
          .png({ compressionLevel: 9, adaptiveFiltering: false })
          .toBuffer(),
      )
}

function generateDocx(
  item: SyntheticCase,
  source: SyntheticMaterial,
): Uint8Array {
  const paragraphs = materialLines(item, source)
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`,
    )
    .join('')

  return createDeterministicZip({
    '[Content_Types].xml': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>',
    ),
    'word/document.xml': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        `<w:body>${paragraphs}<w:sectPr/></w:body>` +
        '</w:document>',
    ),
  })
}

function generateXlsx(
  item: SyntheticCase,
  source: SyntheticMaterial,
): Uint8Array {
  const rows =
    source.facts.length === 0
      ? '<row r="1"><c r="A1" t="inlineStr"><is><t>MATERIAŁ BEZ DANYCH REFERENCYJNYCH</t></is></c></row>'
      : source.facts
          .map((fact, index) => {
            const row = index + 2
            const column = String.fromCharCode(66 + index)
            const label = factLabel(item, fact.factKey)
            return [
              `<row r="${row}">`,
              inlineStringCell(`A${row}`, label),
              inlineStringCell(
                `${column}${row}`,
                formatValue(fact.value, fact.unit),
              ),
              inlineStringCell(`E${row}`, fact.evidenceId),
              '</row>',
            ].join('')
          })
          .join('')

  return createDeterministicZip({
    '[Content_Types].xml': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Dane" sheetId="1" r:id="rId1"/></sheets>' +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>',
    ),
    'xl/worksheets/sheet1.xml': encode(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${rows}</sheetData></worksheet>`,
    ),
  })
}

function generateCsv(
  item: SyntheticCase,
  source: SyntheticMaterial,
): string {
  const rows = ['etykieta;wartosc_b;wartosc_c;wartosc_d;dowod']

  for (const [index, fact] of source.facts.entries()) {
    const columns = ['', '', '', '', fact.evidenceId]
    columns[0] = factLabel(item, fact.factKey)
    columns[index + 1] = formatValue(fact.value, fact.unit)
    rows.push(columns.map(csvCell).join(';'))
  }

  if (source.facts.length === 0) {
    rows.push('MATERIAŁ BEZ DANYCH REFERENCYJNYCH;;;;')
  }

  return `${rows.join('\n')}\n`
}

function generatePlainText(
  item: SyntheticCase,
  source: SyntheticMaterial,
): string {
  return `${materialLines(item, source).join('\n')}\n`
}

function materialLines(
  item: SyntheticCase,
  source: SyntheticMaterial,
): string[] {
  if (source.facts.length === 0) {
    return [
      `CASE ${item.code}`,
      'MATERIAŁ KONTROLNY',
      'BRAK DANYCH REFERENCYJNYCH',
    ]
  }

  if (source.kind === 'docx' || source.kind === 'txt') {
    return source.facts.map((fact) =>
      `${fact.evidenceId} | ${fact.factKey}: ${formatValue(fact.value, fact.unit)}`.padEnd(
        200,
        '_',
      ),
    )
  }

  return source.facts.map(
    (fact) =>
      `${fact.evidenceId} | ${factLabel(item, fact.factKey)}: ${formatValue(fact.value, fact.unit)}`,
  )
}

function factLabel(item: SyntheticCase, factKey: string): string {
  return (
    resolveFactDefinition(factKey, item.propertyType)?.label ?? factKey
  )
}

function formatValue(value: unknown, unit?: string): string {
  const formatted =
    typeof value === 'string' ? value : JSON.stringify(value)
  return unit ? `${formatted} ${unit}` : formatted
}

function inlineStringCell(reference: string, value: string): string {
  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function createDeterministicZip(entries: Zippable): Uint8Array {
  return zipSync(entries, {
    level: 6,
    mtime: ZIP_DATE,
  })
}

function encode(value: string): Uint8Array {
  return strToU8(value)
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function toPdfAscii(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
}

function assertGeneratedCorpusLimits(
  generated: GeneratedSyntheticMaterial[],
): void {
  for (const item of generated) {
    if (
      item.bytes.byteLength === 0 ||
      item.bytes.byteLength > MAX_FILE_BYTES
    ) {
      throw new Error(`SYNTHETIC_FILE_SIZE_INVALID:${item.materialId}`)
    }
  }

  const totalBytes = generated.reduce(
    (total, item) => total + item.bytes.byteLength,
    0,
  )
  if (totalBytes > MAX_CORPUS_BYTES) {
    throw new Error('SYNTHETIC_CORPUS_SIZE_INVALID')
  }
}

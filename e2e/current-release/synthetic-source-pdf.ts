import { createHash } from 'node:crypto'
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'

const MAX_SOURCE_BYTES = 25 * 1024 * 1024

export type SyntheticSourcePdf = {
  name: string
  mimeType: 'application/pdf'
  buffer: Buffer
  sizeBytes: number
  checksumSha256: string
}

export type SyntheticSourceUploadPayload = {
  name: string
  mimeType: 'application/pdf'
  buffer: Buffer
}

export async function createSyntheticSourcePdf(input: {
  runId: string
}): Promise<SyntheticSourcePdf> {
  try {
    return await createSyntheticSourcePdfUnsafe(input.runId)
  } catch {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }
}

async function createSyntheticSourcePdfUnsafe(
  rawRunId: string,
): Promise<SyntheticSourcePdf> {
  const runId = currentReleaseRunIdSchema.parse(rawRunId)
  const marker = `Syntetyczny dokument. RunId: ${runId}.`
  const area =
    'Syntetyczny dokument. Powierzchnia uzytkowa: 83,40 m2.'
  const price =
    'Cena ofertowa: 750 000 PLN. Material bez danych prawdziwych.'
  for (const value of [marker, area, price]) {
    if (!isAscii(value)) {
      throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
    }
  }

  const document = await PDFDocument.create({
    updateMetadata: false,
  })
  const timestamp = timestampFromRunId(runId)
  document.setTitle(`Task 9 source ${runId}`)
  document.setSubject(`${area} ${price}`)
  document.setAuthor('Current release acceptance')
  document.setCreator('Current release acceptance')
  document.setProducer('Current release acceptance')
  document.setCreationDate(timestamp)
  document.setModificationDate(timestamp)

  const font = await document.embedFont(StandardFonts.Helvetica)
  const page = document.addPage([595.28, 841.89])
  const lines = [marker, area, price]
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 54,
      y: 770 - index * 28,
      size: 12,
      font,
      color: rgb(0.08, 0.12, 0.14),
    })
  })

  const bytes = await document.save({
    useObjectStreams: false,
    addDefaultPage: false,
    updateFieldAppearances: false,
  })
  const buffer = Buffer.from(bytes)
  if (
    document.getPageCount() !== 1 ||
    buffer.byteLength < 100 ||
    buffer.byteLength > MAX_SOURCE_BYTES
  ) {
    buffer.fill(0)
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }

  return {
    name: `task9-source-${runId}.pdf`,
    mimeType: 'application/pdf',
    buffer,
    sizeBytes: buffer.byteLength,
    checksumSha256: createHash('sha256')
      .update(buffer)
      .digest('hex'),
  }
}

export function toSyntheticSourceUploadPayload(
  pdf: SyntheticSourcePdf,
): SyntheticSourceUploadPayload {
  return {
    name: pdf.name,
    mimeType: pdf.mimeType,
    buffer: pdf.buffer,
  }
}

export async function usingSyntheticSourcePdf<T>(
  input: {
    runId: string
  },
  action: (pdf: SyntheticSourcePdf) => Promise<T>,
): Promise<T> {
  const pdf = await createSyntheticSourcePdf(input)
  try {
    return await action(pdf)
  } finally {
    pdf.buffer.fill(0)
  }
}

function timestampFromRunId(runId: string): Date {
  const match = runId.match(
    /^syn-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-/,
  )
  if (!match) throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  const [, year, month, day, hour, minute, second] = match
  const timestamp = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`,
  )
  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }
  return timestamp
}

function isAscii(value: string): boolean {
  return [...value].every(
    (character) => character.codePointAt(0)! <= 0x7f,
  )
}

import { createHash } from 'node:crypto'
import {
  chmod,
  lstat,
  mkdir,
  writeFile,
} from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'

const MAX_SOURCE_BYTES = 25 * 1024 * 1024

export async function createSyntheticSourcePdf(input: {
  browserDirectory: string
  runId: string
}): Promise<{
  path: string
  sizeBytes: number
  checksumSha256: string
}> {
  const runId = currentReleaseRunIdSchema.parse(input.runId)
  const browserDirectory = resolve(input.browserDirectory)
  const path = resolve(
    browserDirectory,
    `task9-source-${runId}.pdf`,
  )
  if (!path.startsWith(`${browserDirectory}/`)) {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }

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
  if (
    document.getPageCount() !== 1 ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_SOURCE_BYTES
  ) {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }

  await mkdir(browserDirectory, { recursive: true, mode: 0o700 })
  await rejectSymlink(path)
  await writeFile(path, bytes, { mode: 0o600 })
  await chmod(path, 0o600)

  return {
    path,
    sizeBytes: bytes.byteLength,
    checksumSha256: createHash('sha256')
      .update(bytes)
      .digest('hex'),
  }
}

async function rejectSymlink(path: string): Promise<void> {
  try {
    const file = await lstat(path)
    if (file.isSymbolicLink() || !file.isFile()) {
      throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
    }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }
    throw error
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

import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  lstat,
  mkdir,
  open,
  unlink,
  type FileHandle,
} from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib'
import { currentReleaseRunIdSchema } from '../../src/features/current-release-acceptance/domain'

const MAX_SOURCE_BYTES = 25 * 1024 * 1024
const MODE_MASK = BigInt(0o777)
const MODE_DIRECTORY_PRIVATE = BigInt(0o700)
const MODE_FILE_PRIVATE = BigInt(0o600)

export type SyntheticSourcePdf = {
  path: string
  sizeBytes: number
  checksumSha256: string
}

type FileIdentity = {
  dev: bigint
  ino: bigint
}

type SyntheticSourcePdfIdentity = {
  parent: FileIdentity
  file: FileIdentity
}

export type SyntheticSourcePdfCreateDependencies = {
  createArtifactId?(): string
  afterWrite?(): Promise<void>
}

const syntheticSourcePdfIdentities =
  new WeakMap<SyntheticSourcePdf, SyntheticSourcePdfIdentity>()

const artifactIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export async function createSyntheticSourcePdf(
  input: {
    browserDirectory: string
    runId: string
  },
  dependencies: SyntheticSourcePdfCreateDependencies = {},
): Promise<SyntheticSourcePdf> {
  try {
    return await createSyntheticSourcePdfUnsafe(
      input,
      dependencies,
    )
  } catch {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }
}

async function createSyntheticSourcePdfUnsafe(
  input: {
    browserDirectory: string
    runId: string
  },
  dependencies: SyntheticSourcePdfCreateDependencies,
): Promise<SyntheticSourcePdf> {
  const runId = currentReleaseRunIdSchema.parse(input.runId)
  const browserDirectory = resolve(input.browserDirectory)
  const artifactId =
    dependencies.createArtifactId?.() ?? randomUUID()
  if (!artifactIdPattern.test(artifactId)) {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }
  const path = resolve(
    browserDirectory,
    `task9-source-${runId}-${artifactId}.pdf`,
  )
  if (dirname(path) !== browserDirectory) {
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

  const pdf: SyntheticSourcePdf = {
    path,
    sizeBytes: bytes.byteLength,
    checksumSha256: createHash('sha256')
      .update(bytes)
      .digest('hex'),
  }
  let handle: FileHandle | null = null
  let directoryHandle: FileHandle | null = null

  try {
    await mkdir(browserDirectory, {
      recursive: true,
      mode: 0o700,
    })
    directoryHandle = await open(
      browserDirectory,
      constants.O_RDONLY |
        constants.O_DIRECTORY |
        constants.O_NOFOLLOW,
    )
    const originalParentStat = await directoryHandle.stat({
      bigint: true,
    })
    if (!originalParentStat.isDirectory()) {
      throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
    }
    await directoryHandle.chmod(0o700)
    const parentStat = await directoryHandle.stat({
      bigint: true,
    })
    if (
      !parentStat.isDirectory() ||
      (parentStat.mode & MODE_MASK) !==
        MODE_DIRECTORY_PRIVATE ||
      !identitiesMatch(
        readIdentity(originalParentStat),
        readIdentity(parentStat),
      )
    ) {
      throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
    }

    handle = await open(path, 'wx', 0o600)
    const openedStat = await handle.stat({ bigint: true })
    if (!openedStat.isFile()) {
      throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
    }
    const identity = {
      parent: readIdentity(parentStat),
      file: readIdentity(openedStat),
    }
    syntheticSourcePdfIdentities.set(pdf, identity)

    await handle.writeFile(bytes)
    await dependencies.afterWrite?.()
    await handle.chmod(0o600)
    await handle.sync()
    const writtenStat = await handle.stat({ bigint: true })
    if (
      !writtenStat.isFile() ||
      !identitiesMatch(
        identity.file,
        readIdentity(writtenStat),
      ) ||
      writtenStat.size !== BigInt(bytes.byteLength) ||
      (writtenStat.mode & MODE_MASK) !== MODE_FILE_PRIVATE
    ) {
      throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
    }

    await handle.close()
    handle = null
    await directoryHandle.close()
    directoryHandle = null
    await assertSyntheticSourcePdfIdentity(
      pdf,
      browserDirectory,
      identity,
    )
    return pdf
  } catch (error) {
    await closeIgnoringErrors(handle)
    await closeIgnoringErrors(directoryHandle)
    if (syntheticSourcePdfIdentities.has(pdf)) {
      await removeSyntheticSourcePdf(
        pdf,
        browserDirectory,
      ).catch(() => {})
    }
    throw error
  }
}

export async function removeSyntheticSourcePdf(
  pdf: SyntheticSourcePdf,
  browserDirectory: string,
): Promise<void> {
  try {
    await removeSyntheticSourcePdfUnsafe(pdf, browserDirectory)
  } catch {
    throw new Error('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
  }
}

async function removeSyntheticSourcePdfUnsafe(
  pdf: SyntheticSourcePdf,
  browserDirectory: string,
): Promise<void> {
  const identity = syntheticSourcePdfIdentities.get(pdf)
  if (!identity || typeof pdf.path !== 'string') {
    throw new Error('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
  }
  const directory = resolve(browserDirectory)
  const artifactPath = resolve(pdf.path)
  if (dirname(artifactPath) !== directory) {
    throw new Error('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
  }

  let parentStat
  try {
    parentStat = await lstat(directory, { bigint: true })
  } catch (error) {
    if (isMissingFile(error)) return
    throw error
  }
  if (
    parentStat.isSymbolicLink() ||
    !parentStat.isDirectory() ||
    (parentStat.mode & MODE_MASK) !== MODE_DIRECTORY_PRIVATE ||
    !identitiesMatch(identity.parent, readIdentity(parentStat))
  ) {
    throw new Error('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
  }

  let artifactStat
  try {
    artifactStat = await lstat(artifactPath, { bigint: true })
  } catch (error) {
    if (isMissingFile(error)) return
    throw error
  }
  if (
    artifactStat.isSymbolicLink() ||
    !artifactStat.isFile() ||
    !identitiesMatch(identity.file, readIdentity(artifactStat))
  ) {
    throw new Error('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
  }

  let handle: FileHandle | null = null
  try {
    handle = await open(
      artifactPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    )
    const openedStat = await handle.stat({ bigint: true })
    if (
      !openedStat.isFile() ||
      !identitiesMatch(
        identity.file,
        readIdentity(openedStat),
      )
    ) {
      throw new Error('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
    }
    const finalPathStat = await lstat(artifactPath, {
      bigint: true,
    })
    if (
      finalPathStat.isSymbolicLink() ||
      !finalPathStat.isFile() ||
      !identitiesMatch(
        identity.file,
        readIdentity(finalPathStat),
      )
    ) {
      throw new Error('SYNTHETIC_SOURCE_PDF_REMOVE_INVALID')
    }
    await unlink(artifactPath)
  } catch (error) {
    if (isMissingFile(error)) return
    throw error
  } finally {
    await closeIgnoringErrors(handle)
  }
}

export async function usingSyntheticSourcePdf<T>(
  input: {
    browserDirectory: string
    runId: string
  },
  action: (pdf: SyntheticSourcePdf) => Promise<T>,
): Promise<T> {
  const pdf = await createSyntheticSourcePdf(input)
  try {
    return await action(pdf)
  } finally {
    await removeSyntheticSourcePdf(
      pdf,
      input.browserDirectory,
    )
  }
}

async function assertSyntheticSourcePdfIdentity(
  pdf: SyntheticSourcePdf,
  browserDirectory: string,
  identity: SyntheticSourcePdfIdentity,
): Promise<void> {
  const directory = resolve(browserDirectory)
  const artifactPath = resolve(pdf.path)
  if (dirname(artifactPath) !== directory) {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }
  const [parentStat, artifactStat] = await Promise.all([
    lstat(directory, { bigint: true }),
    lstat(artifactPath, { bigint: true }),
  ])
  if (
    parentStat.isSymbolicLink() ||
    !parentStat.isDirectory() ||
    (parentStat.mode & MODE_MASK) !== MODE_DIRECTORY_PRIVATE ||
    !identitiesMatch(identity.parent, readIdentity(parentStat)) ||
    artifactStat.isSymbolicLink() ||
    !artifactStat.isFile() ||
    !identitiesMatch(identity.file, readIdentity(artifactStat))
  ) {
    throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
  }
}

function readIdentity(value: {
  dev: bigint
  ino: bigint
}): FileIdentity {
  return {
    dev: value.dev,
    ino: value.ino,
  }
}

function identitiesMatch(
  expected: FileIdentity,
  actual: FileIdentity,
): boolean {
  return (
    actual.dev === expected.dev &&
    actual.ino === expected.ino
  )
}

async function closeIgnoringErrors(
  handle: FileHandle | null,
): Promise<void> {
  if (handle === null) return
  await handle.close().catch(() => {})
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'ENOENT'
  )
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

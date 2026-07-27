import type { PropertyFact } from '../properties/domain'
import type {
  EvidenceLocator,
  FactProposalStatus,
  PropertySourceStatus,
  ProposalDecision,
} from './domain'

const maxSourceBytes = 25 * 1024 * 1024

const mediaTypeByExtension: Readonly<Record<string, string>> = {
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  pdf: 'application/pdf',
  png: 'image/png',
  txt: 'text/plain',
  wav: 'audio/wav',
  webm: 'audio/webm',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const supportedMediaTypes = new Set(Object.values(mediaTypeByExtension))

export type PropertyFactValueType =
  | 'text'
  | 'number'
  | 'money'
  | 'boolean'
  | 'date'
  | 'json'

export type PropertySourceWire = {
  id: string
  organizationId: string
  propertyProjectId: string
  storageKey: string
  fileName: string
  mediaType: string
  sizeBytes: number
  checksumSha256: string
  status: PropertySourceStatus
  errorCode: string | null
  errorMessage: string | null
  uploadedAt: string | null
  processedAt: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type PropertyFactProposalWire = {
  id: string
  organizationId: string
  propertyProjectId: string
  sourceId: string
  jobId: string
  externalKey: string
  factKey: string
  label: string
  category: string
  valueType: PropertyFactValueType
  value: unknown
  unit?: string
  confidence: number
  evidenceText: string
  evidenceLocator: EvidenceLocator
  status: FactProposalStatus
  conflictsWithFactId: string | null
  decidedByUserId: string | null
  decisionNote: string | null
  decision: unknown
  decisionFingerprint: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
  fact?: PropertyFact
}

export type SourceStatusPresentation = {
  label: string
  tone: 'neutral' | 'working' | 'success' | 'warning' | 'danger'
}

const sourceStatusPresentation: Record<
  PropertySourceStatus,
  SourceStatusPresentation
> = {
  upload_pending: { label: 'Wysyłanie', tone: 'working' },
  uploaded: { label: 'Sprawdzanie pliku', tone: 'working' },
  scanning: { label: 'Sprawdzanie pliku', tone: 'working' },
  quarantined: { label: 'Wymaga działania', tone: 'danger' },
  validating: { label: 'Analiza źródła', tone: 'working' },
  queued: { label: 'Analiza źródła', tone: 'working' },
  processing: { label: 'Analiza źródła', tone: 'working' },
  review_ready: { label: 'Do weryfikacji', tone: 'warning' },
  completed: { label: 'Zakończono', tone: 'success' },
  failed: { label: 'Nie udało się', tone: 'danger' },
  deleted: { label: 'Usunięto', tone: 'neutral' },
}

export function resolveSourceMediaType(
  file: Pick<File, 'name' | 'type'>,
): string {
  if (supportedMediaTypes.has(file.type)) return file.type

  const extension = file.name.split('.').pop()?.toLowerCase()
  const resolved = extension ? mediaTypeByExtension[extension] : undefined
  if (!resolved) throw new Error('UNSUPPORTED_SOURCE_FORMAT')
  return resolved
}

export function formatSourceStatus(
  status: PropertySourceStatus,
): SourceStatusPresentation {
  return sourceStatusPresentation[status]
}

export function formatEvidenceLocator(locator: EvidenceLocator): string {
  switch (locator.type) {
    case 'page':
      return `Strona ${locator.page}`
    case 'sheet':
      return `Arkusz ${locator.sheet} · ${locator.column}${locator.row}`
    case 'time':
      return `${formatTimestamp(locator.startMs)}–${formatTimestamp(
        locator.endMs,
      )}`
    case 'text':
      return `Znaki ${locator.start}–${locator.end}`
  }
}

export function parseCorrectedProposalValue(
  valueType: PropertyFactValueType,
  rawValue: string,
): Extract<
  ProposalDecision,
  { action: 'correct_and_accept' }
>['value'] {
  const value = rawValue.trim()
  if (!value) throw new Error('INVALID_CORRECTED_VALUE')

  try {
    switch (valueType) {
      case 'number':
      case 'money': {
        const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
        if (!Number.isFinite(parsed)) throw new Error()
        return parsed
      }
      case 'boolean': {
        const normalized = value.toLocaleLowerCase('pl-PL')
        if (['tak', 'true', '1'].includes(normalized)) return true
        if (['nie', 'false', '0'].includes(normalized)) return false
        throw new Error()
      }
      case 'json':
        return JSON.parse(value) as Extract<
          ProposalDecision,
          { action: 'correct_and_accept' }
        >['value']
      case 'date':
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
        ) {
          throw new Error()
        }
        return value
      case 'text':
        return value
    }
  } catch {
    throw new Error('INVALID_CORRECTED_VALUE')
  }
}

export async function uploadPropertySource({
  propertyId,
  file,
  fetch: fetchRequest = globalThis.fetch,
}: {
  propertyId: string
  file: File
  fetch?: typeof globalThis.fetch
}): Promise<PropertySourceWire> {
  if (file.size > maxSourceBytes) {
    throw new Error('SOURCE_FILE_TOO_LARGE')
  }

  const mediaType = resolveSourceMediaType(file)
  const checksumSha256 = await sha256Hex(await file.arrayBuffer())
  const registerResponse = await fetchRequest(
    `/api/properties/${propertyId}/sources`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mediaType,
        sizeBytes: file.size,
        checksumSha256,
      }),
    },
  )
  if (!registerResponse.ok) throw new Error('SOURCE_REGISTER_FAILED')

  const result = (await registerResponse.json()) as {
    source?: PropertySourceWire
    upload?: {
      method?: string
      url?: string
      fields?: Record<string, string>
    }
  }
  if (
    !result.source ||
    result.upload?.method !== 'POST' ||
    !result.upload.url ||
    !result.upload.fields
  ) {
    throw new Error('SOURCE_UPLOAD_GRANT_INVALID')
  }

  const form = new FormData()
  for (const [name, value] of Object.entries(result.upload.fields)) {
    form.append(name, value)
  }
  form.append('file', file)

  const uploadResponse = await fetchRequest(result.upload.url, {
    method: 'POST',
    body: form,
  })
  if (!uploadResponse.ok) throw new Error('SOURCE_UPLOAD_FAILED')

  return result.source
}

export async function fetchPropertySources(
  propertyId: string,
  fetchRequest: typeof globalThis.fetch = globalThis.fetch,
): Promise<PropertySourceWire[]> {
  const response = await fetchRequest(
    `/api/properties/${propertyId}/sources`,
  )
  if (!response.ok) throw new Error('SOURCE_LIST_FAILED')
  const result = (await response.json()) as {
    sources?: PropertySourceWire[]
  }
  if (!Array.isArray(result.sources)) throw new Error('SOURCE_LIST_INVALID')
  return result.sources
}

export async function fetchPropertyProposals(
  propertyId: string,
  fetchRequest: typeof globalThis.fetch = globalThis.fetch,
): Promise<PropertyFactProposalWire[]> {
  const response = await fetchRequest(
    `/api/properties/${propertyId}/proposals`,
  )
  if (!response.ok) throw new Error('PROPOSAL_LIST_FAILED')
  const result = (await response.json()) as {
    proposals?: PropertyFactProposalWire[]
  }
  if (!Array.isArray(result.proposals)) {
    throw new Error('PROPOSAL_LIST_INVALID')
  }
  return result.proposals
}

export async function decidePropertyProposal({
  propertyId,
  proposalId,
  decision,
  fetch: fetchRequest = globalThis.fetch,
}: {
  propertyId: string
  proposalId: string
  decision: ProposalDecision
  fetch?: typeof globalThis.fetch
}): Promise<{
  proposal: PropertyFactProposalWire
  fact: PropertyFact | null
}> {
  const response = await fetchRequest(
    `/api/properties/${propertyId}/proposals/${proposalId}/decision`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(decision),
    },
  )
  if (!response.ok) throw new Error('PROPOSAL_DECISION_FAILED')
  const result = (await response.json()) as {
    proposal?: PropertyFactProposalWire
    fact?: PropertyFact | null
  }
  if (!result.proposal) throw new Error('PROPOSAL_DECISION_INVALID')
  return {
    proposal: result.proposal,
    fact: result.fact ?? null,
  }
}

export async function getPropertySourceDownload({
  propertyId,
  sourceId,
  mode = 'download',
  fetch: fetchRequest = globalThis.fetch,
}: {
  propertyId: string
  sourceId: string
  mode?: 'download' | 'preview'
  fetch?: typeof globalThis.fetch
}): Promise<{ url: string; expiresAt: string }> {
  const modeQuery = mode === 'preview' ? '?mode=preview' : ''
  const response = await fetchRequest(
    `/api/properties/${propertyId}/sources/${sourceId}/download${modeQuery}`,
  )
  if (!response.ok) throw new Error('SOURCE_DOWNLOAD_FAILED')
  const result = (await response.json()) as {
    url?: string
    expiresAt?: string
  }
  if (!result.url || !result.expiresAt) {
    throw new Error('SOURCE_DOWNLOAD_INVALID')
  }
  return { url: result.url, expiresAt: result.expiresAt }
}

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

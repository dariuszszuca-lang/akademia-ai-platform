import { describe, expect, it, vi } from 'vitest'
import {
  decidePropertyProposal,
  fetchPropertyProposals,
  fetchPropertySources,
  formatEvidenceLocator,
  formatSourceStatus,
  getPropertySourceDownload,
  parseCorrectedProposalValue,
  resolveSourceMediaType,
  uploadPropertySource,
} from './client'

const propertyId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'

describe('property source browser client', () => {
  it.each([
    [{ name: 'dane.csv', type: '' }, 'text/csv'],
    [{ name: 'rzut.PDF', type: '' }, 'application/pdf'],
    [
      { name: 'operat.docx', type: '' },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [{ name: 'zdjecie.webp', type: 'image/webp' }, 'image/webp'],
  ])('resolves a supported media type for %j', (file, expected) => {
    expect(resolveSourceMediaType(file)).toBe(expected)
  })

  it('rejects an unsupported browser media type', () => {
    expect(() =>
      resolveSourceMediaType({
        name: 'archiwum.zip',
        type: 'application/zip',
      }),
    ).toThrow('UNSUPPORTED_SOURCE_FORMAT')
  })

  it.each([
    ['upload_pending', 'Wysyłanie', 'working'],
    ['scanning', 'Sprawdzanie pliku', 'working'],
    ['processing', 'Analiza źródła', 'working'],
    ['review_ready', 'Do weryfikacji', 'warning'],
    ['completed', 'Zakończono', 'success'],
    ['quarantined', 'Wymaga działania', 'danger'],
    ['failed', 'Nie udało się', 'danger'],
  ] as const)('presents %s with text and tone', (status, label, tone) => {
    expect(formatSourceStatus(status)).toEqual({ label, tone })
  })

  it.each([
    [{ type: 'page', page: 3 }, 'Strona 3'],
    [
      { type: 'sheet', sheet: 'Dane', row: 8, column: 'C' },
      'Arkusz Dane · C8',
    ],
    [{ type: 'time', startMs: 61_000, endMs: 66_500 }, '01:01–01:06'],
    [{ type: 'text', start: 15, end: 42 }, 'Znaki 15–42'],
  ] as const)('formats evidence locator %j', (locator, expected) => {
    expect(formatEvidenceLocator(locator)).toBe(expected)
  })

  it.each([
    ['number', '52,4', 52.4],
    ['money', '1 250 000,50', 1_250_000.5],
    ['boolean', 'tak', true],
    ['boolean', 'nie', false],
    ['json', '{"pokoje": 3}', { pokoje: 3 }],
    ['text', '  spokojna ulica  ', 'spokojna ulica'],
    ['date', '2026-07-27', '2026-07-27'],
  ] as const)('parses a corrected %s value', (type, raw, expected) => {
    expect(parseCorrectedProposalValue(type, raw)).toEqual(expected)
  })

  it('rejects an invalid corrected value', () => {
    expect(() => parseCorrectedProposalValue('boolean', 'może')).toThrow(
      'INVALID_CORRECTED_VALUE',
    )
  })

  it('registers metadata before posting the exact file to S3', async () => {
    const file = new File(['hello'], 'dane.csv')
    const source = {
      id: sourceId,
      organizationId: '11111111-1111-4111-8111-111111111111',
      propertyProjectId: propertyId,
      storageKey: `originals/source/${sourceId}`,
      fileName: file.name,
      mediaType: 'text/csv',
      sizeBytes: file.size,
      checksumSha256:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      status: 'upload_pending',
      errorCode: null,
      errorMessage: null,
      uploadedAt: null,
      processedAt: null,
      createdByUserId: 'user-1',
      createdAt: '2026-07-27T12:00:00.000Z',
      updatedAt: '2026-07-27T12:00:00.000Z',
    }
    const fetchRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            source,
            upload: {
              method: 'POST',
              url: 'https://uploads.example.invalid',
              fields: {
                key: source.storageKey,
                policy: 'signed-policy',
              },
              expiresAt: '2026-07-27T12:05:00.000Z',
            },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(
      uploadPropertySource({ propertyId, file, fetch: fetchRequest }),
    ).resolves.toEqual(source)

    const [registerUrl, registerInit] = fetchRequest.mock.calls[0]
    expect(registerUrl).toBe(`/api/properties/${propertyId}/sources`)
    expect(registerInit?.method).toBe('POST')
    expect(JSON.parse(String(registerInit?.body))).toEqual({
      fileName: 'dane.csv',
      mediaType: 'text/csv',
      sizeBytes: 5,
      checksumSha256:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    })

    const [uploadUrl, uploadInit] = fetchRequest.mock.calls[1]
    expect(uploadUrl).toBe('https://uploads.example.invalid')
    expect(uploadInit?.method).toBe('POST')
    const formData = uploadInit?.body as FormData
    expect([...formData.keys()]).toEqual(['key', 'policy', 'file'])
    expect(formData.get('file')).toBe(file)
  })

  it('does not call the API for a file over 25 MB', async () => {
    const fetchRequest = vi.fn<typeof fetch>()
    const oversized = {
      name: 'film.mp4',
      type: 'audio/mp4',
      size: 25 * 1024 * 1024 + 1,
      arrayBuffer: vi.fn(),
    } as unknown as File

    await expect(
      uploadPropertySource({
        propertyId,
        file: oversized,
        fetch: fetchRequest,
      }),
    ).rejects.toThrow('SOURCE_FILE_TOO_LARGE')
    expect(fetchRequest).not.toHaveBeenCalled()
  })

  it('refreshes tenant-scoped sources and proposals', async () => {
    const fetchRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ sources: [{ id: sourceId }] }))
      .mockResolvedValueOnce(
        Response.json({ proposals: [{ id: 'proposal-1' }] }),
      )

    await expect(
      fetchPropertySources(propertyId, fetchRequest),
    ).resolves.toEqual([{ id: sourceId }])
    await expect(
      fetchPropertyProposals(propertyId, fetchRequest),
    ).resolves.toEqual([{ id: 'proposal-1' }])
    expect(fetchRequest.mock.calls.map(([url]) => url)).toEqual([
      `/api/properties/${propertyId}/sources`,
      `/api/properties/${propertyId}/proposals`,
    ])
  })

  it('submits one explicit human decision and returns the server result', async () => {
    const result = {
      proposal: { id: 'proposal-1', status: 'corrected' },
      fact: { id: 'fact-1', value: 52.4 },
    }
    const fetchRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(result))

    await expect(
      decidePropertyProposal({
        propertyId,
        proposalId: 'proposal-1',
        decision: {
          action: 'correct_and_accept',
          value: 52.4,
          note: 'Sprawdzono z rzutem.',
        },
        fetch: fetchRequest,
      }),
    ).resolves.toEqual(result)

    expect(fetchRequest).toHaveBeenCalledWith(
      `/api/properties/${propertyId}/proposals/proposal-1/decision`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'correct_and_accept',
          value: 52.4,
          note: 'Sprawdzono z rzutem.',
        }),
      },
    )
  })

  it('gets a short-lived clean source URL', async () => {
    const download = {
      url: 'https://download.example.invalid/file',
      expiresAt: '2026-07-27T12:05:00.000Z',
    }
    const fetchRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(download))

    await expect(
      getPropertySourceDownload({
        propertyId,
        sourceId,
        fetch: fetchRequest,
      }),
    ).resolves.toEqual(download)
    expect(fetchRequest).toHaveBeenCalledWith(
      `/api/properties/${propertyId}/sources/${sourceId}/download`,
    )
  })

  it('requests the explicit safe-preview mode for embedded documents', async () => {
    const fetchRequest = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        url: 'https://download.example.invalid/file',
        expiresAt: '2026-07-27T12:05:00.000Z',
      }),
    )

    await getPropertySourceDownload({
      propertyId,
      sourceId,
      mode: 'preview',
      fetch: fetchRequest,
    })

    expect(fetchRequest).toHaveBeenCalledWith(
      `/api/properties/${propertyId}/sources/${sourceId}/download?mode=preview`,
    )
  })
})

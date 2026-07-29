import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  DEFAULT_LEGAL_MIN_SCORE,
  formatChunksForPrompt,
  legalMinScore,
  searchLegal,
} from './search'

const mocks = vi.hoisted(() => ({
  searchRecords: vi.fn(),
}))

vi.mock('./pinecone', () => ({
  getLegalIndex: () => ({
    searchRecords: mocks.searchRecords,
  }),
}))

const originalLegalMinScore = process.env.LEGAL_RAG_MIN_SCORE

function hit(id: string, score: number) {
  return {
    _id: id,
    _score: score,
    fields: {
      text: `Treść ${id}`,
      ustawa: 'Kodeks cywilny',
      art_number: id,
    },
  }
}

describe('legal retrieval relevance threshold', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.LEGAL_RAG_MIN_SCORE
  })

  afterEach(() => {
    if (originalLegalMinScore === undefined) {
      delete process.env.LEGAL_RAG_MIN_SCORE
    } else {
      process.env.LEGAL_RAG_MIN_SCORE = originalLegalMinScore
    }
  })

  it('returns only hits meeting the default minimum score', async () => {
    mocks.searchRecords.mockResolvedValue({
      result: {
        hits: [hit('art-91', 0.91), hit('art-41', 0.41)],
      },
    })

    const chunks = await searchLegal('synthetic query')

    expect(chunks.map((chunk) => chunk.id)).toEqual(['art-91'])
  })

  it('returns no chunks and the exact fallback when all hits are below threshold', async () => {
    mocks.searchRecords.mockResolvedValue({
      result: { hits: [hit('art-41', 0.41)] },
    })

    const chunks = await searchLegal('synthetic query')

    expect(chunks).toEqual([])
    expect(formatChunksForPrompt(chunks)).toBe(
      '(brak relewantnych fragmentów ustawowych)',
    )
  })

  it.each([
    ['0', 0],
    ['0.65', 0.65],
    ['1', 1],
  ])('accepts a configured score within 0..1: %s', (value, expected) => {
    process.env.LEGAL_RAG_MIN_SCORE = value

    expect(legalMinScore()).toBe(expected)
  })

  it.each([
    undefined,
    '',
    '   ',
    '-0.01',
    '1.01',
    'NaN',
    'Infinity',
    'not-a-number',
  ])('fails closed to the default for invalid score %j', (value) => {
    if (value === undefined) {
      delete process.env.LEGAL_RAG_MIN_SCORE
    } else {
      process.env.LEGAL_RAG_MIN_SCORE = value
    }

    expect(legalMinScore()).toBe(DEFAULT_LEGAL_MIN_SCORE)
  })

  it('rejects hits with an absent or non-finite score', async () => {
    mocks.searchRecords.mockResolvedValue({
      result: {
        hits: [
          { ...hit('absent', 0.91), _score: undefined },
          hit('nan', Number.NaN),
          hit('valid', 0.7),
        ],
      },
    })

    const chunks = await searchLegal('synthetic query')

    expect(chunks.map((chunk) => chunk.id)).toEqual(['valid'])
  })
})

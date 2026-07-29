import { getLegalIndex, type LegalChunk } from './pinecone'

export const DEFAULT_LEGAL_MIN_SCORE = 0.7

export function legalMinScore(): number {
  const raw = process.env.LEGAL_RAG_MIN_SCORE
  if (!raw?.trim()) return DEFAULT_LEGAL_MIN_SCORE

  const configured = Number(raw)
  return Number.isFinite(configured) &&
    configured >= 0 &&
    configured <= 1
    ? configured
    : DEFAULT_LEGAL_MIN_SCORE
}

/**
 * Search top K relevant legal chunks for a query.
 * Pinecone embeds query automatically (multilingual-e5-large).
 */
export async function searchLegal(query: string, topK: number = 5): Promise<LegalChunk[]> {
  const index = getLegalIndex()

  try {
    type SearchResponse = {
      result?: {
        hits?: Array<{
          _id: string
          _score: number
          fields: Record<string, string>
        }>
      }
    }
    const idx = index as unknown as {
      searchRecords: (req: unknown) => Promise<SearchResponse>
    }
    const results = await idx.searchRecords({
      query: {
        topK,
        inputs: { text: query },
      },
      fields: ['text', 'ustawa', 'art_number', 'ksiega', 'tytul', 'url'],
    })

    const hits = results?.result?.hits ?? []

    const minimumScore = legalMinScore()
    return hits
      .filter(
        (hit) =>
          Number.isFinite(hit._score) &&
          hit._score >= minimumScore,
      )
      .map((hit) => ({
        id: hit._id,
        text: hit.fields.text ?? '',
        ustawa: hit.fields.ustawa ?? '',
        art_number: hit.fields.art_number ?? '',
        ksiega: hit.fields.ksiega,
        tytul: hit.fields.tytul,
        url: hit.fields.url,
        score: hit._score,
      }))
  } catch (err) {
    console.error('[legal-search]', err)
    return []
  }
}

export function formatChunksForPrompt(chunks: LegalChunk[]): string {
  if (chunks.length === 0) return '(brak relewantnych fragmentów ustawowych)'
  return chunks
    .map((c, i) => {
      const header = `[${i + 1}] ${c.ustawa}, art. ${c.art_number}${c.ksiega ? ` (${c.ksiega})` : ''}`
      return `${header}\n${c.text}`
    })
    .join('\n\n---\n\n')
}

export function formatChunksForUI(chunks: LegalChunk[]): Array<{ ustawa: string; art: string; url?: string }> {
  return chunks.map(c => ({
    ustawa: c.ustawa,
    art: c.art_number,
    url: c.url,
  }))
}

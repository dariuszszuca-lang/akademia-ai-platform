import { getLegalIndex, type LegalChunk } from './pinecone'

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

    return hits.map(h => ({
      id: h._id,
      text: h.fields.text ?? '',
      ustawa: h.fields.ustawa ?? '',
      art_number: h.fields.art_number ?? '',
      ksiega: h.fields.ksiega,
      tytul: h.fields.tytul,
      url: h.fields.url,
      score: h._score,
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

import { Pinecone } from '@pinecone-database/pinecone'

const apiKey = process.env.PINECONE_API_KEY
const indexName = process.env.PINECONE_INDEX_NAME ?? 'akademia-legal'

let _client: Pinecone | null = null

export function getPineconeClient(): Pinecone {
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY not configured')
  }
  if (!_client) {
    _client = new Pinecone({ apiKey })
  }
  return _client
}

export function getLegalIndex() {
  const pc = getPineconeClient()
  return pc.index(indexName).namespace('legal')
}

export type LegalChunk = {
  id: string
  text: string
  ustawa: string
  art_number: string
  ksiega?: string
  tytul?: string
  url?: string
  score?: number
}

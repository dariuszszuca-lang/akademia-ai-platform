/**
 * Ingestion: ladowanie polskich aktow prawnych do Pinecone (RAG).
 *
 * Run: PINECONE_API_KEY=pcsk_... PINECONE_INDEX_NAME=akademia-legal npx tsx scripts/ingest-legal.ts
 *
 * Expected source: scripts/data/kc-sample.json (lista art z metadata).
 * Pinecone embeduje tekst automatycznie (multilingual-e5-large).
 */
import { Pinecone } from '@pinecone-database/pinecone'
import fs from 'fs'
import path from 'path'

type LegalArticle = {
  art: string
  ksiega?: string
  tytul?: string
  text: string
}

async function main() {
  const apiKey = process.env.PINECONE_API_KEY
  const indexName = process.env.PINECONE_INDEX_NAME ?? 'akademia-legal'
  if (!apiKey) {
    console.error('Brak PINECONE_API_KEY w env')
    process.exit(1)
  }

  const pc = new Pinecone({ apiKey })
  const index = pc.index(indexName).namespace('legal')

  const dataPath = path.join(__dirname, 'data', 'kc-sample.json')
  const raw = fs.readFileSync(dataPath, 'utf8')
  const articles: LegalArticle[] = JSON.parse(raw)

  console.log(`Wczytano ${articles.length} artykulow z ${dataPath}`)

  const records = articles.map(a => {
    const slug = a.art.replace(/[^a-zA-Z0-9]/g, '')
    return {
      _id: `kc-art-${slug}`,
      text: `Art. ${a.art} Kodeksu cywilnego.\n\n${a.text}`,
      ustawa: 'Kodeks cywilny',
      art_number: a.art,
      ksiega: a.ksiega ?? '',
      tytul: a.tytul ?? '',
      url: `https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093`,
    }
  })

  console.log('Upserting do Pinecone (auto-embedding multilingual-e5-large)...')

  // Pinecone integrated embedding - upsert text records w batchach
  const BATCH = 50
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    // @ts-expect-error - upsertRecords API for integrated embedding indexes
    await index.upsertRecords(batch)
    console.log(`  upsert: ${i + batch.length}/${records.length}`)
  }

  console.log('Gotowe. Sprawdzam licznik rekordow...')
  const stats = await pc.index(indexName).describeIndexStats()
  console.log('Stats:', JSON.stringify(stats, null, 2))

  console.log(`\nIngestion zakonczona. ${articles.length} artykulow KC w Pinecone.`)
}

main().catch(err => {
  console.error('FAIL:', err)
  process.exit(1)
})

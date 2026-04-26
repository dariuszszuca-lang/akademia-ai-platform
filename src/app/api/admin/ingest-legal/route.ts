/**
 * Admin endpoint do jednorazowego ingestion polskich aktów prawnych do Pinecone.
 *
 * Wywoływany ręcznie:
 *   curl -X POST https://akademia-ai-platform.vercel.app/api/admin/ingest-legal \
 *        -H "Authorization: Bearer $ADMIN_PASSWORD"
 *
 * Po pierwszym wywołaniu (~10 sek) Pinecone ma 25 artykułów KC w indexie.
 */
import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import kcSample from '@/../scripts/data/kc-sample.json'

export const runtime = 'nodejs'
export const maxDuration = 60

type LegalArticle = {
  art: string
  ksiega?: string
  tytul?: string
  text: string
}

export async function POST(req: Request) {
  // Auth: wymagamy ADMIN_PASSWORD w nagłówku Authorization: Bearer
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.PINECONE_API_KEY
  const indexName = process.env.PINECONE_INDEX_NAME ?? 'akademia-legal'
  if (!apiKey) {
    return NextResponse.json({ error: 'PINECONE_API_KEY missing' }, { status: 500 })
  }

  try {
    const pc = new Pinecone({ apiKey })
    const index = pc.index(indexName).namespace('legal')

    const articles = kcSample as LegalArticle[]
    const records = articles.map(a => {
      const slug = a.art.replace(/[^a-zA-Z0-9]/g, '')
      return {
        _id: `kc-art-${slug}`,
        text: `Art. ${a.art} Kodeksu cywilnego.\n\n${a.text}`,
        ustawa: 'Kodeks cywilny',
        art_number: a.art,
        ksiega: a.ksiega ?? '',
        tytul: a.tytul ?? '',
        url: 'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19640160093',
      }
    })

    const BATCH = 50
    let uploaded = 0
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const idx = index as unknown as {
        upsertRecords: (records: unknown[]) => Promise<unknown>
      }
      await idx.upsertRecords(batch)
      uploaded += batch.length
    }

    return NextResponse.json({
      ok: true,
      uploaded,
      indexName,
      sample: records[0],
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}

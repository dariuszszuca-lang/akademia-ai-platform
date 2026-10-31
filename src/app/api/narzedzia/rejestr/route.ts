import { NextResponse } from 'next/server'
import { estimate, latest, type RcnApiResponse } from '@/features/rejestr/domain'
import { getServerUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SOURCE = 'https://rejestr-cen-transakcyjnych.pl/api/ceny'
const ALLOWED_MONTHS = new Set([3, 6, 12, 24, 36])

export async function GET(request: Request) {
  const userId = await getServerUserId()
  if (!userId) return NextResponse.json({ error: 'Zaloguj się.' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const teryt = params.get('teryt') ?? ''
  const months = Number(params.get('mies') ?? '12')
  if (!/^\d{4}$/.test(teryt)) {
    return NextResponse.json({ error: 'Wybierz powiat albo miasto.' }, { status: 400 })
  }
  if (!ALLOWED_MONTHS.has(months)) {
    return NextResponse.json({ error: 'Niepoprawny okres.' }, { status: 400 })
  }
  const dzielnica = params.get('dzielnica')?.slice(0, 120) || undefined
  const rynek = params.get('rynek') === 'pierwotny' || params.get('rynek') === 'wtórny' ? params.get('rynek')! : undefined
  const metrazRaw = Number(params.get('metraz'))
  const metraz = Number.isFinite(metrazRaw) && metrazRaw >= 10 && metrazRaw <= 500 ? metrazRaw : undefined

  let data: RcnApiResponse
  try {
    const res = await fetch(`${SOURCE}?teryt=${teryt}&mies=${months}`, {
      next: { revalidate: 6 * 60 * 60 },
      signal: AbortSignal.timeout(280_000),
    })
    const body = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: body?.blad ?? 'Rejestr nie odpowiada.' }, { status: res.status })
    }
    data = body as RcnApiResponse
  } catch {
    return NextResponse.json(
      { error: 'Urząd i geoportal nie odpowiadają. Spróbuj za kilka minut.' },
      { status: 502 },
    )
  }

  const query = { dzielnica, metraz, rynek }
  return NextResponse.json({
    nazwa: data.nazwa,
    od: data.od,
    daneDo: data.dane_do,
    liczba: data.liczba,
    podsumowanie: data.podsumowanie,
    dzielnice: data.dzielnice_lista,
    miesiace: data.miesiace,
    wycena: estimate(data.wiersze, query),
    transakcje: latest(data.wiersze, query, 30),
  })
}

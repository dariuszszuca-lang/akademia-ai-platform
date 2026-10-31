import { STANY, porownaj, rozliczKaucje, type Protokol } from './domain'

const pl = (iso: string) => iso.split('-').reverse().join('.')
const zl = (n: number) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
const stanLabel = (s: string) => STANY.find((x) => x.value === s)?.label ?? s

export default function ProtokolDokument({ p }: { p: Protokol }) {
  const cmp = p.typ === 'zwrot' && p.wydanie ? porownaj(p.wydanie, p) : null
  const kaucja = p.typ === 'zwrot' ? rozliczKaucje(p.kaucja, p.potracenia) : null
  return (
    <article className="print-area min-w-0 rounded-2xl border border-border bg-white p-6 text-[13px] leading-6 text-[#1f1a14] sm:p-10">
      <h2 className="text-center text-lg font-bold">
        PROTOKÓŁ ZDAWCZO-ODBIORCZY LOKALU ({p.typ === 'wydanie' ? 'WYDANIE' : 'ZWROT'})
      </h2>
      <p className="mt-2 text-center">sporządzony dnia {pl(p.data)}</p>
      <p className="mt-4"><b>Lokal:</b> {p.adres}</p>
      <p><b>Wynajmujący:</b> {p.wynajmujacy}</p>
      <p><b>Najemca:</b> {p.najemca}</p>
      {p.typ === 'zwrot' && p.wydanie && <p><b>Protokół wydania z dnia:</b> {pl(p.wydanie.data)}</p>}

      <h3 className="mt-5 font-bold">1. Liczniki</h3>
      <table className="mt-1 w-full border-collapse text-left">
        <thead><tr className="border-b border-[#1f1a14]"><th className="py-1">Licznik</th><th>Numer</th><th className="text-right">Stan</th>{cmp && <th className="text-right">Zużycie od wydania</th>}</tr></thead>
        <tbody>
          {p.liczniki.map((l) => {
            const c = cmp?.liczniki.find((x) => x.rodzaj === l.rodzaj)
            return (
              <tr key={l.id} className="border-b border-[#ddd]"><td className="py-1">{l.rodzaj}</td><td>{l.numer || 'brak'}</td><td className="text-right font-mono">{l.stan}</td>{cmp && <td className="text-right font-mono">{c?.zuzycie ?? 'brak'}</td>}</tr>
            )
          })}
        </tbody>
      </table>

      <h3 className="mt-5 font-bold">2. Stan pomieszczeń</h3>
      {p.pokoje.map((r) => (
        <div key={r.id} className="mt-2 break-inside-avoid">
          <p className="font-semibold">{r.nazwa}</p>
          <table className="w-full border-collapse text-left">
            <tbody>
              {r.elementy.map((e) => {
                const c = cmp?.elementy.find((x) => x.pokoj === r.nazwa && x.element === e.nazwa)
                return (
                  <tr key={e.id} className="border-b border-[#eee] align-top">
                    <td className="w-1/3 py-1">{e.nazwa}</td>
                    <td className="w-1/4">{stanLabel(e.stan)}{c && c.ocena !== 'bez zmian' ? ` (${c.ocena})` : ''}</td>
                    <td>{e.uwagi}{e.zdjecia.length ? ` [zdjęcia: ${e.zdjecia.length}]` : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <h3 className="mt-5 font-bold">3. Klucze i piloty</h3>
      <ul className="list-disc pl-6">
        {p.klucze.map((k) => {
          const c = cmp?.klucze.find((x) => x.nazwa === k.nazwa)
          return <li key={k.id}>{k.nazwa}: {k.ilosc} szt.{c && c.brakuje ? ` (brakuje ${c.brakuje} szt.)` : ''}</li>
        })}
      </ul>

      {p.uwagi.trim() && (<><h3 className="mt-5 font-bold">4. Uwagi</h3><p>{p.uwagi}</p></>)}

      {kaucja && (
        <>
          <h3 className="mt-5 font-bold">Rozliczenie kaucji</h3>
          <p>Kaucja: {zl(kaucja.kaucja)}</p>
          {p.potracenia.map((x) => <p key={x.id}>Potrącenie: {x.opis}: {zl(x.kwota)}</p>)}
          <p className="font-semibold">{kaucja.doplata > 0 ? `Najemca dopłaca: ${zl(kaucja.doplata)}` : `Do zwrotu najemcy: ${zl(kaucja.doZwrotu)}`}</p>
        </>
      )}

      {p.pokoje.some((r) => r.elementy.some((e) => e.zdjecia.length)) && (
        <div className="mt-6">
          <h3 className="font-bold">Zdjęcia</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {p.pokoje.flatMap((r) => r.elementy.flatMap((e) => e.zdjecia.map((z, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <figure key={`${e.id}-${i}`} className="break-inside-avoid"><img src={z} alt={`${r.nazwa}: ${e.nazwa}`} className="w-full rounded" /><figcaption className="text-[10px]">{r.nazwa}: {e.nazwa}</figcaption></figure>
            ))))}
          </div>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-10 text-center text-xs">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.podpisWynajmujacego && <img src={p.podpisWynajmujacego} alt="Podpis wynajmującego" className="mx-auto h-16" />}
          <div className="border-t border-[#1f1a14] pt-2">Wynajmujący</div>
        </div>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.podpisNajemcy && <img src={p.podpisNajemcy} alt="Podpis najemcy" className="mx-auto h-16" />}
          <div className="border-t border-[#1f1a14] pt-2">Najemca</div>
        </div>
      </div>
    </article>
  )
}

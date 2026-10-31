import Link from 'next/link'

export const metadata = { title: 'Księga wieczysta po ludzku (pokaz)' }

export default function KsiegaWieczystaPokazPage() {
  return (
    <div className="animate-fade-in-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Narzędzie · pokaz</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">
            Księga wieczysta po ludzku
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">
            To makieta na przykładowej księdze. Nie wpisuj tu prawdziwego numeru.
            Wersja z odczytem prawdziwych ksiąg powstanie po ustaleniu zasad przetwarzania danych.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-[color:var(--slate-light)] px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-foreground/70">
            pokaz
          </span>
          <Link href="/start" className="text-sm font-semibold text-foreground hover:text-accent">
            Wróć do narzędzi
          </Link>
        </div>
      </header>
      <div className="overflow-hidden rounded-2xl border border-border bg-[color:var(--card-strong)]">
        <iframe
          src="/pokaz/ksiega-wieczysta.html"
          title="Księga wieczysta po ludzku, pokaz"
          className="h-[80vh] w-full"
        />
      </div>
    </div>
  )
}

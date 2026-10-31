import { redirect } from 'next/navigation'
import { getPropertyService } from '@/features/properties/server-repository'
import { getServerUserId } from '@/lib/session'
import NewPropertyForm from './NewPropertyForm'
import PropertyCard from './PropertyCard'

export const dynamic = 'force-dynamic'

export default async function PropertiesPage() {
  const userId = await getServerUserId()
  if (!userId) redirect('/login')

  const projects = await getPropertyService().listProjects(userId)

  return (
    <div className="animate-fade-in-up space-y-6">
      <header className="relative overflow-hidden rounded-[2.25rem] border border-border bg-[color:var(--card-strong)] px-5 py-7 shadow-[var(--shadow-card)] sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-28 h-72 w-72 rounded-full border border-accent/20"
        />
        <div
          aria-hidden="true"
          className="absolute -right-4 -top-16 h-52 w-52 rounded-full border border-accent/40"
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-accent">
                Property Intelligence Studio
              </p>
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[0.64rem] font-medium text-foreground/60">
                Prywatny obszar pracy
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.65rem,7vw,5.2rem)] leading-[0.92] tracking-[-0.035em] text-foreground">
              Karty, którym
              <br />
              <em className="font-normal text-accent">można zaufać.</em>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-foreground/60 sm:text-base">
              Fakty, źródła, braki i materiały dla każdej nieruchomości w jednym
              kontrolowanym procesie.
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 lg:max-w-2xl lg:flex-1 lg:items-end">
            <NewPropertyForm />
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-foreground/60">
              {projects.length}{' '}
              {projects.length === 1 ? 'aktywna karta' : 'aktywnych kart'}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-[2.25rem] bg-background p-4 text-foreground shadow-[var(--shadow-card)] sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-accent">
              Moje karty
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">
              Twoje nieruchomości
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-foreground/60">
            Dokładne adresy pozostają ukryte na liście. Otwórz kartę, aby
            pracować na danych źródłowych.
          </p>
        </div>

        {projects.length > 0 ? (
          <div className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <PropertyCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-[color:var(--card-strong)]/70 px-6 text-center">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-display text-2xl text-accent"
            >
              01
            </span>
            <h3 className="mt-5 font-display text-2xl">Pierwsza karta</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-foreground/60">
              Zacznij od jednej prawdziwej oferty. Najpierw uporządkujemy fakty,
              dopiero potem uruchomimy generowanie materiałów.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

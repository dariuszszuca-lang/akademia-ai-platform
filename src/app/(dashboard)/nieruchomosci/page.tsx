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
      <header className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0d171b] px-5 py-7 shadow-[0_30px_90px_-45px_rgba(0,0,0,0.9)] sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-28 h-72 w-72 rounded-full border border-[#bd9360]/20"
        />
        <div
          aria-hidden="true"
          className="absolute -right-4 -top-16 h-52 w-52 rounded-full border border-[#2d6b68]/40"
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#d8b784]">
                Property Intelligence Studio
              </p>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.64rem] font-medium text-[#dce8e4]">
                Prywatny obszar pracy
              </span>
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.65rem,7vw,5.2rem)] leading-[0.92] tracking-[-0.035em] text-[#f7f2e7]">
              Teczki, którym
              <br />
              <em className="font-normal text-[#79aaa4]">można zaufać.</em>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#c6d0cc] sm:text-base">
              Fakty, źródła, braki i materiały dla każdej nieruchomości w jednym
              kontrolowanym procesie.
            </p>
          </div>

          <div className="flex w-full flex-col items-start gap-3 lg:max-w-2xl lg:flex-1 lg:items-end">
            <NewPropertyForm />
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.15em] text-[#82928e]">
              {projects.length}{' '}
              {projects.length === 1 ? 'aktywna teczka' : 'aktywnych teczek'}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-[2.25rem] bg-[#f2ede3] p-4 text-[#162026] shadow-[0_30px_90px_-48px_rgba(0,0,0,0.75)] sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-[#d9d2c5] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-[#8b693e]">
              Portfolio
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.02em]">
              Twoje nieruchomości
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#66716d]">
            Dokładne adresy pozostają ukryte na liście. Otwórz teczkę, aby
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
          <div className="flex min-h-72 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[#bbb4a7] bg-[#fffdf8]/70 px-6 text-center">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-[#b7ccc7] bg-[#eaf2ef] font-display text-2xl text-[#2d6b68]"
            >
              01
            </span>
            <h3 className="mt-5 font-display text-2xl">Pierwsza teczka</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#66716d]">
              Zacznij od jednej prawdziwej oferty. Najpierw uporządkujemy fakty,
              dopiero potem uruchomimy generowanie materiałów.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

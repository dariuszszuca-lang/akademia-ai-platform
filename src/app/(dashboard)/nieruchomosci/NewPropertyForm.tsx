'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

const fieldClassName =
  'mt-2 min-h-12 w-full rounded-xl border border-border bg-white px-3.5 text-sm text-foreground outline-none transition placeholder:text-foreground/60 focus:border-accent focus:ring-4 focus:ring-accent/10'

export default function NewPropertyForm() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addressMode, setAddressMode] = useState('hidden')
  const [propertyType, setPropertyType] = useState('apartment')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const body = {
      title: formData.get('title'),
      propertyType: formData.get('propertyType'),
      transactionType: formData.get('transactionType'),
      city: formData.get('city'),
      addressMode,
      ...optionalField('district', formData),
      ...(addressMode !== 'hidden'
        ? optionalField('address', formData)
        : {}),
      ...(propertyType === 'plot'
        ? optionalField('plotIdentifier', formData)
        : {}),
    }

    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()

      if (!response.ok) {
        const issue = Array.isArray(result.issues)
          ? result.issues[0]?.message
          : undefined
        setError(
          issue ??
            'Nie udało się utworzyć karty. Sprawdź dane i spróbuj ponownie.',
        )
        return
      }

      router.push(`/nieruchomosci/${result.project.id}`)
      router.refresh()
    } catch {
      setError('Brak połączenia z serwerem. Spróbuj ponownie za chwilę.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[color:var(--card-strong)] px-5 text-sm font-semibold text-foreground shadow-[var(--shadow-card)] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-[color:var(--card-strong)]"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-base text-white"
        >
          +
        </span>
        Nowa karta
      </button>
    )
  }

  return (
    <section
      aria-labelledby="new-property-title"
      className="w-full overflow-hidden rounded-[2rem] border border-border bg-[color:var(--card-strong)] shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-accent">
            Nowa nieruchomość
          </p>
          <h2
            id="new-property-title"
            className="mt-2 font-display text-2xl text-foreground"
          >
            Załóż prywatną kartę
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-xl text-foreground/60 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Zamknij formularz"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 sm:p-7">
        <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-foreground md:col-span-2">
            Nazwa robocza
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="np. Apartament przy parku"
              className={fieldClassName}
            />
          </label>

          <label className="text-sm font-semibold text-foreground">
            Typ nieruchomości
            <select
              name="propertyType"
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value)}
              className={fieldClassName}
            >
              <option value="apartment">Mieszkanie</option>
              <option value="house">Dom</option>
              <option value="plot">Działka</option>
              <option value="commercial">Obiekt komercyjny</option>
              <option value="premises">Lokal</option>
              <option value="other">Inna</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-foreground">
            Rodzaj procesu
            <select name="transactionType" className={fieldClassName}>
              <option value="sale">Sprzedaż</option>
              <option value="rent">Najem</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-foreground">
            Miasto
            <input
              name="city"
              required
              minLength={2}
              maxLength={100}
              placeholder="Poznań"
              className={fieldClassName}
            />
          </label>

          <label className="text-sm font-semibold text-foreground">
            Dzielnica lub obszar
            <input
              name="district"
              maxLength={100}
              placeholder="np. Jeżyce"
              className={fieldClassName}
            />
          </label>

          <label className="text-sm font-semibold text-foreground">
            Prywatność adresu
            <select
              name="addressMode"
              value={addressMode}
              onChange={(event) => setAddressMode(event.target.value)}
              className={fieldClassName}
            >
              <option value="hidden">Adres ukryty</option>
              <option value="approximate">Lokalizacja przybliżona</option>
              <option value="exact">Dokładny adres na karcie</option>
            </select>
          </label>

          {addressMode !== 'hidden' && (
            <label className="text-sm font-semibold text-foreground">
              {addressMode === 'exact' ? 'Dokładny adres' : 'Opis lokalizacji'}
              <input
                name="address"
                required={addressMode === 'exact'}
                maxLength={240}
                placeholder={
                  addressMode === 'exact'
                    ? 'Ulica, numer budynku i lokalu'
                    : 'np. okolice parku Sołackiego'
                }
                className={fieldClassName}
              />
            </label>
          )}

          {propertyType === 'plot' && (
            <label className="text-sm font-semibold text-foreground">
              Identyfikator działki
              <input
                name="plotIdentifier"
                maxLength={120}
                placeholder="opcjonalnie"
                className={fieldClassName}
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-xs leading-5 text-foreground/60">
            Adres i fakty pozostają wewnątrz karty. Nic nie trafia do materiałów
            publicznych bez świadomego oznaczenia.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? 'Zakładam kartę…' : 'Załóż kartę'}
          </button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className="mt-4 min-h-5 text-sm font-medium text-[#9a3f32]"
        >
          {error}
        </p>
      </form>
    </section>
  )
}

function optionalField(name: string, formData: FormData) {
  const value = formData.get(name)
  return typeof value === 'string' && value.trim()
    ? { [name]: value.trim() }
    : {}
}

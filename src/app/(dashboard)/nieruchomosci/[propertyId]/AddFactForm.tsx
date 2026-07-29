'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PropertyFact } from '@/features/properties/domain'
import {
  coerceFactValue,
  resolveFactKey,
} from '@/features/properties/form-utils'

type AddFactFormProps = {
  propertyId: string
}

const fieldClassName =
  'mt-2 min-h-11 w-full rounded-xl border border-[#d8d1c4] bg-white px-3.5 text-sm text-[#162026] outline-none transition placeholder:text-[#87908b] focus:border-[#2d6b68] focus:ring-4 focus:ring-[#2d6b68]/10'

export default function AddFactForm({ propertyId }: AddFactFormProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [valueType, setValueType] =
    useState<PropertyFact['valueType']>('text')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    const form = event.currentTarget
    const formData = new FormData(form)
    const label = String(formData.get('label') ?? '').trim()
    const rawValue = String(formData.get('value') ?? '')
    const status = String(formData.get('status') ?? 'declared')

    try {
      const value = coerceFactValue(rawValue, valueType)
      if (
        (valueType === 'number' || valueType === 'money') &&
        (typeof value !== 'number' || Number.isNaN(value))
      ) {
        setError('Wpisz poprawną wartość liczbową.')
        return
      }

      const unit = String(formData.get('unit') ?? '').trim()
      const response = await fetch(
        `/api/properties/${propertyId}/facts`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            key: resolveFactKey(label),
            label,
            category: formData.get('category'),
            valueType,
            value,
            ...(unit ? { unit } : {}),
            status,
            visibility: formData.get('visibility'),
            sourceIds: [],
            ...(status === 'confirmed'
              ? { confirmedByUserId: 'current-session-user' }
              : {}),
          }),
        },
      )
      const result = await response.json()

      if (!response.ok) {
        const issue = Array.isArray(result.issues)
          ? result.issues[0]?.message
          : undefined
        setError(
          issue ??
            'Nie udało się dodać faktu. Sprawdź dane i spróbuj ponownie.',
        )
        return
      }

      form.reset()
      setValueType('text')
      setIsOpen(false)
      router.refresh()
    } catch (caughtError) {
      setError(
        valueType === 'json' && caughtError instanceof SyntaxError
          ? 'Dane JSON mają niepoprawny format.'
          : 'Brak połączenia z serwerem. Spróbuj ponownie za chwilę.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#173f40] px-5 text-sm font-semibold text-white outline-none transition hover:bg-[#245b59] focus-visible:ring-2 focus-visible:ring-[#2d6b68] focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">+</span>
        Dodaj fakt
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.6rem] border border-[#d8d1c4] bg-[#f6f0e5] p-5 text-[#162026]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#8b693e]">
            Nowy wpis
          </p>
          <h3 className="mt-1.5 font-display text-2xl">Dodaj fakt do paszportu</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#d8d1c4] text-xl text-[#52605c] outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#2d6b68]"
          aria-label="Zamknij formularz"
        >
          ×
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold md:col-span-2">
          Nazwa informacji
          <input
            name="label"
            required
            minLength={2}
            maxLength={160}
            placeholder="np. Powierzchnia użytkowa"
            className={fieldClassName}
          />
        </label>

        <label className="text-sm font-semibold">
          Kategoria
          <select name="category" className={fieldClassName}>
            <option value="areas">Powierzchnie</option>
            <option value="price">Cena</option>
            <option value="costs">Koszty</option>
            <option value="rooms">Pomieszczenia</option>
            <option value="building">Budynek</option>
            <option value="plot">Działka</option>
            <option value="legal">Stan prawny</option>
            <option value="technical">Dane techniczne</option>
            <option value="address">Lokalizacja</option>
            <option value="other">Pozostałe</option>
          </select>
        </label>

        <label className="text-sm font-semibold">
          Rodzaj wartości
          <select
            name="valueType"
            value={valueType}
            onChange={(event) =>
              setValueType(event.target.value as PropertyFact['valueType'])
            }
            className={fieldClassName}
          >
            <option value="text">Tekst</option>
            <option value="number">Liczba</option>
            <option value="money">Kwota</option>
            <option value="boolean">Tak / nie</option>
            <option value="date">Data</option>
            <option value="json">Dane strukturalne</option>
          </select>
        </label>

        <ValueField valueType={valueType} />

        <label className="text-sm font-semibold">
          Jednostka
          <input
            name="unit"
            maxLength={30}
            placeholder={valueType === 'money' ? 'PLN' : 'np. m²'}
            className={fieldClassName}
          />
        </label>

        <label className="text-sm font-semibold">
          Status wiarygodności
          <select name="status" className={fieldClassName}>
            <option value="declared">Z deklaracji</option>
            <option value="confirmed">Potwierdzone przeze mnie</option>
            <option value="missing">Brak danych</option>
            <option value="conflicting">Konflikt informacji</option>
            <option value="not_applicable">Nie dotyczy</option>
          </select>
        </label>

        <label className="text-sm font-semibold">
          Widoczność
          <select name="visibility" className={fieldClassName}>
            <option value="internal">Wewnętrzne</option>
            <option value="client">Dla klienta</option>
            <option value="public">Publiczne</option>
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-[#d8d1c4] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p
          role="status"
          aria-live="polite"
          className="min-h-5 text-sm font-medium text-[#9a3f32]"
        >
          {error}
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#173f40] px-5 text-sm font-semibold text-white outline-none transition hover:bg-[#245b59] focus-visible:ring-2 focus-visible:ring-[#2d6b68] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {isSubmitting ? 'Zapisuję…' : 'Zapisz fakt'}
        </button>
      </div>
    </form>
  )
}

function ValueField({
  valueType,
}: {
  valueType: PropertyFact['valueType']
}) {
  if (valueType === 'boolean') {
    return (
      <label className="text-sm font-semibold">
        Wartość
        <select name="value" className={fieldClassName}>
          <option value="true">Tak</option>
          <option value="false">Nie</option>
        </select>
      </label>
    )
  }

  if (valueType === 'json') {
    return (
      <label className="text-sm font-semibold md:col-span-2">
        Wartość JSON
        <textarea
          name="value"
          required
          rows={5}
          placeholder={'{\n  "klucz": "wartość"\n}'}
          className={`${fieldClassName} resize-y py-3 font-mono`}
        />
      </label>
    )
  }

  return (
    <label className="text-sm font-semibold">
      Wartość
      <input
        name="value"
        required
        type={
          valueType === 'date'
            ? 'date'
            : valueType === 'number' || valueType === 'money'
              ? 'text'
              : 'text'
        }
        inputMode={
          valueType === 'number' || valueType === 'money'
            ? 'decimal'
            : undefined
        }
        placeholder={
          valueType === 'number' || valueType === 'money'
            ? 'np. 52,4'
            : 'Wpisz wartość'
        }
        className={fieldClassName}
      />
    </label>
  )
}

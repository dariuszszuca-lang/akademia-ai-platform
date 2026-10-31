'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Project = { id: string; title: string; city?: string | null }

export type SavePayload = {
  toolId: 'rejestr-cen' | 'protokol' | 'ksiega-wieczysta' | 'umowa-najmu' | 'spacer-3d'
  title: string
  summary: Record<string, string | number>
}

/**
 * Zapis podsumowania wyniku do teczki nieruchomości.
 * mode="public": użytkownik bez konta widzi zachętę do rejestracji.
 */
export default function SaveToFolder({
  payload,
  mode,
}: {
  payload: SavePayload | null
  mode: 'platform' | 'public'
}) {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [projectId, setProjectId] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (mode !== 'platform') return
    let alive = true
    fetch('/api/properties')
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d: { projects?: Project[] }) => {
        if (!alive) return
        const list = d.projects ?? []
        setProjects(list)
        if (list[0]) setProjectId(list[0].id)
      })
      .catch(() => alive && setProjects([]))
    return () => {
      alive = false
    }
  }, [mode])

  if (mode === 'public') {
    return (
      <div className="rounded-xl border border-border bg-[color:var(--card-strong)] p-4 text-sm">
        <p className="font-semibold text-foreground">Chcesz zachować wynik?</p>
        <p className="mt-1 text-foreground/60">
          Załóż bezpłatne konto. Wyniki trafią do teczki mieszkania razem z innymi narzędziami.
        </p>
        <Link href="/register" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-white">
          Załóż konto
        </Link>
      </div>
    )
  }

  async function save() {
    if (!payload || !projectId) return
    setState('saving')
    setMessage('')
    try {
      const res = await fetch('/api/narzedzia/wyniki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: projectId, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Nie udało się zapisać.')
      setState('saved')
      setMessage('Zapisane w teczce.')
    } catch (e) {
      setState('error')
      setMessage(e instanceof Error ? e.message : 'Nie udało się zapisać.')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-[color:var(--card-strong)] p-4 text-sm">
      <p className="font-semibold text-foreground">Zapisz w teczce</p>
      <p className="mt-1 text-foreground/60">
        Zapisujemy tylko podsumowanie. Dane osób i zdjęcia zostają na Twoim urządzeniu.
      </p>
      {projects === null ? (
        <p className="mt-3 text-foreground/50">Wczytuję teczki...</p>
      ) : projects.length === 0 ? (
        <p className="mt-3 text-foreground/60">
          Nie masz jeszcze teczki.{' '}
          <Link href="/nieruchomosci" className="font-semibold text-accent hover:underline">
            Załóż teczkę
          </Link>
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="save-folder" className="sr-only">
            Teczka
          </label>
          <select
            id="save-folder"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value)
              setState('idle')
            }}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.city ? `, ${p.city}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={!payload || state === 'saving'}
            className="min-h-11 rounded-full bg-accent px-5 font-semibold text-white disabled:opacity-50"
          >
            {state === 'saving' ? 'Zapisuję...' : 'Zapisz'}
          </button>
        </div>
      )}
      {!payload && projects && projects.length > 0 && (
        <p className="mt-2 text-xs text-foreground/50">Najpierw przygotuj wynik.</p>
      )}
      {message && (
        <p role="status" className={`mt-2 text-xs ${state === 'error' ? 'text-red-700' : 'text-accent'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

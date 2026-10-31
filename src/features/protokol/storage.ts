'use client'

import type { Protokol } from './domain'

/**
 * Protokoły żyją tylko w pamięci przeglądarki (IndexedDB), razem ze zdjęciami i podpisami.
 * Przeniesienie na inne urządzenie: eksport do pliku i import.
 */
const DB = 'protokoly'
const STORE = 'protokoly'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function listaProtokolow(): Promise<Protokol[]> {
  const all = await tx<Protokol[]>('readonly', (s) => s.getAll())
  return all.sort((a, b) => b.zmieniono.localeCompare(a.zmieniono))
}

export async function zapiszProtokol(p: Protokol): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...p, zmieniono: new Date().toISOString() }))
}

export async function usunProtokol(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

export function eksportuj(p: Protokol) {
  const blob = new Blob([JSON.stringify({ format: 'protokol-v1', protokol: p })], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `protokol-${p.typ}-${p.data}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importuj(file: File): Promise<Protokol> {
  const data = JSON.parse(await file.text())
  if (data?.format !== 'protokol-v1' || !data.protokol?.id || !Array.isArray(data.protokol.pokoje)) {
    throw new Error('To nie jest plik protokołu z tego narzędzia.')
  }
  return data.protokol as Protokol
}

/** Zdjęcie z telefonu zmniejszone do 1280 px i JPEG, żeby protokół mieścił się w pamięci. */
export async function zmniejszZdjecie(file: File, max = 1280, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

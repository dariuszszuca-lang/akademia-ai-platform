/**
 * Abstrakcja nad storage. Uzywa Vercel KV jesli skonfigurowane,
 * w przeciwnym razie zapis do lokalnego pliku JSON (dev mode).
 *
 * Klucze: user:{userId}:profil, user:{userId}:onboarding, itd.
 */

import { kv } from '@vercel/kv'
import fs from 'fs/promises'
import path from 'path'

const LOCAL_STORE_PATH = path.join(process.cwd(), '.local-store.json')

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function readLocal(): Promise<Record<string, unknown>> {
  try {
    const data = await fs.readFile(LOCAL_STORE_PATH, 'utf8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

async function writeLocal(data: Record<string, unknown>): Promise<void> {
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), 'utf8')
}

export async function storeGet<T = unknown>(key: string): Promise<T | null> {
  if (isKvConfigured()) {
    return (await kv.get<T>(key)) ?? null
  }
  const data = await readLocal()
  return (data[key] as T | undefined) ?? null
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  if (isKvConfigured()) {
    await kv.set(key, value)
    return
  }
  const data = await readLocal()
  data[key] = value
  await writeLocal(data)
}

export async function storeDelete(key: string): Promise<void> {
  if (isKvConfigured()) {
    await kv.del(key)
    return
  }
  const data = await readLocal()
  delete data[key]
  await writeLocal(data)
}

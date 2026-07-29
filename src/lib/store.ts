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
const LOCAL_EXPIRY_PREFIX = '__store_expiry__:'
let localMutationQueue: Promise<void> = Promise.resolve()

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

async function withLocalMutationLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const previous = localMutationQueue
  let release: () => void = () => undefined
  localMutationQueue = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

function localExpiryKey(key: string): string {
  return `${LOCAL_EXPIRY_PREFIX}${key}`
}

function removeExpiredLocalValue(
  data: Record<string, unknown>,
  key: string,
): boolean {
  const expiryKey = localExpiryKey(key)
  const expiresAt = data[expiryKey]
  if (
    typeof expiresAt !== 'number' ||
    expiresAt > Math.floor(Date.now() / 1000)
  ) {
    return false
  }
  delete data[key]
  delete data[expiryKey]
  return true
}

export async function storeGet<T = unknown>(key: string): Promise<T | null> {
  if (isKvConfigured()) {
    return (await kv.get<T>(key)) ?? null
  }
  return withLocalMutationLock(async () => {
    const data = await readLocal()
    if (removeExpiredLocalValue(data, key)) {
      await writeLocal(data)
      return null
    }
    return (data[key] as T | undefined) ?? null
  })
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  if (isKvConfigured()) {
    await kv.set(key, value)
    return
  }
  await withLocalMutationLock(async () => {
    const data = await readLocal()
    data[key] = value
    delete data[localExpiryKey(key)]
    await writeLocal(data)
  })
}

export async function storeDelete(key: string): Promise<void> {
  if (isKvConfigured()) {
    await kv.del(key)
    return
  }
  await withLocalMutationLock(async () => {
    const data = await readLocal()
    delete data[key]
    delete data[localExpiryKey(key)]
    await writeLocal(data)
  })
}

export async function storeIncrementWithExpiry(
  key: string,
  expiresAtEpochSeconds: number,
): Promise<number> {
  if (isKvConfigured()) {
    const [incremented] = await kv
      .multi()
      .incr(key)
      .expireat(key, expiresAtEpochSeconds)
      .exec()
    if (typeof incremented !== 'number') {
      throw new Error('KV increment returned an invalid value')
    }
    return incremented
  }

  return withLocalMutationLock(async () => {
    const data = await readLocal()
    removeExpiredLocalValue(data, key)
    const stored = data[key]
    const current =
      typeof stored === 'number' && Number.isFinite(stored)
        ? stored
        : 0
    const incremented = current + 1
    data[key] = incremented
    data[localExpiryKey(key)] = expiresAtEpochSeconds
    await writeLocal(data)
    return incremented
  })
}

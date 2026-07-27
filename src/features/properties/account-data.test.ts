import { describe, expect, it, vi } from 'vitest'
import {
  deleteAccountData,
  exportAccountData,
  getAccountKeys,
} from './account-data'

describe('property studio account data workflows', () => {
  it('includes property projects, facts and audit in account export', async () => {
    const propertyStudio = {
      projects: [{ id: 'project-1' }],
      facts: [{ id: 'fact-1' }],
      audit: [{ id: 'audit-1' }],
    }
    const getValue = vi.fn(async (key: string) => `value:${key}`)
    const exportForUser = vi.fn(async () => propertyStudio)

    const result = await exportAccountData('user-a', {
      getValue,
      exportForUser,
    })

    expect(result.propertyStudio).toEqual(propertyStudio)
    expect(exportForUser).toHaveBeenCalledWith('user-a')
    expect(getValue).toHaveBeenCalledTimes(5)
  })

  it('deletes PostgreSQL data before any KV key', async () => {
    const operations: string[] = []

    const deletedKeys = await deleteAccountData('user-a', {
      deletePropertiesForUser: async () => {
        operations.push('postgres')
      },
      deleteValue: async (key) => {
        operations.push(key)
      },
    })

    expect(operations[0]).toBe('postgres')
    expect(operations.slice(1)).toEqual(getAccountKeys('user-a'))
    expect(deletedKeys).toEqual(getAccountKeys('user-a'))
  })

  it('does not delete KV data when PostgreSQL deletion fails', async () => {
    const deleteValue = vi.fn()

    await expect(
      deleteAccountData('user-a', {
        deletePropertiesForUser: async () => {
          throw new Error('database_unavailable')
        },
        deleteValue,
      }),
    ).rejects.toThrow('database_unavailable')

    expect(deleteValue).not.toHaveBeenCalled()
  })
})

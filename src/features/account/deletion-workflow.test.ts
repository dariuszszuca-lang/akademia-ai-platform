import { describe, expect, it, vi } from 'vitest'
import { deleteAuthenticatedAccount } from './deletion-workflow'

describe('authenticated account deletion', () => {
  it('rejects a token belonging to another subject without deleting anything', async () => {
    const verifyToken = vi.fn(async () => ({ sub: 'user-b' }))
    const deleteApplicationData = vi.fn()
    const deleteIdentity = vi.fn()

    await expect(
      deleteAuthenticatedAccount({
        sessionUserId: 'user-a',
        accessToken: 'token',
        verifyToken,
        deleteApplicationData,
        deleteIdentity,
      }),
    ).rejects.toThrow('ACCOUNT_DELETE_SUBJECT_MISMATCH')

    expect(verifyToken).toHaveBeenCalledWith('token')
    expect(deleteApplicationData).not.toHaveBeenCalled()
    expect(deleteIdentity).not.toHaveBeenCalled()
  })

  it('deletes app data before the matching Cognito identity', async () => {
    const order: string[] = []
    const verifyToken = vi.fn(async () => ({ sub: 'user-a' }))
    const deleteIdentity = vi.fn(async (accessToken: string) => {
      order.push('cognito')
      expect(accessToken).toBe('token')
    })

    const result = await deleteAuthenticatedAccount({
      sessionUserId: 'user-a',
      accessToken: 'token',
      verifyToken,
      deleteApplicationData: async () => {
        order.push('application')
        return {
          sourceObjects: 1,
          propertyStudio: 1,
          accountKeys: 5,
        }
      },
      deleteIdentity,
    })

    expect(order).toEqual(['application', 'cognito'])
    expect(result.accountKeys).toBe(5)
    expect(verifyToken).toHaveBeenCalledWith('token')
    expect(deleteIdentity).toHaveBeenCalledWith('token')
  })
})

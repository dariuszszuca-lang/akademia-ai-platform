type DeletedCounts = {
  sourceObjects: number
  propertyStudio: number
  accountKeys: number
}

export async function deleteAuthenticatedAccount(input: {
  sessionUserId: string
  accessToken: string
  verifyToken: (token: string) => Promise<{ sub: string }>
  deleteApplicationData: () => Promise<DeletedCounts>
  deleteIdentity: (token: string) => Promise<void>
}) {
  const verified = await input.verifyToken(input.accessToken)
  if (verified.sub !== input.sessionUserId) {
    throw new Error('ACCOUNT_DELETE_SUBJECT_MISMATCH')
  }

  const deleted = await input.deleteApplicationData()
  await input.deleteIdentity(input.accessToken)
  return deleted
}

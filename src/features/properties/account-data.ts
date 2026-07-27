type PropertyStudioExport = {
  projects: unknown[]
  facts: unknown[]
  audit: unknown[]
}

type ExportAccountDependencies = {
  getValue: (key: string) => Promise<unknown>
  exportForUser: (userId: string) => Promise<PropertyStudioExport>
}

type DeleteAccountDependencies = {
  deletePropertiesForUser: (userId: string) => Promise<void>
  deleteValue: (key: string) => Promise<void>
}

export function getAccountKeys(userId: string) {
  return [
    `user:${userId}:profil`,
    `user:${userId}:persona-buyer`,
    `user:${userId}:persona-seller`,
    `user:${userId}:onboarding`,
    `user:${userId}:subscription`,
  ]
}

export async function exportAccountData(
  userId: string,
  dependencies: ExportAccountDependencies,
) {
  const keys = getAccountKeys(userId)
  const [
    profil,
    personaBuyer,
    personaSeller,
    onboarding,
    subscription,
    propertyStudio,
  ] = await Promise.all([
    ...keys.map((key) => dependencies.getValue(key)),
    dependencies.exportForUser(userId),
  ])

  return {
    profil,
    personaBuyer,
    personaSeller,
    onboarding,
    subscription,
    propertyStudio,
  }
}

export async function deleteAccountData(
  userId: string,
  dependencies: DeleteAccountDependencies,
) {
  await dependencies.deletePropertiesForUser(userId)

  const keys = getAccountKeys(userId)
  for (const key of keys) {
    await dependencies.deleteValue(key)
  }

  return keys
}

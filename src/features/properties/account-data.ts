import type { PropertySource } from '../property-sources/domain'

type PropertyStudioExport = {
  projects: unknown[]
  facts: unknown[]
  audit: unknown[]
}

type PropertySourcesExport = {
  sources: unknown[]
  sourceJobs: unknown[]
  factProposals: unknown[]
}

type ExportAccountDependencies = {
  getValue: (key: string) => Promise<unknown>
  exportForUser: (userId: string) => Promise<PropertyStudioExport>
  exportSourcesForUser: (userId: string) => Promise<PropertySourcesExport>
  recordAccountExported: (userId: string) => Promise<void>
  exportProductEventsForUser: (userId: string) => Promise<unknown[]>
}

type DeleteAccountDependencies = {
  listSourcesForUser: (userId: string) => Promise<PropertySource[]>
  recordAccountDeleted: (userId: string) => Promise<void>
  purgeSourceObjects: (
    sources: PropertySource[],
  ) => Promise<{ deletedVersions: number }>
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
  await dependencies.recordAccountExported(userId)
  const keys = getAccountKeys(userId)
  const [
    accountValues,
    propertyStudio,
    propertySources,
    productEvents,
  ] = await Promise.all([
    Promise.all(keys.map((key) => dependencies.getValue(key))),
    dependencies.exportForUser(userId),
    dependencies.exportSourcesForUser(userId),
    dependencies.exportProductEventsForUser(userId),
  ])
  const [
    profil,
    personaBuyer,
    personaSeller,
    onboarding,
    subscription,
  ] = accountValues

  return {
    profil,
    personaBuyer,
    personaSeller,
    onboarding,
    subscription,
    propertyStudio: {
      ...propertyStudio,
      ...propertySources,
      productEvents,
    },
  }
}

export async function deleteAccountData(
  userId: string,
  dependencies: DeleteAccountDependencies,
) {
  const sources = await dependencies.listSourcesForUser(userId)
  await dependencies.recordAccountDeleted(userId)
  const purgeResult =
    sources.length === 0
      ? { deletedVersions: 0 }
      : await dependencies.purgeSourceObjects(sources)
  await dependencies.deletePropertiesForUser(userId)

  const keys = getAccountKeys(userId)
  for (const key of keys) {
    await dependencies.deleteValue(key)
  }

  return {
    sourceObjects: purgeResult.deletedVersions,
    propertyStudio: 1,
    accountKeys: keys.length,
  }
}

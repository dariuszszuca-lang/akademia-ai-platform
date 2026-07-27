import { z } from 'zod'

export const propertyTypes = [
  'apartment',
  'house',
  'plot',
  'commercial',
  'premises',
  'other',
] as const

export const transactionTypes = ['sale', 'rent'] as const

export const propertyStages = [
  'draft',
  'collecting',
  'verification',
  'ready',
  'marketing',
  'under_offer',
  'closed',
  'archived',
] as const

export const addressModes = ['exact', 'approximate', 'hidden'] as const

export const propertyFactStatuses = [
  'confirmed',
  'declared',
  'inferred',
  'conflicting',
  'missing',
  'not_applicable',
] as const

export const propertyFactVisibilities = ['internal', 'client', 'public'] as const
export const actorTypes = ['user', 'ai', 'integration'] as const
export const propertyFactValueTypes = [
  'text',
  'number',
  'money',
  'boolean',
  'date',
  'json',
] as const

export const propertyFactValueTypeSchema = z.enum(propertyFactValueTypes)

const propertyBaseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  propertyType: z.enum(propertyTypes),
  transactionType: z.enum(transactionTypes),
  stage: z.enum(propertyStages).default('draft'),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().max(100).optional(),
  addressMode: z.enum(addressModes),
  address: z.string().trim().max(240).optional(),
  plotIdentifier: z.string().trim().max(120).optional(),
})

function validateExactAddress(
  value: { addressMode?: (typeof addressModes)[number]; address?: string },
  context: z.RefinementCtx,
) {
  if (value.addressMode === 'exact' && !value.address?.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['address'],
      message: 'Dokładny adres jest wymagany dla trybu exact.',
    })
  }
}

export const createPropertySchema = propertyBaseSchema.superRefine(
  validateExactAddress,
)

export const updatePropertySchema = propertyBaseSchema
  .omit({ propertyType: true, transactionType: true })
  .partial()
  .superRefine(validateExactAddress)

const factBaseSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9._-]*$/)
    .max(100),
  label: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  valueType: propertyFactValueTypeSchema,
  value: z.unknown(),
  unit: z.string().trim().max(30).optional(),
  status: z.enum(propertyFactStatuses),
  visibility: z.enum(propertyFactVisibilities).default('internal'),
  sourceIds: z.array(z.string().min(1)).default([]),
  confirmedByUserId: z.string().min(1).optional(),
})

function validateConfirmation(
  value: {
    status?: (typeof propertyFactStatuses)[number]
    actorType?: (typeof actorTypes)[number]
    sourceIds?: string[]
    confirmedByUserId?: string
  },
  context: z.RefinementCtx,
) {
  if (value.status !== 'confirmed') return

  if (value.actorType === 'ai') {
    context.addIssue({
      code: 'custom',
      path: ['status'],
      message: 'AI nie może samodzielnie potwierdzić faktu.',
    })
    return
  }

  if ((value.sourceIds?.length ?? 0) === 0 && !value.confirmedByUserId) {
    context.addIssue({
      code: 'custom',
      path: ['status'],
      message: 'Potwierdzony fakt wymaga źródła albo potwierdzenia użytkownika.',
    })
  }
}

export const createPropertyFactSchema =
  factBaseSchema.superRefine(validateConfirmation)

export const updatePropertyFactSchema = factBaseSchema
  .partial()
  .extend({
    actorType: z.enum(actorTypes),
  })
  .superRefine(validateConfirmation)

export type CreatePropertyInput = z.infer<typeof createPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
export type CreatePropertyFactInput = z.infer<typeof createPropertyFactSchema>
export type UpdatePropertyFactInput = z.infer<typeof updatePropertyFactSchema>
export type PropertyStage = (typeof propertyStages)[number]
export type PropertyFactStatus = (typeof propertyFactStatuses)[number]

export type PropertyProject = CreatePropertyInput & {
  id: string
  organizationId: string
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
}

export type PropertyFact = CreatePropertyFactInput & {
  id: string
  propertyProjectId: string
  version: number
  createdByType: (typeof actorTypes)[number]
  createdById: string
  confirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

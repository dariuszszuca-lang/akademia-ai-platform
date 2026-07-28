import { z } from 'zod'
import {
  propertyFactValueTypeSchema,
  transactionTypes,
} from '../properties/domain'
import {
  evidenceLocatorSchema,
  supportedSourceMediaTypes,
} from '../property-sources/domain'

export const syntheticCaseCodes = [
  'SYN-M-01',
  'SYN-M-02',
  'SYN-D-01',
  'SYN-P-01',
  'SYN-P-02',
] as const

export const syntheticMaterialKinds = [
  'pdf',
  'jpeg',
  'png',
  'docx',
  'xlsx',
  'csv',
  'txt',
] as const

export const runIdSchema = z
  .string()
  .regex(/^syn-\d{8}T\d{6}Z-[a-f0-9]{8}$/)

const forbiddenFieldNames = new Set(['password', 'secret', 'token'])
const forbiddenStringPatterns = [
  /(?:^|\D)\d{11}(?:\D|$)/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?48[\s.-]*)?(?:\d[\s.-]*){9}/,
  /[A-Z]{2}\d[A-Z]\/\d{8}\/\d/,
  /AKIA[A-Z0-9]{12,}/,
  /sk_live_/,
  /sk-ant-/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
]

export function assertSyntheticDataPolicy(value: unknown): void {
  if (typeof value === 'string' || typeof value === 'number') {
    const serialized = String(value)
    if (forbiddenStringPatterns.some((pattern) => pattern.test(serialized))) {
      throw new Error('SYNTHETIC_DATA_POLICY_VIOLATION')
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach(assertSyntheticDataPolicy)
    return
  }

  if (!value || typeof value !== 'object') return

  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenFieldNames.has(key.toLowerCase())) {
      throw new Error('SYNTHETIC_DATA_POLICY_VIOLATION')
    }
    assertSyntheticDataPolicy(nestedValue)
  }
}

const syntheticFactValueSchema = z.object({
  factKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-zA-Z0-9._-]*$/)
    .max(100),
  valueType: propertyFactValueTypeSchema,
  value: z.json(),
  unit: z.string().trim().max(30).optional(),
})

export const expectedFactSchema = syntheticFactValueSchema.extend({
  locator: evidenceLocatorSchema,
  evidenceId: z.string().regex(/^EVID-[A-Z0-9-]+$/),
  conflict: z.boolean().default(false),
  acceptedVariants: z.array(z.json()).default([]),
})

export const syntheticMaterialSchema = z.object({
  id: z.string().regex(/^SYN-[A-Z0-9-]+$/),
  caseCode: z.enum(syntheticCaseCodes),
  kind: z.enum(syntheticMaterialKinds),
  fileName: z.string().trim().min(1).max(120),
  mediaType: z.enum(supportedSourceMediaTypes),
  expectedOutcome: z.enum([
    'review_ready',
    'needs_manual_review',
    'controlled_failure',
  ]),
  facts: z.array(expectedFactSchema),
})

export const syntheticCaseSchema = z.object({
  code: z.enum(syntheticCaseCodes),
  title: z.string().trim().min(3).max(120),
  propertyType: z.enum(['apartment', 'house', 'plot']),
  transactionType: z.enum(transactionTypes),
  city: z.literal('Testowo'),
  district: z.string().trim().min(2).max(100),
  addressMode: z.literal('hidden'),
  seedFacts: z.array(syntheticFactValueSchema),
  materials: z.array(syntheticMaterialSchema).length(4),
})

const expectedKindCounts: Record<SyntheticMaterialKind, number> = {
  pdf: 5,
  jpeg: 2,
  png: 1,
  docx: 3,
  xlsx: 3,
  csv: 3,
  txt: 3,
}

export const syntheticCorpusSchema = z
  .object({
    version: z.literal('synthetic-v1'),
    cases: z.array(syntheticCaseSchema).length(5),
  })
  .superRefine((corpus, context) => {
    try {
      assertSyntheticDataPolicy(corpus)
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'SYNTHETIC_DATA_POLICY_VIOLATION',
      })
    }

    if (
      !corpus.cases.every(
        (item, index) => item.code === syntheticCaseCodes[index],
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['cases'],
        message: 'SYNTHETIC_CASE_SET_INVALID',
      })
    }

    const materials = corpus.cases.flatMap((item) => item.materials)
    const facts = materials.flatMap((item) => item.facts)
    const materialIds = new Set(materials.map((item) => item.id))
    const evidenceIds = new Set(facts.map((item) => item.evidenceId))

    if (materials.length !== 20 || materialIds.size !== materials.length) {
      context.addIssue({
        code: 'custom',
        path: ['cases'],
        message: 'SYNTHETIC_MATERIAL_SET_INVALID',
      })
    }

    if (evidenceIds.size !== facts.length) {
      context.addIssue({
        code: 'custom',
        path: ['cases'],
        message: 'SYNTHETIC_EVIDENCE_IDS_NOT_UNIQUE',
      })
    }

    for (const item of corpus.cases) {
      if (
        item.materials.some(
          (material) => material.caseCode !== item.code,
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['cases'],
          message: 'SYNTHETIC_MATERIAL_CASE_MISMATCH',
        })
      }
    }

    for (const kind of syntheticMaterialKinds) {
      const count = materials.filter((item) => item.kind === kind).length
      if (count !== expectedKindCounts[kind]) {
        context.addIssue({
          code: 'custom',
          path: ['cases'],
          message: `SYNTHETIC_KIND_COUNT_INVALID:${kind}`,
        })
      }
    }

    if (facts.length < 50) {
      context.addIssue({
        code: 'custom',
        path: ['cases'],
        message: 'SYNTHETIC_FACT_COUNT_TOO_LOW',
      })
    }

    if (facts.filter((fact) => fact.conflict).length !== 5) {
      context.addIssue({
        code: 'custom',
        path: ['cases'],
        message: 'SYNTHETIC_CONFLICT_COUNT_INVALID',
      })
    }
  })

export type SyntheticCaseCode = (typeof syntheticCaseCodes)[number]
export type SyntheticMaterialKind = (typeof syntheticMaterialKinds)[number]
export type SyntheticCorpus = z.infer<typeof syntheticCorpusSchema>
export type SyntheticCase = z.infer<typeof syntheticCaseSchema>
export type SyntheticMaterial = z.infer<typeof syntheticMaterialSchema>
export type ExpectedSyntheticFact = z.infer<typeof expectedFactSchema>
export type SupportedSourceMediaType =
  (typeof supportedSourceMediaTypes)[number]

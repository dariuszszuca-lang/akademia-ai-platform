import crypto from 'node:crypto'
import { z } from 'zod'

export const guardDutyScanResultStatuses = [
  'NO_THREATS_FOUND',
  'THREATS_FOUND',
  'UNSUPPORTED',
  'ACCESS_DENIED',
  'FAILED',
] as const

export type GuardDutyScanResultStatus =
  (typeof guardDutyScanResultStatuses)[number]

const s3ObjectDetailsSchema = z
  .object({
    bucketName: z.string().min(3).max(63),
    objectKey: z
      .string()
      .min(1)
      .max(1024)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    eTag: z.string().min(1).max(256),
    versionId: z.string().min(1).max(1024),
    s3Throttled: z.boolean(),
  })
  .passthrough()

const scanResultDetailsSchema = z
  .object({
    scanResultStatus: z.enum(guardDutyScanResultStatuses),
    threats: z.unknown().nullable(),
    statusReasons: z.array(z.string().min(1).max(160)).nullable(),
  })
  .passthrough()

export const guardDutyObjectScanEventSchema = z
  .object({
    version: z.literal('0'),
    id: z.string().min(1).max(160),
    'detail-type': z.literal(
      'GuardDuty Malware Protection Object Scan Result',
    ),
    source: z.literal('aws.guardduty'),
    account: z.string().regex(/^\d{12}$/),
    time: z.iso.datetime({ offset: true }),
    region: z.string().regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/),
    resources: z.array(z.string().min(1).max(2048)).min(1),
    detail: z
      .object({
        schemaVersion: z.literal('1.0'),
        scanStatus: z.enum(['COMPLETED', 'SKIPPED', 'FAILED']),
        resourceType: z.literal('S3_OBJECT'),
        s3ObjectDetails: s3ObjectDetailsSchema,
        scanResultDetails: scanResultDetailsSchema,
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((event, context) => {
    const result = event.detail.scanResultDetails.scanResultStatus
    const expectedScanStatus =
      result === 'NO_THREATS_FOUND' || result === 'THREATS_FOUND'
        ? 'COMPLETED'
        : result === 'FAILED'
          ? 'FAILED'
          : 'SKIPPED'

    if (event.detail.scanStatus !== expectedScanStatus) {
      context.addIssue({
        code: 'custom',
        path: ['detail', 'scanStatus'],
        message: 'GuardDuty scan status does not match its result.',
      })
    }
  })

export type GuardDutyObjectScanEvent = z.infer<
  typeof guardDutyObjectScanEventSchema
>

const propertySourceObjectKeyPattern =
  /^originals\/organizations\/([^/]+)\/properties\/([^/]+)\/sources\/([^/]+)\/original$/
const uuidSchema = z.string().uuid()

export function parsePropertySourceObjectKey(objectKey: string) {
  const match = propertySourceObjectKeyPattern.exec(objectKey)
  if (!match) throw new Error('UNEXPECTED_SCAN_OBJECT_KEY')

  const [organizationId, propertyProjectId, sourceId] = match
    .slice(1)
    .map((value) => {
      const parsed = uuidSchema.safeParse(value)
      if (!parsed.success) {
        throw new Error('UNEXPECTED_SCAN_OBJECT_KEY')
      }
      return parsed.data
    })

  return { organizationId, propertyProjectId, sourceId }
}

export function createGuardDutyExecutionName(
  event: GuardDutyObjectScanEvent,
) {
  const object = event.detail.s3ObjectDetails
  const canonicalIdentity = [
    object.bucketName,
    object.objectKey,
    object.versionId,
    event.detail.scanResultDetails.scanResultStatus,
  ].join('\n')
  const fingerprint = crypto
    .createHash('sha256')
    .update(canonicalIdentity)
    .digest('hex')

  return `source-${fingerprint}`
}

export function routeGuardDutyObjectScan(
  rawEvent: unknown,
  selectedBucket: string,
) {
  const event = guardDutyObjectScanEventSchema.parse(rawEvent)
  const object = event.detail.s3ObjectDetails
  if (object.bucketName !== selectedBucket) {
    throw new Error('UNEXPECTED_SCAN_BUCKET')
  }

  const { sourceId } = parsePropertySourceObjectKey(object.objectKey)
  const scanResultStatus =
    event.detail.scanResultDetails.scanResultStatus
  const common = {
    bucketName: object.bucketName,
    objectKey: object.objectKey,
    versionId: object.versionId,
    sourceId,
    scanResultStatus,
    executionName: createGuardDutyExecutionName(event),
  }

  return scanResultStatus === 'NO_THREATS_FOUND'
    ? { action: 'start' as const, ...common }
    : { action: 'do_not_process' as const, ...common }
}

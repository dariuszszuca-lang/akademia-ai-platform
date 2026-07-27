import {
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import crypto from 'node:crypto'
import { z } from 'zod'
import {
  PropertySourceObjectValidationError,
  mapObjectValidationErrorCode,
  validatePropertySourceObject,
  type PropertySourceObjectInspection,
} from '../../src/features/property-sources/pipeline/object-validation'
import { supportedSourceMediaTypes } from '../../src/features/property-sources/domain'
import {
  inspectPropertySourceBytes,
  preparePropertySourceBytes,
  type PreparedSourcePart,
} from '../../src/features/property-sources/pipeline/document-preparation'

const validatorEventSchema = z
  .object({
    sourceId: z.string().uuid(),
    bucketName: z.string().min(3).max(63),
    objectKey: z.string().min(1).max(1024),
    versionId: z.string().min(1).max(1024),
    scanResultStatus: z.literal('NO_THREATS_FOUND'),
    attempt: z.number().int().positive().max(20),
    pipelineVersion: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/),
    context: z
      .object({
        jobId: z.string().uuid(),
        source: z
          .object({
            id: z.string().uuid(),
            checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
            sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
            mediaType: z.enum(supportedSourceMediaTypes),
            storageKey: z.string().min(1).max(1024),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough()

type InspectionInput = {
  bucketName: string
  objectKey: string
  versionId: string
  mediaType: (typeof supportedSourceMediaTypes)[number]
  expectedSizeBytes: number
  expectedChecksumSha256Hex: string
}

type ValidatorDependencies = {
  inspectObject: (
    input: InspectionInput,
  ) => Promise<
    PropertySourceObjectInspection & { bodyBytes?: Uint8Array }
  >
  prepareObject?: typeof preparePropertySourceBytes
  writePart?: (input: WritePartInput) => Promise<string>
}

export function createValidatorHandler({
  inspectObject,
  prepareObject,
  writePart,
}: ValidatorDependencies) {
  return async (rawEvent: unknown) => {
    const event = validatorEventSchema.parse(rawEvent)
    if (
      event.context.source.id !== event.sourceId ||
      event.context.source.storageKey !== event.objectKey
    ) {
      throw new Error('SOURCE_CONTEXT_MISMATCH')
    }

    try {
      const inspection = await inspectObject({
        bucketName: event.bucketName,
        objectKey: event.objectKey,
        versionId: event.versionId,
        mediaType: event.context.source.mediaType,
        expectedSizeBytes: event.context.source.sizeBytes,
        expectedChecksumSha256Hex:
          event.context.source.checksumSha256,
      })
      const route = validatePropertySourceObject(inspection)
      if (route.kind === 'audio') {
        return {
          ...event,
          validation: {
            ...route,
            strategy: 'manual_review_policy_gate' as const,
          },
          result: createManualAudioResult(event),
        }
      }
      if (route.kind === 'document' && route.strategy === 'direct') {
        return {
          ...event,
          validation: route,
          preparedParts: [
            {
              kind: 'document' as const,
              format: bedrockDocumentFormat(
                event.context.source.mediaType,
              ),
              s3Uri: `s3://${event.bucketName}/${event.objectKey}`,
              pageOffset: 0,
            },
          ],
        }
      }
      if (route.kind === 'image' && route.strategy === 'direct') {
        return {
          ...event,
          validation: route,
          preparedParts: [
            {
              kind: 'image' as const,
              format: bedrockImageFormat(
                event.context.source.mediaType,
              ),
              s3Uri: `s3://${event.bucketName}/${event.objectKey}`,
            },
          ],
        }
      }
      if (inspection.bodyBytes && prepareObject && writePart) {
        const prepared = await prepareObject({
          mediaType: event.context.source.mediaType,
          bytes: inspection.bodyBytes,
          route,
        })
        const preparedParts = await Promise.all(
          prepared.map(async (part, index) => {
            const extension = preparedPartExtension(part)
            const s3Uri = await writePart({
              bucketName: event.bucketName,
              sourceId: event.sourceId,
              versionId: event.versionId,
              partNumber: index + 1,
              extension,
              contentType: preparedPartContentType(part),
              bytes: part.bytes,
            })
            return {
              kind: part.kind,
              format: part.format,
              s3Uri,
              ...(part.kind === 'document'
                ? {
                    pageOffset: part.pageOffset,
                    ...(part.locatorMap
                      ? { locatorMap: part.locatorMap }
                      : {}),
                  }
                : {}),
            }
          }),
        )
        return { ...event, validation: route, preparedParts }
      }
      if (route.kind === 'document' || route.kind === 'image') {
        return {
          ...event,
          validation: route,
          result: {
            ...resultIdentity(event),
            outcome: 'needs_manual_review' as const,
            errorCode: 'EXTRACTION_FAILED' as const,
            provider: 'amazon-bedrock' as const,
            providerCostMicrounits: 0,
            currency: 'USD' as const,
          },
        }
      }
      return { ...event, validation: route }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'DOCUMENT_LIMIT_EXCEEDED'
      ) {
        return {
          ...event,
          validation: { kind: 'rejected' as const },
          result: {
            ...resultIdentity(event),
            outcome: 'failed' as const,
            errorCode: 'DOCUMENT_LIMIT_EXCEEDED' as const,
          },
        }
      }
      if (
        error instanceof Error &&
        [
          'DIRECT_DOCUMENT_REUSES_ORIGINAL',
          'DIRECT_IMAGE_REUSES_ORIGINAL',
          'IMAGE_METADATA_INVALID',
          'MALFORMED_CSV',
          'MALFORMED_DOCUMENT',
          'UNSAFE_XML',
          'UNSUPPORTED_PREPARATION_ROUTE',
        ].includes(error.message)
      ) {
        return {
          ...event,
          validation: { kind: 'rejected' as const },
          result: {
            ...resultIdentity(event),
            outcome: 'failed' as const,
            errorCode: 'EXTRACTION_FAILED' as const,
          },
        }
      }
      if (!(error instanceof PropertySourceObjectValidationError)) {
        throw error
      }
      return {
        ...event,
        validation: { kind: 'rejected' as const },
        result: {
          ...resultIdentity(event),
          outcome: 'failed' as const,
          errorCode: mapObjectValidationErrorCode(error.code),
        },
      }
    }
  }
}

type WritePartInput = {
  bucketName: string
  sourceId: string
  versionId: string
  partNumber: number
  extension: string
  contentType: string
  bytes: Uint8Array
}

function preparedPartExtension(part: PreparedSourcePart) {
  return part.kind === 'image' ? 'webp' : part.format
}

function preparedPartContentType(part: PreparedSourcePart) {
  if (part.kind === 'image') return 'image/webp'
  return part.format === 'pdf' ? 'application/pdf' : 'text/plain'
}

function bedrockDocumentFormat(
  mediaType: (typeof supportedSourceMediaTypes)[number],
) {
  switch (mediaType) {
    case 'application/pdf':
      return 'pdf' as const
    case 'text/csv':
      return 'csv' as const
    case 'text/plain':
      return 'txt' as const
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx' as const
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx' as const
    default:
      throw new Error('UNSUPPORTED_BEDROCK_DOCUMENT_FORMAT')
  }
}

function bedrockImageFormat(
  mediaType: (typeof supportedSourceMediaTypes)[number],
) {
  switch (mediaType) {
    case 'image/jpeg':
      return 'jpeg' as const
    case 'image/png':
      return 'png' as const
    case 'image/webp':
      return 'webp' as const
    default:
      throw new Error('UNSUPPORTED_BEDROCK_IMAGE_FORMAT')
  }
}

function createManualAudioResult(
  event: z.infer<typeof validatorEventSchema>,
) {
  return {
    ...resultIdentity(event),
    outcome: 'needs_manual_review' as const,
    errorCode: 'TRANSCRIPTION_FAILED' as const,
    provider: 'amazon-transcribe' as const,
    providerCostMicrounits: 0,
    currency: 'USD' as const,
  }
}

function resultIdentity(event: z.infer<typeof validatorEventSchema>) {
  return {
    sourceId: event.sourceId,
    jobId: event.context.jobId,
    checksumSha256: event.context.source.checksumSha256,
    attempt: event.attempt,
    pipelineVersion: event.pipelineVersion,
  }
}

const s3Client = new S3Client({})

let defaultHandler:
  | ReturnType<typeof createValidatorHandler>
  | undefined

export async function handler(event: unknown) {
  defaultHandler ??= createValidatorHandler({
    inspectObject: inspectS3Object,
    prepareObject: preparePropertySourceBytes,
    writePart: writePreparedPart,
  })
  return defaultHandler(event)
}

async function inspectS3Object(
  input: InspectionInput,
): Promise<
  PropertySourceObjectInspection & { bodyBytes: Uint8Array }
> {
  const objectIdentity = {
    Bucket: input.bucketName,
    Key: input.objectKey,
    VersionId: input.versionId,
  }
  const [head, tags, body] = await Promise.all([
    s3Client.send(
      new HeadObjectCommand({
        ...objectIdentity,
        ChecksumMode: 'ENABLED',
      }),
    ),
    s3Client.send(new GetObjectTaggingCommand(objectIdentity)),
    s3Client.send(new GetObjectCommand(objectIdentity)),
  ])
  if (
    head.ContentLength === undefined ||
    !head.ChecksumSHA256 ||
    !body.Body
  ) {
    throw new PropertySourceObjectValidationError(
      'OBJECT_VALIDATION_FAILED',
    )
  }

  const bodyBytes = await body.Body.transformToByteArray()
  const formatMetadata = await inspectPropertySourceBytes(
    input.mediaType,
    bodyBytes,
  )
  return {
    mediaType: input.mediaType,
    expectedSizeBytes: input.expectedSizeBytes,
    objectSizeBytes: head.ContentLength,
    expectedChecksumSha256Hex: input.expectedChecksumSha256Hex,
    checksumSha256Base64: head.ChecksumSHA256,
    guardDutyScanTag: tags.TagSet?.find(
      (tag) => tag.Key === 'GuardDutyMalwareScanStatus',
    )?.Value,
    headerBytes: bodyBytes.slice(0, 512),
    bodyBytes,
    ...formatMetadata,
  }
}

async function writePreparedPart(input: WritePartInput) {
  const versionFingerprint = crypto
    .createHash('sha256')
    .update(input.versionId)
    .digest('hex')
    .slice(0, 16)
  const key =
    `work/sources/${input.sourceId}/${versionFingerprint}/` +
    `part-${String(input.partNumber).padStart(3, '0')}.${input.extension}`
  await s3Client.send(
    new PutObjectCommand({
      Bucket: input.bucketName,
      Key: key,
      Body: input.bytes,
      ContentType: input.contentType,
      ChecksumAlgorithm: 'SHA256',
      Metadata: {
        'source-id': input.sourceId,
      },
    }),
  )
  return `s3://${input.bucketName}/${key}`
}

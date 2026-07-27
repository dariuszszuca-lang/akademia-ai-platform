import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import type { PropertySourceService } from './service'
import type { PropertySourceUploadService } from './upload-service'
import { factProposalStatuses } from './domain'

type PropertyContext = {
  params: Promise<{
    propertyId: string
  }>
}

type ProposalContext = {
  params: Promise<{
    propertyId: string
    proposalId: string
  }>
}

type SourceContext = {
  params: Promise<{
    propertyId: string
    sourceId: string
  }>
}

type PropertySourceHttpDependencies = {
  getService: () => PropertySourceService
  getUploadService: () => PropertySourceUploadService
  getUserId: () => Promise<string | null>
}

const propertyParamsSchema = z.object({
  propertyId: z.string().uuid(),
})

const proposalParamsSchema = z.object({
  propertyId: z.string().uuid(),
  proposalId: z.string().uuid(),
})

const sourceParamsSchema = z.object({
  propertyId: z.string().uuid(),
  sourceId: z.string().uuid(),
})

const proposalStatusSchema = z.enum(factProposalStatuses)

class InvalidJsonError extends Error {}

export function createPropertySourceHttpHandlers({
  getService,
  getUploadService,
  getUserId,
}: PropertySourceHttpDependencies) {
  return {
    listSources: (_request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId } = propertyParamsSchema.parse(await context.params)
        return NextResponse.json({
          sources: await getService().listSources(userId, propertyId),
        })
      }),

    createSource: (request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId } = propertyParamsSchema.parse(await context.params)
        const result = await getUploadService().initiateUpload(
          userId,
          propertyId,
          await readJson(request),
        )

        return NextResponse.json(result, { status: 201 })
      }),

    downloadSource: (_request: Request, context: SourceContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId, sourceId } = sourceParamsSchema.parse(
          await context.params,
        )
        return NextResponse.json(
          await getUploadService().createDownloadUrl(
            userId,
            propertyId,
            sourceId,
          ),
        )
      }),

    listProposals: (request: Request, context: PropertyContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId } = propertyParamsSchema.parse(await context.params)
        const url = new URL(request.url)
        const statuses = url.searchParams
          .getAll('status')
          .flatMap((value) => value.split(','))
          .filter(Boolean)
          .map((status) => proposalStatusSchema.parse(status))
        const sourceId = url.searchParams.get('sourceId') ?? undefined

        return NextResponse.json({
          proposals: await getService().listProposals(userId, propertyId, {
            ...(statuses.length > 0 ? { statuses } : {}),
            ...(sourceId ? { sourceId } : {}),
          }),
        })
      }),

    decideProposal: (request: Request, context: ProposalContext) =>
      withAuthenticatedUser(getUserId, async (userId) => {
        const { propertyId, proposalId } = proposalParamsSchema.parse(
          await context.params,
        )
        const result = await getService().decideProposal(
          userId,
          propertyId,
          proposalId,
          await readJson(request),
        )

        return NextResponse.json(result)
      }),
  }
}

async function withAuthenticatedUser(
  getUserId: PropertySourceHttpDependencies['getUserId'],
  action: (userId: string) => Promise<NextResponse>,
) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    return await action(userId)
  } catch (error) {
    return propertySourceErrorResponse(error)
  }
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new InvalidJsonError()
  }
}

export function propertySourceErrorResponse(error: unknown) {
  if (error instanceof InvalidJsonError) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'validation_error', issues: error.issues },
      { status: 400 },
    )
  }

  if (
    error instanceof Error &&
    [
      'PROPERTY_NOT_FOUND',
      'SOURCE_NOT_FOUND',
      'PROPOSAL_NOT_FOUND',
    ].includes(error.message)
  ) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (
    error instanceof Error &&
    [
      'SOURCE_NOT_CLEAN',
      'SOURCE_NOT_READY',
    ].includes(error.message)
  ) {
    return NextResponse.json(
      { error: 'source_not_clean' },
      { status: 409 },
    )
  }

  if (
    error instanceof Error &&
    ([
      'UPLOAD_GRANT_FAILED',
      'SOURCE_UPLOAD_SIGNING_FAILED',
      'SOURCE_DOWNLOAD_SIGNING_FAILED',
    ].includes(error.message) ||
      error.message.startsWith('Missing runtime variable:') ||
      error.message.startsWith('Invalid runtime variable:'))
  ) {
    return NextResponse.json(
      { error: 'source_storage_unavailable' },
      { status: 503 },
    )
  }

  if (
    error instanceof Error &&
    [
      'PROPOSAL_ALREADY_DECIDED',
      'INVALID_PROPOSAL_DECISION',
      'PROPOSAL_CONFLICT_CHANGED',
    ].includes(error.message)
  ) {
    return NextResponse.json(
      { error: error.message.toLowerCase() },
      { status: 409 },
    )
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[property-source-api] request_failed', {
      type: error instanceof Error ? error.name : 'unknown',
    })
  }
  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}

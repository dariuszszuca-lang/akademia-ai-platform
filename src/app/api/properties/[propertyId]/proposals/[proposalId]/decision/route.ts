import { createPropertySourceHttpHandlers } from '@/features/property-sources/http'
import { getPropertySourceService } from '@/features/property-sources/server-repository'
import { getServerUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handlers = createPropertySourceHttpHandlers({
  getService: getPropertySourceService,
  getUserId: getServerUserId,
})

export const POST = handlers.decideProposal

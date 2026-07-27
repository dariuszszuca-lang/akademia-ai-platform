import { createPropertySourceHttpHandlers } from '@/features/property-sources/http'
import {
  getPropertySourceService,
  getPropertySourceUploadService,
} from '@/features/property-sources/server-repository'
import { getServerUserId } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handlers = createPropertySourceHttpHandlers({
  getService: getPropertySourceService,
  getUploadService: getPropertySourceUploadService,
  getUserId: getServerUserId,
})

export const GET = handlers.listProposals

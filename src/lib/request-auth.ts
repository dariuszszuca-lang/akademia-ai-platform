import { NextResponse } from 'next/server'
import { getServerUserId } from './session'

export type ApiUserResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

export function createApiUserResolver(
  readUserId: () => Promise<string | null>,
) {
  return async (): Promise<ApiUserResult> => {
    const userId = await readUserId()
    if (!userId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'unauthorized' },
          { status: 401 },
        ),
      }
    }

    return { ok: true, userId }
  }
}

export const resolveApiUser = createApiUserResolver(getServerUserId)

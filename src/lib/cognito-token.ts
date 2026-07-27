import 'server-only'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { SessionConfigurationError } from './auth-session'

type AccessTokenVerifier = ReturnType<typeof CognitoJwtVerifier.create>

let verifier: AccessTokenVerifier | undefined

export async function verifyCognitoAccessToken(accessToken: string) {
  const payload = await getVerifier().verify(accessToken)
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('TOKEN_SUBJECT_MISSING')
  }

  return { sub: payload.sub }
}

function getVerifier() {
  if (verifier) return verifier

  const userPoolId =
    (
      process.env.COGNITO_USER_POOL_ID ??
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
    )?.trim()
  const clientId =
    (
      process.env.COGNITO_CLIENT_ID ??
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    )?.trim()

  if (!userPoolId || !clientId) {
    throw new SessionConfigurationError()
  }

  verifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'access',
    clientId,
  })
  return verifier
}

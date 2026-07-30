import { z } from 'zod'

export const cognitoSubjectSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'SYNTHETIC_COGNITO_SUB_INVALID',
  )

import { z } from 'zod'

/**
 * Wynik narzędzia zapisany na karcie nieruchomości.
 *
 * Zasada: na karcie zapisujemy tylko podsumowanie (liczby, daty, flagi).
 * Dane osobowe (imiona, PESEL, treść księgi, zdjęcia) zostają w przeglądarce użytkownika.
 */
export const TOOL_RESULT_TOOLS = [
  'rejestr-cen',
  'protokol',
  'ksiega-wieczysta',
  'umowa-najmu',
  'spacer-3d',
] as const

export const MAX_RESULTS_PER_PROPERTY = 50

const PESEL_LIKE = /\b\d{11}\b/

const summaryValue = z.union([
  z.number().finite(),
  z
    .string()
    .trim()
    .max(200)
    .refine((value) => !PESEL_LIKE.test(value), {
      message: 'Podsumowanie nie może zawierać numeru PESEL.',
    }),
])

export const saveToolResultSchema = z.object({
  propertyId: z.string().trim().min(1).max(100),
  toolId: z.enum(TOOL_RESULT_TOOLS),
  title: z.string().trim().min(1).max(120),
  summary: z
    .record(z.string().trim().min(1).max(60), summaryValue)
    .refine((record) => Object.keys(record).length <= 12, {
      message: 'Podsumowanie może mieć najwyżej 12 pozycji.',
    }),
})

export type SaveToolResultInput = z.infer<typeof saveToolResultSchema>

export type ToolResult = Omit<SaveToolResultInput, 'propertyId'> & {
  id: string
  createdAt: string
}

export function toolResultsKey(userId: string, propertyId: string) {
  return `tool-results:${userId}:${propertyId}`
}

import { z } from 'zod'
import { runIdSchema, syntheticCaseCodes } from './domain'
import {
  syntheticAcceptanceScoreSchema,
  type SyntheticAcceptanceScore,
} from './scorer'

export const safeReportSchema = z
  .object({
    contractVersion: z.literal('synthetic-acceptance-v1'),
    runId: runIdSchema,
    mode: z.enum(['local', 'production-synthetic']),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    caseCodes: z.array(z.enum(syntheticCaseCodes)),
    score: syntheticAcceptanceScoreSchema,
    modelIds: z.array(z.string().max(240)),
    cleanup: z
      .object({
        databaseEmpty: z.boolean(),
        cognitoUserAbsent: z.boolean(),
        s3VersionsRemaining: z.number().int().nonnegative(),
        dlqMessagesVisible: z.number().int().nonnegative(),
        alarmsNotOk: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type SafeSyntheticAcceptanceReport = z.infer<
  typeof safeReportSchema
>

export function createSafeReport(
  input: unknown,
): SafeSyntheticAcceptanceReport {
  return safeReportSchema.parse(input)
}

export function serializeSafeReport(
  report: SafeSyntheticAcceptanceReport,
): string {
  return `${JSON.stringify(safeReportSchema.parse(report), null, 2)}\n`
}

export function renderSafeReportMarkdown(
  report: SafeSyntheticAcceptanceReport,
): string {
  const parsed = safeReportSchema.parse(report)
  const score: SyntheticAcceptanceScore = parsed.score
  const modelIds =
    parsed.modelIds.length > 0 ? parsed.modelIds.join(', ') : 'brak'

  return [
    '# Syntetyczny odbiór Property Intelligence Studio',
    '',
    `- Przebieg: \`${parsed.runId}\``,
    `- Tryb: \`${parsed.mode}\``,
    `- Start: ${parsed.startedAt}`,
    `- Koniec: ${parsed.completedAt}`,
    `- Przypadki: ${parsed.caseCodes.join(', ')}`,
    `- Modele: ${modelIds}`,
    `- Zaakceptowany: ${score.accepted ? 'tak' : 'nie'}`,
    '',
    '## Wynik',
    '',
    `- Trafione fakty: ${score.referenceFactsMatched}/${score.referenceFactsTotal}`,
    `- Precyzja: ${(score.precision * 100).toFixed(2)}%`,
    `- Pokrycie lokalizatorów: ${(score.locatorCoverage * 100).toFixed(2)}%`,
    `- Konflikty: ${score.conflictsDetected}/${score.conflictsExpected}`,
    `- Fałszywe konflikty: ${score.falseConflicts}`,
    `- Potwierdzone propozycje: ${score.confirmedProposalCount}`,
    `- Duplikaty workflow: ${score.duplicateWorkflowCount}`,
    `- Duplikaty propozycji: ${score.duplicateProposalCount}`,
    `- Czas: ${score.durationMs} ms`,
    `- Koszt dostawcy: ${score.providerCostUsd.toFixed(6)} USD`,
    '',
    '## Sprzątanie',
    '',
    `- Baza pusta: ${parsed.cleanup.databaseEmpty ? 'tak' : 'nie'}`,
    `- Użytkownik nie istnieje: ${parsed.cleanup.cognitoUserAbsent ? 'tak' : 'nie'}`,
    `- Wersje S3: ${parsed.cleanup.s3VersionsRemaining}`,
    `- Wiadomości DLQ: ${parsed.cleanup.dlqMessagesVisible}`,
    `- Alarmy poza OK: ${parsed.cleanup.alarmsNotOk}`,
    '',
  ].join('\n')
}

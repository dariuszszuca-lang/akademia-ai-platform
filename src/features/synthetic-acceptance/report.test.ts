import { describe, expect, it } from 'vitest'
import {
  createSafeReport,
  renderSafeReportMarkdown,
  serializeSafeReport,
} from './report'

const safeInput = {
  contractVersion: 'synthetic-acceptance-v1' as const,
  runId: 'syn-20260728T200000Z-deadbeef',
  mode: 'local' as const,
  startedAt: '2026-07-28T20:00:00.000Z',
  completedAt: '2026-07-28T20:00:01.000Z',
  caseCodes: [
    'SYN-M-01',
    'SYN-M-02',
    'SYN-D-01',
    'SYN-P-01',
    'SYN-P-02',
  ] as const,
  score: {
    referenceFactsTotal: 54,
    referenceFactsMatched: 54,
    precision: 1,
    locatorCoverage: 1,
    conflictsExpected: 5,
    conflictsDetected: 5,
    falseConflicts: 0,
    confirmedProposalCount: 0,
    duplicateWorkflowCount: 0,
    duplicateProposalCount: 0,
    durationMs: 1000,
    providerCostUsd: 0,
    errorsByCode: {},
    accepted: true,
  },
  modelIds: [],
  cleanup: {
    databaseEmpty: true,
    cognitoUserAbsent: true,
    s3VersionsRemaining: 0,
    dlqMessagesVisible: 0,
    alarmsNotOk: 0,
  },
}

describe('safe synthetic acceptance report', () => {
  it('serializes only the closed report contract', () => {
    const report = createSafeReport(safeInput)
    const json = serializeSafeReport(report)
    const markdown = renderSafeReportMarkdown(report)

    expect(JSON.parse(json)).toEqual(safeInput)
    expect(markdown).toContain('syn-20260728T200000Z-deadbeef')
    expect(markdown).toContain('Zaakceptowany: tak')

    for (const forbidden of [
      '.pdf',
      '.docx',
      'Testowo',
      'EVID-',
      '@example.',
      '"before"',
      '"after"',
      '"fileName"',
      '"evidenceText"',
      '"token"',
    ]) {
      expect(json).not.toContain(forbidden)
      expect(markdown).not.toContain(forbidden)
    }
  })

  it('rejects unexpected fields instead of silently copying them', () => {
    expect(() =>
      createSafeReport({
        ...safeInput,
        fileName: 'synthetic.pdf',
      }),
    ).toThrow()
    expect(() =>
      createSafeReport({
        ...safeInput,
        cleanup: {
          ...safeInput.cleanup,
          before: { sourceCount: 20 },
        },
      }),
    ).toThrow()
  })
})

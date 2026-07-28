import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runLocalSyntheticAcceptance } from './local-runner'

describe('local synthetic acceptance runner', () => {
  it('scores the complete corpus, writes a safe report and removes generated files', async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), 'studio-synthetic-acceptance-'),
    )
    const runId = 'syn-20260728T200000Z-deadbeef'

    try {
      const result = await runLocalSyntheticAcceptance({
        workspaceRoot,
        runId,
        startedAt: new Date('2026-07-28T20:00:00.000Z'),
        completedAt: new Date('2026-07-28T20:00:01.000Z'),
      })

      expect(result.generatedMaterialCount).toBe(20)
      expect(result.report.caseCodes).toHaveLength(5)
      expect(result.report.score).toMatchObject({
        referenceFactsMatched: 54,
        referenceFactsTotal: 54,
        precision: 1,
        locatorCoverage: 1,
        conflictsDetected: 5,
        conflictsExpected: 5,
        accepted: true,
      })
      await expect(
        stat(
          join(
            workspaceRoot,
            'Temp',
            'synthetic-acceptance',
            runId,
          ),
        ),
      ).rejects.toMatchObject({ code: 'ENOENT' })

      const serialized = await readFile(result.reportPath, 'utf8')
      expect(JSON.parse(serialized)).toEqual(result.report)
      expect(serialized).not.toContain('.pdf')
      expect(serialized).not.toContain('EVID-')
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })
})

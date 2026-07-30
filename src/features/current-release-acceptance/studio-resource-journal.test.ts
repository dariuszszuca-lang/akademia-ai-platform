import { describe, expect, it } from 'vitest'
import type { Task9Runtime } from '../../../e2e/current-release/task9-helpers'

const organizationId =
  '11111111-1111-4111-8111-111111111111'
const projectId = '22222222-2222-4222-8222-222222222222'
const factId = '33333333-3333-4333-8333-333333333333'
const sourceId = '44444444-4444-4444-8444-444444444444'
const subjectA = '55555555-5555-4555-8555-555555555555'
const title = 'SYN journal-test'
const storageKey =
  `originals/organizations/${organizationId}/source.pdf`

const validProject = {
  id: projectId,
  organizationId,
  title,
  propertyType: 'apartment',
  transactionType: 'sale',
  city: 'Testowo',
  district: 'Dzielnica Zero',
  addressMode: 'hidden',
}

const validFact = {
  id: factId,
  propertyProjectId: projectId,
  key: 'area.usable',
  label: 'Powierzchnia użytkowa',
  valueType: 'number',
  value: 80,
  unit: 'm²',
  status: 'confirmed',
  visibility: 'internal',
  confirmedByUserId: subjectA,
  version: 1,
}

const validSource = {
  id: sourceId,
  organizationId,
  propertyProjectId: projectId,
  storageKey,
  mediaType: 'application/pdf',
  sizeBytes: 1024,
  checksumSha256: 'a'.repeat(64),
}
const validSourceExpectation = {
  organizationId,
  projectId,
  sizeBytes: validSource.sizeBytes,
  checksumSha256: validSource.checksumSha256,
}

type ProjectCheckpoint = (
  project: Record<string, unknown>,
  expectedTitle: string,
  recordResources: Task9Runtime['recordResources'],
) => Promise<{
  organizationId: string
  projectId: string
}>

type FactCheckpoint = (
  fact: Record<string, unknown>,
  expected: {
    projectId: string
    subjectA: string
  },
  recordFactId: Task9Runtime['recordFactId'],
) => Promise<{
  factId: string
  version: number
}>

type SourcePipelineEvidenceReaders = {
  readPipelineCalls(): number
  readBudgetSourcePipelineCalls(): number
}

const validPipelineEvidenceReaders: SourcePipelineEvidenceReaders = {
  readPipelineCalls: () => 1,
  readBudgetSourcePipelineCalls: () => 1,
}

type SourceCheckpoint = (
  source: Record<string, unknown>,
  expected: {
    organizationId: string
    projectId: string
    sizeBytes: number
    checksumSha256: string
  },
  recordResources: Task9Runtime['recordResources'],
  pipelineEvidenceReaders: SourcePipelineEvidenceReaders,
) => Promise<{
  sourceId: string
  storageKey: string
}>

async function loadResourceCheckpoints(): Promise<{
  project: ProjectCheckpoint
  fact: FactCheckpoint
  source: SourceCheckpoint
}> {
  const studioModule = (await import(
    '../../../e2e/current-release/scenarios/studio'
  )) as unknown as Record<string, unknown>
  expect(
    studioModule.journalAndValidateCreatedProject,
  ).toBeTypeOf('function')
  expect(
    studioModule.journalAndValidateCreatedFact,
  ).toBeTypeOf('function')
  expect(
    studioModule.journalAndValidateRegisteredSource,
  ).toBeTypeOf('function')
  return {
    project:
      studioModule.journalAndValidateCreatedProject as ProjectCheckpoint,
    fact:
      studioModule.journalAndValidateCreatedFact as FactCheckpoint,
    source:
      studioModule.journalAndValidateRegisteredSource as SourceCheckpoint,
  }
}

describe('Task 9 Studio resource journal checkpoints', () => {
  it('journals project and organization IDs before validating other project fields', async () => {
    const { project } = await loadResourceCheckpoints()
    const records: Array<
      Parameters<Task9Runtime['recordResources']>[0]
    > = []

    await expect(
      project(
        { ...validProject, title: 'wrong title' },
        title,
        async (record) => {
          records.push(record)
        },
      ),
    ).rejects.toThrow('STUDIO_PROPERTY_RESPONSE_INVALID')
    expect(records).toEqual([
      { organizationId, projectId },
    ])
  })

  it('stops project validation and later actions when project journaling fails', async () => {
    const { project } = await loadResourceCheckpoints()
    const journalError = new Error('project journal failed')
    let nextActionReached = false

    const execution = project(
      validProject,
      title,
      async () => {
        throw journalError
      },
    ).then(() => {
      nextActionReached = true
    })

    await expect(execution).rejects.toBe(journalError)
    expect(nextActionReached).toBe(false)
  })

  it('journals the fact ID before validating other fact fields', async () => {
    const { fact } = await loadResourceCheckpoints()
    const recordedFactIds: string[] = []

    await expect(
      fact(
        { ...validFact, value: 81 },
        { projectId, subjectA },
        async (id) => {
          recordedFactIds.push(id)
        },
      ),
    ).rejects.toThrow('STUDIO_FACT_RESPONSE_INVALID')
    expect(recordedFactIds).toEqual([factId])
  })

  it('stops fact validation and later actions when fact journaling fails', async () => {
    const { fact } = await loadResourceCheckpoints()
    const journalError = new Error('fact journal failed')
    let nextActionReached = false

    const execution = fact(
      validFact,
      { projectId, subjectA },
      async () => {
        throw journalError
      },
    ).then(() => {
      nextActionReached = true
    })

    await expect(execution).rejects.toBe(journalError)
    expect(nextActionReached).toBe(false)
  })

  it('journals source ID and safe storage key before validating other source fields', async () => {
    const { source } = await loadResourceCheckpoints()
    const records: Array<
      Parameters<Task9Runtime['recordResources']>[0]
    > = []

    await expect(
      source(
        { ...validSource, mediaType: 'text/plain' },
        validSourceExpectation,
        async (record) => {
          records.push(record)
        },
        validPipelineEvidenceReaders,
      ),
    ).rejects.toThrow('STUDIO_SOURCE_REGISTRATION_INVALID')
    expect(records).toEqual([
      { organizationId, sourceId },
      { organizationId, storageKey },
    ])
  })

  it('journals source ID but rejects a storage key outside the cleanup prefix', async () => {
    const { source } = await loadResourceCheckpoints()
    const records: Array<
      Parameters<Task9Runtime['recordResources']>[0]
    > = []

    await expect(
      source(
        {
          ...validSource,
          storageKey: 'originals/organizations/other/source.pdf',
        },
        validSourceExpectation,
        async (record) => {
          records.push(record)
        },
        validPipelineEvidenceReaders,
      ),
    ).rejects.toThrow('STUDIO_SOURCE_REGISTRATION_INVALID')
    expect(records).toEqual([{ organizationId, sourceId }])
  })

  it.each([
    {
      name: 'pipeline call count',
      pipelineCalls: 0,
      budgetSourcePipelineCalls: 1,
    },
    {
      name: 'budget source pipeline count',
      pipelineCalls: 1,
      budgetSourcePipelineCalls: 0,
    },
  ])(
    'journals source cleanup IDs before rejecting an invalid $name',
    async ({
      pipelineCalls,
      budgetSourcePipelineCalls,
    }) => {
      const { source } = await loadResourceCheckpoints()
      const records: Array<
        Parameters<Task9Runtime['recordResources']>[0]
      > = []

      await expect(
        source(
          validSource,
          validSourceExpectation,
          async (record) => {
            records.push(record)
          },
          {
            readPipelineCalls: () => pipelineCalls,
            readBudgetSourcePipelineCalls: () =>
              budgetSourcePipelineCalls,
          },
        ),
      ).rejects.toThrow('STUDIO_SOURCE_REGISTRATION_INVALID')
      expect(records).toEqual([
        { organizationId, sourceId },
        { organizationId, storageKey },
      ])
    },
  )

  it.each([
    {
      name: 'pipeline call reader',
      createReaders: (readError: Error) => ({
        readPipelineCalls: () => {
          throw readError
        },
        readBudgetSourcePipelineCalls: () => 1,
      }),
    },
    {
      name: 'budget source pipeline reader',
      createReaders: (readError: Error) => ({
        readPipelineCalls: () => 1,
        readBudgetSourcePipelineCalls: () => {
          throw readError
        },
      }),
    },
  ])(
    'journals source cleanup IDs before invoking a throwing $name',
    async ({ createReaders }) => {
      const { source } = await loadResourceCheckpoints()
      const readError = new Error('pipeline evidence read failed')
      const records: Array<
        Parameters<Task9Runtime['recordResources']>[0]
      > = []

      await expect(
        source(
          validSource,
          validSourceExpectation,
          async (record) => {
            records.push(record)
          },
          createReaders(readError),
        ),
      ).rejects.toBe(readError)
      expect(records).toEqual([
        { organizationId, sourceId },
        { organizationId, storageKey },
      ])
    },
  )

  it.each([
    { failedWrite: 0, expectedRecords: 1 },
    { failedWrite: 1, expectedRecords: 2 },
  ])(
    'stops source pipeline when journal write $failedWrite fails',
    async ({ failedWrite, expectedRecords }) => {
      const { source } = await loadResourceCheckpoints()
      const journalError = new Error(
        `source journal ${failedWrite} failed`,
      )
      const records: Array<
        Parameters<Task9Runtime['recordResources']>[0]
      > = []
      let nextActionReached = false

      const execution = source(
        validSource,
        validSourceExpectation,
        async (record) => {
          records.push(record)
          if (records.length - 1 === failedWrite) {
            throw journalError
          }
        },
        validPipelineEvidenceReaders,
      ).then(() => {
        nextActionReached = true
      })

      await expect(execution).rejects.toBe(journalError)
      expect(records).toHaveLength(expectedRecords)
      expect(nextActionReached).toBe(false)
    },
  )
})

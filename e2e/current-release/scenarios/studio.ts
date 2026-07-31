import {
  expect,
  type APIResponse,
} from '@playwright/test'
import { getUserSubject } from '../operator'
import {
  toSyntheticSourceUploadPayload,
  usingSyntheticSourcePdf,
} from '../synthetic-source-pdf'
import {
  assertDownloadedPdfSummary,
  assertIsolationSummary,
  assertUiIsolationSummary,
  createSingleSourcePipeline,
  parseAcceptedAreaDecisionResponse,
  parseAcceptedAreaFactList,
  parseFactUpdateResponse,
  parsePdfDownloadHeaders,
  parsePersistedFactList,
  parseProposalDecisionReadback,
  parseRejectedPriceDecisionResponse,
  parseSignedS3DownloadUrl,
  selectTargetProposals,
  summarizeIsolationResponse,
  summarizeDownloadedPdf,
  summarizeUiIsolationResponse,
  type Task9ProposalCandidate,
  type Task9Runtime,
  type Task9SelectedProposals,
  type Task9StudioState,
} from '../task9-helpers'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const terminalSourceStatuses = new Set([
  'review_ready',
  'completed',
  'failed',
])
const proposalStatuses = new Set<
  Task9ProposalCandidate['status']
>([
  'pending',
  'conflict',
  'accepted',
  'corrected',
  'rejected',
  'needs_review',
])

export async function journalSelectedProposalResources(
  recordResources: Task9Runtime['recordResources'],
  organizationId: string,
  selected: Task9SelectedProposals,
): Promise<void> {
  await recordResources({
    organizationId,
    sourceJobId: selected.area.jobId,
  })
  await recordResources({
    organizationId,
    proposalId: selected.area.id,
  })
  await recordResources({
    organizationId,
    proposalId: selected.price.id,
  })
}

export async function journalAndValidateCreatedProject(
  project: Record<string, unknown>,
  expectedTitle: string,
  recordResources: Task9Runtime['recordResources'],
): Promise<{
  organizationId: string
  projectId: string
}> {
  const projectId = readUuid(
    project.id,
    'STUDIO_PROPERTY_RESPONSE_INVALID',
  )
  const organizationId = readUuid(
    project.organizationId,
    'STUDIO_PROPERTY_RESPONSE_INVALID',
  )
  await recordResources({ organizationId, projectId })

  if (
    project.title !== expectedTitle ||
    project.propertyType !== 'apartment' ||
    project.transactionType !== 'sale' ||
    project.city !== 'Testowo' ||
    project.district !== 'Dzielnica Zero' ||
    project.addressMode !== 'hidden'
  ) {
    throw new Error('STUDIO_PROPERTY_RESPONSE_INVALID')
  }

  return { organizationId, projectId }
}

export async function journalAndValidateCreatedFact(
  fact: Record<string, unknown>,
  expected: {
    projectId: string
    subjectA: string
  },
  recordFactId: Task9Runtime['recordFactId'],
): Promise<{
  factId: string
  version: number
}> {
  const factId = readUuid(
    fact.id,
    'STUDIO_FACT_RESPONSE_INVALID',
  )
  await recordFactId(factId)

  if (
    fact.propertyProjectId !== expected.projectId ||
    fact.key !== 'area.usable' ||
    fact.label !== 'Powierzchnia użytkowa' ||
    fact.valueType !== 'number' ||
    fact.value !== 80 ||
    fact.unit !== 'm²' ||
    fact.status !== 'confirmed' ||
    fact.visibility !== 'internal' ||
    fact.confirmedByUserId !== expected.subjectA ||
    fact.confirmedByUserId === 'current-session-user' ||
    !Number.isSafeInteger(fact.version) ||
    (fact.version as number) < 1
  ) {
    throw new Error('STUDIO_FACT_RESPONSE_INVALID')
  }

  return {
    factId,
    version: fact.version as number,
  }
}

export async function journalAndValidateRegisteredSource(
  source: Record<string, unknown>,
  expected: {
    organizationId: string
    projectId: string
    sizeBytes: number
    checksumSha256: string
  },
  recordResources: Task9Runtime['recordResources'],
  pipelineEvidenceReaders: {
    readPipelineCalls(): number
    readBudgetSourcePipelineCalls(): number
  },
): Promise<{
  sourceId: string
  storageKey: string
}> {
  const sourceId = readUuid(
    source.id,
    'STUDIO_SOURCE_REGISTRATION_INVALID',
  )
  await recordResources({
    organizationId: expected.organizationId,
    sourceId,
  })
  const storageKey = readCleanupStorageKey(
    source.storageKey,
    expected.organizationId,
    'STUDIO_SOURCE_REGISTRATION_INVALID',
  )
  await recordResources({
    organizationId: expected.organizationId,
    storageKey,
  })
  const pipelineCalls =
    pipelineEvidenceReaders.readPipelineCalls()
  const budgetSourcePipelineCalls =
    pipelineEvidenceReaders.readBudgetSourcePipelineCalls()

  if (
    source.organizationId !== expected.organizationId ||
    source.propertyProjectId !== expected.projectId ||
    source.mediaType !== 'application/pdf' ||
    source.sizeBytes !== expected.sizeBytes ||
    source.checksumSha256 !== expected.checksumSha256 ||
    pipelineCalls !== 1 ||
    budgetSourcePipelineCalls !== 1
  ) {
    throw new Error('STUDIO_SOURCE_REGISTRATION_INVALID')
  }

  return { sourceId, storageKey }
}

export async function runStudioScenarios(
  runtime: Task9Runtime,
): Promise<Task9StudioState> {
  const title = `SYN ${runtime.fixtures.runId}`
  let organizationId: string | null = null
  let projectId: string | null = null
  let factId: string | null = null
  let sourceId: string | null = null
  let storageKey: string | null = null
  let subjectA: string | null = null
  let subjectB: string | null = null
  let restoredFactVersion: number | null = null
  let selectedProposals: Task9SelectedProposals | null = null
  let areaDecision: { id: string; status: 'accepted' } | null =
    null
  let priceDecision: { id: string; status: 'rejected' } | null =
    null

  await runtime.runScenario(
    'studio.property',
    'STUDIO_PROPERTY_FAILED',
    async () => {
      const { pageA } = runtime
      await pageA.goto('/nieruchomosci')
      await pageA.getByRole('button', { name: 'Nowa teczka' }).click()

      await pageA.locator('input[name="title"]').fill(title)
      await pageA
        .locator('select[name="propertyType"]')
        .selectOption('apartment')
      await pageA
        .locator('select[name="transactionType"]')
        .selectOption('sale')
      await pageA.locator('input[name="city"]').fill('Testowo')
      await pageA
        .locator('input[name="district"]')
        .fill('Dzielnica Zero')
      await pageA
        .locator('select[name="addressMode"]')
        .selectOption('hidden')

      const responsePromise = pageA.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/properties',
      )
      await pageA
        .getByRole('button', { name: 'Załóż teczkę' })
        .click()
      const response = await responsePromise
      if (response.status() !== 201) {
        throw new Error('STUDIO_PROPERTY_RESPONSE_INVALID')
      }

      const project = readNestedRecord(
        await readJson(response, 'STUDIO_PROPERTY_RESPONSE_INVALID'),
        'project',
        'STUDIO_PROPERTY_RESPONSE_INVALID',
      )
      const createdProject =
        await journalAndValidateCreatedProject(
          project,
          title,
          runtime.recordResources,
        )
      organizationId = createdProject.organizationId
      projectId = createdProject.projectId

      await pageA.waitForURL(
        (url) =>
          url.pathname ===
          `/nieruchomosci/${createdProject.projectId}`,
      )
      if (
        new URL(pageA.url()).pathname !==
        `/nieruchomosci/${createdProject.projectId}`
      ) {
        throw new Error('STUDIO_PROPERTY_URL_INVALID')
      }
    },
  )

  const createdOrganizationId = requireValue<string>(
    organizationId,
    'STUDIO_PROPERTY_NOT_AVAILABLE',
  )
  const createdProjectId = requireValue<string>(
    projectId,
    'STUDIO_PROPERTY_NOT_AVAILABLE',
  )

  await runtime.runScenario(
    'studio.fact',
    'STUDIO_FACT_FAILED',
    async () => {
      const nextSubjectA = await getUserSubject(
        runtime.operatorContext,
        runtime.fixtures.userA,
      )
      if (!nextSubjectA) {
        throw new Error('STUDIO_USER_A_SUBJECT_MISSING')
      }

      const { pageA } = runtime
      await pageA.goto(`/nieruchomosci/${createdProjectId}`)
      await pageA.getByRole('button', { name: 'Dodaj fakt' }).click()
      await pageA
        .locator('input[name="label"]')
        .fill('Powierzchnia użytkowa')
      // Etykieta katalogowa (area.usable) blokuje metadane w AddFactForm:
      // category/valueType/unit są disabled i wypełnione z katalogu.
      const categorySelect = pageA.locator('select[name="category"]')
      const valueTypeSelect = pageA.locator('select[name="valueType"]')
      const unitInput = pageA.locator('input[name="unit"]')
      await expect(categorySelect).toBeDisabled()
      await expect(categorySelect).toHaveValue('Powierzchnia')
      await expect(valueTypeSelect).toBeDisabled()
      await expect(valueTypeSelect).toHaveValue('number')
      await expect(unitInput).toBeDisabled()
      await expect(unitInput).toHaveValue('m²')
      await pageA.locator('input[name="value"]').fill('80')
      await pageA
        .locator('select[name="status"]')
        .selectOption('confirmed')
      await pageA
        .locator('select[name="visibility"]')
        .selectOption('internal')

      const factsPath =
        `/api/properties/${createdProjectId}/facts`
      const responsePromise = pageA.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === factsPath,
      )
      await pageA
        .getByRole('button', { name: 'Zapisz fakt' })
        .click()
      const response = await responsePromise
      if (response.status() !== 201) {
        throw new Error('STUDIO_FACT_RESPONSE_INVALID')
      }

      const fact = readNestedRecord(
        await readJson(response, 'STUDIO_FACT_RESPONSE_INVALID'),
        'fact',
        'STUDIO_FACT_RESPONSE_INVALID',
      )
      const createdFact = await journalAndValidateCreatedFact(
        fact,
        {
          projectId: createdProjectId,
          subjectA: nextSubjectA,
        },
        runtime.recordFactId,
      )
      const nextFactId = createdFact.factId
      const updatePath =
        `/api/properties/${createdProjectId}/facts/${nextFactId}`
      const createdVersion = createdFact.version
      for (const update of [
        { value: 81, version: createdVersion + 1 },
        { value: 80, version: createdVersion + 2 },
      ] as const) {
        const updateResponse =
          await runtime.contextA.request.patch(updatePath, {
            data: { value: update.value },
          })
        if (updateResponse.status() !== 200) {
          throw new Error('STUDIO_FACT_UPDATE_INVALID')
        }
        parseFactUpdateResponse(
          await readJson(
            updateResponse,
            'STUDIO_FACT_UPDATE_INVALID',
          ),
          {
            factId: nextFactId,
            projectId: createdProjectId,
            subjectA: nextSubjectA,
            value: update.value,
            version: update.version,
          },
        )
      }

      const factsReadback =
        await runtime.contextA.request.get(factsPath)
      if (factsReadback.status() !== 200) {
        throw new Error('STUDIO_FACT_READBACK_INVALID')
      }
      parsePersistedFactList(
        await readJson(
          factsReadback,
          'STUDIO_FACT_READBACK_INVALID',
        ),
        {
          factId: nextFactId,
          projectId: createdProjectId,
          subjectA: nextSubjectA,
          value: 80,
          version: createdVersion + 2,
        },
      )
      restoredFactVersion = createdVersion + 2
      factId = nextFactId
      subjectA = nextSubjectA
    },
  )

  const createdFactId = requireValue<string>(
    factId,
    'STUDIO_FACT_NOT_AVAILABLE',
  )
  const userASubject = requireValue<string>(
    subjectA,
    'STUDIO_USER_A_SUBJECT_MISSING',
  )

  await runtime.runScenario(
    'studio.source',
    'STUDIO_SOURCE_FAILED',
    async () => {
      await usingSyntheticSourcePdf(
        {
          runId: runtime.fixtures.runId,
        },
        async (pdf) => {
          if (
            pdf.sizeBytes <= 0 ||
            pdf.sizeBytes > 25 * 1024 * 1024
          ) {
            throw new Error('SYNTHETIC_SOURCE_PDF_INVALID')
          }

          const { pageA } = runtime
          await pageA.goto(
            `/nieruchomosci/${createdProjectId}/zrodla`,
          )
          const registrationPath =
            `/api/properties/${createdProjectId}/sources`
          const registrationPromise = pageA.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              new URL(response.url()).pathname ===
                registrationPath,
          )
          const pipeline = createSingleSourcePipeline(
            runtime.budget,
          )
          await pipeline.run(() =>
            pageA
              .locator('input[type="file"]')
              .setInputFiles(
                toSyntheticSourceUploadPayload(pdf),
              ),
          )
          const registration = await registrationPromise
          if (registration.status() !== 201) {
            throw new Error(
              'STUDIO_SOURCE_REGISTRATION_INVALID',
            )
          }

          const source = readNestedRecord(
            await readJson(
              registration,
              'STUDIO_SOURCE_REGISTRATION_INVALID',
            ),
            'source',
            'STUDIO_SOURCE_REGISTRATION_INVALID',
          )
          const registeredSource =
            await journalAndValidateRegisteredSource(
              source,
              {
                organizationId: createdOrganizationId,
                projectId: createdProjectId,
                sizeBytes: pdf.sizeBytes,
                checksumSha256: pdf.checksumSha256,
              },
              runtime.recordResources,
              {
                readPipelineCalls: () => pipeline.calls(),
                readBudgetSourcePipelineCalls: () =>
                  runtime.budget.snapshot().sourcePipelineCalls,
              },
            )
          const nextSourceId = registeredSource.sourceId
          const nextStorageKey = registeredSource.storageKey
          sourceId = nextSourceId
          storageKey = nextStorageKey

          await pollSourceUntilTerminal(
            runtime,
            createdProjectId,
            nextSourceId,
          )
          await assertSingleDownloadGrant(
            runtime,
            createdProjectId,
            nextSourceId,
            {
              storageKey: nextStorageKey,
              sizeBytes: pdf.sizeBytes,
              checksumSha256: pdf.checksumSha256,
            },
          )
        },
      )
    },
  )

  const createdSourceId = requireValue<string>(
    sourceId,
    'STUDIO_SOURCE_NOT_AVAILABLE',
  )
  const createdStorageKey = requireValue<string>(
    storageKey,
    'STUDIO_SOURCE_NOT_AVAILABLE',
  )

  await runtime.runScenario(
    'studio.proposals',
    'STUDIO_PROPOSALS_FAILED',
    async () => {
      const proposalsResponse = await runtime.contextA.request.get(
        `/api/properties/${createdProjectId}/proposals?sourceId=${createdSourceId}`,
      )
      if (proposalsResponse.status() !== 200) {
        throw new Error('STUDIO_PROPOSAL_SET_INVALID')
      }
      const payload = await readJson(
        proposalsResponse,
        'STUDIO_PROPOSAL_SET_INVALID',
      )
      const candidates = readProposalCandidates(payload)
      const selected = selectTargetProposals(candidates)
      await journalSelectedProposalResources(
        runtime.recordResources,
        createdOrganizationId,
        selected,
      )
      if (selected.area.sourceId !== createdSourceId) {
        throw new Error('STUDIO_PROPOSAL_SCOPE_INVALID')
      }
      selectedProposals = selected

      await runtime.pageA.goto(
        `/nieruchomosci/${createdProjectId}/zrodla`,
      )
      const areaResult = await decideProposalFromUi({
        runtime,
        projectId: createdProjectId,
        proposal: selected.area,
        buttonName: 'Przyjmij nową',
        expectedStatus: 'accepted',
      })
      const acceptedArea =
        parseAcceptedAreaDecisionResponse(areaResult.payload, {
          proposalId: areaResult.id,
          factId: createdFactId,
          projectId: createdProjectId,
          subjectA: userASubject,
          sourceId: createdSourceId,
          jobId: selected.area.jobId,
          preAcceptVersion: requireValue<number>(
            restoredFactVersion,
            'STUDIO_FACT_READBACK_INVALID',
          ),
        })

      const priceResult = await decideProposalFromUi({
        runtime,
        projectId: createdProjectId,
        proposal: selected.price,
        buttonName: 'Odrzuć',
        expectedStatus: 'rejected',
      })
      parseRejectedPriceDecisionResponse(priceResult.payload, {
        proposalId: priceResult.id,
        sourceId: createdSourceId,
        jobId: selected.area.jobId,
      })
      const readbackResponse =
        await runtime.contextA.request.get(
          `/api/properties/${createdProjectId}/proposals?sourceId=${createdSourceId}`,
        )
      if (readbackResponse.status() !== 200) {
        throw new Error('STUDIO_PROPOSAL_READBACK_INVALID')
      }
      const readback = parseProposalDecisionReadback(
        await readJson(
          readbackResponse,
          'STUDIO_PROPOSAL_READBACK_INVALID',
        ),
        {
          acceptedId: areaResult.id,
          rejectedId: priceResult.id,
          sourceId: createdSourceId,
          jobId: selected.area.jobId,
        },
      )
      areaDecision = readback.accepted
      priceDecision = readback.rejected

      const factsReadback =
        await runtime.contextA.request.get(
          `/api/properties/${createdProjectId}/facts`,
        )
      if (factsReadback.status() !== 200) {
        throw new Error(
          'STUDIO_ACCEPTED_AREA_READBACK_INVALID',
        )
      }
      parseAcceptedAreaFactList(
        await readJson(
          factsReadback,
          'STUDIO_ACCEPTED_AREA_READBACK_INVALID',
        ),
        {
          factId: createdFactId,
          projectId: createdProjectId,
          subjectA: userASubject,
          sourceId: createdSourceId,
          version: acceptedArea.version,
        },
      )

      await runtime.pageA.goto(
        `/nieruchomosci/${createdProjectId}/braki`,
      )
      await expect(
        runtime.pageA.getByRole('heading', {
          name: 'Braki i konflikty',
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        runtime.pageA.getByRole('heading', {
          name: 'Brak otwartych kwestii',
          exact: true,
        }),
      ).toBeVisible()
    },
  )

  const finalSelected = requireValue<Task9SelectedProposals>(
    selectedProposals,
    'STUDIO_PROPOSALS_NOT_AVAILABLE',
  )
  const finalAreaDecision = requireValue<{
    id: string
    status: 'accepted'
  }>(
    areaDecision,
    'STUDIO_PROPOSALS_NOT_AVAILABLE',
  )
  const finalPriceDecision = requireValue<{
    id: string
    status: 'rejected'
  }>(
    priceDecision,
    'STUDIO_PROPOSALS_NOT_AVAILABLE',
  )
  if (
    finalSelected.area.id !== finalAreaDecision.id ||
    finalSelected.price.id !== finalPriceDecision.id
  ) {
    throw new Error('STUDIO_PROPOSALS_NOT_AVAILABLE')
  }

  await runtime.runScenario(
    'studio.history',
    'STUDIO_HISTORY_FAILED',
    async () => {
      await runtime.pageA.goto(
        `/nieruchomosci/${createdProjectId}/historia`,
      )
      for (const label of [
        'Utworzono teczkę',
        'Dodano fakt',
        'Zmieniono fakt',
        'Zarejestrowano źródło',
        'AI przygotowało propozycję',
        'Rozstrzygnięto propozycję',
      ]) {
        const count = await runtime.pageA
          .getByText(label, { exact: true })
          .count()
        if (count < 1) {
          throw new Error('STUDIO_HISTORY_ENTRY_MISSING')
        }
      }
    },
  )

  await runtime.runScenario(
    'isolation.cross-user',
    'ISOLATION_CROSS_USER_FAILED',
    async () => {
      const nextSubjectB = await getUserSubject(
        runtime.operatorContext,
        runtime.fixtures.userB,
      )
      if (!nextSubjectB) {
        throw new Error('STUDIO_USER_B_SUBJECT_MISSING')
      }

      const forbiddenIdentifiers = [
        runtime.fixtures.runId,
        title,
        createdProjectId,
        createdFactId,
        createdSourceId,
      ]
      for (const path of [
        `/api/properties/${createdProjectId}`,
        `/api/properties/${createdProjectId}/facts`,
        `/api/properties/${createdProjectId}/sources`,
      ]) {
        const response = await runtime.contextB.request.get(path)
        const summary = summarizeIsolationResponse(
          response.status(),
          await response.text(),
          forbiddenIdentifiers,
        )
        assertIsolationSummary(summary)
      }

      const navigation = await runtime.pageB.goto(
        `/nieruchomosci/${createdProjectId}`,
      )
      const visibleText =
        await runtime.pageB.locator('body').innerText()
      const workspaceVisible =
        (await runtime.pageB
          .getByRole('heading', { name: title, exact: true })
          .count()) > 0 ||
        (await runtime.pageB
          .locator('nav[aria-label="Sekcje teczki"]')
          .count()) > 0
      const uiSummary = summarizeUiIsolationResponse({
        status: navigation?.status() ?? null,
        visibleText,
        workspaceVisible,
        forbiddenIdentifiers,
      })
      assertUiIsolationSummary(uiSummary)
      subjectB = nextSubjectB
    },
  )

  return {
    title,
    organizationId: createdOrganizationId,
    projectId: createdProjectId,
    factId: createdFactId,
    sourceId: createdSourceId,
    jobId: finalSelected.area.jobId,
    storageKey: createdStorageKey,
    subjectA: userASubject,
    subjectB: requireValue<string>(
      subjectB,
      'STUDIO_USER_B_SUBJECT_MISSING',
    ),
    proposals: {
      area: finalAreaDecision,
      price: finalPriceDecision,
    },
  }
}

async function pollSourceUntilTerminal(
  runtime: Task9Runtime,
  projectId: string,
  sourceId: string,
): Promise<void> {
  const deadline = Date.now() + 7 * 60_000
  const intervals = [1_000, 2_000, 4_000, 8_000]
  let attempt = 0

  while (Date.now() < deadline) {
    const response = await runtime.contextA.request.get(
      `/api/properties/${projectId}/sources`,
    )
    if (response.status() !== 200) {
      throw new Error('STUDIO_SOURCE_LIST_INVALID')
    }
    const payload = await readJson(
      response,
      'STUDIO_SOURCE_LIST_INVALID',
    )
    const source = readSourceFromList(payload, sourceId)
    if (source !== null && terminalSourceStatuses.has(source)) {
      if (source === 'failed') {
        throw new Error('STUDIO_SOURCE_FAILED')
      }
      return
    }

    const interval =
      intervals[Math.min(attempt, intervals.length - 1)]!
    attempt += 1
    await waitForPollInterval(
      Math.min(interval, Math.max(0, deadline - Date.now())),
    )
  }

  throw new Error('STUDIO_SOURCE_POLL_TIMEOUT')
}

async function assertSingleDownloadGrant(
  runtime: Task9Runtime,
  projectId: string,
  sourceId: string,
  expected: {
    storageKey: string
    sizeBytes: number
    checksumSha256: string
  },
): Promise<void> {
  const response = await runtime.contextA.request.get(
    `/api/properties/${projectId}/sources/${sourceId}/download`,
  )
  if (response.status() !== 200) {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_INVALID')
  }
  const payload = await readJson(
    response,
    'STUDIO_SOURCE_DOWNLOAD_INVALID',
  )
  if (
    !isRecord(payload) ||
    typeof payload.url !== 'string' ||
    payload.url.trim().length === 0 ||
    typeof payload.expiresAt !== 'string'
  ) {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_INVALID')
  }
  const expiresAt = Date.parse(payload.expiresAt)
  const now = Date.now()
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    expiresAt - now > 65_000
  ) {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_INVALID')
  }
  parseSignedS3DownloadUrl(payload.url, {
    bucketName: runtime.operatorContext.resources.bucketName,
    region: runtime.operatorContext.region,
    storageKey: expected.storageKey,
  })

  let downloadResponse: APIResponse | null = null
  try {
    downloadResponse = await runtime.contextA.request.get(
      payload.url,
      { maxRedirects: 0 },
    )
    const headers = parsePdfDownloadHeaders(
      downloadResponse.status(),
      downloadResponse.headers(),
    )
    if (headers.contentLength !== expected.sizeBytes) {
      throw new Error('STUDIO_SOURCE_DOWNLOAD_INVALID')
    }
    const body = await downloadResponse.body()
    if (body.byteLength !== headers.contentLength) {
      throw new Error('STUDIO_SOURCE_DOWNLOAD_INVALID')
    }
    const summary = summarizeDownloadedPdf({
      status: downloadResponse.status(),
      contentType: headers.contentType,
      body,
      expectedSha256: expected.checksumSha256,
    })
    assertDownloadedPdfSummary(summary)
  } catch {
    throw new Error('STUDIO_SOURCE_DOWNLOAD_INVALID')
  } finally {
    if (downloadResponse !== null) {
      await downloadResponse.dispose().catch(() => {})
    }
  }
}

async function decideProposalFromUi<
  TStatus extends 'accepted' | 'rejected',
>(input: {
  runtime: Task9Runtime
  projectId: string
  proposal: Task9ProposalCandidate
  buttonName: 'Przyjmij nową' | 'Odrzuć'
  expectedStatus: TStatus
}): Promise<{
  id: string
  status: TStatus
  payload: unknown
}> {
  const { pageA } = input.runtime
  const item = pageA.locator('ol > li').filter({
    has: pageA.getByRole('heading', {
      name: input.proposal.label,
      exact: true,
    }),
  })
  await expect(item).toHaveCount(1)
  await expect(
    item.getByText(
      input.proposal.factKey === 'area.usable'
        ? '83.4'
        : '750000',
      { exact: false },
    ),
  ).toBeVisible()
  await expect(
    item.getByText('Strona 1', { exact: false }),
  ).toBeVisible()

  const decisionPath =
    `/api/properties/${input.projectId}/proposals/${input.proposal.id}/decision`
  const responsePromise = pageA.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === decisionPath,
  )
  await item
    .getByRole('button', {
      name: input.buttonName,
      exact: true,
    })
    .click()
  const response = await responsePromise
  if (response.status() !== 200) {
    throw new Error('STUDIO_PROPOSAL_DECISION_INVALID')
  }
  const payload = await readJson(
    response,
    'STUDIO_PROPOSAL_DECISION_INVALID',
  )
  const proposal = readNestedRecord(
    payload,
    'proposal',
    'STUDIO_PROPOSAL_DECISION_INVALID',
  )
  if (
    proposal.id !== input.proposal.id ||
    proposal.status !== input.expectedStatus
  ) {
    throw new Error('STUDIO_PROPOSAL_DECISION_INVALID')
  }
  return {
    id: input.proposal.id,
    status: input.expectedStatus,
    payload,
  }
}

function readProposalCandidates(
  payload: unknown,
): Task9ProposalCandidate[] {
  if (!isRecord(payload) || !Array.isArray(payload.proposals)) {
    throw new Error('STUDIO_PROPOSAL_SET_INVALID')
  }

  const candidates: Task9ProposalCandidate[] = []
  for (const value of payload.proposals) {
    if (!isRecord(value)) continue
    const isTarget =
      value.factKey === 'area.usable' ||
      value.factKey === 'price.asking'
    if (
      typeof value.id !== 'string' ||
      !uuidPattern.test(value.id) ||
      typeof value.factKey !== 'string' ||
      typeof value.sourceId !== 'string' ||
      !uuidPattern.test(value.sourceId) ||
      typeof value.jobId !== 'string' ||
      !uuidPattern.test(value.jobId) ||
      typeof value.valueType !== 'string' ||
      typeof value.status !== 'string' ||
      !proposalStatuses.has(
        value.status as Task9ProposalCandidate['status'],
      ) ||
      typeof value.label !== 'string'
    ) {
      if (isTarget) {
        throw new Error('STUDIO_PROPOSAL_SET_INVALID')
      }
      continue
    }
    candidates.push({
      id: value.id,
      factKey: value.factKey,
      sourceId: value.sourceId,
      jobId: value.jobId,
      valueType: value.valueType,
      status: value.status as Task9ProposalCandidate['status'],
      label: value.label,
      value: value.value,
    })
  }
  return candidates
}

function readSourceFromList(
  payload: unknown,
  sourceId: string,
): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.sources)) {
    throw new Error('STUDIO_SOURCE_LIST_INVALID')
  }
  const source = payload.sources.find(
    (candidate) =>
      isRecord(candidate) && candidate.id === sourceId,
  )
  if (source === undefined) return null
  if (
    !isRecord(source) ||
    typeof source.status !== 'string'
  ) {
    throw new Error('STUDIO_SOURCE_LIST_INVALID')
  }
  return source.status
}

async function readJson(
  response: { json(): Promise<unknown> },
  errorCode: string,
): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(errorCode)
  }
}

function readNestedRecord(
  payload: unknown,
  key: string,
  errorCode: string,
): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload[key])) {
    throw new Error(errorCode)
  }
  return payload[key]
}

function readUuid(value: unknown, errorCode: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error(errorCode)
  }
  return value
}

function readCleanupStorageKey(
  value: unknown,
  organizationId: string,
  errorCode: string,
): string {
  const prefix = `originals/organizations/${organizationId}/`
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 1024 ||
    !value.startsWith(prefix)
  ) {
    throw new Error(errorCode)
  }
  return value
}

function requireValue<T>(
  value: T | null,
  errorCode: string,
): T {
  if (value === null) throw new Error(errorCode)
  return value
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function waitForPollInterval(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

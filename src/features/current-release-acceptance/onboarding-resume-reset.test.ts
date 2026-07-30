import { describe, expect, it, vi } from 'vitest'
import {
  assertOnboardingResetEvidence,
  summarizeOnboardingArtifacts,
  verifyWizardResume,
} from '../../../e2e/current-release/onboarding-evidence'
import { runOnboardingResetScenario } from '../../../e2e/current-release/scenarios/onboarding-reset'
import { syntheticAnswer } from '../../../e2e/current-release/ui-helpers'
import { runAdminAccountScenarioFlow } from '../../../e2e/current-release/scenarios/admin-account-mobile'

describe('current release onboarding wizard resume evidence', () => {
  it('reloads at the next step, proves the saved answer, and resumes completion', async () => {
    const order: string[] = []
    const driver = {
      reload: vi.fn(async () => {
        order.push('reload')
      }),
      assertNextQuestion: vi.fn(async () => {
        order.push('next-question')
      }),
      goBack: vi.fn(async () => {
        order.push('back')
      }),
      assertSavedQuestion: vi.fn(async () => {
        order.push('saved-question')
      }),
      readSavedAnswer: vi.fn(async () => {
        order.push('read-answer')
        return 'synthetic answer'
      }),
      goForwardAndAwaitSave: vi.fn(async () => {
        order.push('forward')
      }),
    }

    await verifyWizardResume(driver, 'synthetic answer')

    expect(order).toEqual([
      'reload',
      'next-question',
      'back',
      'saved-question',
      'read-answer',
      'forward',
      'next-question',
    ])
  })

  it('fails closed when the answer was not restored', async () => {
    await expect(
      verifyWizardResume(
        {
          reload: async () => undefined,
          assertNextQuestion: async () => undefined,
          goBack: async () => undefined,
          assertSavedQuestion: async () => undefined,
          readSavedAnswer: async () => 'different answer',
          goForwardAndAwaitSave: async () => undefined,
        },
        'synthetic answer',
      ),
    ).rejects.toThrow('ONBOARDING_RESUME_ANSWER_MISMATCH')
  })
})

describe('current release onboarding reset evidence', () => {
  const completeArtifacts = {
    profil: { markdown: 'private profile contents' },
    personaBuyer: { markdown: 'private buyer contents' },
    personaSeller: { markdown: 'private seller contents' },
    onboarding: {
      currentStep: 'complete',
      expressAnswers: { q1: 'private answer' },
    },
  }

  it('summarizes artifacts without retaining profile or persona contents', () => {
    const summary = summarizeOnboardingArtifacts(completeArtifacts)

    expect(summary).toMatchObject({
      profilePresent: true,
      personasPresent: true,
      onboardingPresent: true,
    })
    expect(summary.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(summary)).not.toContain('private')
  })

  it('accepts only an empty A and byte-equivalent B artifacts after reset', () => {
    const beforeA = summarizeOnboardingArtifacts(completeArtifacts)
    const beforeB = summarizeOnboardingArtifacts({
      ...completeArtifacts,
      profil: { markdown: 'private profile B' },
    })
    const afterA = summarizeOnboardingArtifacts({
      profil: null,
      personaBuyer: null,
      personaSeller: null,
      onboarding: null,
    })
    const afterB = summarizeOnboardingArtifacts({
      ...completeArtifacts,
      profil: { markdown: 'private profile B' },
    })

    expect(() =>
      assertOnboardingResetEvidence({
        beforeA,
        beforeB,
        afterA,
        afterB,
      }),
    ).not.toThrow()
  })

  it('fails when B changed or any A onboarding artifact remains', () => {
    const before = summarizeOnboardingArtifacts(completeArtifacts)
    const empty = summarizeOnboardingArtifacts({
      profil: null,
      personaBuyer: null,
      personaSeller: null,
      onboarding: null,
    })

    expect(() =>
      assertOnboardingResetEvidence({
        beforeA: before,
        beforeB: before,
        afterA: {
          ...empty,
          onboardingPresent: true,
        },
        afterB: before,
      }),
    ).toThrow('ONBOARDING_RESET_A_NOT_CLEARED')

    expect(() =>
      assertOnboardingResetEvidence({
        beforeA: before,
        beforeB: before,
        afterA: empty,
        afterB: summarizeOnboardingArtifacts({
          ...completeArtifacts,
          profil: { markdown: 'changed B' },
        }),
      }),
    ).toThrow('ONBOARDING_RESET_B_CHANGED')

    expect(() =>
      assertOnboardingResetEvidence({
        beforeA: before,
        beforeB: before,
        afterA: summarizeOnboardingArtifacts({
          profil: null,
          personaBuyer: { markdown: 'leftover buyer' },
          personaSeller: null,
          onboarding: null,
        }),
        afterB: before,
      }),
    ).toThrow('ONBOARDING_RESET_A_NOT_CLEARED')
  })
})

describe('current release onboarding reset scenario', () => {
  it('exports both users, resets only A, proves B unchanged, and restores minimal A state without model calls', async () => {
    const calls: string[] = []
    const runId = 'syn-20260729T220000Z-deadbeef'
    const restoredAnswer = syntheticAnswer(runId, 0, 'a')
    const completeA = {
      profil: 'profile A',
      personaBuyer: 'buyer A',
      personaSeller: 'seller A',
      onboarding: { currentStep: 'complete' },
    }
    const completeB = {
      profil: 'profile B',
      personaBuyer: 'buyer B',
      personaSeller: 'seller B',
      onboarding: { currentStep: 'complete' },
    }
    const emptyA = {
      profil: null,
      personaBuyer: null,
      personaSeller: null,
      onboarding: null,
    }
    const readsA = [completeA, emptyA]
    const readsB = [completeB, completeB]
    const createContext = (
      role: 'a' | 'b',
      reads: unknown[],
    ) => ({
      request: {
        get: vi.fn(async (pathname: string) => {
          calls.push(`${role}:GET ${pathname}`)
          if (pathname === '/api/account/export') {
            return response(200, reads.shift())
          }
          if (
            role === 'a' &&
            pathname === '/api/onboarding/state'
          ) {
            return response(200, {
              state: {
                currentStep: 'express',
                expressAnswers: {
                  q1: restoredAnswer,
                },
                personaBuyer: { path: null, answers: {} },
                personaSeller: { path: null, answers: {} },
                deepAnswers: {},
              },
              hasProfilMd: false,
            })
          }
          return response(404, {})
        }),
        post: vi.fn(
          async (
            pathname: string,
            options?: { data?: unknown; headers?: unknown },
          ) => {
            calls.push(`${role}:POST ${pathname}`)
            if (pathname === '/api/onboarding/reset') {
              expect(options?.headers).toEqual({
                authorization: 'Bearer admin password',
              })
              return response(200, {
                ok: true,
                cleared: [
                  'onboarding',
                  'profil',
                  'persona-buyer',
                  'persona-seller',
                ],
                userId: 'subject-a',
              })
            }
            if (pathname === '/api/onboarding/save-answer') {
              expect(options?.data).toEqual({
                questionId: 'q1',
                answer: restoredAnswer,
              })
              return response(200, { ok: true })
            }
            return response(404, {})
          },
        ),
      },
    })
    const contextA = createContext('a', readsA)
    const contextB = createContext('b', readsB)

    await runOnboardingResetScenario({
      fixtures: {
        adminPassword: 'admin password',
        runId,
      },
      contextA,
      contextB,
      runScenario: async (
        name: string,
        errorCode: string,
        action: () => Promise<void>,
      ) => {
        expect(name).toBe('onboarding.reset')
        expect(errorCode).toBe('ONBOARDING_RESET_FAILED')
        await action()
      },
    } as never)

    expect(calls).toEqual([
      'a:GET /api/account/export',
      'b:GET /api/account/export',
      'a:POST /api/onboarding/reset',
      'a:GET /api/account/export',
      'b:GET /api/account/export',
      'a:POST /api/onboarding/save-answer',
      'a:GET /api/onboarding/state',
    ])
    expect(
      calls.some((call) =>
        /generate|agents\/run/.test(call),
      ),
    ).toBe(false)
  })
})

describe('current release post-Studio scenario order', () => {
  it('runs reset after full A export and mobile, immediately before deletion', async () => {
    const order: string[] = []

    const result = await runAdminAccountScenarioFlow({
      runAdminToggle: async () => {
        order.push('admin-toggle')
      },
      runAccountExport: async () => {
        order.push('account-export')
        return { observedPipelineCostUsd: 0.12 }
      },
      runOnboardingReset: async () => {
        order.push('onboarding-reset')
      },
      runMobile: async () => {
        order.push('mobile')
      },
      runAccountDelete: async () => {
        order.push('account-delete')
      },
    })

    expect(order).toEqual([
      'admin-toggle',
      'account-export',
      'mobile',
      'onboarding-reset',
      'account-delete',
    ])
    expect(result).toEqual({ observedPipelineCostUsd: 0.12 })
  })
})

function response(status: number, payload: unknown) {
  return {
    status: () => status,
    json: async () => payload,
  }
}

import { describe, expect, it } from 'vitest'
import {
  enableAccountPublicAccessBlock,
  type AwsCliRunner,
} from './account-public-access-block'

type Response = string | Error

function fakeCli(
  responses: Record<string, Response | Response[]>,
): AwsCliRunner & { calls: string[][] } {
  const calls: string[][] = []
  const queues = new Map(
    Object.entries(responses).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : [value],
    ]),
  )

  return {
    calls,
    run(args) {
      calls.push(args)
      const key = args.slice(0, 2).join(' ')
      const response = queues.get(key)?.shift()
      if (response === undefined) {
        throw new Error(`Unexpected AWS CLI call: ${args.join(' ')}`)
      }
      if (response instanceof Error) {
        throw response
      }
      return response
    },
  }
}

const allBlocked = {
  BlockPublicAcls: true,
  IgnorePublicAcls: true,
  BlockPublicPolicy: true,
  RestrictPublicBuckets: true,
}

describe('enableAccountPublicAccessBlock', () => {
  it('stops before write when the caller account differs', () => {
    const cli = fakeCli({
      'sts get-caller-identity': JSON.stringify({
        Account: '111122223333',
      }),
    })

    expect(() => enableAccountPublicAccessBlock(cli)).toThrow(
      'Refusing account 111122223333',
    )
    expect(
      cli.calls.some((call) =>
        call.includes('put-public-access-block'),
      ),
    ).toBe(false)
  })

  it('stops before any AWS call when the region differs', () => {
    const cli = fakeCli({})

    expect(() =>
      enableAccountPublicAccessBlock(cli, {
        region: 'us-east-1',
      }),
    ).toThrow('Refusing region us-east-1')
    expect(cli.calls).toEqual([])
  })

  it('enables and verifies all four account-level blocks', () => {
    const cli = fakeCli({
      'sts get-caller-identity': JSON.stringify({
        Account: '261965598943',
      }),
      's3control get-public-access-block': [
        new Error('NoSuchPublicAccessBlockConfiguration'),
        JSON.stringify({
          PublicAccessBlockConfiguration: allBlocked,
        }),
      ],
      's3control put-public-access-block': '',
    })

    expect(enableAccountPublicAccessBlock(cli)).toEqual(allBlocked)
    expect(cli.calls).toContainEqual(
      expect.arrayContaining([
        's3control',
        'put-public-access-block',
        '--account-id',
        '261965598943',
      ]),
    )
  })

  it('fails when the post-write state is incomplete', () => {
    const cli = fakeCli({
      'sts get-caller-identity': JSON.stringify({
        Account: '261965598943',
      }),
      's3control get-public-access-block': [
        JSON.stringify({
          PublicAccessBlockConfiguration: {
            ...allBlocked,
            RestrictPublicBuckets: false,
          },
        }),
        JSON.stringify({
          PublicAccessBlockConfiguration: {
            ...allBlocked,
            RestrictPublicBuckets: false,
          },
        }),
      ],
      's3control put-public-access-block': '',
    })

    expect(() => enableAccountPublicAccessBlock(cli)).toThrow(
      'Account public access block verification failed',
    )
  })
})

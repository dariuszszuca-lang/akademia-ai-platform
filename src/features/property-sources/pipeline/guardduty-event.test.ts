import { describe, expect, it } from 'vitest'
import {
  createGuardDutyExecutionName,
  guardDutyObjectScanEventSchema,
  parsePropertySourceObjectKey,
  routeGuardDutyObjectScan,
} from './guardduty-event'
import {
  guardDutyScanResultStatuses,
  guardDutyScanFixture,
} from './guardduty-event.fixtures'

const selectedBucket = 'property-studio-dev-sources'

describe('GuardDuty property source scan contract', () => {
  it.each(guardDutyScanResultStatuses)(
    'parses the official %s result shape',
    (status) => {
      const fixture = guardDutyScanFixture(status)

      expect(guardDutyObjectScanEventSchema.parse(fixture)).toMatchObject({
        source: 'aws.guardduty',
        'detail-type': 'GuardDuty Malware Protection Object Scan Result',
        detail: {
          resourceType: 'S3_OBJECT',
          scanResultDetails: { scanResultStatus: status },
        },
      })
    },
  )

  it('starts extraction only for a clean selected object', () => {
    const event = guardDutyScanFixture('NO_THREATS_FOUND')

    expect(routeGuardDutyObjectScan(event, selectedBucket)).toEqual({
      action: 'start',
      bucketName: selectedBucket,
      objectKey:
        'originals/organizations/00000000-0000-4000-8000-000000000001/properties/00000000-0000-4000-8000-000000000002/sources/00000000-0000-4000-8000-000000000003/original',
      versionId: 'source-version-1',
      sourceId: '00000000-0000-4000-8000-000000000003',
      scanResultStatus: 'NO_THREATS_FOUND',
      executionName:
        'source-3464207aa3faebd1c96902c9638b2d6ca58bbe8e363afe3881a652d2bd80d275',
    })
  })

  it.each(
    guardDutyScanResultStatuses.filter(
      (status) => status !== 'NO_THREATS_FOUND',
    ),
  )('never starts extraction for %s', (status) => {
    expect(routeGuardDutyObjectScan(
      guardDutyScanFixture(status),
      selectedBucket,
    )).toMatchObject({
      action: 'do_not_process',
      scanResultStatus: status,
    })
  })

  it('rejects a clean event for any other bucket or key prefix', () => {
    const wrongBucket = guardDutyScanFixture('NO_THREATS_FOUND')
    wrongBucket.detail.s3ObjectDetails.bucketName = 'attacker-bucket'
    const wrongPrefix = guardDutyScanFixture('NO_THREATS_FOUND')
    wrongPrefix.detail.s3ObjectDetails.objectKey =
      'work/organizations/00000000-0000-4000-8000-000000000001/properties/00000000-0000-4000-8000-000000000002/sources/00000000-0000-4000-8000-000000000003/original'

    expect(() =>
      routeGuardDutyObjectScan(wrongBucket, selectedBucket),
    ).toThrow('UNEXPECTED_SCAN_BUCKET')
    expect(() =>
      routeGuardDutyObjectScan(wrongPrefix, selectedBucket),
    ).toThrow('UNEXPECTED_SCAN_OBJECT_KEY')
  })

  it('rejects an inconsistent clean result that was not completed', () => {
    const event = guardDutyScanFixture('NO_THREATS_FOUND')
    event.detail.scanStatus = 'FAILED'

    expect(() =>
      routeGuardDutyObjectScan(event, selectedBucket),
    ).toThrow()
  })

  it('extracts only a UUID source ID from the exact opaque key shape', () => {
    expect(
      parsePropertySourceObjectKey(
        'originals/organizations/00000000-0000-4000-8000-000000000001/properties/00000000-0000-4000-8000-000000000002/sources/00000000-0000-4000-8000-000000000003/original',
      ),
    ).toEqual({
      organizationId: '00000000-0000-4000-8000-000000000001',
      propertyProjectId: '00000000-0000-4000-8000-000000000002',
      sourceId: '00000000-0000-4000-8000-000000000003',
    })

    expect(() =>
      parsePropertySourceObjectKey(
        'originals/organizations/org/properties/property/sources/../../secret',
      ),
    ).toThrow('UNEXPECTED_SCAN_OBJECT_KEY')
  })

  it('gives duplicate delivery one deterministic Step Functions name', () => {
    const event = guardDutyScanFixture('NO_THREATS_FOUND')
    const duplicate = structuredClone(event)
    duplicate.id = 'different-event-delivery-id'

    const first = routeGuardDutyObjectScan(event, selectedBucket)
    const second = routeGuardDutyObjectScan(duplicate, selectedBucket)

    expect(first.executionName).toBe(second.executionName)
    expect(first.executionName).toHaveLength(71)
    expect(first.executionName).toMatch(/^source-[a-f0-9]{64}$/)
  })

  it('changes execution identity when object version or result changes', () => {
    const clean = guardDutyScanFixture('NO_THREATS_FOUND')
    const changedVersion = guardDutyScanFixture('NO_THREATS_FOUND')
    changedVersion.detail.s3ObjectDetails.versionId = 'source-version-2'
    const threat = guardDutyScanFixture('THREATS_FOUND')

    const cleanName = createGuardDutyExecutionName(
      guardDutyObjectScanEventSchema.parse(clean),
    )
    expect(
      createGuardDutyExecutionName(
        guardDutyObjectScanEventSchema.parse(changedVersion),
      ),
    ).not.toBe(cleanName)
    expect(
      createGuardDutyExecutionName(
        guardDutyObjectScanEventSchema.parse(threat),
      ),
    ).not.toBe(cleanName)
  })
})

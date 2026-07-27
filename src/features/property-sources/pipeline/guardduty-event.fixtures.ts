import {
  guardDutyScanResultStatuses,
  type GuardDutyScanResultStatus,
} from './guardduty-event'

export { guardDutyScanResultStatuses }

export function guardDutyScanFixture(status: GuardDutyScanResultStatus) {
  const scanStatus =
    status === 'UNSUPPORTED' || status === 'ACCESS_DENIED'
      ? 'SKIPPED'
      : status === 'FAILED'
        ? 'FAILED'
        : 'COMPLETED'

  return {
    version: '0',
    id: '72c7d362-737a-6dce-fc78-9e27a0171419',
    'detail-type': 'GuardDuty Malware Protection Object Scan Result',
    source: 'aws.guardduty',
    account: '111122223333',
    time: '2026-07-27T12:00:00Z',
    region: 'eu-central-1',
    resources: [
      'arn:aws:guardduty:eu-central-1:111122223333:malware-protection-plan/example',
    ],
    detail: {
      schemaVersion: '1.0',
      scanStatus,
      resourceType: 'S3_OBJECT',
      s3ObjectDetails: {
        bucketName: 'property-studio-dev-sources',
        objectKey:
          'originals/organizations/00000000-0000-4000-8000-000000000001/properties/00000000-0000-4000-8000-000000000002/sources/00000000-0000-4000-8000-000000000003/original',
        eTag: 'fixture-etag',
        versionId: 'source-version-1',
        s3Throttled: false,
      },
      scanResultDetails: {
        scanResultStatus: status,
        threats:
          status === 'THREATS_FOUND'
            ? [
                {
                  name: 'fixture-threat',
                  source: 'AMAZON',
                  itemDetails: [],
                },
              ]
            : null,
        statusReasons:
          status === 'UNSUPPORTED'
            ? ['PASSWORD_PROTECTED']
            : status === 'ACCESS_DENIED'
              ? ['SSE_C_ENCRYPTED_OBJECT']
              : null,
      },
    },
  }
}
